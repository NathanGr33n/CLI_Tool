// Import xterm.js using Node.js require (now possible with nodeIntegration: true)
let Terminal: any, FitAddon: any, WebLinksAddon: any;

try {
  const xterm = require('@xterm/xterm');
  Terminal = xterm.Terminal;
  
  const fitAddon = require('@xterm/addon-fit');
  FitAddon = fitAddon.FitAddon;
  
  const webLinksAddon = require('@xterm/addon-web-links');
  WebLinksAddon = webLinksAddon.WebLinksAddon;
  
  console.log('✓ xterm.js modules loaded successfully');
} catch (error) {
  console.error('❌ Failed to load xterm.js modules:', error);
}

// Declare the electronAPI interface
interface ElectronAPI {
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
  terminalResize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean }>;
}

// Access electronAPI from global scope
function getElectronAPI(): ElectronAPI | null {
  return (global as any).electronAPI || (window as any).electronAPI || null;
}

interface TabInfo {
  id: string;
  sessionId: string | null;
  title: string;
  shellType: string;
  element: HTMLElement;
  terminal: any;
  terminalContainer: HTMLElement;
  fitAddon: any;
}

class TerminalApp {
  private tabs: Map<string, TabInfo> = new Map();
  private activeTabId: string | null = null;
  private tabCounter = 0;
  private agentSidebarOpen = false;
  
  // Circuit breaker to prevent infinite loops
  private failedTabAttempts = 0;
  private maxFailedAttempts = 3;
  private lastFailedAttemptTime = 0;
  private circuitBreakerResetTime = 30000; // 30 seconds

  constructor() {
    console.log('🏠 TerminalApp constructor called');
    try {
      this.setupEventListeners();
      console.log('✓ Event listeners set up');
      this.setupElectronListeners();
      console.log('✓ Electron listeners set up');
      this.initializeAgent();
      console.log('✓ Agent initialization started');
      this.createInitialTab();
      console.log('✓ Initial tab creation started');
    } catch (error) {
      console.error('❌ Error in TerminalApp constructor:', error);
      throw error;
    }
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
    const electronAPI = getElectronAPI();
    if (!electronAPI) {
      console.error('❌ Electron API not available');
      return;
    }
    
    console.log('✓ Electron API available, setting up listeners...');

    // Handle shell output
    electronAPI.onShellOutput((sessionId: string, data: string) => {
      this.handleShellOutput(sessionId, data);
    });

    // Handle shell exit
    electronAPI.onShellExit((sessionId: string, exitCode: number) => {
      this.handleShellExit(sessionId, exitCode);
    });

    // Handle menu commands
    electronAPI.onMenuNewTab(() => {
      this.createTab('powershell');
    });

    electronAPI.onMenuCloseTab(() => {
      if (this.activeTabId) {
        this.closeTab(this.activeTabId);
      }
    });

    electronAPI.onMenuNewShellTab((shellType: string) => {
      this.createTab(shellType);
    });
  }

  private tabCreationInProgress = false;
  
  private isCircuitBreakerOpen(): boolean {
    const now = Date.now();
    if (this.failedTabAttempts >= this.maxFailedAttempts) {
      if (now - this.lastFailedAttemptTime > this.circuitBreakerResetTime) {
        // Reset circuit breaker after timeout
        console.log('🔄 Circuit breaker reset after timeout');
        this.failedTabAttempts = 0;
        return false;
      }
      return true;
    }
    return false;
  }
  
  private recordTabCreationFailure(): void {
    this.failedTabAttempts++;
    this.lastFailedAttemptTime = Date.now();
    console.warn(`⚠️ Tab creation failure #${this.failedTabAttempts}/${this.maxFailedAttempts}`);
  }
  
  private recordTabCreationSuccess(): void {
    this.failedTabAttempts = 0;
    console.log('✓ Tab creation successful, circuit breaker reset');
  }
  
  private async createInitialTab(): Promise<void> {
    console.log('🎯 Starting initial tab creation...');
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen()) {
      console.error('❌ Circuit breaker open - too many failed tab creation attempts');
      this.showError('Terminal creation temporarily disabled due to repeated failures. Please refresh the page to try again.');
      return;
    }
    
    // Prevent multiple simultaneous tab creation attempts
    if (this.tabCreationInProgress) {
      console.log('⚠️ Tab creation already in progress, skipping...');
      return;
    }
    
    this.tabCreationInProgress = true;
    
