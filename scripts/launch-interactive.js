#!/usr/bin/env node

const { spawn } = require('child_process');

console.log('🚀 Launching CLI Agent GUI in interactive mode...');
console.log('📝 The app window should open and stay open for interaction.');
console.log('🔐 Press Ctrl+C in this terminal to close the app when you\'re done testing.\n');

// Launch electron with proper stdio inheritance
const electronProcess = spawn('npx', ['electron', 'dist/electron/main.js'], {
  stdio: 'inherit', // This will show all output in the terminal
  cwd: process.cwd(),
  shell: true
});

// Handle process events
electronProcess.on('close', (code) => {
  console.log(`\n✨ GUI application closed with code: ${code}`);
  process.exit(code);
});

electronProcess.on('error', (error) => {
  console.error('❌ Error launching GUI:', error.message);
  process.exit(1);
});

// Handle Ctrl+C to cleanly shut down
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down GUI application...');
  electronProcess.kill('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating GUI application...');
  electronProcess.kill('SIGTERM');
  process.exit(0);
});
