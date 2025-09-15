export interface TransparencySettings {
  windowOpacity: number;
  terminalOpacity: number;
  sidebarOpacity: number;
  tabOpacity: number;
  enabled: boolean;
}

export class TransparencyManager {
  private settings: TransparencySettings = {
    windowOpacity: 0.95,
    terminalOpacity: 0.9,
    sidebarOpacity: 0.85,
    tabOpacity: 0.9,
    enabled: true
  };

  private debounceTimer: number | null = null;

  constructor() {
    this.loadSettings();
    this.applySettings();
  }

  setWindowOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.settings.windowOpacity = clampedOpacity;
    
    // Apply to Electron window
    window.electronAPI?.invoke('set-window-transparency', clampedOpacity);
    
    this.saveSettings();
  }

  setTerminalOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.settings.terminalOpacity = clampedOpacity;
    
    this.applyTerminalTransparency();
    this.saveSettings();
  }

  setSidebarOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.settings.sidebarOpacity = clampedOpacity;
    
    this.applySidebarTransparency();
    this.saveSettings();
  }

  setTabOpacity(opacity: number): void {
    const clampedOpacity = Math.max(0.1, Math.min(1.0, opacity));
    this.settings.tabOpacity = clampedOpacity;
    
    this.applyTabTransparency();
    this.saveSettings();
  }

  setEnabled(enabled: boolean): void {
    this.settings.enabled = enabled;
    
    if (enabled) {
      this.applySettings();
    } else {
      this.disableTransparency();
    }
    
    this.saveSettings();
  }

  getSettings(): TransparencySettings {
    return { ...this.settings };
  }

  resetToDefaults(): void {
    this.settings = {
      windowOpacity: 0.95,
      terminalOpacity: 0.9,
      sidebarOpacity: 0.85,
      tabOpacity: 0.9,
      enabled: true
    };
    
    this.applySettings();
    this.saveSettings();
  }

  private applySettings(): void {
    if (!this.settings.enabled) {
      this.disableTransparency();
      return;
    }

    // Apply window transparency
    window.electronAPI?.invoke('set-window-transparency', this.settings.windowOpacity);
    
    // Apply CSS transparency
    this.applyTerminalTransparency();
    this.applySidebarTransparency();
    this.applyTabTransparency();
    
    // Update CSS custom properties
    this.updateCSSProperties();
  }

  private disableTransparency(): void {
    // Reset window opacity to fully opaque
    window.electronAPI?.invoke('set-window-transparency', 1.0);
    
    // Reset CSS opacities
    const root = document.documentElement;
    root.style.setProperty('--terminal-opacity', '1.0');
    root.style.setProperty('--sidebar-opacity', '1.0');
    root.style.setProperty('--tab-opacity', '1.0');
    root.style.setProperty('--transparency-enabled', 'false');
  }

  private applyTerminalTransparency(): void {
    const terminals = document.querySelectorAll('.xterm');
    terminals.forEach(terminal => {
      const htmlTerminal = terminal as HTMLElement;
      htmlTerminal.style.backgroundColor = `rgba(30, 30, 30, ${this.settings.terminalOpacity})`;
    });
  }

  private applySidebarTransparency(): void {
    const sidebar = document.querySelector('.ai-panel') as HTMLElement;
    if (sidebar) {
      const currentBg = getComputedStyle(sidebar).backgroundColor;
      const rgbaMatch = currentBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      
      if (rgbaMatch) {
        const [, r, g, b] = rgbaMatch;
        sidebar.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${this.settings.sidebarOpacity})`;
      }
    }
  }

  private applyTabTransparency(): void {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      const htmlTab = tab as HTMLElement;
      const currentBg = getComputedStyle(htmlTab).backgroundColor;
      const rgbaMatch = currentBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      
      if (rgbaMatch) {
        const [, r, g, b] = rgbaMatch;
        htmlTab.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${this.settings.tabOpacity})`;
      }
    });
  }

  private updateCSSProperties(): void {
    const root = document.documentElement;
    root.style.setProperty('--window-opacity', this.settings.windowOpacity.toString());
    root.style.setProperty('--terminal-opacity', this.settings.terminalOpacity.toString());
    root.style.setProperty('--sidebar-opacity', this.settings.sidebarOpacity.toString());
    root.style.setProperty('--tab-opacity', this.settings.tabOpacity.toString());
    root.style.setProperty('--transparency-enabled', this.settings.enabled.toString());
  }

  private saveSettings(): void {
    // Debounce saving to avoid too frequent writes
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      localStorage.setItem('transparency-settings', JSON.stringify(this.settings));
      console.log('🎨 Transparency settings saved:', this.settings);
    }, 300);
  }

  private loadSettings(): void {
    try {
      const saved = localStorage.getItem('transparency-settings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsedSettings };
        console.log('🎨 Transparency settings loaded:', this.settings);
      }
    } catch (error) {
      console.warn('⚠️ Failed to load transparency settings, using defaults:', error);
    }
  }

  // Utility methods for smooth transitions
  animateOpacityChange(targetOpacity: number, duration: number = 300): void {
    if (!this.settings.enabled) return;

    const startOpacity = this.settings.windowOpacity;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const currentOpacity = startOpacity + (targetOpacity - startOpacity) * progress;
      this.setWindowOpacity(currentOpacity);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }

  // Preset transparency levels
  setPreset(preset: 'minimal' | 'balanced' | 'subtle' | 'opaque'): void {
    switch (preset) {
      case 'minimal':
        this.settings = {
          windowOpacity: 0.7,
          terminalOpacity: 0.6,
          sidebarOpacity: 0.5,
          tabOpacity: 0.6,
          enabled: true
        };
        break;
      case 'balanced':
        this.settings = {
          windowOpacity: 0.85,
          terminalOpacity: 0.8,
          sidebarOpacity: 0.75,
          tabOpacity: 0.8,
          enabled: true
        };
        break;
      case 'subtle':
        this.settings = {
          windowOpacity: 0.95,
          terminalOpacity: 0.9,
          sidebarOpacity: 0.85,
          tabOpacity: 0.9,
          enabled: true
        };
        break;
      case 'opaque':
        this.settings = {
          windowOpacity: 1.0,
          terminalOpacity: 1.0,
          sidebarOpacity: 1.0,
          tabOpacity: 1.0,
          enabled: false
        };
        break;
    }
    
    this.applySettings();
    this.saveSettings();
  }
}
