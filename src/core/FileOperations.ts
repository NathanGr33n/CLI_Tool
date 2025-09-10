import * as fs from 'fs-extra';
import * as path from 'path';
import { glob } from 'glob';
import { minimatch } from 'minimatch';
import { FileOperation, FileInfo, ToolResult, LogLevel } from '../types';
import { Logger } from '../utils/Logger';

export class FileOperations {
  private logger: Logger;
  private maxFileSize: number;
  private allowedExtensions: string[];
  private forbiddenPaths: string[];

  constructor(
    logger: Logger,
    maxFileSize: number = 10 * 1024 * 1024, // 10MB default
    allowedExtensions: string[] = [],
    forbiddenPaths: string[] = ['node_modules', '.git', 'dist', 'build']
  ) {
    this.logger = logger;
    this.maxFileSize = maxFileSize;
    this.allowedExtensions = allowedExtensions;
    this.forbiddenPaths = forbiddenPaths;
  }

  /**
   * Read file contents with safety checks
   */
  async readFile(filePath: string, startLine?: number, endLine?: number): Promise<ToolResult> {
    try {
      const absolutePath = path.resolve(filePath);
      
      // Security check
      if (!this.isPathAllowed(absolutePath)) {
        return {
          success: false,
          error: `Access denied to path: ${filePath}`
        };
      }

      // Check if file exists
      if (!await fs.pathExists(absolutePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      // Check file size
      const stats = await fs.stat(absolutePath);
      if (stats.size > this.maxFileSize) {
        return {
          success: false,
          error: `File too large: ${stats.size} bytes (max: ${this.maxFileSize})`
        };
      }

      // Read content
      const content = await fs.readFile(absolutePath, 'utf-8');
      
      // Handle line range if specified
      let result = content;
      if (startLine !== undefined || endLine !== undefined) {
        const lines = content.split('\n');
        const start = Math.max(0, (startLine || 1) - 1);
        const end = endLine ? Math.min(lines.length, endLine) : lines.length;
        result = lines.slice(start, end).join('\n');
      }

      this.logger.debug(`Read file: ${filePath} (${result.length} chars)`);

      return {
        success: true,
        data: {
          content: result,
          size: stats.size,
          lastModified: stats.mtime,
          lines: content.split('\n').length
        }
      };
    } catch (error) {
      this.logger.error(`Failed to read file ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Write content to file
   */
  async writeFile(filePath: string, content: string, append: boolean = false): Promise<ToolResult> {
    try {
      const absolutePath = path.resolve(filePath);
      
      // Security check
      if (!this.isPathAllowed(absolutePath)) {
        return {
          success: false,
          error: `Access denied to path: ${filePath}`
        };
      }

      // Ensure directory exists
      await fs.ensureDir(path.dirname(absolutePath));

      // Write content
      if (append) {
        await fs.appendFile(absolutePath, content, 'utf-8');
      } else {
        await fs.writeFile(absolutePath, content, 'utf-8');
      }

      const stats = await fs.stat(absolutePath);
      this.logger.debug(`${append ? 'Appended to' : 'Wrote'} file: ${filePath} (${content.length} chars)`);

      return {
        success: true,
        data: {
          size: stats.size,
          lastModified: stats.mtime
        }
      };
    } catch (error) {
      this.logger.error(`Failed to write file ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Edit file by replacing text
   */
  async editFile(filePath: string, searchText: string, replaceText: string): Promise<ToolResult> {
    try {
      // First read the file
      const readResult = await this.readFile(filePath);
      if (!readResult.success) {
        return readResult;
      }

      const content = readResult.data.content;
      
      // Check if search text exists
      if (!content.includes(searchText)) {
        return {
          success: false,
          error: `Search text not found in file: ${filePath}`
        };
      }

      // Replace text
      const newContent = content.replace(new RegExp(searchText, 'g'), replaceText);
      
      // Write back to file
      return await this.writeFile(filePath, newContent);
    } catch (error) {
      this.logger.error(`Failed to edit file ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string): Promise<ToolResult> {
    try {
      const absolutePath = path.resolve(filePath);
      
      // Security check
      if (!this.isPathAllowed(absolutePath)) {
        return {
          success: false,
          error: `Access denied to path: ${filePath}`
        };
      }

      // Check if path exists
      if (!await fs.pathExists(absolutePath)) {
        return {
          success: false,
          error: `Path not found: ${filePath}`
        };
      }

      await fs.remove(absolutePath);
      this.logger.debug(`Deleted: ${filePath}`);

      return {
        success: true,
        data: { deleted: filePath }
      };
    } catch (error) {
      this.logger.error(`Failed to delete ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List files in directory with filtering
   */
  async listFiles(dirPath: string, pattern?: string, recursive: boolean = true): Promise<ToolResult> {
    try {
      const absolutePath = path.resolve(dirPath);
      
      // Security check
      if (!this.isPathAllowed(absolutePath)) {
        return {
          success: false,
          error: `Access denied to path: ${dirPath}`
        };
      }

      // Check if directory exists
      if (!await fs.pathExists(absolutePath)) {
        return {
          success: false,
          error: `Directory not found: ${dirPath}`
        };
      }

      const globPattern = pattern || (recursive ? '**/*' : '*');
      const files = await glob(globPattern, {
        cwd: absolutePath,
        dot: false,
        ignore: this.forbiddenPaths.map(p => `**/${p}/**`)
      });

      const fileInfos: FileInfo[] = [];
      
      for (const file of files) {
        const filePath = path.join(absolutePath, file);
        try {
          const stats = await fs.stat(filePath);
          fileInfos.push({
            path: filePath,
            relativePath: file,
            size: stats.size,
            lastModified: stats.mtime,
            extension: path.extname(file),
            isDirectory: stats.isDirectory()
          });
        } catch (error) {
          // Skip files that can't be accessed
          continue;
        }
      }

      this.logger.debug(`Listed ${fileInfos.length} files in ${dirPath}`);

      return {
        success: true,
        data: fileInfos
      };
    } catch (error) {
      this.logger.error(`Failed to list files in ${dirPath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Search for text in files
   */
  async searchInFiles(searchTerm: string, dirPath: string, filePattern?: string): Promise<ToolResult> {
    try {
      const listResult = await this.listFiles(dirPath, filePattern);
      if (!listResult.success) {
        return listResult;
      }

      const files = listResult.data as FileInfo[];
      const matches: Array<{file: string, line: number, content: string}> = [];

      for (const file of files) {
        if (file.isDirectory) continue;
        
        // Skip files that are too large or not allowed
        if (file.size > this.maxFileSize) continue;
        if (this.allowedExtensions.length > 0 && !this.allowedExtensions.includes(file.extension)) {
          continue;
        }

        try {
          const content = await fs.readFile(file.path, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchTerm.toLowerCase())) {
              matches.push({
                file: file.relativePath,
                line: index + 1,
                content: line.trim()
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }

      this.logger.debug(`Found ${matches.length} matches for "${searchTerm}"`);

      return {
        success: true,
        data: matches
      };
    } catch (error) {
      this.logger.error(`Failed to search in files:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<ToolResult> {
    try {
      const absolutePath = path.resolve(filePath);
      
      if (!await fs.pathExists(absolutePath)) {
        return {
          success: false,
          error: `File not found: ${filePath}`
        };
      }

      const stats = await fs.stat(absolutePath);
      const info: FileInfo = {
        path: absolutePath,
        relativePath: path.relative(process.cwd(), absolutePath),
        size: stats.size,
        lastModified: stats.mtime,
        extension: path.extname(filePath),
        isDirectory: stats.isDirectory()
      };

      return {
        success: true,
        data: info
      };
    } catch (error) {
      this.logger.error(`Failed to get file info ${filePath}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a path is allowed based on security rules
   */
  private isPathAllowed(absolutePath: string): boolean {
    // Check forbidden paths
    for (const forbidden of this.forbiddenPaths) {
      if (minimatch(absolutePath, `**/${forbidden}/**`)) {
        return false;
      }
    }

    // Additional security checks can be added here
    // For example, prevent access to system directories on Windows/Unix
    const systemPaths = [
      'C:\\Windows\\System32',
      'C:\\Program Files',
      '/etc',
      '/usr/bin',
      '/System'
    ];

    for (const systemPath of systemPaths) {
      if (absolutePath.startsWith(systemPath)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Execute a file operation based on the operation type
   */
  async executeOperation(operation: FileOperation): Promise<ToolResult> {
    switch (operation.type) {
      case 'read':
        return this.readFile(operation.path);
      
      case 'write':
        if (!operation.content) {
          return {
            success: false,
            error: 'Content is required for write operation'
          };
        }
        return this.writeFile(operation.path, operation.content);
      
      case 'edit':
        if (!operation.searchText || !operation.replaceText) {
          return {
            success: false,
            error: 'searchText and replaceText are required for edit operation'
          };
        }
        return this.editFile(operation.path, operation.searchText, operation.replaceText);
      
      case 'create':
        if (!operation.content) {
          return {
            success: false,
            error: 'Content is required for create operation'
          };
        }
        // Check if file already exists
        if (await fs.pathExists(operation.path)) {
          return {
            success: false,
            error: `File already exists: ${operation.path}`
          };
        }
        return this.writeFile(operation.path, operation.content);
      
      case 'delete':
        return this.deleteFile(operation.path);
      
      default:
        return {
          success: false,
          error: `Unknown operation type: ${(operation as any).type}`
        };
    }
  }
}
