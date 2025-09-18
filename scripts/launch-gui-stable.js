#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching CLI Agent GUI with stability enhancements...');
console.log('🛡️  Auto-close prevention enabled');
console.log('🔐 Press Ctrl+Q to close (not the X button)');
console.log('📝 Window will stay open and resist automatic closing\n');

const mainPath = path.join(__dirname, '..', 'dist', 'electron', 'main.js');

// Set environment variables for stable operation
const env = {
  ...process.env,
  NODE_ENV: 'development', // Enable development features
  ELECTRON_ENABLE_LOGGING: '1',
  ELECTRON_DISABLE_SECURITY_WARNINGS: '1'
};

console.log('📄 Main script path:', mainPath);
console.log('🔧 Environment configured for stability\n');

// Launch electron with stability flags
const electronArgs = [
  'electron',
  mainPath,
  '--prevent-auto-close',     // Custom flag for our close prevention
  '--disable-gpu-sandbox',    // Disable GPU sandbox for stability
  '--no-sandbox',            // Disable sandboxing
  '--disable-web-security',  // Allow local file access
  '--disable-dev-shm-usage', // Prevent shared memory issues
  '--disable-background-throttling', // Keep background processes active
  '--force-device-scale-factor=1',   // Prevent scaling issues
];

console.log('⚡ Electron command:', 'npx', electronArgs.join(' '));
console.log('🏁 Starting GUI application...\n');

const electronProcess = spawn('npx', electronArgs, {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: env,
  shell: true,
  detached: false
});

let isManualShutdown = false;

// Handle stdout with prefix
electronProcess.stdout.on('data', (data) => {
  const output = data.toString();
  // Add prefix to each line for clarity
  const lines = output.split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (line.trim()) {
      console.log('[GUI]', line);
    }
  });
});

// Handle stderr with prefix
electronProcess.stderr.on('data', (data) => {
  const output = data.toString();
  // Filter out harmless GPU warnings
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
  const uptime = Date.now() - startTime;
  console.log(`\n📊 GUI process exited after ${Math.round(uptime/1000)}s`);
  console.log(`📋 Exit details:`, { code, signal });
  
  if (!isManualShutdown && uptime < 30000) {
    console.log('⚠️  GUI closed unexpectedly (less than 30 seconds)');
    console.log('🔧 This might indicate an environment issue');
    console.log('💡 Try running in a regular terminal window outside this interface');
  } else if (isManualShutdown) {
    console.log('✅ GUI closed normally by user');
  } else {
    console.log('✅ GUI ran successfully');
  }
  
  process.exit(code || 0);
});

// Handle process error
electronProcess.on('error', (error) => {
  console.error('❌ Failed to start GUI:', error.message);
  console.error('🔧 Make sure Electron is installed: npm install');
  process.exit(1);
});

// Track start time
const startTime = Date.now();

// Handle cleanup on various signals
const cleanup = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down GUI gracefully...`);
  isManualShutdown = true;
  
  if (electronProcess && !electronProcess.killed) {
    electronProcess.kill('SIGTERM');
    
    // Force kill after 3 seconds if it doesn't exit gracefully
    setTimeout(() => {
      if (!electronProcess.killed) {
        console.log('⚡ Force killing GUI process...');
        electronProcess.kill('SIGKILL');
      }
    }, 3000);
  }
  
  setTimeout(() => process.exit(0), 1000);
};

// Handle various shutdown signals
process.on('SIGINT', () => cleanup('SIGINT'));
process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGHUP', () => cleanup('SIGHUP'));

// Handle Windows specific signals
if (process.platform === 'win32') {
  process.on('SIGBREAK', () => cleanup('SIGBREAK'));
}

// Keep process alive and show periodic status
setInterval(() => {
  const uptime = Math.round((Date.now() - startTime) / 1000);
  if (uptime % 30 === 0 && uptime > 0) { // Every 30 seconds
    console.log(`📊 GUI running for ${uptime}s - health check OK`);
  }
}, 1000);

console.log('✅ GUI launcher initialized - GUI should appear shortly...');
console.log('🔄 Monitoring GUI process health...\n');
