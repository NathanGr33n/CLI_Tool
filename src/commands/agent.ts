import chalk from 'chalk';
import ora from 'ora';
import { AgentCore } from '../core/AgentCore';

export async function runAgentCommand(agent: AgentCore, prompt: string, options: any): Promise<void> {
  console.log(chalk.blue.bold('🤖 CLI Agent - Single Command Mode'));
  console.log(chalk.gray(`Prompt: "${prompt}"\n`));

  try {
    // Analyze project if not in dry-run mode
    if (!options.dryRun) {
      const spinner = ora('Analyzing project...').start();
      try {
        await agent.analyzeProject();
        spinner.succeed('Project analyzed');
      } catch (error) {
        spinner.warn('Could not fully analyze project');
      }
    }

    // Process the prompt
    const processingSpinner = ora('Processing prompt...').start();
    const response = await agent.processMessage(prompt);
    processingSpinner.succeed('Prompt processed');

    // Display response
    console.log('\n' + chalk.cyan('🤖 Agent Response:'));
    console.log(response.message);

    // Display planned actions
    if (response.actions.length > 0) {
      console.log(chalk.blue('\n📋 Planned Actions:'));
      response.actions.forEach((action, index) => {
        const icon = getActionIcon(action.type);
        console.log(chalk.blue(`   ${index + 1}. ${icon} ${action.description}`));
      });

      // Handle dry-run mode
      if (options.dryRun) {
        console.log(chalk.yellow('\n⏸️  Dry-run mode: Actions not executed'));
        return;
      }

      // Handle auto-approval
      const shouldExecute = options.yes || !response.needsConfirmation || await promptForConfirmation();
      
      if (shouldExecute) {
        const executionSpinner = ora('Executing actions...').start();
        
        try {
          const results = await agent.executeActions(response.actions);
          executionSpinner.succeed('Actions executed');
          
          // Display results
          displayResults(response.actions, results);
          
        } catch (error) {
          executionSpinner.fail('Execution failed');
          console.error(chalk.red('Error executing actions:'), error);
          process.exit(1);
        }
      } else {
        console.log(chalk.yellow('⏸️  Actions cancelled by user'));
      }
    } else {
      console.log(chalk.dim('\n📝 No actions required'));
    }

    // Display follow-up questions
    if (response.followUpQuestions && response.followUpQuestions.length > 0) {
      console.log(chalk.yellow('\n💡 Follow-up suggestions:'));
      response.followUpQuestions.forEach((question, index) => {
        console.log(chalk.yellow(`   ${index + 1}. ${question}`));
      });
    }

  } catch (error) {
    console.error(chalk.red('Failed to process command:'), error);
    process.exit(1);
  }
}

function getActionIcon(type: string): string {
  switch (type) {
    case 'file':
      return '📄';
    case 'command':
      return '⚡';
    case 'analysis':
      return '🔍';
    default:
      return '🔧';
  }
}

function displayResults(actions: any[], results: any[]): void {
  console.log(chalk.green('\n✅ Execution Results:'));
  
  results.forEach((result, index) => {
    const action = actions[index];
    const status = result.success ? '✅' : '❌';
    const statusColor = result.success ? chalk.green : chalk.red;
    
    console.log(statusColor(`   ${status} ${action.description}`));
    
    if (result.success && result.data) {
      displayActionResult(action, result.data);
    } else if (result.error) {
      console.log(chalk.red(`      Error: ${result.error}`));
    }
  });
}

function displayActionResult(action: any, data: any): void {
  switch (action.type) {
    case 'file':
      if (action.payload.type === 'read' && data.content) {
        console.log(chalk.gray('      Content preview:'));
        const preview = data.content.split('\n').slice(0, 5).join('\n');
        console.log(chalk.dim('      ' + preview.replace(/\n/g, '\n      ')));
        if (data.content.split('\n').length > 5) {
          console.log(chalk.dim('      ... (use interactive mode for full content)'));
        }
      } else if (action.payload.type === 'write') {
        console.log(chalk.gray(`      File written: ${data.size} bytes`));
      }
      break;
      
    case 'command':
      if (data.stdout) {
        console.log(chalk.gray('      Output:'));
        console.log(chalk.white('      ' + data.stdout.replace(/\n/g, '\n      ')));
      }
      if (data.stderr && data.stderr.trim()) {
        console.log(chalk.yellow('      Warnings:'));
        console.log(chalk.yellow('      ' + data.stderr.replace(/\n/g, '\n      ')));
      }
      console.log(chalk.gray(`      Completed in ${data.duration}ms`));
      break;
      
    case 'analysis':
      if (data.files) {
        console.log(chalk.gray(`      Analyzed ${data.files.length} files`));
      }
      break;
  }
}

function promptForConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.yellow('⚠️  Execute these actions? (y/N): '), (answer: string) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
