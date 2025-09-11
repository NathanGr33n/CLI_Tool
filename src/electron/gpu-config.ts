import { app } from 'electron';
import * as os from 'os';

export interface GPUConfig {
  hardwareAcceleration: boolean;
  softwareRendering: boolean;
  gpuSandbox: boolean;
}

export class GPUManager {
  private static isConfigured = false;

  /**
   * Configure GPU settings based on system capabilities and user preferences
   */
  static configure(options: Partial<GPUConfig> = {}): void {
    if (this.isConfigured) {
      console.warn('GPU configuration has already been applied');
      return;
    }

    const config: GPUConfig = {
      hardwareAcceleration: false, // Default to false for stability
      softwareRendering: true,
      gpuSandbox: false,
      ...options
    };

    console.log('Configuring GPU settings:', config);

    // Apply command line switches before app is ready
    if (!config.hardwareAcceleration) {
      // Core GPU disabling flags
      app.commandLine.appendSwitch('--disable-gpu');
      app.commandLine.appendSwitch('--disable-gpu-sandbox');
      app.commandLine.appendSwitch('--disable-software-rasterizer');
      
      // Disable GPU processes and features
      app.commandLine.appendSwitch('--disable-gpu-memory-buffer-video-frames');
      app.commandLine.appendSwitch('--disable-gpu-rasterization');
      app.commandLine.appendSwitch('--disable-gpu-memory-buffer-compositor-resources');
      app.commandLine.appendSwitch('--disable-gpu-process-crash-limit');
      
      // Disable background processes
      app.commandLine.appendSwitch('--disable-background-timer-throttling');
      app.commandLine.appendSwitch('--disable-backgrounding-occluded-windows');
      app.commandLine.appendSwitch('--disable-background-media-suspend');
      
      // Disable compositor features
      app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor,VizHitTestSurfaceLayer');
      
      // Force CPU-based rendering
      app.commandLine.appendSwitch('--use-gl=desktop');
      app.commandLine.appendSwitch('--enable-software-compositing');
      
      // Disable hardware video decoding
      app.commandLine.appendSwitch('--disable-accelerated-video-decode');
      app.commandLine.appendSwitch('--disable-accelerated-video-encode');
    }

    if (config.softwareRendering) {
      app.commandLine.appendSwitch('--enable-software-rendering');
    }

    // Windows-specific fixes
    if (process.platform === 'win32') {
      app.commandLine.appendSwitch('--no-sandbox');
      app.commandLine.appendSwitch('--disable-dev-shm-usage');
      
      // Additional Windows GPU fixes
      app.commandLine.appendSwitch('--disable-features=VizDisplayCompositor');
      app.commandLine.appendSwitch('--disable-ipc-flooding-protection');
    }

    // Development-friendly settings
    if (process.env.NODE_ENV === 'development') {
      app.commandLine.appendSwitch('--ignore-certificate-errors');
      app.commandLine.appendSwitch('--disable-web-security');
      app.commandLine.appendSwitch('--allow-running-insecure-content');
    }

    // Also disable hardware acceleration programmatically
    if (!config.hardwareAcceleration) {
      app.disableHardwareAcceleration();
      console.log('✓ Hardware acceleration disabled programmatically');
    }

    this.isConfigured = true;
  }

  /**
   * Get system GPU information
   */
  static getSystemInfo(): any {
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
      freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024) + ' GB'
    };

    return systemInfo;
  }

  /**
   * Check if hardware acceleration should be disabled based on system
   */
  static shouldDisableHardwareAcceleration(): boolean {
    // Always disable hardware acceleration on Windows to prevent GPU process crashes
    if (process.platform === 'win32') {
      return true;
    }

    // Check for known problematic configurations on other platforms
    const cpus = os.cpus();
    const isVirtualMachine = cpus.some(cpu => 
      cpu.model.includes('Virtual') || 
      cpu.model.includes('QEMU') ||
      cpu.model.includes('VMware')
    );

    // Check for low memory systems
    const totalMemoryGB = os.totalmem() / 1024 / 1024 / 1024;
    const isLowMemory = totalMemoryGB < 4;

    return isVirtualMachine || isLowMemory;
  }

  /**
   * Apply optimal GPU configuration automatically
   */
  static autoConfiguration(): void {
    const shouldDisable = this.shouldDisableHardwareAcceleration();
    const systemInfo = this.getSystemInfo();

    console.log('System information:', systemInfo);
    console.log('Auto-disabling hardware acceleration:', shouldDisable);

    this.configure({
      hardwareAcceleration: !shouldDisable,
      softwareRendering: shouldDisable,
      gpuSandbox: !shouldDisable
    });
  }
}
