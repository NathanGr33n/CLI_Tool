import chalk from 'chalk';
import * as fs from 'fs-extra';
import * as path from 'path';
import { ConfigManager } from '../utils/ConfigManager';

export async function showStatus(options: any): Promise<void> {
  console.log(chalk.blue.bold('📊 CLI Agent Status'));
  console.log(chalk.gray('Current project and environment information\n'));

  const workingDir = options.directory || process.cwd();
  
  try {
    // Basic environment info
    const envInfo = {
      cwd: workingDir,
      platform: process.platform,
      nodeVersion: process.version,
      user: process.env.USER || process.env.USERNAME || 'unknown',
      shell: process.env.SHELL || process.env.COMSPEC || 'unknown'
    };

    // Project info
    const projectInfo = await getProjectInfo(workingDir);
    
    // Configuration info
    const configInfo = await getConfigInfo();

    if (options.format === 'json') {
      console.log(JSON.stringify({
        environment: envInfo,
        project: projectInfo,
        configuration: configInfo
      }, null, 2));
    } else {
      displayTableFormat(envInfo, projectInfo, configInfo);
    }

  } catch (error) {
    console.error(chalk.red('Failed to get status:'), error);
    process.exit(1);
  }
}

async function getProjectInfo(workingDir: string) {
  const info: any = {
    directory: workingDir,
    hasGit: false,
    hasPackageJson: false,
    hasNodeModules: false,
    fileCount: 0
  };

  try {
    // Check for Git
    info.hasGit = await fs.pathExists(path.join(workingDir, '.git'));
    
    // Check for package.json
    const packageJsonPath = path.join(workingDir, 'package.json');
    info.hasPackageJson = await fs.pathExists(packageJsonPath);
    
    if (info.hasPackageJson) {
      try {
        const packageJson = await fs.readJSON(packageJsonPath);
        info.projectName = packageJson.name;
        info.projectVersion = packageJson.version;
        info.dependencies = Object.keys(packageJson.dependencies || {}).length;
        info.devDependencies = Object.keys(packageJson.devDependencies || {}).length;
      } catch (error) {
        // Ignore JSON parsing errors
      }
    }
    
    // Check for node_modules
    info.hasNodeModules = await fs.pathExists(path.join(workingDir, 'node_modules'));
    
    // Count files (excluding common ignore patterns)
    try {
      const files = await fs.readdir(workingDir);
      info.fileCount = files.filter(file => 
        !file.startsWith('.') && 
        file !== 'node_modules' &&
        file !== 'dist' &&
        file !== 'build'
      ).length;
    } catch (error) {
      info.fileCount = 'unknown';
    }

  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not fully analyze project'), error);
  }

  return info;
}

async function getConfigInfo() {
  const info: any = {
    hasConfig: false,
    configPath: null
  };

  try {
    // Check for configuration file
    const configPath = await ConfigManager.findConfig();
    if (configPath) {
      info.hasConfig = true;
      info.configPath = configPath;
      
      // Load and validate config
      try {
        const config = await ConfigManager.load(configPath);
        info.configValid = true;
        info.maxFileSize = `${config.maxFileSize / (1024 * 1024)}MB`;
        info.allowedExtensions = config.allowedFileExtensions.length;
        info.forbiddenPaths = config.forbiddenPaths.length;
        info.safeCommands = config.safeCommands.length;
        info.dangerousCommands = config.dangerousCommands.length;
      } catch (error) {
        info.configValid = false;
        info.configError = error instanceof Error ? error.message : 'Unknown error';
      }
    }
  } catch (error) {
    console.warn(chalk.yellow('Warning: Could not check configuration'), error);
  }

  return info;
}

function displayTableFormat(envInfo: any, projectInfo: any, configInfo: any): void {
  // Environment section
  console.log(chalk.green.bold('🌍 Environment'));
  console.log(`   Working Directory: ${chalk.cyan(envInfo.cwd)}`);
  console.log(`   Platform: ${chalk.cyan(envInfo.platform)}`);
  console.log(`   Node.js: ${chalk.cyan(envInfo.nodeVersion)}`);
  console.log(`   User: ${chalk.cyan(envInfo.user)}`);
  console.log(`   Shell: ${chalk.cyan(envInfo.shell)}`);
  
  // Project section
  console.log(chalk.green.bold('\n📁 Project'));
  if (projectInfo.projectName) {
    console.log(`   Name: ${chalk.cyan(projectInfo.projectName)}`);
    console.log(`   Version: ${chalk.cyan(projectInfo.projectVersion)}`);
  }
  
  console.log(`   Has Git: ${projectInfo.hasGit ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Has package.json: ${projectInfo.hasPackageJson ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Has node_modules: ${projectInfo.hasNodeModules ? chalk.green('Yes') : chalk.red('No')}`);
  console.log(`   Files (visible): ${chalk.cyan(projectInfo.fileCount)}`);
  
  if (projectInfo.dependencies !== undefined) {
    console.log(`   Dependencies: ${chalk.cyan(projectInfo.dependencies)}`);
    console.log(`   Dev Dependencies: ${chalk.cyan(projectInfo.devDependencies)}`);
  }

  // Configuration section
  console.log(chalk.green.bold('\n⚙️  Configuration'));
  if (configInfo.hasConfig) {
    console.log(`   Config File: ${chalk.green('Found')} (${chalk.dim(configInfo.configPath)})`);
    console.log(`   Valid: ${configInfo.configValid ? chalk.green('Yes') : chalk.red('No')}`);
    
    if (configInfo.configValid) {
      console.log(`   Max File Size: ${chalk.cyan(configInfo.maxFileSize)}`);
      console.log(`   Allowed Extensions: ${chalk.cyan(configInfo.allowedExtensions)} types`);
      console.log(`   Forbidden Paths: ${chalk.cyan(configInfo.forbiddenPaths)} patterns`);
      console.log(`   Safe Commands: ${chalk.cyan(configInfo.safeCommands)} commands`);
      console.log(`   Dangerous Commands: ${chalk.cyan(configInfo.dangerousCommands)} commands`);
    } else if (configInfo.configError) {
      console.log(`   Error: ${chalk.red(configInfo.configError)}`);
    }
  } else {
    console.log(`   Config File: ${chalk.yellow('Not found')} (using defaults)`);
    console.log(`   ${chalk.dim('Run "cli-agent init" to create a configuration file')}`);
  }

  // Status indicators
  console.log(chalk.green.bold('\n🚦 Status Indicators'));
  
  // Project readiness
  const projectReady = projectInfo.hasPackageJson && projectInfo.hasNodeModules;
  console.log(`   Project Ready: ${projectReady ? chalk.green('✓') : chalk.yellow('⚠')}`);
  
  // Git status
  console.log(`   Version Control: ${projectInfo.hasGit ? chalk.green('✓') : chalk.yellow('○')}`);
  
  // Configuration status
  console.log(`   Configuration: ${configInfo.hasConfig && configInfo.configValid ? chalk.green('✓') : chalk.yellow('○')}`);

  // Quick tips
  if (!projectReady || !configInfo.hasConfig) {
    console.log(chalk.yellow.bold('\n💡 Quick Tips'));
    
    if (!configInfo.hasConfig) {
      console.log(`   • Run ${chalk.cyan('cli-agent init')} to create a configuration file`);
    }
    
    if (projectInfo.hasPackageJson && !projectInfo.hasNodeModules) {
      console.log(`   • Run ${chalk.cyan('npm install')} to install dependencies`);
    }
    
    if (!projectInfo.hasGit) {
      console.log(`   • Run ${chalk.cyan('git init')} to initialize version control`);
    }
  }
}
