const logger = require('../utils/logger')('template');

class TemplateService {
  constructor() {
    this.counters = new Map();
  }

  /**
   * Process template variables in content
   * @param {string} content - The template content
   * @param {Object} variables - Custom variables to use in the template
   * @param {string} noteId - ID of the note for maintaining counters
   * @returns {string} Processed content
   */
  process(content, variables = {}, noteId = null) {
    if (!content) return '';
    
    try {
      // Handle counter
      if (noteId) {
        const count = (this.counters.get(noteId) || 0) + 1;
        this.counters.set(noteId, count);
        variables.counter = count;
      }

      // Add built-in variables
      const builtIns = {
        date: new Date().toLocaleDateString(),
        time: new Date().toLocaleTimeString(),
        datetime: new Date().toLocaleString(),
        timestamp: Date.now(),
        ...variables
      };

      // Process each variable
      return content.replace(/\{\{\s*([^}]+)\s*\}\}/g, (match, expr) => {
        try {
          // Handle function calls like {{random(1, 10)}}
          if (expr.includes('(') && expr.endsWith(')')) {
            const funcMatch = expr.match(/(\w+)\(([^)]*)\)/);
            if (funcMatch) {
              const [_, funcName, argsStr] = funcMatch;
              const args = argsStr.split(',').map(arg => {
                const trimmed = arg.trim();
                // Try to parse as number if possible
                if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
                if (/^\d+\.\d+$/.test(trimmed)) return parseFloat(trimmed);
                // Handle quoted strings
                if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || 
                    (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
                  return trimmed.slice(1, -1);
                }
                // Check if it's a variable
                return variables[trimmed] ?? builtIns[trimmed] ?? trimmed;
              });
              
              // Built-in functions
              switch (funcName.toLowerCase()) {
                case 'random':
                  if (args.length === 2) {
                    const [min, max] = args;
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                  }
                  return match;
                default:
                  return match; // Unknown function
              }
            }
          }
          
          // Handle environment variables
          if (expr.startsWith('env.')) {
            const varName = expr.slice(4);
            return process.env[varName] || '';
          }
          
          // Handle regular variables
          return builtIns[expr] !== undefined ? builtIns[expr] : variables[expr] !== undefined ? variables[expr] : match;
        } catch (error) {
          logger.error(`Error processing template expression: ${expr}`, error);
          return match; // Return original on error
        }
      });
    } catch (error) {
      logger.error('Error processing template:', error);
      return content; // Return original on error
    }
  }

  /**
   * Reset counter for a specific note
   * @param {string} noteId - ID of the note
   */
  resetCounter(noteId) {
    if (this.counters.has(noteId)) {
      this.counters.delete(noteId);
    }
  }
}

module.exports = new TemplateService();