    try {
      await this.createTab('powershell');
      console.log('✓ Initial tab created successfully');
      this.recordTabCreationSuccess();
    } catch (error) {
      console.error('❌ Failed to create initial tab:', error);
      this.recordTabCreationFailure();
      
      // Only try fallback once, and only if we don't have any tabs yet and circuit breaker allows
      if (this.tabs.size === 0 && !this.isCircuitBreakerOpen()) {
        try {
          console.log('🔄 Trying fallback CMD tab...');
          await this.createTab('cmd');
          console.log('✓ Fallback CMD tab created successfully');
          this.recordTabCreationSuccess();
        } catch (fallbackError) {
          console.error('❌ Fallback tab creation also failed:', fallbackError);
          this.recordTabCreationFailure();
          this.showError('Failed to create any terminal session. Please check that PowerShell or CMD are available on your system.');
        }
      } else if (this.tabs.size > 0) {
        console.log('✓ Tab creation failed but we have existing tabs, continuing...');
      }
    } finally {
      this.tabCreationInProgress = false;
    }
  }

  private generateTabId(): string {
    return `tab-${++this.tabCounter}`;
  }

  private async createTab(shellType: string): Promise<void> {
    const tabId = this.generateTabId();
    console.log(`🆕 Creating new tab: ${tabId} (${shellType})`);
    
    // Check if we're in circuit breaker mode
    if (this.isCircuitBreakerOpen()) {
      throw new Error('Circuit breaker is open - too many failed attempts');
    }
    
    try {
      // Create shell session
      console.log(`🔧 Requesting shell session for ${shellType}...`);
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        throw new Error('Electron API not available');
      }
      const sessionResult = await electronAPI.createShellSession(shellType);
      console.log('📊 Shell session result:', sessionResult);
      
      if (!sessionResult.success) {
        throw new Error(sessionResult.error || 'Failed to create shell session');
      }

      const sessionId = sessionResult.sessionId!;
      const title = sessionResult.title || shellType;
      console.log(`✓ Shell session created: ${sessionId} (${title})`);

      // Create tab element
      const tabElement = this.createTabElement(tabId, title);
      
      // Create terminal container
      const terminalContainer = this.createTerminalContainer(tabId);

      // Validate that Terminal class is available
      if (typeof Terminal === 'undefined') {
        throw new Error('Terminal class not available - xterm.js not loaded properly');
      }
      
      if (typeof FitAddon === 'undefined') {
        throw new Error('FitAddon class not available - addon-fit.js not loaded properly');
      }
      
      if (typeof WebLinksAddon === 'undefined') {
        throw new Error('WebLinksAddon class not available - addon-web-links.js not loaded properly');
      }
      
      console.log('✓ All xterm.js classes available, creating terminal...');
      
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

      // Validate terminal container
      const terminalElement = terminalContainer.querySelector('.terminal-instance') as HTMLElement;
      if (!terminalElement) {
        throw new Error('Terminal container element not found');
      }
      
      console.log('✓ Terminal container element found, opening terminal...');
      
      // Open terminal in container
      terminal.open(terminalElement);
      
      // Handle terminal input
      terminal.onData((data: string) => {
        console.log(`📥 Terminal input for ${sessionId}:`, JSON.stringify(data));
        const electronAPI = getElectronAPI();
        if (electronAPI) {
          electronAPI.shellInput(sessionId, data);
        }
      });

      // Fit terminal to container and handle resize
      setTimeout(() => {
        try {
          fitAddon.fit();
          // Send resize information to backend
          const { cols, rows } = terminal;
          console.log(`📱 Terminal sized to ${cols}x${rows}`);
          const electronAPI = getElectronAPI();
          if (electronAPI) {
            electronAPI.terminalResize(sessionId, cols, rows);
          }
          // Focus terminal for immediate interaction
          terminal.focus();
          console.log('✓ Terminal fitted and focused');
        } catch (error) {
          console.error('❌ Error during terminal setup:', error);
        }
      }, 200);
      
      // Handle terminal resize events
      terminal.onResize(({ cols, rows }: { cols: number, rows: number }) => {
        console.log(`📱 Terminal resized: ${cols}x${rows}`);
        const electronAPI = getElectronAPI();
        if (electronAPI) {
          electronAPI.terminalResize(sessionId, cols, rows);
        }
      });

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
      console.error(`❌ Failed to create ${shellType} tab:`, error);
      this.recordTabCreationFailure();
      
      // Don't show error if circuit breaker is open (already shown)
      if (!this.isCircuitBreakerOpen()) {
        this.showError(`Failed to create ${shellType} tab: ${(error as Error).message || error}`);
      }
      
      // Don't retry if circuit breaker is open
      if (this.tabs.size === 0 && !this.isCircuitBreakerOpen()) {
        console.warn('⚠️  No tabs available and circuit breaker allows retry...');
        // Don't retry automatically to prevent loops - user can refresh instead
      }
      
      // Re-throw error to be handled by caller
      throw error;
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
        const electronAPI = getElectronAPI();
        if (electronAPI) {
          await electronAPI.killShellSession(tab.sessionId);
        }
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
    console.log(`📤 Received shell output for ${sessionId}:`, data.slice(0, 100) + (data.length > 100 ? '...' : ''));
    
    // Find the tab with this session ID
    for (const tab of this.tabs.values()) {
      if (tab.sessionId === sessionId && tab.terminal) {
        console.log(`✓ Writing to terminal for tab ${tab.id}`);
        tab.terminal.write(data);
        return;
      }
    }
    
    console.warn(`⚠️  No terminal found for session ${sessionId}`);
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
        
        // Notify backend of resize if session exists
        if (activeTab.sessionId) {
          const { cols, rows } = activeTab.terminal!;
          const electronAPI = getElectronAPI();
          if (electronAPI) {
            electronAPI.terminalResize(activeTab.sessionId, cols, rows);
          }
        }
        
        // Refocus terminal after resize
        activeTab.terminal!.focus();
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
    if (!getElectronAPI()) {
      console.error('Electron API not available for agent initialization');
      return;
    }

    try {
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        throw new Error('Electron API not available for agent initialization');
      }
      const result = await electronAPI.agentInitialize();
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
      const electronAPI = getElectronAPI();
      if (!electronAPI) {
        throw new Error('Electron API not available for agent message');
      }
      const response = await electronAPI.agentMessage(message);
      
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
    console.error('❌ Error:', message);
    
    // Show error in terminal area if no terminal is available
    const terminalArea = document.getElementById('terminal-area');
    if (terminalArea && this.tabs.size === 0) {
      terminalArea.innerHTML = `
        <div class="error-container" style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--accent-red);
          text-align: center;
          padding: 40px;
        ">
          <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
          <div style="font-size: 16px; margin-bottom: 12px; font-weight: 600;">Terminal Error</div>
          <div style="font-size: 14px; color: var(--text-muted); max-width: 500px;">${message}</div>
          <button onclick="window.location.reload()" style="
            margin-top: 20px;
            padding: 8px 16px;
            background: var(--accent-blue);
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
          ">Retry</button>
        </div>
      `;
    }
    
    // Also show in console for debugging
    if (getElectronAPI()) {
      // Could add notification system here later
    }
  }
}

