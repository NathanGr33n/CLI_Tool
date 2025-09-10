import { UserIntent, Entity, SessionContext, AgentAction } from '../types';
import { Logger } from '../utils/Logger';

export class IntentParser {
  private logger: Logger;
  
  // Simple patterns for intent recognition
  private intentPatterns = {
    file_read: [
      /\b(?:read|show|display|cat|view|open|get)\s+(?:file|contents?|text)?\s*([^\s]+)/i,
      /\bwhat'?s\s+in\s+([^\s]+)/i,
      /\bshow\s+me\s+([^\s]+)/i,
      /\bcontents?\s+of\s+([^\s]+)/i,
    ],
    file_write: [
      /\b(?:write|create|make|generate|save)\s+(?:file|text)?\s*([^\s]+)/i,
      /\b(?:put|add|insert)\s+.*\s+(?:in|into|to)\s+([^\s]+)/i,
      /\bcreate\s+(?:a\s+)?(?:new\s+)?file\s+(?:called\s+)?([^\s]+)/i,
    ],
    file_edit: [
      /\b(?:edit|modify|change|update|replace)\s+.*\s+in\s+([^\s]+)/i,
      /\breplace\s+.*\s+(?:in|with)\s+([^\s]+)/i,
      /\bfind\s+.*\s+and\s+replace\s+.*\s+in\s+([^\s]+)/i,
    ],
    command_execute: [
      /\b(?:run|execute|exec|start|launch)\s+(.+)/i,
      /\b(?:command|cmd)\s+(.+)/i,
      /\$\s*(.+)/i, // Shell-style command
    ],
    project_analyze: [
      /\b(?:analyze|scan|check|inspect)\s+(?:project|directory|folder|this)/i,
      /\bshow\s+(?:project|directory)\s+(?:structure|info|overview)/i,
      /\bwhat\s+(?:files|projects?)\s+(?:are\s+)?(?:here|in\s+this)/i,
      /\blist\s+(?:files|directories)/i,
    ],
    git_status: [
      /\bgit\s+status/i,
      /\b(?:check|show)\s+git\s+(?:status|info)/i,
      /\bwhat\s+(?:changed|modifications)/i,
    ],
    help: [
      /\b(?:help|usage|how|what)\b/i,
      /\bwhat\s+can\s+you\s+do/i,
      /\bhow\s+do\s+i\s+/i,
      /\bcommands?\s*$/i,
    ],
    system_info: [
      /\b(?:system|machine|computer)\s+(?:info|information|details)/i,
      /\bshow\s+system/i,
      /\buname|whoami|pwd/i,
    ]
  };

  // File extension patterns
  private filePatterns = [
    // Specific file extensions first (higher priority)
    /([^\s]+\.(?:json|js|ts|jsx|tsx|py|java|cpp|c|h|hpp|css|html|yml|yaml|md|txt|xml|sql|sh|bat|ps1|go|rs|rb|php))\b/gi,
    // General file patterns with extensions
    /(?:^|\s)([a-zA-Z0-9_\-./]+\.[a-zA-Z]{2,5})(?:\s|$)/g,
    // Paths without extensions (lowest priority)
    /(?:^|\s)([a-zA-Z0-9_\-./]{3,})(?:\s|$)/g
  ];

  // Command patterns 
  private commandPatterns = [
    /(?:run|execute|exec)\s+(.+)/i,
    /\$\s*(.+)/i,
    /^([a-zA-Z][a-zA-Z0-9_\-]*)\s+/i // Command starting with identifier
  ];

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Parse user input to determine intent and extract entities
   */
  async parseIntent(message: string, context: SessionContext): Promise<UserIntent> {
    try {
      this.logger.debug('Parsing intent for message', { message });

      const intent = this.classifyIntent(message);
      const entities = this.extractEntities(message, intent);
      const confidence = this.calculateConfidence(intent, entities, message);
      const suggestedActions = this.generateSuggestedActions(intent, entities, context);

      const userIntent: UserIntent = {
        originalMessage: message,
        intent,
        entities,
        confidence,
        suggestedActions
      };

      this.logger.debug('Intent parsed', {
        intent: userIntent.intent,
        entities: userIntent.entities.length,
        confidence: userIntent.confidence
      });

      return userIntent;
    } catch (error) {
      this.logger.error('Failed to parse intent', error);
      
      // Return a fallback intent
      return {
        originalMessage: message,
        intent: 'unknown',
        entities: [],
        confidence: 0.1,
        suggestedActions: []
      };
    }
  }

