export interface Theme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
    brightBlack: string;
    brightRed: string;
    brightGreen: string;
    brightYellow: string;
    brightBlue: string;
    brightMagenta: string;
    brightCyan: string;
    brightWhite: string;
  };
  ui: {
    sidebarBg: string;
    tabBg: string;
    tabActiveBg: string;
    borderColor: string;
    buttonBg: string;
    buttonHover: string;
  };
  transparency?: {
    windowOpacity: number;
    terminalOpacity: number;
    sidebarOpacity: number;
    tabOpacity: number;
    enabled: boolean;
  };
}

export const themes: Record<string, Theme> = {
  dark: {
    name: "Dark",
    colors: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#ffffff',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5'
    },
    ui: {
      sidebarBg: '#252526',
      tabBg: '#2d2d30',
      tabActiveBg: '#1e1e1e',
      borderColor: '#3e3e42',
      buttonBg: '#0e639c',
      buttonHover: '#1177bb'
    },
    transparency: {
      windowOpacity: 0.95,
      terminalOpacity: 0.9,
      sidebarOpacity: 0.85,
      tabOpacity: 0.9,
      enabled: true
    }
  },
  dracula: {
    name: "Dracula",
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      selection: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff'
    },
    ui: {
      sidebarBg: '#21222c',
      tabBg: '#282a36',
      tabActiveBg: '#44475a',
      borderColor: '#6272a4',
      buttonBg: '#bd93f9',
      buttonHover: '#d6acff'
    },
    transparency: {
      windowOpacity: 0.92,
      terminalOpacity: 0.88,
      sidebarOpacity: 0.82,
      tabOpacity: 0.87,
      enabled: true
    }
  },
  monokai: {
    name: "Monokai",
    colors: {
      background: '#272822',
      foreground: '#f8f8f2',
      cursor: '#f8f8f0',
      selection: '#49483e',
      black: '#272822',
      red: '#f92672',
      green: '#a6e22e',
      yellow: '#f4bf75',
      blue: '#66d9ef',
      magenta: '#ae81ff',
      cyan: '#a1efe4',
      white: '#f8f8f2',
      brightBlack: '#75715e',
      brightRed: '#f92672',
      brightGreen: '#a6e22e',
      brightYellow: '#f4bf75',
      brightBlue: '#66d9ef',
      brightMagenta: '#ae81ff',
      brightCyan: '#a1efe4',
      brightWhite: '#f9f8f5'
    },
    ui: {
      sidebarBg: '#1e1f1c',
      tabBg: '#2f3129',
      tabActiveBg: '#272822',
      borderColor: '#49483e',
      buttonBg: '#66d9ef',
      buttonHover: '#a1efe4'
    },
    transparency: {
      windowOpacity: 0.93,
      terminalOpacity: 0.86,
      sidebarOpacity: 0.8,
      tabOpacity: 0.85,
      enabled: true
    }
  }
};

export class ThemeManager {
  private currentTheme: string = 'dark';
  private transparencyManager: any = null; // Will be set externally
  
  constructor() {
    this.loadTheme();
  }
  
  setTransparencyManager(transparencyManager: any): void {
    this.transparencyManager = transparencyManager;
  }
  
  setTheme(themeName: string): void {
    if (themes[themeName]) {
      this.currentTheme = themeName;
      this.applyTheme(themes[themeName]);
      this.applyTransparency(themes[themeName]);
      this.saveTheme();
    }
  }
  
  getCurrentTheme(): Theme {
    return themes[this.currentTheme] || themes.dark;
  }
  
  getAvailableThemes(): string[] {
    return Object.keys(themes);
  }
  
  private applyTheme(theme: Theme): void {
    // Apply terminal colors
    const terminalOptions = {
      theme: theme.colors
    };
    
    // Notify all terminals to update their theme
    getElectronAPI()?.invoke('apply-theme', terminalOptions);
    
    // Apply UI theme
    this.applyUITheme(theme.ui);
  }
  
  private applyUITheme(uiTheme: any): void {
    const root = document.documentElement;
    root.style.setProperty('--sidebar-bg', uiTheme.sidebarBg);
    root.style.setProperty('--tab-bg', uiTheme.tabBg);
    root.style.setProperty('--tab-active-bg', uiTheme.tabActiveBg);
    root.style.setProperty('--border-color', uiTheme.borderColor);
    root.style.setProperty('--button-bg', uiTheme.buttonBg);
    root.style.setProperty('--button-hover', uiTheme.buttonHover);
  }
  
  private saveTheme(): void {
    localStorage.setItem('selected-theme', this.currentTheme);
  }
  
  private loadTheme(): void {
    const saved = localStorage.getItem('selected-theme');
    if (saved && themes[saved]) {
      this.setTheme(saved);
    }
  }
  
  private applyTransparency(theme: Theme): void {
    if (this.transparencyManager && theme.transparency) {
      this.transparencyManager.setWindowOpacity(theme.transparency.windowOpacity);
      this.transparencyManager.setTerminalOpacity(theme.transparency.terminalOpacity);
      this.transparencyManager.setSidebarOpacity(theme.transparency.sidebarOpacity);
      this.transparencyManager.setTabOpacity(theme.transparency.tabOpacity);
      this.transparencyManager.setEnabled(theme.transparency.enabled);
    }
  }
}
