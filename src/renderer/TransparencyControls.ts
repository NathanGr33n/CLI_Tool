export class TransparencyControlsUI {
  private container: HTMLElement;
  private transparencyManager: any;
  private isVisible = false;

  constructor(parentContainer: HTMLElement, transparencyManager: any) {
    this.transparencyManager = transparencyManager;
    this.container = this.createControlsUI();
    parentContainer.appendChild(this.container);
    this.bindEvents();
    this.updateUI();
  }

  private createControlsUI(): HTMLElement {
    const controls = document.createElement('div');
    controls.className = 'transparency-controls';
    controls.innerHTML = `
      <div class="transparency-header">
        <h4>🎨 Transparency</h4>
        <button class="toggle-transparency-controls" title="Toggle Transparency Controls">⚙️</button>
      </div>
      <div class="transparency-panel" style="display: none;">
        <div class="transparency-presets">
          <button class="preset-btn" data-preset="opaque">Opaque</button>
          <button class="preset-btn" data-preset="subtle">Subtle</button>
          <button class="preset-btn" data-preset="balanced">Balanced</button>
          <button class="preset-btn" data-preset="minimal">Minimal</button>
        </div>
        
        <div class="transparency-sliders">
          <div class="slider-group">
            <label for="window-opacity">Window: <span class="opacity-value">95%</span></label>
            <input type="range" id="window-opacity" min="10" max="100" step="5" value="95" class="opacity-slider">
          </div>
          
          <div class="slider-group">
            <label for="terminal-opacity">Terminal: <span class="opacity-value">90%</span></label>
            <input type="range" id="terminal-opacity" min="10" max="100" step="5" value="90" class="opacity-slider">
          </div>
          
          <div class="slider-group">
            <label for="sidebar-opacity">Sidebar: <span class="opacity-value">85%</span></label>
            <input type="range" id="sidebar-opacity" min="10" max="100" step="5" value="85" class="opacity-slider">
          </div>
          
          <div class="slider-group">
            <label for="tab-opacity">Tabs: <span class="opacity-value">90%</span></label>
            <input type="range" id="tab-opacity" min="10" max="100" step="5" value="90" class="opacity-slider">
          </div>
        </div>
        
        <div class="transparency-actions">
          <button class="transparency-toggle">Enable Transparency</button>
          <button class="reset-transparency">Reset</button>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .transparency-controls {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        margin: 12px;
        overflow: hidden;
        transition: all 0.3s ease;
      }

      .transparency-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: var(--bg-secondary);
        cursor: pointer;
        user-select: none;
      }

      .transparency-header h4 {
        margin: 0;
        font-size: 14px;
        color: var(--text-primary);
        font-weight: 600;
      }

      .toggle-transparency-controls {
        background: none;
        border: none;
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.15s ease;
        padding: 4px;
        border-radius: 4px;
      }

      .toggle-transparency-controls:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }

      .transparency-panel {
        padding: 16px;
        background: var(--bg-tertiary);
      }

      .transparency-presets {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }

      .preset-btn {
        padding: 8px 12px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        color: var(--text-secondary);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.15s ease;
      }

      .preset-btn:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
        border-color: var(--accent-blue);
      }

      .preset-btn.active {
        background: var(--accent-blue);
        color: white;
        border-color: var(--accent-blue);
      }

      .transparency-sliders {
        margin-bottom: 16px;
      }

      .slider-group {
        margin-bottom: 12px;
      }

      .slider-group label {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 12px;
        color: var(--text-secondary);
        font-weight: 500;
      }

      .opacity-value {
        color: var(--accent-blue);
        font-weight: 600;
        min-width: 32px;
        text-align: right;
      }

      .opacity-slider {
        width: 100%;
        height: 6px;
        background: var(--bg-secondary);
        border-radius: 3px;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }

      .opacity-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        background: var(--accent-blue);
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: all 0.15s ease;
      }

      .opacity-slider::-webkit-slider-thumb:hover {
        transform: scale(1.1);
        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
      }

      .opacity-slider::-moz-range-thumb {
        width: 18px;
        height: 18px;
        background: var(--accent-blue);
        border-radius: 50%;
        border: none;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: all 0.15s ease;
      }

      .transparency-actions {
        display: flex;
        gap: 8px;
      }

      .transparency-toggle, .reset-transparency {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--border-color);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 500;
        transition: all 0.15s ease;
      }

      .transparency-toggle {
        background: var(--accent-blue);
        color: white;
        border-color: var(--accent-blue);
      }

      .transparency-toggle:hover {
        background: #005a9e;
      }

      .transparency-toggle.disabled {
        background: var(--bg-secondary);
        color: var(--text-muted);
        border-color: var(--border-color);
      }

      .reset-transparency {
        background: var(--bg-secondary);
        color: var(--text-secondary);
      }

      .reset-transparency:hover {
        background: var(--bg-hover);
        color: var(--text-primary);
      }
    `;
    document.head.appendChild(style);

    return controls;
  }

  private bindEvents(): void {
    const header = this.container.querySelector('.transparency-header') as HTMLElement;
    const toggleBtn = this.container.querySelector('.toggle-transparency-controls') as HTMLElement;
    const panel = this.container.querySelector('.transparency-panel') as HTMLElement;
    
    // Toggle panel visibility
    const togglePanel = () => {
      this.isVisible = !this.isVisible;
      panel.style.display = this.isVisible ? 'block' : 'none';
      toggleBtn.style.transform = this.isVisible ? 'rotate(180deg)' : 'rotate(0deg)';
    };
    
    header.addEventListener('click', togglePanel);

    // Preset buttons
    const presetBtns = this.container.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const preset = (e.target as HTMLElement).getAttribute('data-preset') as any;
        this.transparencyManager.setPreset(preset);
        this.updatePresetButtons(preset);
        this.updateUI();
      });
    });

    // Opacity sliders
    const sliders = this.container.querySelectorAll('.opacity-slider');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value) / 100;
        const id = target.id;

        // Update display value
        const valueDisplay = target.parentElement?.querySelector('.opacity-value') as HTMLElement;
        if (valueDisplay) {
          valueDisplay.textContent = `${target.value}%`;
        }

        // Apply transparency
        switch (id) {
          case 'window-opacity':
            this.transparencyManager.setWindowOpacity(value);
            break;
          case 'terminal-opacity':
            this.transparencyManager.setTerminalOpacity(value);
            break;
          case 'sidebar-opacity':
            this.transparencyManager.setSidebarOpacity(value);
            break;
          case 'tab-opacity':
            this.transparencyManager.setTabOpacity(value);
            break;
        }
      });
    });

    // Toggle transparency
    const toggleTransparency = this.container.querySelector('.transparency-toggle') as HTMLElement;
    toggleTransparency.addEventListener('click', () => {
      const settings = this.transparencyManager.getSettings();
      this.transparencyManager.setEnabled(!settings.enabled);
      this.updateUI();
    });

    // Reset button
    const resetBtn = this.container.querySelector('.reset-transparency') as HTMLElement;
    resetBtn.addEventListener('click', () => {
      this.transparencyManager.resetToDefaults();
      this.updateUI();
    });
  }

  updateUI(): void {
    const settings = this.transparencyManager.getSettings();

    // Update sliders
    const windowSlider = this.container.querySelector('#window-opacity') as HTMLInputElement;
    const terminalSlider = this.container.querySelector('#terminal-opacity') as HTMLInputElement;
    const sidebarSlider = this.container.querySelector('#sidebar-opacity') as HTMLInputElement;
    const tabSlider = this.container.querySelector('#tab-opacity') as HTMLInputElement;

    if (windowSlider) {
      windowSlider.value = (settings.windowOpacity * 100).toString();
      const valueDisplay = windowSlider.parentElement?.querySelector('.opacity-value') as HTMLElement;
      if (valueDisplay) valueDisplay.textContent = `${Math.round(settings.windowOpacity * 100)}%`;
    }

    if (terminalSlider) {
      terminalSlider.value = (settings.terminalOpacity * 100).toString();
      const valueDisplay = terminalSlider.parentElement?.querySelector('.opacity-value') as HTMLElement;
      if (valueDisplay) valueDisplay.textContent = `${Math.round(settings.terminalOpacity * 100)}%`;
    }

    if (sidebarSlider) {
      sidebarSlider.value = (settings.sidebarOpacity * 100).toString();
      const valueDisplay = sidebarSlider.parentElement?.querySelector('.opacity-value') as HTMLElement;
      if (valueDisplay) valueDisplay.textContent = `${Math.round(settings.sidebarOpacity * 100)}%`;
    }

    if (tabSlider) {
      tabSlider.value = (settings.tabOpacity * 100).toString();
      const valueDisplay = tabSlider.parentElement?.querySelector('.opacity-value') as HTMLElement;
      if (valueDisplay) valueDisplay.textContent = `${Math.round(settings.tabOpacity * 100)}%`;
    }

    // Update toggle button
    const toggleBtn = this.container.querySelector('.transparency-toggle') as HTMLElement;
    if (toggleBtn) {
      toggleBtn.textContent = settings.enabled ? 'Disable Transparency' : 'Enable Transparency';
      toggleBtn.className = `transparency-toggle ${!settings.enabled ? 'disabled' : ''}`;
    }
  }

  updatePresetButtons(activePreset: string): void {
    const presetBtns = this.container.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-preset') === activePreset);
    });
  }

  show(): void {
    this.container.style.display = 'block';
  }

  hide(): void {
    this.container.style.display = 'none';
  }

  destroy(): void {
    this.container.remove();
  }
}
