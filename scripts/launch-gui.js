#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting CLI Agent GUI...\n');

const mainPath = path.join(__dirname, '..', 'dist', 'electron', 'main.js');

// Check if build exists
if (!fs.existsSync(mainPath)) {
  console.error('❌ Build not found!');
  console.error('💡 Run this first: npm run build');
  process.exit(1);
}

// Environment setup for stability
const env = {
  ...process.env,
  NODE_ENV: 'development',
  ELECTRON_ENABLE_LOGGING: '1',
  ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
};

// Electron arguments for Windows compatibility and stability
const electronArgs = [
  'electron',
  mainPath,
  '--prevent-auto-close',        // Custom flag for close prevention
  '--disable-gpu-sandbox',       // Windows GPU compatibility
  '--no-sandbox',               // Disable sandboxing for stability
  '--disable-web-security',     // Allow local file access
  '--disable-dev-shm-usage'     // Prevent shared memory issues
];

console.log('📄 Main script:', mainPath);
console.log('⚡ Starting Electron...\n');

const electronProcess = spawn('npx', electronArgs, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: env,
  shell: true
});

// Handle output
electronProcess.stdout.on('data', (data) => {
  const output = data.toString();
  const lines = output.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (line.trim()) {
      console.log('[GUI]', line);
    }
  });
});

// Handle errors
electronProcess.stderr.on('data', (data) => {
  const output = data.toString();
  // Filter out harmless warnings
  if (!output.includes('GPU process') && !output.includes('libva error')) {
    const lines = output.split('\n').filter(line => line.trim());
    lines.forEach(line => {
      if (line.trim()) {
        console.error('[GUI-ERR]', line);
      }
    });
  }
});

// Handle process exit
electronProcess.on('exit', (code, signal) => {
  console.log('\n✅ GUI closed');
  if (code !== 0) {
    console.log(`Exit code: ${code}, Signal: ${signal}`);
  }
  process.exit(code || 0);
});

// Handle startup errors
electronProcess.on('error', (error) => {
  console.error('❌ Failed to start GUI:', error.message);
  console.error('💡 Make sure you ran: npm run build');
  console.error('💡 And that Electron is installed: npm install');
  process.exit(1);
});

// Handle shutdown signals
const cleanup = (signal) => {
  console.log(`\n🛑 Shutting down GUI (${signal})...`);
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGTERM');
  }
  setTimeout(() => process.exit(0), 1000);
};

process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));

// Windows specific
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => cleanup('SIGBREAK'));
}

console.log('✅ GUI launcher started');
console.log('💡 Use Ctrl+C to close, or Ctrl+Q in the GUI window\n');
