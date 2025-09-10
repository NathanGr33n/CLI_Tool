# Custom CLI Agent Tool

A powerful CLI agent that understands natural language, can read and write files, execute commands securely, and help with project management tasks - similar to Warp's agent functionality but running locally.

## Features

- 🗂️ **File Operations**: Read, write, edit, and manage project files
- ⚡ **Command Execution**: Run system commands with built-in security checks  
- 🧠 **Natural Language Understanding**: Interact using plain English
- 🔒 **Security**: Configurable safeguards for file access and command execution
- 📊 **Project Analysis**: Understand project structure, Git status, dependencies
- 🎯 **Interactive Mode**: Conversational interface for complex workflows
- 🚀 **Single Command Mode**: Execute one-off tasks quickly

## Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the project:
   ```bash
   npm run build
   ```
4. Link globally (optional):
   ```bash
   npm link
   ```

## Usage

### Interactive Mode (Default)

Start an interactive session where you can have a conversation with the agent:

```bash
cli-agent
# or
cli-agent run
```

Example interactions:
```
> read package.json
> show me the git status  
> create a new file called hello.js with console.log('Hello World')
> run npm install
> analyze this project
```

### Single Command Mode

Execute a single command and exit:

```bash
cli-agent agent "read the README file"
cli-agent agent "show me git status" --yes
cli-agent agent "list all JavaScript files" --dry-run
```

### Other Commands

- **Status**: Check project and environment info
  ```bash
  cli-agent status
  cli-agent status --format json
  ```

- **Initialize**: Create configuration file
  ```bash
  cli-agent init
  cli-agent init --force  # Overwrite existing config
  ```

- **Help**: Show usage information
  ```bash
  cli-agent --help
  cli-agent <command> --help
  ```

## Configuration

The agent uses a `.cli-agent.yml` configuration file to control behavior:

```yaml
name: cli-agent
version: 1.0.0
workingDirectory: /path/to/project
maxFileSize: 10485760  # 10MB
allowedFileExtensions:
  - .js
  - .ts
  - .json
  - .md
  # ... more extensions
forbiddenPaths:
  - node_modules
  - .git
  - dist
safeCommands:
  - npm
  - git
  - node
  # ... more commands
dangerousCommands:
  - rm
  - del
  - format
  # ... dangerous commands to block
```

Create a configuration file:
```bash
cli-agent init
```

## Examples

### File Operations

```bash
# Read file contents
cli-agent agent "show me package.json"

# Create a new file
cli-agent agent "create a new TypeScript file called utils.ts with basic helper functions"

# Edit existing file
cli-agent agent "replace 'old text' with 'new text' in config.js"

# List files
cli-agent agent "show me all JavaScript files in src directory"
```

### Command Execution

```bash
# Run npm commands
cli-agent agent "install dependencies with npm"
cli-agent agent "run the build script"

# Git operations
cli-agent agent "check git status"
cli-agent agent "show me recent commits"

# System info
cli-agent agent "show system information"
```

### Project Analysis

```bash
# Analyze project structure
cli-agent agent "analyze this project"

# Get project overview
cli-agent agent "what kind of project is this?"

# Check dependencies
cli-agent agent "show me the project dependencies"
```

## Security Features

- **File Access Control**: Configurable file size limits and allowed extensions
- **Path Restrictions**: Prevent access to system directories and forbidden paths
- **Command Filtering**: Allow-list and block-list for system commands
- **Confirmation Prompts**: Dangerous operations require user confirmation
- **Dry-run Mode**: Preview actions without executing them

## Development

### Project Structure

```
src/
├── core/           # Core agent functionality
│   ├── AgentCore.ts       # Main orchestrator
│   ├── FileOperations.ts  # File handling
│   ├── CommandExecutor.ts # Command execution
│   └── IntentParser.ts    # Natural language parsing
├── commands/       # CLI command implementations
├── utils/          # Utilities (Logger, ConfigManager)
├── types/          # TypeScript type definitions
└── index.ts        # CLI entry point
```

### Commands

- `npm run dev`: Run in development mode
- `npm run build`: Build the project
- `npm run lint`: Lint code
- `npm run format`: Format code
- `npm test`: Run tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Inspiration

This project was inspired by Warp's agent functionality, providing similar capabilities for local development environments without requiring cloud services.

# CLI_Tool
Custom built CLI tool
