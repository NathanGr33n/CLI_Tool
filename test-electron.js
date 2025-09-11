const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Starting minimal Electron test...');

let mainWindow;

function createWindow() {
  console.log('Creating window...');
  
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Simple HTML content
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Electron Test</title>
        <style>
          body { 
            background: #1e1e1e; 
            color: #e5e5e5; 
            font-family: Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
          }
          h1 { color: #007acc; }
        </style>
      </head>
      <body>
        <div>
          <h1>✅ Electron is Working!</h1>
          <p>If you see this, the basic Electron setup is functional.</p>
          <p>Time: ${new Date().toLocaleString()}</p>
        </div>
      </body>
    </html>
  `;

  mainWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent));

  mainWindow.on('ready-to-show', () => {
    console.log('Window ready to show');
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    console.log('Window closed');
    mainWindow = null;
  });
  
  console.log('Window created successfully');
}

app.whenReady().then(() => {
  console.log('App ready');
  createWindow();
}).catch(error => {
  console.error('App ready error:', error);
});

app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

console.log('Electron test script loaded');
