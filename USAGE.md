# CLI Agent Usage

Your CLI Agent now has two simple, working modes:

## 🖥️ Terminal Version (Text-based)
```bash
npm run terminal
```
- Interactive command-line interface
- Works in any terminal/command prompt
- Full agent functionality with text commands
- Great for automation, scripting, and headless environments

## 🎛️ GUI Version (Electron-based)
```bash
npm run gui
```  
- Full graphical interface with terminal emulator
- Multiple shell types (PowerShell, CMD, WSL)
- Built-in AI assistant panel
- Visual file operations and status monitoring
- Perfect for interactive development work

## 🛠️ Setup
Before using either version, make sure to build the project:
```bash
npm install
npm run build
```

## 💡 Tips
- **Terminal version**: Use `exit` or `Ctrl+C` to quit
- **GUI version**: Use `Ctrl+Q` to quit (the X button is disabled to prevent accidental closure)
- If you encounter issues, try rebuilding with `npm run build`
- The GUI version works best on Windows with the compatibility flags we've included

## 🔧 Development
- `npm run dev`: Run terminal version in development mode (no build required)
- `npm run build`: Compile TypeScript and copy static files
- Both versions use the same core engine and agent functionality

That's it! Two simple commands for two different interfaces. 🚀