// Prevent multiple initialization
let appInitialized = false;

// Initialize the app when DOM is loaded
function initializeApp() {
  if (appInitialized) {
    console.log('⚠️ App already initialized, skipping...');
    return;
  }
  appInitialized = true;
  
  console.log('🎯 DOM Content Loaded - Initializing Terminal App...');
  
  // Check if required libraries are available
  console.log('Checking required libraries:');
  console.log('- Terminal available:', typeof Terminal !== 'undefined');
  console.log('- FitAddon available:', typeof FitAddon !== 'undefined');
  console.log('- WebLinksAddon available:', typeof WebLinksAddon !== 'undefined');
  console.log('- electronAPI available:', !!getElectronAPI());
  
  if (typeof Terminal === 'undefined') {
    console.error('❌ Terminal (xterm.js) not available - check if xterm.js loaded');
    document.body.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace;">
        <h2>Error: Terminal Library Not Available</h2>
        <p>The xterm.js library failed to load. Please check your internet connection or refresh the page.</p>
      </div>
    `;
    return;
  }
  
  try {
    new TerminalApp();
    console.log('✓ Terminal App initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Terminal App:', error);
    document.body.innerHTML = `
      <div style="color: red; padding: 20px; font-family: monospace;">
        <h2>Terminal App Initialization Error</h2>
        <p>${error}</p>
        <button onclick="window.location.reload()">Reload</button>
      </div>
    `;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOM is already ready
  setTimeout(initializeApp, 100);
}

// Handle app cleanup
window.addEventListener('beforeunload', () => {
  if (getElectronAPI()) {
    const electronAPI = getElectronAPI();
    if (electronAPI) {
      electronAPI.removeAllListeners();
    }
  }
});
