#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { version } from '../package.json';
import { AgentCore } from './core/AgentCore';
import { Logger } from './utils/Logger';
import { ConfigManager } from './utils/ConfigManager';
import { runInteractiveMode } from './commands/interactive';
import { runAgentCommand } from './commands/agent';
import { showStatus } from './commands/status';
import { initProject } from './commands/init';

const logger = new Logger();

async function main() {
  const program = new Command();
  
  program
    .name('cli-agent')
    .description('A custom CLI agent tool with file operations, command execution, and natural language understanding')
    .version(version);

  // Interactive mode (default)
  program
    .command('run', { isDefault: true })
    .description('Start interactive agent mode')
    .option('-d, --directory <path>', 'Set working directory', process.cwd())
    .option('-c, --config <file>', 'Configuration file path')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (options) => {
      try {
        if (options.verbose) {
          logger.setLevel('debug');
        }
        
        const config = await ConfigManager.load(options.config);
        const agent = new AgentCore(config, logger);
        
        await runInteractiveMode(agent, options);
      } catch (error) {
        logger.error('Failed to start interactive mode:', error);
        process.exit(1);
      }
    });

  // Agent command execution
  program
    .command('agent <prompt>')
    .description('Execute a single agent command')
    .option('-d, --directory <path>', 'Set working directory', process.cwd())
    .option('-c, --config <file>', 'Configuration file path')
    .option('-y, --yes', 'Auto-approve all actions')
    .option('--dry-run', 'Show what would be done without executing')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (prompt, options) => {
      try {
        if (options.verbose) {
          logger.setLevel('debug');
        }
        
        const config = await ConfigManager.load(options.config);
        const agent = new AgentCore(config, logger);
        
        await runAgentCommand(agent, prompt, options);
      } catch (error) {
        logger.error('Failed to execute agent command:', error);
        process.exit(1);
      }
    });

  // Status command
  program
    .command('status')
    .description('Show current project status and context')
    .option('-d, --directory <path>', 'Set working directory', process.cwd())
    .option('-f, --format <type>', 'Output format (json|table)', 'table')
    .action(async (options) => {
      try {
        await showStatus(options);
      } catch (error) {
        logger.error('Failed to show status:', error);
        process.exit(1);
      }
    });

  // Init command
  program
    .command('init')
    .description('Initialize CLI agent configuration in current directory')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (options) => {
      try {
        await initProject(options);
      } catch (error) {
        logger.error('Failed to initialize project:', error);
        process.exit(1);
      }
    });

  // File operations
  program
    .command('files')
    .description('File operation commands')
    .addCommand(
      new Command('read')
        .description('Read file contents')
        .argument('<path>', 'File path to read')
        .option('-l, --lines <range>', 'Line range (e.g., 1-10)')
        .action(async (path, options) => {
          // Implementation will be added later
          console.log(`Reading file: ${path}`);
        })
    )
    .addCommand(
      new Command('write')
        .description('Write content to file')
        .argument('<path>', 'File path to write')
        .option('-c, --content <text>', 'Content to write')
        .option('-a, --append', 'Append to file instead of overwriting')
        .action(async (path, options) => {
          // Implementation will be added later
          console.log(`Writing to file: ${path}`);
        })
    );

  // Help customization
  program.configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name() + (cmd.alias() ? `|${cmd.alias()}` : ''),
  });

  // Error handling
  program.exitOverride();
  
  try {
    await program.parseAsync();
  } catch (error: any) {
    if (error.code === 'commander.help') {
      // Help was displayed, exit cleanly
      process.exit(0);
    } else if (error.code === 'commander.version') {
      // Version was displayed, exit cleanly
      process.exit(0);
    } else {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
  });
}

export { main };
