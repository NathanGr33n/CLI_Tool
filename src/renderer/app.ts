import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';

// Declare the global electronAPI interface
declare global {
  interface Window {
    electronAPI: {
      createShellSession: (type: string) => Promise<{ success: boolean; sessionId?: string; title?: string; error?: string }>;
      shellInput: (sessionId: string, data: string) => Promise<{ success: boolean }>;
      killShellSession: (sessionId: string) => Promise<{ success: boolean }>;
      onShellOutput: (callback: (sessionId: string, data: string) => void) => void;
      onShellExit: (callback: (sessionId: string, exitCode: number) => void) => void;
      onMenuNewTab: (callback: () => void) => void;
      onMenuCloseTab: (callback: () => void) => void;
      onMenuNewShellTab: (callback: (shellType: string) => void) => void;
      removeAllListeners: () => void;
      closeApp: () => Promise<void>;
      
      // Agent functionality
      agentInitialize: (workingDirectory?: string) => Promise<{ success: boolean; error?: string }>;
      agentMessage: (message: string) => Promise<any>;
      agentExecuteActions: (actionIds: string[]) => Promise<any[]>;
      agentAnalyzeProject: () => Promise<any>;
      agentGetCapabilities: () => Promise<string[]>;
    };
  }
}

interface TabInfo {
  id: string;
  sessionId: string | null;
  title: string;
  shellType: string;
  element: HTMLElement;
  terminal: Terminal | null;
  terminalContainer: HTMLElement;
  fitAddon: FitAddon | null;
}

class TerminalApp {
  private tabs: Map<string, TabInfo> = new Map();
  private activeTabId: string | null = null;
  private tabCounter = 0;
  private agentSidebarOpen = false;

  constructor() {
    this.setupEventListeners();
    this.setupElectronListeners();
    this.initializeAgent();
    this.createInitialTab();
  }

