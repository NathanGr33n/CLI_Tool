import * as readline from 'readline';
import chalk from 'chalk';
import ora from 'ora';
import { AgentCore } from '../core/AgentCore';
import { AgentAction, AgentResponse } from '../types';

export async function runInteractiveMode(agent: AgentCore, options: any): Promise<void> {
  console.log(chalk.blue.bold('🤖 CLI Agent Interactive Mode'));
  console.log(chalk.gray('Type "help" for assistance or "quit" to exit.\n'));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
    history: []
  });

  let isRunning = true;

  // Welcome message with project analysis
  const welcomeSpinner = ora('Analyzing project...').start();
  try {
    await agent.analyzeProject();
    const context = agent.getSessionContext();
    welcomeSpinner.succeed(`Initialized in ${context.projectContext.rootPath}`);
    
    if (context.projectContext.packageInfo) {
      console.log(chalk.dim(`📦 Project: ${context.projectContext.packageInfo.name} v${context.projectContext.packageInfo.version}`));
    }
    
    if (context.projectContext.gitInfo) {
      console.log(chalk.dim(`🌿 Branch: ${context.projectContext.gitInfo.branch}`));
    }
    
    console.log(chalk.dim(`📁 Files: ${context.projectContext.files.length}\n`));
  } catch (error) {
    welcomeSpinner.fail('Failed to analyze project');
  }

  rl.prompt();

  rl.on('line', async (input: string) => {
    const trimmedInput = input.trim();
    
    // Handle exit commands
    if (trimmedInput === 'quit' || trimmedInput === 'exit' || trimmedInput === 'q') {
      console.log(chalk.yellow('Goodbye! 👋'));
      rl.close();
      return;
    }

    // Handle empty input
    if (trimmedInput === '') {
      rl.prompt();
      return;
    }

    try {
      // Process the user message
      const response = await processUserInput(agent, trimmedInput);
      
      // Display response
      displayResponse(response);
      
      // Execute actions if any
      if (response.actions.length > 0) {
        await handleActions(agent, response.actions, response.needsConfirmation);
      }
      
    } catch (error) {
      console.log(chalk.red('Error processing your request:'), error);
    }
    
    rl.prompt();
  });

  rl.on('close', () => {
    isRunning = false;
    console.log(chalk.gray('\nSession ended.'));
    process.exit(0);
  });

  rl.on('SIGINT', () => {
    console.log(chalk.yellow('\n\nUse "quit" or "exit" to leave the session.'));
    rl.prompt();
  });
}

async function processUserInput(agent: AgentCore, input: string): Promise<AgentResponse> {
  const spinner = ora('Processing...').start();
  
  try {
    const response = await agent.processMessage(input);
    spinner.stop();
    return response;
  } catch (error) {
    spinner.fail('Processing failed');
    throw error;
  }
}

function displayResponse(response: AgentResponse): void {
  // Display main message
  console.log('\n' + chalk.cyan('🤖 Agent:'));
  console.log(formatMessage(response.message));

  // Display follow-up questions if any
  if (response.followUpQuestions && response.followUpQuestions.length > 0) {
    console.log(chalk.yellow('\n💡 You might also want to:'));
    response.followUpQuestions.forEach((question, index) => {
      console.log(chalk.yellow(`   ${index + 1}. ${question}`));
    });
  }

  // Display planned actions
  if (response.actions.length > 0) {
    console.log(chalk.blue('\n📋 Planned actions:'));
    response.actions.forEach((action, index) => {
      const icon = getActionIcon(action.type);
      console.log(chalk.blue(`   ${index + 1}. ${icon} ${action.description}`));
    });
  }

  console.log();
}

async function handleActions(agent: AgentCore, actions: AgentAction[], needsConfirmation: boolean): Promise<void> {
  if (needsConfirmation) {
    const shouldProceed = await confirmExecution();
    if (!shouldProceed) {
      console.log(chalk.yellow('⏸️  Actions cancelled.'));
      return;
    }
  }

  const spinner = ora('Executing actions...').start();
  
  try {
    const results = await agent.executeActions(actions);
    spinner.stop();
    
    // Display results
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
    
  } catch (error) {
    spinner.fail('Execution failed');
    console.log(chalk.red('Error executing actions:'), error);
  }
}

function displayActionResult(action: AgentAction, data: any): void {
  switch (action.type) {
    case 'file':
      if (action.payload.type === 'read' && data.content) {
        console.log(chalk.gray('      Content preview:'));
        const preview = data.content.split('\n').slice(0, 10).join('\n');
        console.log(chalk.dim('      ' + preview.replace(/\n/g, '\n      ')));
        if (data.content.split('\n').length > 10) {
          console.log(chalk.dim('      ... (truncated)'));
        }
      } else if (action.payload.type === 'write') {
        console.log(chalk.gray(`      File size: ${data.size} bytes`));
      }
      break;
      
    case 'command':
      if (data.stdout) {
        console.log(chalk.gray('      Output:'));
        console.log(chalk.white('      ' + data.stdout.replace(/\n/g, '\n      ')));
      }
      if (data.stderr) {
        console.log(chalk.yellow('      Error output:'));
        console.log(chalk.yellow('      ' + data.stderr.replace(/\n/g, '\n      ')));
      }
      console.log(chalk.gray(`      Exit code: ${data.exitCode}, Duration: ${data.duration}ms`));
      break;
      
    case 'analysis':
      if (data.files) {
        console.log(chalk.gray(`      Found ${data.files.length} files`));
        if (data.gitInfo) {
          console.log(chalk.gray(`      Git branch: ${data.gitInfo.branch}`));
        }
        if (data.packageInfo) {
          console.log(chalk.gray(`      Package: ${data.packageInfo.name}`));
        }
      }
      break;
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

function formatMessage(message: string): string {
  // Format message with proper line breaks and styling
  return message
    .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
    .replace(/\*(.*?)\*/g, chalk.italic('$1'))
    .replace(/`(.*?)`/g, chalk.cyan('$1'))
    .replace(/^(🗂️|⚡|📊|❓|📄|🔍)/gm, (match) => chalk.yellow(match));
}

function confirmExecution(): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    rl.question(chalk.yellow('⚠️  This action requires confirmation. Proceed? (y/N): '), (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}
