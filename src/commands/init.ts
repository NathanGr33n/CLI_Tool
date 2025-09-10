import chalk from 'chalk';
import { ConfigManager } from '../utils/ConfigManager';

export async function initProject(options: any): Promise<void> {
  console.log(chalk.blue.bold('🚀 CLI Agent Initialization'));
  console.log(chalk.gray('Setting up configuration for the current project\n'));

  try {
    // Check if config already exists
    const existingConfig = await ConfigManager.findConfig();
    
    if (existingConfig && !options.force) {
      console.log(chalk.yellow('⚠️  Configuration file already exists:'));
      console.log(chalk.dim(`   ${existingConfig}`));
      console.log(chalk.yellow('Use --force to overwrite the existing configuration.\n'));
      return;
    }

    // Create new configuration
    const configPath = await ConfigManager.init(undefined, options.force);
    
    console.log(chalk.green('✅ Configuration file created successfully!'));
    console.log(chalk.dim(`   Location: ${configPath}\n`));

    // Display next steps
    console.log(chalk.cyan.bold('🎯 Next Steps:'));
    console.log(chalk.cyan('1. Review and customize the configuration file'));
    console.log(chalk.cyan('2. Run "cli-agent status" to verify the setup'));
    console.log(chalk.cyan('3. Start using the agent with "cli-agent" (interactive mode)'));
    console.log(chalk.cyan('4. Or run single commands with "cli-agent agent <prompt>"\n'));

    // Display configuration preview
    console.log(chalk.blue.bold('📄 Configuration Preview:'));
    try {
      const config = await ConfigManager.load(configPath);
      console.log(chalk.dim(`   Project: ${config.name} v${config.version}`));
      console.log(chalk.dim(`   Working Directory: ${config.workingDirectory}`));
      console.log(chalk.dim(`   Max File Size: ${config.maxFileSize / (1024 * 1024)}MB`));
      console.log(chalk.dim(`   Allowed File Types: ${config.allowedFileExtensions.length} extensions`));
      console.log(chalk.dim(`   Safe Commands: ${config.safeCommands.length} commands`));
      console.log(chalk.dim(`   Dangerous Commands: ${config.dangerousCommands.length} commands (blocked)`));
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not preview configuration'));
    }

    console.log(chalk.green.bold('\n🎉 Ready to use CLI Agent!'));
    console.log(chalk.gray('Type "cli-agent --help" to see all available commands.'));

  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log(chalk.yellow('Configuration file already exists. Use --force to overwrite.'));
    } else {
      console.error(chalk.red('Failed to initialize project:'), error);
      process.exit(1);
    }
  }
}
