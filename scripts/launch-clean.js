#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🧹 Launching CLI Agent GUI with clean cache...');
console.log('📝 This will clear any cached files and start fresh.');

// Clear any potential cache
const distPath = path.join(__dirname, '..', 'dist');
console.log('🔧 Ensuring fresh build files...');

// Launch electron with cache cleared
const electronPath = path.join(__dirname, '..', 'node_modules', '.bin', 'electron.cmd');
const mainPath = path.join(distPath, 'electron', 'main.js');

console.log('🚀 Starting Electron with clean cache...');
console.log('📄 Main path:', mainPath);

const electronArgs = [
  '--no-sandbox',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--force-gpu-mem-available-mb=512',
  '--max_old_space_size=4096',
  '--clear-cache',
  mainPath
];

console.log('⚡ Electron args:', electronArgs);

const electronProcess = spawn(electronPath, electronArgs, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development'
  }
});

electronProcess.on('close', (code) => {
  console.log(`\n✨ GUI application closed with code: ${code}`);
});

electronProcess.on('error', (error) => {
  console.error('❌ Failed to start Electron:', error);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, shutting down...');
  electronProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  electronProcess.kill();
  process.exit(0);
});
