// Simple debug test script
console.log('🔥 DEBUG TEST SCRIPT LOADED SUCCESSFULLY!');
console.log('📍 Current URL:', window.location.href);
console.log('📍 Document ready state:', document.readyState);
console.log('📍 Available globals:', {
    Terminal: typeof Terminal,
    electronAPI: typeof window.electronAPI,
    global: typeof global
});

// Test DOM elements
const elements = {
    appContainer: document.getElementById('app-container'),
    tabsContainer: document.getElementById('tabs-container'),
    terminalArea: document.getElementById('terminal-area'),
    statusBar: document.getElementById('bottom-status-bar')
};

console.log('📍 DOM elements:', {
    appContainer: !!elements.appContainer,
    tabsContainer: !!elements.tabsContainer, 
    terminalArea: !!elements.terminalArea,
    statusBar: !!elements.statusBar
});

// Log all element visibility
Object.entries(elements).forEach(([name, element]) => {
    if (element) {
        const style = window.getComputedStyle(element);
        console.log(`📍 ${name}:`, {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity
        });
    }
});

// Alert that debug script ran
window.debugTestRan = true;
console.log('🔥 DEBUG TEST COMPLETE - Setting window.debugTestRan = true');
