import { TransparencyManager } from './TransparencyManager.js';
import { ThemeManager } from './ThemeManager.js';
import { TransparencyControlsUI } from './TransparencyControls.js';

// Access electronAPI from global scope
function getElectronAPI(): any {
  return (global as any).electronAPI || (window as any).electronAPI || null;
}

export class TransparencyIntegration {
  private transparencyManager: TransparencyManager;
  private themeManager: ThemeManager;
  private transparencyControlsUI: TransparencyControlsUI | null = null;

  constructor() {
    this.transparencyManager = new TransparencyManager();
    this.themeManager = new ThemeManager();
    
    // Link transparency manager to theme manager
    this.themeManager.setTransparencyManager(this.transparencyManager);
    
    this.initialize();
  }

  private initialize(): void {
    // Initialize transparency on window load
    this.setupTransparency();
    
    // Add transparency controls to the UI
    this.addTransparencyControls();
    
    // Listen for theme updates from main process
    this.setupThemeUpdateListener();
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    console.log('🎨 Transparency integration initialized');
  }

  private setupTransparency(): void {
    // Apply initial transparency settings
    setTimeout(() => {
      this.transparencyManager.loadSettings();
      console.log('🎨 Initial transparency settings applied');
    }, 1000);
  }

  private addTransparencyControls(): void {
    // Find the agent sidebar
    const agentSidebar = document.querySelector('.agent-chat-container');
    if (agentSidebar) {
      this.transparencyControlsUI = new TransparencyControlsUI(
        agentSidebar as HTMLElement, 
        this.transparencyManager
      );
      console.log('🎨 Transparency controls added to sidebar');
    } else {
      // Retry after a delay if sidebar not found
      setTimeout(() => {
        this.addTransparencyControls();
      }, 2000);
    }
  }

  private setupThemeUpdateListener(): void {
    // Listen for theme updates from main process
    const electronAPI = getElectronAPI();
    electronAPI?.invoke('add-theme-listener', (terminalOptions: any) => {
      console.log('🎨 Theme update received:', terminalOptions);
      // Apply theme to terminals
      this.applyThemeToTerminals(terminalOptions);
    });
  }

  private applyThemeToTerminals(terminalOptions: any): void {
    // Apply theme to all active terminal instances
    const terminals = document.querySelectorAll('.xterm');
    terminals.forEach(terminal => {
      const xtermInstance = (terminal as any).terminal;
      if (xtermInstance && terminalOptions.theme) {
        xtermInstance.options.theme = terminalOptions.theme;
        console.log('🎨 Theme applied to terminal instance');
      }
    });
  }

  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + Shift + T: Toggle transparency
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        const settings = this.transparencyManager.getSettings();
        this.transparencyManager.setEnabled(!settings.enabled);
        console.log('🎨 Transparency toggled via keyboard shortcut');
      }
      
      // Ctrl/Cmd + Shift + O: Cycle opacity presets
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'O') {
        e.preventDefault();
        this.cycleOpacityPresets();
        console.log('🎨 Opacity preset cycled via keyboard shortcut');
      }
      
      // Ctrl/Cmd + Shift + R: Reset transparency to defaults
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        this.transparencyManager.resetToDefaults();
        this.transparencyControlsUI?.updateUI();
        console.log('🎨 Transparency reset to defaults via keyboard shortcut');
      }
    });
  }

  private cycleOpacityPresets(): void {
    const presets = ['opaque', 'subtle', 'balanced', 'minimal'];
    const current = this.getCurrentPreset();
    const currentIndex = presets.indexOf(current);
    const nextIndex = (currentIndex + 1) % presets.length;
    const nextPreset = presets[nextIndex] as any;
    
    this.transparencyManager.setPreset(nextPreset);
    
    // Update UI if available
    if (this.transparencyControlsUI) {
      this.transparencyControlsUI.updateUI();
      this.transparencyControlsUI.updatePresetButtons(nextPreset);
    }
  }

  private getCurrentPreset(): string {
    const settings = this.transparencyManager.getSettings();
    
    // Determine current preset based on settings
    if (!settings.enabled) return 'opaque';
    if (settings.windowOpacity >= 0.95) return 'subtle';
    if (settings.windowOpacity >= 0.85) return 'balanced';
    return 'minimal';
  }

  // Public methods for external access
  getTransparencyManager(): TransparencyManager {
    return this.transparencyManager;
  }

  getThemeManager(): ThemeManager {
    return this.themeManager;
  }

  // Method to add transparency controls to custom container
  addControlsToContainer(container: HTMLElement): TransparencyControlsUI {
    return new TransparencyControlsUI(container, this.transparencyManager);
  }

  // Enable/disable transparency with animation
  animatedToggle(duration: number = 500): void {
    const settings = this.transparencyManager.getSettings();
    const targetOpacity = settings.enabled ? 1.0 : 0.85;
    this.transparencyManager.animateOpacityChange(targetOpacity, duration);
  }

  // Get current transparency status for external components
  getTransparencyStatus(): { enabled: boolean; windowOpacity: number } {
    const settings = this.transparencyManager.getSettings();
    return {
      enabled: settings.enabled,
      windowOpacity: settings.windowOpacity
    };
  }
}

// Global instance for easy access
let transparencyIntegration: TransparencyIntegration | null = null;

// Initialize when DOM is ready (with delay to ensure everything is loaded)
function initializeTransparency() {
  if (!transparencyIntegration) {
    transparencyIntegration = new TransparencyIntegration();
    (window as any).transparencyIntegration = transparencyIntegration;
  }
}

// Initialize with a delay to ensure the app is fully loaded
// Temporarily disabled for testing
/*
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initializeTransparency, 2000);
  });
} else {
  setTimeout(initializeTransparency, 2000);
}
*/

export default TransparencyIntegration;
