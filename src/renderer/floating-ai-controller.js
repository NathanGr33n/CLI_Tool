/**
 * Floating AI Widget Controller
 * Manages the collapsed/expanded states and interactions
 */
class FloatingAIWidget {
    constructor() {
        this.isExpanded = false;
        this.isDragging = false;
        this.dragOffset = { x: 0, y: 0 };
        this.messageHistory = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectToExistingAgent();
    }

    initializeElements() {
        this.widget = document.getElementById('floating-ai-widget');
        this.toggleFab = document.getElementById('ai-toggle-fab');
        this.chatPopup = document.getElementById('ai-chat-popup');
        this.messagesContainer = document.getElementById('ai-popup-messages');
        this.inputField = document.getElementById('ai-input-field');
        this.sendBtn = document.getElementById('ai-send-btn');
        this.minimizeBtn = document.getElementById('minimize-popup');
        this.closeBtn = document.getElementById('close-popup');
        this.notificationDot = document.getElementById('notification-dot');
        
        // Quick action buttons
        this.quickActionBtns = document.querySelectorAll('.quick-action-btn');
    }

    setupEventListeners() {
        // Toggle between collapsed and expanded states
        this.toggleFab.addEventListener('click', () => {
            this.toggleWidget();
        });

        // Minimize and close buttons
        this.minimizeBtn.addEventListener('click', () => {
            this.minimizeWidget();
        });

        this.closeBtn.addEventListener('click', () => {
            this.hideWidget();
        });

        // Send message
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter key to send message
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });

        // Input field focus handling
        this.inputField.addEventListener('focus', () => {
            this.inputField.parentElement.style.borderColor = '#007acc';
        });

        this.inputField.addEventListener('blur', () => {
            this.inputField.parentElement.style.borderColor = 'var(--border-color, #3e3e42)';
        });

        // Quick action buttons
        this.quickActionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.closest('.quick-action-btn').getAttribute('data-action');
                this.handleQuickAction(action);
            });
        });

        // Drag functionality for the popup
        this.setupDragFunctionality();

        // Close popup when clicking outside
        document.addEventListener('click', (e) => {
            if (this.isExpanded && !this.widget.contains(e.target)) {
                this.minimizeWidget();
            }
        });

        // Prevent popup from closing when clicking inside
        this.chatPopup.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Shift + A to toggle AI widget
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggleWidget();
            }
            
            // Escape to minimize widget if expanded
            if (e.key === 'Escape' && this.isExpanded) {
                this.minimizeWidget();
            }
        });
    }

    setupDragFunctionality() {
        const header = this.chatPopup.querySelector('.ai-popup-header');
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.closest('.popup-control-btn')) return;
            
            this.isDragging = true;
            const rect = this.widget.getBoundingClientRect();
            this.dragOffset = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top
            };
            
            document.addEventListener('mousemove', this.handleDrag);
            document.addEventListener('mouseup', this.handleDragEnd);
            
            header.style.cursor = 'grabbing';
        });
    }

    handleDrag = (e) => {
        if (!this.isDragging) return;
        
        const x = e.clientX - this.dragOffset.x;
        const y = e.clientY - this.dragOffset.y;
        
        // Constrain to viewport
        const maxX = window.innerWidth - this.widget.offsetWidth;
        const maxY = window.innerHeight - this.widget.offsetHeight;
        
        const constrainedX = Math.max(0, Math.min(x, maxX));
        const constrainedY = Math.max(0, Math.min(y, maxY));
        
        this.widget.style.left = `${constrainedX}px`;
        this.widget.style.top = `${constrainedY}px`;
        this.widget.style.right = 'auto';
        this.widget.style.bottom = 'auto';
    };

    handleDragEnd = () => {
        this.isDragging = false;
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.handleDragEnd);
        
        const header = this.chatPopup.querySelector('.ai-popup-header');
        header.style.cursor = 'move';
    };

    toggleWidget() {
        if (this.isExpanded) {
            this.minimizeWidget();
        } else {
            this.expandWidget();
        }
    }

    expandWidget() {
        this.isExpanded = true;
        this.chatPopup.style.display = 'block';
        
        // Trigger reflow for animation
        this.chatPopup.offsetHeight;
        
        this.chatPopup.classList.add('show');
        this.toggleFab.style.opacity = '0.7';
        
        // Focus input field after animation
        setTimeout(() => {
            this.inputField.focus();
        }, 300);
        
        // Hide notification dot
        this.hideNotification();
    }

    minimizeWidget() {
        this.isExpanded = false;
        this.chatPopup.classList.remove('show');
        this.toggleFab.style.opacity = '1';
        
        // Add bounce animation
        this.widget.classList.add('minimizing');
        
        setTimeout(() => {
            this.chatPopup.style.display = 'none';
            this.widget.classList.remove('minimizing');
        }, 300);
    }

    hideWidget() {
        this.minimizeWidget();
        // Could add logic to completely hide the FAB if needed
    }

    sendMessage() {
        const message = this.inputField.value.trim();
        if (!message) return;

        // Add user message to chat
        this.addMessage('user', message);
        
        // Clear input
        this.inputField.value = '';
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Send to AI agent (integrate with existing agent system)
        this.sendToAgent(message);
    }

    addMessage(type, content, timestamp = new Date()) {
        const messageElement = document.createElement('div');
        messageElement.className = 'ai-message-item';
        
        const isUser = type === 'user';
        const avatarIcon = isUser ? '👤' : '🤖';
        const messageClass = isUser ? 'message-content-user' : 'message-content-ai';
        const avatarClass = isUser ? 'user-avatar' : 'ai-avatar';
        
        messageElement.innerHTML = `
            <div class="${messageClass}">
                <div class="${avatarClass}">${avatarIcon}</div>
                <div class="message-text">
                    <p>${content}</p>
                    <div class="message-time">${this.formatTime(timestamp)}</div>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(messageElement);
        this.scrollToBottom();
        
        // Store in history
        this.messageHistory.push({
            type,
            content,
            timestamp
        });
    }

    showTypingIndicator() {
        const typingElement = document.createElement('div');
        typingElement.className = 'typing-indicator';
        typingElement.innerHTML = `
            AI is typing...
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.messagesContainer.appendChild(typingElement);
        this.scrollToBottom();
    }

    removeTypingIndicator() {
        const typingIndicator = this.messagesContainer.querySelector('.typing-indicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }

    async sendToAgent(message) {
        try {
            // Get the existing electronAPI
            const electronAPI = this.getElectronAPI();
            if (!electronAPI) {
                throw new Error('Electron API not available');
            }

            // Send message to agent
            const response = await electronAPI.agentMessage(message);
            
            // Remove typing indicator
            this.removeTypingIndicator();
            
            // Add response message
            if (response && response.response) {
                this.addMessage('ai', response.response);
            } else {
                this.addMessage('ai', 'I apologize, but I encountered an issue processing your request.');
            }
            
        } catch (error) {
            console.error('Error sending message to agent:', error);
            this.removeTypingIndicator();
            this.addMessage('ai', 'Sorry, I\'m having trouble connecting. Please try again later.');
        }
    }

    handleQuickAction(action) {
        switch (action) {
            case 'help':
                this.addMessage('user', 'help');
                this.sendToAgent('help');
                break;
            case 'analyze':
                this.addMessage('user', 'analyze current project');
                this.sendToAgent('analyze current project');
                break;
            case 'commands':
                this.addMessage('user', 'show available commands');
                this.sendToAgent('show available commands');
                break;
        }
    }

    showNotification() {
        this.notificationDot.style.display = 'block';
    }

    hideNotification() {
        this.notificationDot.style.display = 'none';
    }

    connectToExistingAgent() {
        // Try to get existing messages from the main agent sidebar
        try {
            const existingMessages = document.getElementById('agent-messages');
            if (existingMessages) {
                const messages = existingMessages.querySelectorAll('.agent-message');
                messages.forEach(msg => {
                    const isUser = msg.classList.contains('agent-message-user');
                    const content = msg.querySelector('.message-content').textContent;
                    if (content && content.trim()) {
                        this.messageHistory.push({
                            type: isUser ? 'user' : 'ai',
                            content: content.trim(),
                            timestamp: new Date()
                        });
                    }
                });
            }
        } catch (error) {
            console.log('No existing agent messages found');
        }
    }

    getElectronAPI() {
        return (global && global.electronAPI) || (window && window.electronAPI) || null;
    }

    formatTime(timestamp) {
        return timestamp.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    scrollToBottom() {
        setTimeout(() => {
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        }, 100);
    }

    // Public methods for external integration
    notify() {
        if (!this.isExpanded) {
            this.showNotification();
        }
    }

    addExternalMessage(type, content) {
        this.addMessage(type, content);
        if (!this.isExpanded) {
            this.notify();
        }
    }

    // Cleanup method
    destroy() {
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.handleDragEnd);
    }
}

// Auto-initialize when DOM is loaded
let floatingAIWidget = null;

function initializeFloatingAI() {
    const widgetHTML = document.querySelector('.floating-ai-widget');
    if (widgetHTML && !floatingAIWidget) {
        floatingAIWidget = new FloatingAIWidget();
        
        // Make it globally accessible
        window.floatingAI = floatingAIWidget;
        
        console.log('🤖 Floating AI Widget initialized');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFloatingAI);
} else {
    initializeFloatingAI();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FloatingAIWidget;
}