  /**
   * Classify the main intent of the message
   */
  private classifyIntent(message: string): string {
    const normalizedMessage = message.toLowerCase().trim();
    
    // Check each intent pattern
    for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(normalizedMessage)) {
          this.logger.debug(`Intent classified as: ${intent}`, { pattern: pattern.source });
          return intent;
        }
      }
    }

    // Special cases based on context
    if (normalizedMessage === 'quit' || normalizedMessage === 'exit') {
      return 'quit';
    }

    if (normalizedMessage.length === 0) {
      return 'empty';
    }

    // If no specific intent found, try to detect if it's a command
    if (this.looksLikeCommand(normalizedMessage)) {
      return 'command_execute';
    }

    return 'unknown';
  }

  /**
   * Extract entities from the message based on the intent
   */
  private extractEntities(message: string, intent: string): Entity[] {
    const entities: Entity[] = [];

    // Extract file entities
    if (intent.includes('file') || intent === 'project_analyze') {
      entities.push(...this.extractFileEntities(message));
    }

    // Extract command entities
    if (intent === 'command_execute') {
      entities.push(...this.extractCommandEntities(message));
    }

    // Extract technology/tool entities
    entities.push(...this.extractTechnologyEntities(message));

    // Extract directory entities
    entities.push(...this.extractDirectoryEntities(message));

    return entities;
  }

  /**
   * Extract file-related entities
   */
  private extractFileEntities(message: string): Entity[] {
    const entities: Entity[] = [];
    const seenValues = new Set<string>();
    
    for (const pattern of this.filePatterns) {
      pattern.lastIndex = 0; // Reset regex state
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const value = match[1] || match[0];
        const cleanValue = value.trim();
        
        if (cleanValue && cleanValue.length > 0 && !seenValues.has(cleanValue)) {
          // Skip common words that might be matched accidentally
          if (this.isLikelyFileName(cleanValue)) {
            entities.push({
              type: 'file',
              value: cleanValue,
              confidence: this.getFileConfidence(cleanValue),
              start: match.index,
              end: match.index + match[0].length
            });
            seenValues.add(cleanValue);
          }
        }
      }
    }

    // Sort by confidence (highest first) and return top matches
    return entities
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 3); // Limit to top 3 matches to avoid noise
  }

  /**
   * Extract command entities
   */
  private extractCommandEntities(message: string): Entity[] {
    const entities: Entity[] = [];
    
    for (const pattern of this.commandPatterns) {
      const match = pattern.exec(message);
      if (match) {
        const command = match[1] || match[0];
        if (command && command.trim().length > 0) {
          entities.push({
            type: 'command',
            value: command.trim(),
            confidence: 0.8,
            start: match.index,
            end: match.index + match[0].length
          });
          break; // Only take the first command match
        }
      }
    }

    // If no pattern matched but looks like a command, extract the whole thing
    if (entities.length === 0 && this.looksLikeCommand(message)) {
      entities.push({
        type: 'command',
        value: message.trim(),
        confidence: 0.6,
        start: 0,
        end: message.length
      });
    }

    return entities;
  }

  /**
   * Extract technology/tool entities
   */
  private extractTechnologyEntities(message: string): Entity[] {
    const technologies = [
      'npm', 'yarn', 'pip', 'git', 'docker', 'node', 'python', 'java',
      'typescript', 'javascript', 'react', 'vue', 'angular', 'express',
      'webpack', 'vite', 'eslint', 'prettier', 'jest', 'mocha', 'cypress'
    ];

    const entities: Entity[] = [];
    const words = message.toLowerCase().split(/\s+/);

    words.forEach((word, index) => {
      if (technologies.includes(word)) {
        const start = message.toLowerCase().indexOf(word);
        entities.push({
          type: 'technology',
          value: word,
          confidence: 0.7,
          start,
          end: start + word.length
        });
      }
    });

    return entities;
  }

  /**
   * Extract directory entities
   */
  private extractDirectoryEntities(message: string): Entity[] {
    const entities: Entity[] = [];
    
    // Common directory patterns
    const dirPatterns = [
      /([^\s]+\/[^\s]*)/g, // Unix-style paths
      /([a-zA-Z]:\\[^\s]*)/g, // Windows-style paths
      /\.\/([^\s]*)/g, // Relative paths
      /\.\.\/([^\s]*)/g, // Parent directory paths
    ];

    for (const pattern of dirPatterns) {
      let match;
      while ((match = pattern.exec(message)) !== null) {
        const value = match[1] || match[0];
        if (value && !value.includes('.')) { // Likely directory, not file
          entities.push({
            type: 'directory',
            value: value.trim(),
            confidence: 0.6,
            start: match.index,
            end: match.index + match[0].length
          });
        }
      }
    }

    return entities;
  }

  /**
   * Calculate confidence score for the intent
   */
  private calculateConfidence(intent: string, entities: Entity[], message: string): number {
    let confidence = 0.5; // Base confidence

    // Higher confidence for specific intents
    if (intent !== 'unknown') {
      confidence += 0.3;
    }

    // Boost confidence based on entities found
    if (entities.length > 0) {
      confidence += Math.min(0.2, entities.length * 0.1);
    }

    // Boost confidence for clear commands
    if (intent === 'command_execute' && message.startsWith('$')) {
      confidence += 0.2;
    }

    // Boost confidence for file operations with clear file extensions
    if (intent.includes('file') && entities.some(e => e.type === 'file' && e.value.includes('.'))) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Generate suggested actions based on intent and entities
   */
  private generateSuggestedActions(intent: string, entities: Entity[], context: SessionContext): AgentAction[] {
    const actions: AgentAction[] = [];
    const timestamp = new Date();

    switch (intent) {
      case 'file_read':
        entities
          .filter(e => e.type === 'file')
          .forEach(entity => {
            actions.push({
              id: this.generateActionId(),
              type: 'file',
              description: `Read file: ${entity.value}`,
              payload: {
                type: 'read',
                path: entity.value
              },
              timestamp,
              status: 'pending'
            });
          });
        break;

      case 'command_execute':
        entities
          .filter(e => e.type === 'command')
          .forEach(entity => {
            actions.push({
              id: this.generateActionId(),
              type: 'command',
              description: `Execute: ${entity.value}`,
              payload: {
                command: entity.value,
                args: [],
                options: {
                  cwd: context.currentDirectory
                }
              },
              timestamp,
              status: 'pending'
            });
          });
        break;

      case 'project_analyze':
        actions.push({
          id: this.generateActionId(),
          type: 'analysis',
          description: 'Analyze project structure',
          payload: {
            type: 'project_analysis'
          },
          timestamp,
          status: 'pending'
        });
        break;
    }

    return actions;
  }

  /**
   * Check if a message looks like a command
   */
  private looksLikeCommand(message: string): boolean {
    const commonCommands = [
      'ls', 'dir', 'pwd', 'cd', 'mkdir', 'rmdir', 'cp', 'mv', 'rm',
      'cat', 'grep', 'find', 'git', 'npm', 'yarn', 'pip', 'docker',
      'node', 'python', 'java', 'make', 'cmake', 'curl', 'wget'
    ];

    const firstWord = message.trim().split(/\s+/)[0].toLowerCase();
    return commonCommands.includes(firstWord) || message.startsWith('$');
  }

  /**
   * Check if a string is likely to be a filename
   */
  private isLikelyFileName(value: string): boolean {
    // Skip common English words that are unlikely to be files
    const commonWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'me', 'you', 'it', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must'];
    
    const lowerValue = value.toLowerCase();
    if (commonWords.includes(lowerValue)) {
      return false;
    }
    
    // Must be reasonable length
    if (value.length < 2 || value.length > 100) {
      return false;
    }
    
    // Files with extensions are more likely
    if (value.includes('.')) {
      return true;
    }
    
    // Path-like strings
    if (value.includes('/') || value.includes('\\')) {
      return true;
    }
    
    // Common filenames without extensions
    const commonFilenames = ['readme', 'license', 'dockerfile', 'makefile', 'changelog', 'todo'];
    if (commonFilenames.includes(lowerValue)) {
      return true;
    }
    
    // At least 3 characters and contains alphanumeric
    return value.length >= 3 && /[a-zA-Z0-9]/.test(value);
  }

  /**
   * Calculate confidence for file entities
   */
  private getFileConfidence(filename: string): number {
    let confidence = 0.5;

    // Higher confidence for files with extensions
    if (filename.includes('.')) {
      confidence += 0.3;
    }

    // Higher confidence for common file extensions
    const commonExtensions = ['.js', '.ts', '.py', '.json', '.md', '.txt', '.html', '.css'];
    if (commonExtensions.some(ext => filename.endsWith(ext))) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Generate a unique action ID
   */
  private generateActionId(): string {
    return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
