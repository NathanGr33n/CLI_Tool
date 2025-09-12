#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching CLI Agent GUI in AI Test mode...');
console.log('📝 This will test the AI agent interaction functionality.');
console.log('🔐 Press Ctrl+C in this terminal to close the app when done testing.');

// System information
const systemInfo = {
  platform: process.platform,
  arch: process.arch,
  nodeVersion: process.version,
  totalMemory: `${Math.round(require('os').totalmem() / 1024 / 1024 / 1024)} GB`,
  freeMemory: `${Math.round(require('os').freemem() / 1024 / 1024 / 1024)} GB`
};

console.log('\nSystem information:', systemInfo);

// Force GPU settings for better compatibility
console.log('Configuring for AI test mode...');

// Path to the compiled electron app
const electronPath = path.join(__dirname, '..', 'dist', 'electron', 'main.js');

// Spawn electron with test-ai flag
const isWindows = process.platform === 'win32';
const electronCmd = isWindows ? 'npx.cmd' : 'npx';
const electronProcess = spawn(electronCmd, ['electron', electronPath, '--test-ai'], {
  stdio: 'inherit',
  cwd: path.join(__dirname, '..'),
  env: {
    ...process.env,
    // Add environment variables for debugging
    DEBUG: 'true',
    NODE_ENV: 'development'
  },
  shell: true // Use shell to resolve npx on Windows
});

electronProcess.on('close', (code) => {
  console.log(`\n✨ AI Test application closed with code: ${code}`);
});

electronProcess.on('error', (error) => {
  console.error('❌ Failed to launch electron:', error);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Terminating AI test...');
  electronProcess.kill('SIGINT');
  process.exit(0);
});
