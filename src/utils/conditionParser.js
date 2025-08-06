const logger = require('./logger')('conditionParser');

/**
 * Parse and evaluate a condition string
 * @param {string} condition - The condition string to evaluate
 * @param {Object} context - The context containing variables for evaluation
 * @returns {boolean} - The result of the condition evaluation
 */
function parseCondition(condition, context = {}) {
  if (!condition || typeof condition !== 'string') {
    return true; // No condition means always execute
  }

  try {
    // Simple condition parser supporting basic expressions
    // Example: "status === 'success' && attempts < 3"
    const sandbox = {
      ...context,
      // Add helper functions
      hasTag: (tag) => {
        const tags = context.tags || [];
        return tags.includes(tag);
      },
      hasAnyTag: (...tags) => {
        const noteTags = context.tags || [];
        return tags.some(tag => noteTags.includes(tag));
      },
      hasAllTags: (...tags) => {
        const noteTags = context.tags || [];
        return tags.every(tag => noteTags.includes(tag));
      },
      // Date helpers
      isWeekday: () => {
        const day = new Date().getDay();
        return day > 0 && day < 6; // Monday to Friday
      },
      isWeekend: () => {
        const day = new Date().getDay();
        return day === 0 || day === 6; // Saturday or Sunday
      },
      // Time helpers
      isTimeBetween: (start, end) => {
        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        
        const parseTime = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 100 + (minutes || 0);
        };
        
        const startTime = parseTime(start);
        const endTime = parseTime(end);
        
        if (startTime <= endTime) {
          return currentTime >= startTime && currentTime <= endTime;
        } else {
          // Handle overnight ranges (e.g., 22:00-06:00)
          return currentTime >= startTime || currentTime <= endTime;
        }
      }
    };

    // Create a safe evaluation function
    const evalFn = new Function(
      'context',
      `with(context) { 
        try { 
          return !!(${condition}); 
        } catch (e) { 
          console.error('Condition evaluation error:', e); 
          return false; 
        } 
      }`
    );

    // Evaluate the condition
    return evalFn(sandbox);
  } catch (error) {
    logger.error(`Error evaluating condition "${condition}":`, error);
    return false; // Default to not executing if there's an error
  }
}

/**
 * Check if a note's dependencies are satisfied
 * @param {Object} note - The note to check dependencies for
 * @param {Array<Object>} dependencies - The note's dependencies
 * @returns {Object} - Result with satisfied status and any errors
 */
async function checkDependencies(note, dependencies) {
  if (!dependencies || dependencies.length === 0) {
    return { satisfied: true };
  }

  const results = [];
  let allSatisfied = true;

  for (const dep of dependencies) {
    const dependency = await note.sequelize.models.ScheduledNote.findByPk(dep.dependsOnId);
    
    if (!dependency) {
      results.push({
        dependencyId: dep.dependsOnId,
        status: 'error',
        message: 'Dependency not found'
      });
      allSatisfied = false;
      continue;
    }

    const status = {
      dependencyId: dep.dependsOnId,
      dependencyName: dependency.name,
      requiredStatus: dep.requiredStatus,
      actualStatus: dependency.lastExecutionStatus,
      lastExecution: dependency.lastExecutionTime,
      satisfied: false
    };

    // Check if dependency status matches required status
    if (dep.requiredStatus === 'any') {
      status.satisfied = !!dependency.lastExecutionStatus;
    } else {
      status.satisfied = dependency.lastExecutionStatus === dep.requiredStatus;
    }

    // Check if dependency has been executed at all
    if (dependency.lastExecutionTime === null) {
      status.satisfied = false;
      status.message = 'Dependency has never been executed';
    }

    // Check if dependency is still active
    if (!dependency.isActive) {
      status.satisfied = false;
      status.message = 'Dependency is not active';
    }

    if (!status.satisfied) {
      allSatisfied = false;
    }

    results.push(status);
  }

  return {
    satisfied: allSatisfied,
    results
  };
}

module.exports = {
  parseCondition,
  checkDependencies
};
