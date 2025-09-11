#!/usr/bin/env node

const os = require('os');
const { spawn } = require('child_process');

console.log('🔍 GPU Diagnostics Tool for CLI Agent GUI\n');

function getSystemInfo() {
  const info = {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || 'Unknown',
    totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
    freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB',
    osVersion: os.release(),
    hostname: os.hostname()
  };

  console.log('📊 System Information:');
  Object.entries(info).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log('');

  return info;
}

function checkForVirtualMachine(info) {
  const isVM = info.cpuModel.includes('Virtual') || 
               info.cpuModel.includes('QEMU') ||
               info.cpuModel.includes('VMware') ||
               info.hostname.includes('VM');

  console.log('🖥️  Virtual Machine Detection:');
  console.log(`  Running in VM: ${isVM ? 'Yes' : 'No'}`);
  if (isVM) {
    console.log('  ⚠️  Hardware acceleration should be disabled in VMs');
  }
  console.log('');

  return isVM;
}

function checkMemory(info) {
  const totalGB = parseInt(info.totalMemory);
  const freeGB = parseInt(info.freeMemory);
  const isLowMemory = totalGB < 4;

  console.log('💾 Memory Analysis:');
  console.log(`  Total Memory: ${info.totalMemory}`);
  console.log(`  Available Memory: ${info.freeMemory}`);
  console.log(`  Low Memory System: ${isLowMemory ? 'Yes' : 'No'}`);
  if (isLowMemory) {
    console.log('  ⚠️  Consider disabling hardware acceleration on low-memory systems');
  }
  console.log('');

  return { isLowMemory, totalGB, freeGB };
}

function recommendGPUSettings(isVM, memoryInfo) {
  console.log('💡 GPU Configuration Recommendations:');
  
  const shouldDisableHardwareAccel = isVM || memoryInfo.isLowMemory || process.platform === 'win32';
  
  console.log(`  Disable Hardware Acceleration: ${shouldDisableHardwareAccel ? 'Yes' : 'No'}`);
  console.log(`  Use Software Rendering: ${shouldDisableHardwareAccel ? 'Yes' : 'No'}`);
  console.log(`  Disable GPU Sandbox: ${process.platform === 'win32' ? 'Yes' : 'No'}`);
  
  if (shouldDisableHardwareAccel) {
    console.log('\n📝 Recommended Electron flags:');
    console.log('  --disable-gpu');
    console.log('  --disable-gpu-sandbox');
    console.log('  --enable-software-rendering');
    console.log('  --no-sandbox (Windows only)');
  }
  console.log('');
}

async function testElectronLaunch() {
  console.log('🚀 Testing Electron Launch...');
  
  return new Promise((resolve) => {
    const testProcess = spawn('npx', ['electron', '--version'], {
      shell: true,
      stdio: 'pipe'
    });

    let output = '';
    let error = '';

    testProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    testProcess.stderr.on('data', (data) => {
      error += data.toString();
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        console.log(`  ✅ Electron version: ${output.trim()}`);
      } else {
        console.log(`  ❌ Electron test failed with code ${code}`);
        if (error) {
          console.log(`  Error: ${error.trim()}`);
        }
      }
      console.log('');
      resolve(code === 0);
    });

    testProcess.on('error', (err) => {
      console.log(`  ❌ Failed to run Electron: ${err.message}`);
      console.log('');
      resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      testProcess.kill();
      console.log('  ⏰ Electron test timed out');
      console.log('');
      resolve(false);
    }, 10000);
  });
}

function showTroubleshootingTips() {
  console.log('🛠️  Troubleshooting Tips:');
  console.log('');
  console.log('1. If you see GPU process errors:');
  console.log('   - These are usually warnings and don\'t affect functionality');
  console.log('   - The app automatically disables hardware acceleration on Windows');
  console.log('');
  console.log('2. If the app won\'t start:');
  console.log('   - Make sure you\'ve run: npm run build');
  console.log('   - Try: npm run copy-static');
  console.log('   - Check if Electron is installed: npm list electron');
  console.log('');
  console.log('3. Performance issues:');
  console.log('   - Close other applications to free memory');
  console.log('   - Restart your computer');
  console.log('   - Update graphics drivers');
  console.log('');
  console.log('4. For debugging:');
  console.log('   - Launch with: npm run start:gui');
  console.log('   - Press F12 in the app to open DevTools');
  console.log('   - Check console for errors');
  console.log('');
}

async function runDiagnostics() {
  const systemInfo = getSystemInfo();
  const isVM = checkForVirtualMachine(systemInfo);
  const memoryInfo = checkMemory(systemInfo);
  
  recommendGPUSettings(isVM, memoryInfo);
  
  const electronOk = await testElectronLaunch();
  
  if (!electronOk) {
    console.log('⚠️  Electron test failed - you may need to install dependencies:');
    console.log('   npm install');
    console.log('');
  }

  showTroubleshootingTips();
}

// Run diagnostics
runDiagnostics().catch(console.error);
