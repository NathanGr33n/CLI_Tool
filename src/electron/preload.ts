import { contextBridge, ipcRenderer } from 'electron';

// Define the API interface for the renderer
interface ElectronAPI {
  // Shell session management
  createShellSession: (type: string) => Promise<{ success: boolean; sessionId?: string; title?: string; error?: string }>;
  shellInput: (sessionId: string, data: string) => Promise<{ success: boolean }>;
  killShellSession: (sessionId: string) => Promise<{ success: boolean }>;
  
  // Event listeners
  onShellOutput: (callback: (sessionId: string, data: string) => void) => void;
  onShellExit: (callback: (sessionId: string, exitCode: number) => void) => void;
  onMenuNewTab: (callback: () => void) => void;
  onMenuCloseTab: (callback: () => void) => void;
  onMenuNewShellTab: (callback: (shellType: string) => void) => void;
  
  // Cleanup
  removeAllListeners: () => void;
  
  // App controls
  closeApp: () => Promise<void>;
  
  // Agent functionality
  agentInitialize: (workingDirectory?: string) => Promise<{ success: boolean; error?: string }>;
  agentMessage: (message: string) => Promise<any>;
  agentExecuteActions: (actionIds: string[]) => Promise<any[]>;
  agentAnalyzeProject: () => Promise<any>;
  agentGetCapabilities: () => Promise<string[]>;
  agentChangeDirectory: (newPath: string) => Promise<{ success: boolean }>;
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
  
  // Transparency controls
  setWindowTransparency: (opacity: number) => Promise<{ success: boolean; opacity?: number; error?: string }>;
  getWindowTransparency: () => Promise<{ success: boolean; opacity?: number; error?: string }>;
  applyTheme: (terminalOptions: any) => Promise<{ success: boolean }>;
  
  // General invoke method for flexibility
  invoke: (channel: string, ...args: any[]) => Promise<any>;
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI: ElectronAPI = {
  // Shell session management
  createShellSession: (type: string) => ipcRenderer.invoke('create-shell-session', type),
  shellInput: (sessionId: string, data: string) => ipcRenderer.invoke('shell-input', sessionId, data),
  killShellSession: (sessionId: string) => ipcRenderer.invoke('kill-shell-session', sessionId),
  
  // Event listeners
  onShellOutput: (callback) => {
    ipcRenderer.on('shell-output', (_event, sessionId, data) => callback(sessionId, data));
  },
  
  onShellExit: (callback) => {
    ipcRenderer.on('shell-exit', (_event, sessionId, exitCode) => callback(sessionId, exitCode));
  },
  
  onMenuNewTab: (callback) => {
    ipcRenderer.on('menu-new-tab', () => callback());
  },
  
  onMenuCloseTab: (callback) => {
    ipcRenderer.on('menu-close-tab', () => callback());
  },
  
  onMenuNewShellTab: (callback) => {
    ipcRenderer.on('menu-new-shell-tab', (_event, shellType) => callback(shellType));
  },
  
  // Cleanup
  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('shell-output');
    ipcRenderer.removeAllListeners('shell-exit');
    ipcRenderer.removeAllListeners('menu-new-tab');
    ipcRenderer.removeAllListeners('menu-close-tab');
    ipcRenderer.removeAllListeners('menu-new-shell-tab');
  },
  
  // App controls
  closeApp: () => ipcRenderer.invoke('close-app'),
  
  // Agent functionality
  agentInitialize: (workingDirectory?: string) => ipcRenderer.invoke('agent-initialize', workingDirectory),
  agentMessage: (message: string) => ipcRenderer.invoke('agent-message', message),
  agentExecuteActions: (actionIds: string[]) => ipcRenderer.invoke('agent-execute-actions', actionIds),
  agentAnalyzeProject: () => ipcRenderer.invoke('agent-analyze-project'),
  agentGetCapabilities: () => ipcRenderer.invoke('agent-get-capabilities'),
  agentChangeDirectory: (newPath: string) => ipcRenderer.invoke('agent-change-directory', newPath),
  terminalResize: (sessionId: string, cols: number, rows: number) => ipcRenderer.invoke('terminal-resize', sessionId, cols, rows),
  
  // Transparency controls
  setWindowTransparency: (opacity: number) => ipcRenderer.invoke('set-window-transparency', opacity),
  getWindowTransparency: () => ipcRenderer.invoke('get-window-transparency'),
  applyTheme: (terminalOptions: any) => ipcRenderer.invoke('apply-theme', terminalOptions),
  
  // General invoke method for flexibility
  invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args)
};

// With nodeIntegration enabled and contextIsolation disabled,
// we can directly expose the API to the global scope
try {
  (global as any).electronAPI = electronAPI;
  (window as any).electronAPI = electronAPI;
  console.log('✓ electronAPI exposed to global scope');
} catch (error) {
  console.error('❌ Failed to expose electronAPI:', error);
}
