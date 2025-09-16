/**
 * Bottom Status Bar Controller
 * Manages the full-width bottom status bar with real-time updates
 */
class BottomStatusBar {
    constructor() {
        this.updateInterval = null;
        this.lastCommand = 'Ready';
        this.lastCommandTime = null;
        this.sessionCount = 1;
        
        this.initializeElements();
        this.setupEventListeners();
        this.startUpdates();
        this.updateLayout();
    }

    initializeElements() {
        // Main elements
        this.statusBar = document.getElementById('bottom-status-bar');
        
        // Shell info
        this.shellIcon = document.getElementById('shell-icon');
        this.shellName = document.getElementById('current-shell-status');
        this.shellIndicator = document.getElementById('shell-indicator');
        
        // Directory info
        this.currentPath = document.getElementById('current-directory-status');
        this.directoryInfo = document.querySelector('.current-directory-info');
        
        // Session count
        this.sessionCountDisplay = document.getElementById('session-count-status');
        
        // Git info
        this.gitInfo = document.getElementById('git-info');
        this.gitBranch = document.getElementById('git-branch-status');
        this.gitChanges = document.getElementById('git-changes-status');
        
        // Command status
        this.commandStatus = document.getElementById('command-status');
        this.commandLabel = document.querySelector('.command-label');
        this.commandTime = document.getElementById('command-execution-time');
        
        // System metrics
        this.cpuUsage = document.getElementById('cpu-usage-status');
        this.memoryUsage = document.getElementById('memory-usage-status');
        this.systemMetrics = document.getElementById('system-metrics');
        
        // Connection status
        this.connectionStatus = document.getElementById('connection-status');
        this.connectionIcon = document.querySelector('.connection-icon');
        this.connectionText = document.getElementById('connection-status-text');
        
        // Controls
        this.settingsBtn = document.getElementById('settings-control-btn');
        this.aiControlBtn = document.getElementById('ai-control-btn');
        
        // Time
        this.timeDisplay = document.getElementById('current-time-display');
        this.currentTimeContainer = document.querySelector('.current-time');
    }

