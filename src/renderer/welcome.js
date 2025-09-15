/**
 * Welcome Screen Controller
 * Handles the VS Code-like welcome screen functionality
 */

window.WelcomeScreen = (function() {
    let recentProjects = [];
    const maxRecentProjects = 10;

    // Initialize the welcome screen
    function init() {
        console.log('🎨 Initializing Welcome Screen...');
        
        // Load recent projects from local storage
        loadRecentProjects();
        
        // Set up event listeners
        setupEventListeners();
        
        // Update recent projects display
        updateRecentProjectsDisplay();
        
        console.log('✓ Welcome Screen initialized');
    }

    // Set up all event listeners
    function setupEventListeners() {
        // Action cards
        const actionCards = document.querySelectorAll('.action-card');
        actionCards.forEach(card => {
            card.addEventListener('click', handleActionCard);
        });

        // Recent project items
        const recentProjects = document.querySelectorAll('.recent-project');
        recentProjects.forEach(project => {
            project.addEventListener('click', handleRecentProject);
        });

        // Dialog handlers
        setupDialogHandlers();

        // Footer links
        document.getElementById('show-help')?.addEventListener('click', showHelp);
        document.getElementById('show-keyboard-shortcuts')?.addEventListener('click', showKeyboardShortcuts);
        document.getElementById('show-settings')?.addEventListener('click', showSettings);

        // More actions
        document.getElementById('clear-recent-btn')?.addEventListener('click', clearRecentProjects);
        document.getElementById('show-more-recent-btn')?.addEventListener('click', showMoreRecent);

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    // Handle action card clicks
    function handleActionCard(event) {
        const action = event.currentTarget.dataset.action;
        console.log('🔄 Action card clicked:', action);

        switch (action) {
            case 'create-project':
                showCreateProjectDialog();
                break;
            case 'open-folder':
                openFolder();
                break;
            case 'clone-repo':
                showCloneRepoDialog();
                break;
            case 'open-terminal':
                openTerminal();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }

    // Handle recent project clicks
    function handleRecentProject(event) {
        const projectPath = event.currentTarget.dataset.path;
        if (projectPath) {
            console.log('📂 Opening recent project:', projectPath);
            openProject(projectPath);
        }
    }

    // Dialog handlers
    function setupDialogHandlers() {
        // Dialog close buttons
        const closeButtons = document.querySelectorAll('.dialog-close, [data-dialog]');
        closeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const dialogId = button.dataset.dialog || button.closest('.dialog-overlay')?.id;
                if (dialogId) {
                    hideDialog(dialogId);
                }
            });
        });

        // Create project dialog
        document.getElementById('browse-location')?.addEventListener('click', browseFolderLocation);
        document.getElementById('create-project-confirm')?.addEventListener('click', createProject);

        // Clone repo dialog
        document.getElementById('browse-clone-location')?.addEventListener('click', browseCloneLocation);
        document.getElementById('clone-repo-confirm')?.addEventListener('click', cloneRepository);

        // Close dialogs when clicking overlay
        const overlays = document.querySelectorAll('.dialog-overlay');
        overlays.forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    hideDialog(overlay.id);
                }
            });
        });
    }

    // Show create project dialog
    function showCreateProjectDialog() {
        console.log('📝 Showing create project dialog');
        showDialog('create-project-dialog');
    }

    // Show clone repository dialog
    function showCloneRepoDialog() {
        console.log('🔄 Showing clone repository dialog');
        showDialog('clone-repo-dialog');
    }

    // Open folder browser
    async function openFolder() {
        console.log('📁 Opening folder browser');
        try {
            if (window.electronAPI?.showOpenDialog) {
                const result = await window.electronAPI.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Open Project Folder'
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    const projectPath = result.filePaths[0];
                    openProject(projectPath);
                }
            } else {
                console.warn('Electron API not available for folder selection');
                // Fallback: show input dialog
                const projectPath = prompt('Enter project path:');
                if (projectPath) {
                    openProject(projectPath);
                }
            }
        } catch (error) {
            console.error('Failed to open folder dialog:', error);
        }
    }

    // Open terminal directly
    function openTerminal() {
        console.log('💻 Opening terminal directly');
        addToRecentProjects('Terminal', process.cwd() || 'C:\\');
        transitionToTerminal();
    }

    // Open a project
    function openProject(projectPath) {
        console.log('🚀 Opening project:', projectPath);
        
        // Add to recent projects
        const projectName = projectPath.split(/[/\\]/).pop() || 'Unknown Project';
        addToRecentProjects(projectName, projectPath);
        
        // Change working directory if needed
        if (window.electronAPI?.changeDirectory) {
            window.electronAPI.changeDirectory(projectPath);
        }
        
        // Transition to terminal
        transitionToTerminal();
    }

    // Create new project
    async function createProject() {
        const projectName = document.getElementById('project-name').value.trim();
        const projectLocation = document.getElementById('project-location').value.trim();
        const projectTemplate = document.getElementById('project-template').value;

        if (!projectName) {
            alert('Please enter a project name');
            return;
        }

        if (!projectLocation) {
            alert('Please select a project location');
            return;
        }

        console.log('📝 Creating project:', { projectName, projectLocation, projectTemplate });

        try {
            const projectPath = `${projectLocation}/${projectName}`;
            
            // Create project directory through Electron API
            if (window.electronAPI?.createProject) {
                const result = await window.electronAPI.createProject({
                    name: projectName,
                    location: projectLocation,
                    template: projectTemplate
                });

                if (result.success) {
                    hideDialog('create-project-dialog');
                    openProject(projectPath);
                } else {
                    alert('Failed to create project: ' + (result.error || 'Unknown error'));
                }
            } else {
                console.warn('Electron API not available for project creation');
                // Fallback behavior
                addToRecentProjects(projectName, projectPath);
                hideDialog('create-project-dialog');
                transitionToTerminal();
            }
        } catch (error) {
            console.error('Failed to create project:', error);
            alert('Failed to create project: ' + error.message);
        }
    }

    // Clone repository
    async function cloneRepository() {
        const repoUrl = document.getElementById('repo-url').value.trim();
        const cloneLocation = document.getElementById('clone-location').value.trim();

        if (!repoUrl) {
            alert('Please enter a repository URL');
            return;
        }

        if (!cloneLocation) {
            alert('Please select a clone location');
            return;
        }

        console.log('🔄 Cloning repository:', { repoUrl, cloneLocation });

        try {
            // Extract repo name from URL
            const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repository';
            const projectPath = `${cloneLocation}/${repoName}`;

            if (window.electronAPI?.cloneRepository) {
                const result = await window.electronAPI.cloneRepository({
                    url: repoUrl,
                    location: cloneLocation
                });

                if (result.success) {
                    hideDialog('clone-repo-dialog');
                    openProject(projectPath);
                } else {
                    alert('Failed to clone repository: ' + (result.error || 'Unknown error'));
                }
            } else {
                console.warn('Electron API not available for repository cloning');
                // Fallback behavior
                addToRecentProjects(repoName, projectPath);
                hideDialog('clone-repo-dialog');
                transitionToTerminal();
            }
        } catch (error) {
            console.error('Failed to clone repository:', error);
            alert('Failed to clone repository: ' + error.message);
        }
    }

    // Browse for folder location
    async function browseFolderLocation() {
        try {
            if (window.electronAPI?.showOpenDialog) {
                const result = await window.electronAPI.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Select Project Location'
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    document.getElementById('project-location').value = result.filePaths[0];
                }
            }
        } catch (error) {
            console.error('Failed to browse for location:', error);
        }
    }

    // Browse for clone location
    async function browseCloneLocation() {
        try {
            if (window.electronAPI?.showOpenDialog) {
                const result = await window.electronAPI.showOpenDialog({
                    properties: ['openDirectory'],
                    title: 'Select Clone Location'
                });

                if (!result.canceled && result.filePaths.length > 0) {
                    document.getElementById('clone-location').value = result.filePaths[0];
                }
            }
        } catch (error) {
            console.error('Failed to browse for clone location:', error);
        }
    }

    // Transition from welcome screen to terminal
    function transitionToTerminal() {
        console.log('🔄 Transitioning to terminal...');
        
        const welcomeScreen = document.getElementById('welcome-screen-container');
        const appContainer = document.getElementById('app-container');
        
        if (welcomeScreen && appContainer) {
            // Fade out welcome screen
            welcomeScreen.style.opacity = '0';
            welcomeScreen.style.transition = 'opacity 0.3s ease';
            
            setTimeout(() => {
                welcomeScreen.style.display = 'none';
                appContainer.style.display = 'block';
                appContainer.style.opacity = '0';
                
                // Fade in terminal
                setTimeout(() => {
                    appContainer.style.transition = 'opacity 0.3s ease';
                    appContainer.style.opacity = '1';
                    
                    // Initialize terminal if needed
                    if (window.app && window.app.createFirstTab) {
                        window.app.createFirstTab();
                    }
                }, 50);
            }, 300);
        }
    }

    // Recent projects management
    function loadRecentProjects() {
        try {
            const stored = localStorage.getItem('cli-agent-recent-projects');
            if (stored) {
                recentProjects = JSON.parse(stored);
                console.log('📂 Loaded recent projects:', recentProjects.length);
            }
        } catch (error) {
            console.error('Failed to load recent projects:', error);
            recentProjects = [];
        }
    }

    function saveRecentProjects() {
        try {
            localStorage.setItem('cli-agent-recent-projects', JSON.stringify(recentProjects));
            console.log('💾 Saved recent projects:', recentProjects.length);
        } catch (error) {
            console.error('Failed to save recent projects:', error);
        }
    }

    function addToRecentProjects(name, path) {
        // Remove if already exists
        recentProjects = recentProjects.filter(p => p.path !== path);
        
        // Add to beginning
        recentProjects.unshift({
            name: name,
            path: path,
            lastOpened: new Date().toISOString()
        });
        
        // Limit to max items
        if (recentProjects.length > maxRecentProjects) {
            recentProjects = recentProjects.slice(0, maxRecentProjects);
        }
        
        saveRecentProjects();
        updateRecentProjectsDisplay();
    }

    function updateRecentProjectsDisplay() {
        const container = document.getElementById('recent-projects');
        if (!container) return;

        if (recentProjects.length === 0) {
            container.innerHTML = '<div class="no-recent-projects">No recent projects</div>';
            return;
        }

        const projectsHtml = recentProjects.map(project => `
            <div class="recent-project" data-path="${project.path}">
                <div class="project-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M10 4H4c-1.11 0-2 .89-2 2v12c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2h-8l-2-2z"/>
                    </svg>
                </div>
                <div class="project-info">
                    <div class="project-name">${project.name}</div>
                    <div class="project-path">${project.path}</div>
                </div>
                <div class="project-actions">
                    <button class="project-action-btn" title="Open in new window">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z"/>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');

        container.innerHTML = projectsHtml;

        // Re-attach event listeners to new elements
        const projectElements = container.querySelectorAll('.recent-project');
        projectElements.forEach(project => {
            project.addEventListener('click', handleRecentProject);
        });
    }

    function clearRecentProjects() {
        if (confirm('Clear all recent projects?')) {
            recentProjects = [];
            saveRecentProjects();
            updateRecentProjectsDisplay();
        }
    }

    function showMoreRecent() {
        console.log('📋 Show more recent projects');
        // This could open a larger dialog or expand the list
        alert('Feature coming soon!');
    }

    // Dialog management
    function showDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.style.display = 'flex';
            // Focus first input
            const firstInput = dialog.querySelector('input, select');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        }
    }

    function hideDialog(dialogId) {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            dialog.style.display = 'none';
            // Clear form inputs
            const inputs = dialog.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (input.type !== 'button' && input.type !== 'submit') {
                    input.value = '';
                }
            });
        }
    }

    // Footer actions
    function showHelp() {
        console.log('❓ Show help');
        alert('Help documentation coming soon!');
    }

    function showKeyboardShortcuts() {
        console.log('⌨️  Show keyboard shortcuts');
        alert('Keyboard shortcuts:\n\nCtrl+T - New Tab\nCtrl+W - Close Tab\nCtrl+` - Toggle Terminal\nF1 - Help');
    }

    function showSettings() {
        console.log('⚙️ Show settings');
        alert('Settings panel coming soon!');
    }

    // Keyboard shortcuts
    function handleKeyboardShortcuts(event) {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 'n':
                    event.preventDefault();
                    showCreateProjectDialog();
                    break;
                case 'o':
                    event.preventDefault();
                    openFolder();
                    break;
                case '`':
                    event.preventDefault();
                    openTerminal();
                    break;
            }
        }
        
        if (event.key === 'Escape') {
            // Close any open dialogs
            const openDialogs = document.querySelectorAll('.dialog-overlay[style*="flex"]');
            openDialogs.forEach(dialog => {
                hideDialog(dialog.id);
            });
        }
    }

    // Public API
    return {
        init,
        openProject,
        transitionToTerminal,
        addToRecentProjects
    };
})();
