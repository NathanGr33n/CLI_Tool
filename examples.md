# CLI Agent Examples

This document demonstrates how to use the custom CLI agent tool with practical examples.

## Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Initialize configuration:
   ```bash
   node dist/index.js init
   ```

4. Check status:
   ```bash
   node dist/index.js status
   ```

## Example Usage

### File Operations

```bash
# Read a file
node dist/index.js agent "show me package.json" --yes

# Read specific lines
node dist/index.js agent "show me lines 1-10 of README.md" --yes

# List files
node dist/index.js agent "show me all TypeScript files" --yes
```

### Command Execution

```bash
# Git operations
node dist/index.js agent "run git status" --yes
node dist/index.js agent "check git log" --yes

# NPM operations  
node dist/index.js agent "run npm list" --yes

# System info
node dist/index.js agent "show system info" --yes
```

### Project Analysis

```bash
# Analyze project structure
node dist/index.js agent "analyze this project" --yes

# Get project overview
node dist/index.js agent "what kind of project is this?" --yes
```

### Interactive Mode

```bash
# Start interactive session
node dist/index.js

# Then try commands like:
> help
> read package.json  
> run git status
> analyze project
> quit
```

## Test Scenarios

### Scenario 1: New Project Setup
1. Initialize a new project directory
2. Run `node dist/index.js init` to create configuration
3. Use `node dist/index.js agent "analyze project"` to understand structure
4. Use `node dist/index.js agent "run git init"` to initialize version control

### Scenario 2: Code Review Assistant
1. Use `node dist/index.js agent "show me recent git changes"`
2. Use `node dist/index.js agent "read src/index.ts"`
3. Use `node dist/index.js agent "run eslint src/"`

### Scenario 3: Documentation Helper
1. Use `node dist/index.js agent "read README.md"`
2. Use `node dist/index.js agent "show me package.json dependencies"`
3. Use `node dist/index.js agent "list all markdown files"`

## Configuration Examples

### Custom File Extensions
Edit `.cli-agent.yml`:
```yaml
allowedFileExtensions:
  - .js
  - .ts
  - .py
  - .go
  - .rs
```

### Custom Safe Commands
```yaml
safeCommands:
  - git
  - npm
  - yarn
  - docker
  - kubectl
```

### Path Restrictions
```yaml
forbiddenPaths:
  - node_modules
  - .git
  - dist
  - build
  - .env
```

## Error Scenarios to Test

1. **File not found**: `node dist/index.js agent "read nonexistent.txt"`
2. **Dangerous command**: `node dist/index.js agent "run rm -rf /"`
3. **Large file**: Try reading a file larger than maxFileSize
4. **Invalid path**: `node dist/index.js agent "read /etc/shadow"`

## Performance Tests

1. **Large directory**: Analyze a project with 1000+ files
2. **Long command**: Run a command that takes several seconds
3. **Multiple operations**: Chain several file operations together

## Security Tests

1. Verify dangerous commands are blocked
2. Test path traversal attempts (`../../../etc/passwd`)
3. Verify file size limits are enforced
4. Test command injection attempts

## Expected Outputs

All examples above should work without errors when run in the CLI_Tool directory after building the project. The agent should:

- Parse natural language commands correctly
- Execute file operations safely
- Run commands with proper security checks
- Provide helpful error messages when things go wrong
- Display results in a user-friendly format
