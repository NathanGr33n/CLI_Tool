#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching CLI Agent GUI...');
console.log('📁 Working directory:', process.cwd());
console.log('📄 Main file:', path.resolve('dist/electron/main.js'));

const electronProcess = spawn('npx', ['electron', 'dist/electron/main.js'], {
  stdio: 'inherit',
  cwd: process.cwd(),
  shell: true
});

electronProcess.on('close', (code) => {
  console.log(`\n✨ GUI application closed with exit code: ${code}`);
});

electronProcess.on('error', (error) => {
  console.error('❌ Error launching GUI:', error);
});
