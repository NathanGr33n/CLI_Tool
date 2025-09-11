#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Launching CLI Agent GUI (Clean Mode)...');

// Launch with optimized flags for stability
const electronProcess = spawn('npx', ['electron', 'dist/electron/main.js'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  cwd: process.cwd(),
  shell: true,
  env: {
    ...process.env,
    // Suppress Electron warnings
    ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    // Force software rendering
    LIBGL_ALWAYS_SOFTWARE: '1'
  }
});

let hasErrors = false;

// Filter and display only important output
electronProcess.stdout.on('data', (data) => {
  const output = data.toString();
  
  // Skip GPU-related errors and warnings
  if (output.includes('GPU process') || 
      output.includes('gpu_process_host') ||
      output.includes('ContextResult::kTransientFailure') ||
      output.includes('vector[] index out of bounds')) {
    return;
  }
  
  // Show important information
  if (output.includes('System information') ||
      output.includes('Auto-disabling') ||
      output.includes('Configuring GPU') ||
      output.includes('✓') ||
      output.includes('❌') ||
      output.includes('⚠️')) {
    process.stdout.write(output);
  }
});

electronProcess.stderr.on('data', (data) => {
  const error = data.toString();
  
  // Filter out known harmless GPU errors
  if (error.includes('GPU process exited') ||
      error.includes('gpu_process_host.cc') ||
      error.includes('ContextResult::kTransientFailure') ||
      error.includes('vector[] index out of bounds') ||
      error.includes('gpu-process-crashed event') ||
      error.includes('libc++')) {
    // These are harmless on Windows - app continues with software rendering
    return;
  }
  
  // Show other errors that might be important
  if (error.trim()) {
    hasErrors = true;
    console.error('⚠️  ', error.trim());
  }
});

electronProcess.on('close', (code) => {
  if (code === 0) {
    console.log('\n✨ GUI application closed successfully!');
  } else {
    console.log(`\n❌ GUI application exited with code: ${code}`);
    if (hasErrors) {
      console.log('📋 Check the errors above for troubleshooting.');
    }
  }
});

electronProcess.on('error', (error) => {
  console.error('❌ Error launching GUI:', error.message);
  
  if (error.code === 'ENOENT') {
    console.log('\n💡 Solutions:');
    console.log('1. Make sure Electron is installed: npm install');
    console.log('2. Try building first: npm run build');
    console.log('3. Use the direct command: npx electron dist/electron/main.js');
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down GUI application...');
  electronProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Terminating GUI application...');
  electronProcess.kill('SIGTERM');
});