  private setupEventListeners(): void {
    // New tab button
    const newTabBtn = document.getElementById('new-tab-btn');
    newTabBtn?.addEventListener('click', () => {
      this.createTab('powershell');
    });

    // Shell selector buttons
    const shellBtns = document.querySelectorAll('.shell-btn');
    shellBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const shellType = (e.target as HTMLElement).getAttribute('data-shell') || 'powershell';
        this.createTab(shellType);
      });
    });

    // Agent toggle button
    const agentToggleBtn = document.getElementById('agent-toggle-btn');
    agentToggleBtn?.addEventListener('click', () => {
      this.toggleAgentSidebar();
    });

    // Close sidebar button
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    closeSidebarBtn?.addEventListener('click', () => {
      this.toggleAgentSidebar(false);
    });

    // Agent input handling
    const agentInput = document.getElementById('agent-input') as HTMLInputElement;
    const agentSendBtn = document.getElementById('agent-send-btn');
    
    const sendMessage = () => {
      const message = agentInput.value.trim();
      if (message) {
        this.handleAgentMessage(message);
        agentInput.value = '';
      }
    };

    agentSendBtn?.addEventListener('click', sendMessage);
    agentInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });

    // Context menu handling
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e.pageX, e.pageY);
    });

    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Window resize handling
    window.addEventListener('resize', () => {
      this.resizeActiveTerminal();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 't':
            e.preventDefault();
            this.createTab('powershell');
            break;
          case 'w':
            e.preventDefault();
            if (this.activeTabId) {
              this.closeTab(this.activeTabId);
            }
            break;
        }
      }
    });
  }

  private setupElectronListeners(): void {
    if (!window.electronAPI) {
      console.error('Electron API not available');
      return;
    }

    // Handle shell output
    window.electronAPI.onShellOutput((sessionId: string, data: string) => {
      this.handleShellOutput(sessionId, data);
    });

    // Handle shell exit
    window.electronAPI.onShellExit((sessionId: string, exitCode: number) => {
      this.handleShellExit(sessionId, exitCode);
    });

    // Handle menu commands
    window.electronAPI.onMenuNewTab(() => {
      this.createTab('powershell');
    });

    window.electronAPI.onMenuCloseTab(() => {
      if (this.activeTabId) {
        this.closeTab(this.activeTabId);
      }
    });

    window.electronAPI.onMenuNewShellTab((shellType: string) => {
      this.createTab(shellType);
    });
  }

  private async createInitialTab(): Promise<void> {
    await this.createTab('powershell');
  }

  private generateTabId(): string {
    return `tab-${++this.tabCounter}`;
  }

  private async createTab(shellType: string): Promise<void> {
    const tabId = this.generateTabId();
    
    try {
      // Create shell session
      const sessionResult = await window.electronAPI.createShellSession(shellType);
      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Failed to create shell session');
      }

      const sessionId = sessionResult.sessionId!;
      const title = sessionResult.title || shellType;

      // Create tab element
      const tabElement = this.createTabElement(tabId, title);
      
      // Create terminal container
      const terminalContainer = this.createTerminalContainer(tabId);

      // Create terminal instance
      const terminal = new Terminal({
        theme: {
          background: '#1e1e1e',
          foreground: '#e5e5e5',
          cursor: '#e5e5e5',
          selectionBackground: 'rgba(255, 255, 255, 0.2)',
          black: '#000000',
          red: '#d13438',
          green: '#16825d',
          yellow: '#ca5010',
          blue: '#007acc',
          magenta: '#a347ba',
          cyan: '#3a96dd',
          white: '#cccccc',
          brightBlack: '#666666',
          brightRed: '#f14c4c',
          brightGreen: '#23d18b',
          brightYellow: '#f5f543',
          brightBlue: '#3b8eea',
          brightMagenta: '#d670d6',
          brightCyan: '#29b8db',
          brightWhite: '#e5e5e5'
        },
        fontFamily: 'Cascadia Code, Fira Code, SF Mono, Monaco, Inconsolata, Roboto Mono, monospace',
        fontSize: 14,
        lineHeight: 1.2,
        cursorBlink: true,
        cursorStyle: 'block',
        scrollback: 10000,
        tabStopWidth: 4
      });

      // Add addons
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      terminal.loadAddon(new WebLinksAddon());

      // Open terminal in container
      terminal.open(terminalContainer.querySelector('.terminal-instance') as HTMLElement);
      
      // Handle terminal input
      terminal.onData((data) => {
        window.electronAPI.shellInput(sessionId, data);
      });

      // Fit terminal to container
      setTimeout(() => {
        fitAddon.fit();
      }, 100);

      // Store tab info
      const tabInfo: TabInfo = {
        id: tabId,
        sessionId,
        title,
        shellType,
        element: tabElement,
        terminal,
        terminalContainer,
        fitAddon
      };

      this.tabs.set(tabId, tabInfo);

      // Activate the new tab
      this.activateTab(tabId);

      // Update status
      this.updateStatus(shellType);

    } catch (error) {
      console.error('Failed to create tab:', error);
      this.showError(`Failed to create ${shellType} tab: ${error}`);
    }
  }

  private createTabElement(tabId: string, title: string): HTMLElement {
    const tabsContainer = document.getElementById('tabs-container')!;
    
    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.setAttribute('data-tab-id', tabId);

    tab.innerHTML = `
      <span class="tab-title">${title}</span>
      <button class="tab-close">&times;</button>
    `;

    // Add event listeners
    tab.addEventListener('click', (e) => {
      if (!(e.target as HTMLElement).classList.contains('tab-close')) {
        this.activateTab(tabId);
      }
    });

    const closeBtn = tab.querySelector('.tab-close');
    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(tabId);
    });

    tabsContainer.appendChild(tab);
    return tab;
  }

  private createTerminalContainer(tabId: string): HTMLElement {
    const terminalArea = document.getElementById('terminal-area')!;
    
    const container = document.createElement('div');
    container.className = 'terminal-container';
    container.setAttribute('data-tab-id', tabId);
    
    const terminalDiv = document.createElement('div');
    terminalDiv.className = 'terminal-instance';
    
    container.appendChild(terminalDiv);
    terminalArea.appendChild(container);
    
    return container;
  }

  private activateTab(tabId: string): void {
    // Deactivate all tabs
    this.tabs.forEach((tab, id) => {
      tab.element.classList.remove('active');
      tab.terminalContainer.classList.remove('active');
      
      if (id === tabId) {
        tab.element.classList.add('active');
        tab.terminalContainer.classList.add('active');
        
        // Focus terminal and resize
        if (tab.terminal && tab.fitAddon) {
          setTimeout(() => {
            tab.terminal!.focus();
            tab.fitAddon!.fit();
          }, 50);
        }
        
        // Update status
        this.updateStatus(tab.shellType);
      }
    });

    this.activeTabId = tabId;
  }

  private async closeTab(tabId: string): Promise<void> {
    const tab = this.tabs.get(tabId);
    if (!tab) return;

    try {
      // Kill shell session
      if (tab.sessionId) {
        await window.electronAPI.killShellSession(tab.sessionId);
      }

      // Dispose terminal
      if (tab.terminal) {
        tab.terminal.dispose();
      }

      // Remove DOM elements
      tab.element.remove();
      tab.terminalContainer.remove();

      // Remove from tabs map
      this.tabs.delete(tabId);

      // If this was the active tab, activate another tab
      if (this.activeTabId === tabId) {
        const remainingTabs = Array.from(this.tabs.keys());
        if (remainingTabs.length > 0) {
          this.activateTab(remainingTabs[0]);
        } else {
          this.activeTabId = null;
          // Create a new tab if no tabs remain
          this.createTab('powershell');
        }
      }
    } catch (error) {
      console.error('Failed to close tab:', error);
    }
  }

  private handleShellOutput(sessionId: string, data: string): void {
    // Find the tab with this session ID
    for (const tab of this.tabs.values()) {
      if (tab.sessionId === sessionId && tab.terminal) {
        tab.terminal.write(data);
        break;
      }
    }
  }

  private handleShellExit(sessionId: string, exitCode: number): void {
    // Find and handle the exited session
    for (const [tabId, tab] of this.tabs.entries()) {
      if (tab.sessionId === sessionId) {
        if (tab.terminal) {
          tab.terminal.write(`\r\n[Process exited with code ${exitCode}]\r\n`);
        }
        
        // Update tab title to show it's disconnected
        const titleElement = tab.element.querySelector('.tab-title');
        if (titleElement) {
          titleElement.textContent = `${tab.title} (exited)`;
        }
        
        tab.sessionId = null;
        break;
      }
    }
  }

  private resizeActiveTerminal(): void {
    if (!this.activeTabId) return;
    
    const activeTab = this.tabs.get(this.activeTabId);
    if (activeTab && activeTab.terminal && activeTab.fitAddon) {
      setTimeout(() => {
        activeTab.fitAddon!.fit();
      }, 100);
    }
  }

  private toggleAgentSidebar(open?: boolean): void {
    const sidebar = document.getElementById('agent-sidebar');
    const toggleBtn = document.getElementById('agent-toggle-btn');
    
    if (sidebar && toggleBtn) {
      this.agentSidebarOpen = open !== undefined ? open : !this.agentSidebarOpen;
      
      if (this.agentSidebarOpen) {
        sidebar.classList.add('open');
        toggleBtn.classList.add('active');
      } else {
        sidebar.classList.remove('open');
        toggleBtn.classList.remove('active');
      }
      
      // Resize terminal after sidebar animation
      setTimeout(() => {
        this.resizeActiveTerminal();
      }, 300);
    }
  }

  private async initializeAgent(): Promise<void> {
    if (!window.electronAPI) {
      console.error('Electron API not available for agent initialization');
      return;
    }

    try {
      const result = await window.electronAPI.agentInitialize();
      if (result.success) {
        console.log('Agent initialized successfully');
      } else {
        console.error('Failed to initialize agent:', result.error);
      }
    } catch (error) {
      console.error('Error initializing agent:', error);
    }
  }

  private async handleAgentMessage(message: string): Promise<void> {
    const messagesContainer = document.getElementById('agent-messages');
    if (!messagesContainer) return;

    // Add user message
    this.addAgentMessage('user', message);

    // Add loading indicator
    const loadingId = this.addAgentMessage('agent', 'Thinking...', true);

    try {
      // Use the real agent
      const response = await window.electronAPI.agentMessage(message);
      
      this.removeAgentMessage(loadingId);
      
      if (response.success) {
        this.addAgentMessage('agent', response.message || 'No response message');
        
        // Handle actions if any
        if (response.actions && response.actions.length > 0) {
          const actionsText = response.actions.map((action: any) => 
            `• ${action.description} (${action.status})`
          ).join('\n');
          this.addAgentMessage('agent', `Suggested actions:\n${actionsText}`);
        }
      } else {
        this.addAgentMessage('agent', `Error: ${response.error || 'Unknown error'}`);
      }

    } catch (error) {
      this.removeAgentMessage(loadingId);
      this.addAgentMessage('agent', `Error: ${error}`);
    }
  }

  private addAgentMessage(role: 'user' | 'agent', content: string, isLoading: boolean = false): string {
    const messagesContainer = document.getElementById('agent-messages');
    if (!messagesContainer) return '';

    const messageId = `msg-${Date.now()}`;
    const messageDiv = document.createElement('div');
    messageDiv.className = `agent-message agent-message-${role}`;
    messageDiv.id = messageId;
    messageDiv.innerHTML = `
      <div class="message-content ${isLoading ? 'loading' : ''}">${content}</div>
      <div class="message-timestamp">${new Date().toLocaleTimeString()}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageId;
  }

  private removeAgentMessage(messageId: string): void {
    const messageElement = document.getElementById(messageId);
    if (messageElement) {
      messageElement.remove();
    }
  }

  private updateStatus(shellType: string): void {
    const currentShell = document.getElementById('current-shell');
    if (currentShell) {
      currentShell.textContent = shellType === 'powershell' ? 'PowerShell' : 
                                 shellType === 'cmd' ? 'Command Prompt' :
                                 shellType === 'wsl' ? 'WSL' : shellType;
    }
  }

  private showContextMenu(x: number, y: number): void {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.style.left = `${x}px`;
      contextMenu.style.top = `${y}px`;
      contextMenu.style.display = 'block';
    }
  }

  private hideContextMenu(): void {
    const contextMenu = document.getElementById('context-menu');
    if (contextMenu) {
      contextMenu.style.display = 'none';
    }
  }

  private showError(message: string): void {
    console.error(message);
    // TODO: Show proper error notification
  }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TerminalApp();
});

// Handle app cleanup
window.addEventListener('beforeunload', () => {
  if (window.electronAPI) {
    window.electronAPI.removeAllListeners();
  }
});