    setupEventListeners() {
        // Directory click - open file explorer
        if (this.directoryInfo) {
            this.directoryInfo.addEventListener('click', () => {
                this.openDirectoryInExplorer();
            });
        }

        // Settings button
        if (this.settingsBtn) {
            this.settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }

        // AI control button
        if (this.aiControlBtn) {
            this.aiControlBtn.addEventListener('click', () => {
                this.toggleAI();
            });
        }

        // Time click - show date/time info
        if (this.currentTimeContainer) {
            this.currentTimeContainer.addEventListener('click', () => {
                this.showTimeInfo();
            });
        }

        // Shell indicator click - show shell info
        if (this.shellIndicator) {
            this.shellIndicator.addEventListener('click', () => {
                this.showShellInfo();
            });
        }

        // Connection status click - show connection details
        if (this.connectionStatus) {
            this.connectionStatus.addEventListener('click', () => {
                this.showConnectionInfo();
            });
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey) {
                switch (e.key) {
                    case ',':
                        e.preventDefault();
                        this.openSettings();
                        break;
                }
            }
            
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggleAI();
            }
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.updateLayout();
        });

        // Listen for shell changes from main app
        this.setupAppEventListeners();
    }

    setupAppEventListeners() {
        // Listen for shell changes
        document.addEventListener('shell-changed', (e) => {
            this.updateShellInfo(e.detail.shellType, e.detail.sessionId);
        });

        // Listen for directory changes
        document.addEventListener('directory-changed', (e) => {
            this.updateDirectory(e.detail.path);
        });

        // Listen for tab changes
        document.addEventListener('tabs-changed', (e) => {
            this.updateSessionCount(e.detail.count);
        });

        // Listen for command execution
        document.addEventListener('command-executed', (e) => {
            this.updateCommandStatus(e.detail.command, e.detail.duration);
        });

        // Listen for git status updates
        document.addEventListener('git-status-changed', (e) => {
            this.updateGitStatus(e.detail.branch, e.detail.changes);
        });
    }

    startUpdates() {
        // Update time every second
        this.updateTime();
        setInterval(() => {
            this.updateTime();
        }, 1000);

        // Update system metrics every 2 seconds
        this.updateSystemMetrics();
        setInterval(() => {
            this.updateSystemMetrics();
        }, 2000);

        // Check git status every 5 seconds
        setInterval(() => {
            this.checkGitStatus();
        }, 5000);

        // Update connection status every 3 seconds
        setInterval(() => {
            this.updateConnectionStatus();
        }, 3000);
    }

    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        if (this.timeDisplay) {
            this.timeDisplay.textContent = timeString;
        }
    }

    async updateSystemMetrics() {
        try {
            const electronAPI = this.getElectronAPI();
            if (electronAPI) {
                const stats = await electronAPI.invoke('get-system-stats');
                
                if (this.cpuUsage && stats.cpu !== undefined) {
                    this.cpuUsage.textContent = `${stats.cpu}%`;
                    this.cpuUsage.classList.add('updating');
                    setTimeout(() => {
                        this.cpuUsage.classList.remove('updating');
                    }, 300);
                }
                
                if (this.memoryUsage && stats.memory) {
                    this.memoryUsage.textContent = stats.memory;
                    this.memoryUsage.classList.add('updating');
                    setTimeout(() => {
                        this.memoryUsage.classList.remove('updating');
                    }, 300);
                }
            }
        } catch (error) {
            // Silently handle errors - system metrics are optional
            if (this.cpuUsage) this.cpuUsage.textContent = '--';
            if (this.memoryUsage) this.memoryUsage.textContent = '--';
        }
    }

    async checkGitStatus() {
        try {
            const electronAPI = this.getElectronAPI();
            if (electronAPI) {
                const gitStatus = await electronAPI.invoke('get-git-status');
                
                if (gitStatus) {
                    this.updateGitStatus(gitStatus.branch, gitStatus.changes);
                    if (this.gitInfo) {
                        this.gitInfo.style.display = 'flex';
                    }
                } else {
                    if (this.gitInfo) {
                        this.gitInfo.style.display = 'none';
                    }
                }
            }
        } catch (error) {
            // Hide git info if not available
            if (this.gitInfo) {
                this.gitInfo.style.display = 'none';
            }
        }
    }

    updateShellInfo(shellType, sessionId) {
        const shellNames = {
            'powershell': 'PowerShell',
            'cmd': 'Command Prompt', 
            'wsl': 'WSL',
            'bash': 'Bash'
        };

        const shellIcons = {
            'powershell': '<path d="M23.53 12L20.56 9.22l-.44-.44-.01.01L18.36 7.04a.5.5 0 0 0-.71.71L19.8 10H12.5a.5.5 0 0 0 0 1h7.3l-2.15 2.25a.5.5 0 0 0 .71.71l1.75-1.75h.01l.44-.44L23.53 12z"/>',
            'cmd': '<path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 18V8h16v10H4z"/><path d="M6 10h2v2H6zm0 4h8v2H6z"/>',
            'wsl': '<path d="M3 3h18v18H3V3zm16 16V5H5v14h14z"/><path d="M7 7h2v2H7zm4 0h6v2h-6zm-4 4h10v2H7zm0 4h6v2H7z"/>',
            'bash': '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>'
        };

        if (this.shellName) {
            this.shellName.textContent = shellNames[shellType] || shellType;
        }

        if (this.shellIcon) {
            this.shellIcon.innerHTML = shellIcons[shellType] || shellIcons.cmd;
            this.shellIcon.className = `shell-icon ${shellType}`;
        }
    }

    updateDirectory(path) {
        if (this.currentPath) {
            // Shorten path if too long
            let displayPath = path;
            if (path.length > 40) {
                const parts = path.split(/[\\\/]/);
                if (parts.length > 3) {
                    displayPath = `${parts[0]}\\...\\${parts[parts.length-1]}`;
                }
            }
            this.currentPath.textContent = displayPath;
            this.currentPath.title = path; // Full path in tooltip
        }
    }

    updateSessionCount(count) {
        this.sessionCount = count;
        if (this.sessionCountDisplay) {
            this.sessionCountDisplay.textContent = `${count} tab${count !== 1 ? 's' : ''}`;
        }
    }

    updateCommandStatus(command, duration) {
        this.lastCommand = command;
        this.lastCommandTime = duration;
        
        if (this.commandLabel) {
            this.commandLabel.textContent = command.length > 20 ? 
                `${command.substring(0, 20)}...` : command;
        }
        
        if (this.commandTime && duration) {
            this.commandTime.textContent = `${duration}ms`;
            this.commandTime.style.display = 'block';
        }
    }

    updateGitStatus(branch, changes) {
        if (this.gitBranch) {
            this.gitBranch.textContent = branch || 'main';
        }
        
        if (this.gitChanges && changes) {
            if (changes.ahead || changes.behind) {
                let changeText = '';
                if (changes.ahead) changeText += `↑${changes.ahead}`;
                if (changes.behind) changeText += `↓${changes.behind}`;
                this.gitChanges.textContent = changeText;
            } else {
                this.gitChanges.textContent = '';
            }
        }
    }

    updateConnectionStatus() {
        const electronAPI = this.getElectronAPI();
        const isConnected = electronAPI !== null;
        
        if (this.connectionIcon) {
            this.connectionIcon.className = `connection-icon ${isConnected ? 'connected' : 'disconnected'}`;
        }
        
        if (this.connectionText) {
            this.connectionText.textContent = isConnected ? 'Connected' : 'Disconnected';
        }
    }

    updateLayout() {
        const width = window.innerWidth;
        
        // Show/hide elements based on screen size
        if (this.systemMetrics) {
            this.systemMetrics.style.display = width > 1200 ? 'flex' : 'none';
        }
        
        if (this.gitInfo) {
            const shouldShow = width > 900 && this.gitInfo.style.display !== 'none';
            this.gitInfo.style.display = shouldShow ? 'flex' : 'none';
        }
        
        if (this.commandStatus) {
            this.commandStatus.style.display = width > 600 ? 'flex' : 'none';
        }
    }

    // Action methods
    openDirectoryInExplorer() {
        const electronAPI = this.getElectronAPI();
        if (electronAPI) {
            electronAPI.invoke('open-directory-in-explorer', this.currentPath.textContent);
        }
    }

    openSettings() {
        const electronAPI = this.getElectronAPI();
        if (electronAPI) {
            electronAPI.invoke('open-settings');
        }
    }

    toggleAI() {
        // Toggle AI assistant
        if (window.floatingAI) {
            window.floatingAI.toggleWidget();
        }
        
        // Update button state
        if (this.aiControlBtn) {
            this.aiControlBtn.classList.toggle('active');
        }
    }

    showTimeInfo() {
        const now = new Date();
        const info = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;
        
        // Could show a tooltip or notification
        this.showTooltip(this.currentTimeContainer, info);
    }

    showShellInfo() {
        const info = `${this.shellName.textContent} - Session ID: ${this.sessionCount}`;
        this.showTooltip(this.shellIndicator, info);
    }

    showConnectionInfo() {
        const info = 'Terminal connection status';
        this.showTooltip(this.connectionStatus, info);
    }

    showTooltip(element, text) {
        // Simple tooltip implementation
        const tooltip = document.createElement('div');
        tooltip.className = 'status-tooltip';
        tooltip.textContent = text;
        tooltip.style.cssText = `
            position: absolute;
            bottom: 30px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg-tertiary, #2d2d30);
            color: var(--text-primary, #e5e5e5);
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 10px;
            white-space: nowrap;
            z-index: 10001;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        
        element.style.position = 'relative';
        element.appendChild(tooltip);
        
        // Animate in
        setTimeout(() => {
            tooltip.style.opacity = '1';
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            tooltip.style.opacity = '0';
            setTimeout(() => {
                if (tooltip.parentNode) {
                    tooltip.parentNode.removeChild(tooltip);
                }
            }, 200);
        }, 2000);
    }

    getElectronAPI() {
        return (global && global.electronAPI) || (window && window.electronAPI) || null;
    }

    // Public methods for external integration
    setShell(shellType) {
        this.updateShellInfo(shellType, null);
    }

    setDirectory(path) {
        this.updateDirectory(path);
    }

    setSessionCount(count) {
        this.updateSessionCount(count);
    }

    notifyCommand(command, duration) {
        this.updateCommandStatus(command, duration);
    }

    // Cleanup
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
    }
}

// Auto-initialize when DOM is loaded
let bottomStatusBar = null;

function initializeBottomStatusBar() {
    const statusBarHTML = document.querySelector('.bottom-status-bar');
    if (statusBarHTML && !bottomStatusBar) {
        bottomStatusBar = new BottomStatusBar();
        
        // Make it globally accessible
        window.bottomStatusBar = bottomStatusBar;
        
        console.log('📊 Bottom Status Bar initialized');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeBottomStatusBar);
} else {
    initializeBottomStatusBar();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BottomStatusBar;
}
