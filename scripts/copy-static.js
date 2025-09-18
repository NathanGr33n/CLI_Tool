#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');

async function copyStaticFiles() {
  try {
    // Ensure dist/renderer directory exists
    await fs.ensureDir('dist/renderer');
    
    // Copy HTML files
    await fs.copy('src/renderer/index.html', 'dist/renderer/index.html');
    console.log('✓ Copied index.html');
    
    await fs.copy('src/renderer/welcome-screen.html', 'dist/renderer/welcome-screen.html');
    console.log('✓ Copied welcome-screen.html');
    
    // Copy CSS files
    await fs.copy('src/renderer/styles.css', 'dist/renderer/styles.css');
    console.log('✓ Copied styles.css');
    
    // Copy xterm.css from node_modules
    await fs.copy('node_modules/@xterm/xterm/css/xterm.css', 'dist/renderer/xterm.css');
    console.log('✓ Copied xterm.css');
    
    // Copy welcome screen JavaScript
    await fs.copy('src/renderer/welcome.js', 'dist/renderer/welcome.js');
    console.log('✓ Copied welcome.js');
    
    // Copy status bar controller
    await fs.copy('src/renderer/bottom-status-controller.js', 'dist/renderer/bottom-status-controller.js');
    console.log('✓ Copied bottom-status-controller.js');
    
    // Copy debug test script
    await fs.copy('src/renderer/debug-test.js', 'dist/renderer/debug-test.js');
    console.log('✓ Copied debug-test.js');
    
    // The JavaScript files should already be compiled by tsc, but let's make sure
    // If the compiled app.js doesn't exist, we can't copy from src since it's TypeScript
    const appJsExists = await fs.pathExists('dist/renderer/app.js');
    if (appJsExists) {
      console.log('✓ app.js already compiled by TypeScript');
    } else {
      console.log('⚠️  app.js not found - make sure to run tsc first');
    }
    
    console.log('Static files copied successfully!');
  } catch (error) {
    console.error('Error copying static files:', error);
    process.exit(1);
  }
}

copyStaticFiles();
