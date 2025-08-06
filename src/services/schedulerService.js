const cron = require('node-cron');
const { Op } = require('sequelize');
const { Webhook, ScheduledNote, ScheduledNoteDependency } = require('../models');
const broadcastService = require('./broadcastService');
const templateService = require('./templateService');
const auditService = require('./auditService');
const { parseCondition, checkDependencies } = require('../utils/conditionParser');
const logger = require('../utils/logger')('scheduler');

// Helper function to get changes between two objects
function getObjectChanges(before, after, fieldsToIgnore = []) {
  if (!before) return after || {};
  if (!after) return {};
  
  const changes = {};
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  
  for (const key of allKeys) {
    if (fieldsToIgnore.includes(key)) continue;
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changes[key] = {
        from: before[key],
        to: after[key]
      };
    }
  }
  
  return changes;
}

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      // Load all active scheduled notes that aren't waiting for dependencies
      const notes = await ScheduledNote.findAll({
        where: { 
          isActive: true,
          [Op.or]: [
            { isWaitingForDependencies: false },
            { isWaitingForDependencies: null }
          ]
        },
        include: [
          {
            model: ScheduledNoteDependency,
            as: 'dependencies',
            required: false
          }
        ]
      });

      // Schedule each note
      for (const note of notes) {
        // Check if the note has any dependencies
        if (note.dependencies && note.dependencies.length > 0) {
          const { satisfied } = await checkDependencies(note, note.dependencies);
          if (!satisfied) {
            logger.info(`Note "${note.name}" has unsatisfied dependencies, marking as waiting`);
            await note.update({ isWaitingForDependencies: true });
            continue;
          }
        }
        
        this.scheduleNote(note);
      }

      // Start the dependency check interval (every minute)
      this.dependencyCheckInterval = setInterval(
        () => this.checkDependentNotes(),
        60 * 1000 // 1 minute
      );

      logger.info(`Scheduler initialized with ${notes.length} active notes`);
    } catch (error) {
      logger.error('Failed to initialize scheduler:', error);
    }
  }

  /**
   * Clean up resources when shutting down
   */
  async shutdown() {
    // Clear the dependency check interval
    if (this.dependencyCheckInterval) {
      clearInterval(this.dependencyCheckInterval);
    }
    
    // Stop all scheduled jobs
    for (const job of this.jobs.values()) {
      job.stop();
    }
    this.jobs.clear();
  }

  /**
   * Check for notes that are waiting for dependencies
   */
  async checkDependentNotes() {
    try {
      const waitingNotes = await ScheduledNote.findAll({
        where: { 
          isActive: true,
          isWaitingForDependencies: true
        },
        include: [
          {
            model: ScheduledNoteDependency,
            as: 'dependencies',
            required: true
          }
        ]
      });

      for (const note of waitingNotes) {
        const { satisfied } = await checkDependencies(note, note.dependencies);
        
        if (satisfied) {
          logger.info(`Dependencies satisfied for note "${note.name}", scheduling for execution`);
          await note.update({ isWaitingForDependencies: false });
          this.scheduleNote(note);
        }
      }
    } catch (error) {
      logger.error('Error checking dependent notes:', error);
    }
  }

  async scheduleNote(note, options = {}) {
    const { userId, serverId, requestId } = options;
    
    try {
      // Log the scheduling attempt
      await auditService.log({
        action: 'schedule',
        entity: 'ScheduledNote',
        entityId: note.id,
        userId,
        serverId: serverId || note.serverId,
        status: 'started',
        metadata: { 
          requestId,
          schedule: note.schedule,
          timezone: note.timezone || 'UTC'
        }
      });

      // Cancel existing job if it exists
      if (this.jobs.has(note.id)) {
        const oldJob = this.jobs.get(note.id);
        oldJob.stop();
        this.jobs.delete(note.id);
        
        await auditService.log({
          action: 'unschedule',
          entity: 'ScheduledNote',
          entityId: note.id,
          userId,
          serverId: serverId || note.serverId,
          status: 'success',
          metadata: { 
            requestId,
            reason: 'Rescheduling note with new parameters'
          }
        });
      }

      // If note is not active, don't schedule it
      if (!note.isActive) {
        await auditService.log({
          action: 'schedule',
          entity: 'ScheduledNote',
          entityId: note.id,
          userId,
          serverId: serverId || note.serverId,
          status: 'skipped',
          metadata: { 
            requestId,
            reason: 'Note is not active',
            schedule: note.schedule
          }
        });
        return null;
      }

      // Parse schedule (CRON or interval)
      let schedule;
      if (note.schedule.endsWith('h')) {
        // Convert interval in hours to a cron schedule (e.g., '2h' -> '0 */2 * * *')
        const hours = parseInt(note.schedule);
        schedule = `0 */${hours} * * *`;
      } else {
        // Use as CRON expression
        schedule = note.schedule;
      }

      // Schedule the job
      const job = cron.schedule(schedule, async () => {
        try {
          await this.executeScheduledNote(note, { userId, serverId, requestId });
        } catch (error) {
          logger.error(`Unhandled error in scheduled job for note ${note.id}:`, error);
          
          // Log the unhandled error
          await auditService.log({
            action: 'execute',
            entity: 'ScheduledNote',
            entityId: note.id,
            userId,
            serverId: serverId || note.serverId,
            status: 'error',
            error: error.message,
            metadata: { 
              requestId,
              errorDetails: error.stack || error.toString()
            }
          });
        }
      }, {
        timezone: note.timezone || 'UTC',
      });

      // Store the job reference
      this.jobs.set(note.id, job);
      
      const nextRun = job.nextDate().toDate();
      
      // Log successful scheduling
      await auditService.log({
        action: 'schedule',
        entity: 'ScheduledNote',
        entityId: note.id,
        userId,
        serverId: serverId || note.serverId,
        status: 'success',
        metadata: { 
          requestId,
          schedule: note.schedule,
          timezone: note.timezone || 'UTC',
          nextRun: nextRun.toISOString()
        }
      });

      logger.info(`Scheduled note "${note.name}" with ID ${note.id}, next run: ${nextRun}`);
      
      return job;
    } catch (error) {
      logger.error(`Failed to schedule note ${note.id}:`, error);
      
      // Log the scheduling failure
      await auditService.log({
        action: 'schedule',
        entity: 'ScheduledNote',
        entityId: note.id,
        userId,
        serverId: serverId || note.serverId,
        status: 'failed',
        error: error.message,
        metadata: { 
          requestId,
          schedule: note.schedule,
          errorDetails: error.stack || error.toString()
        }
      });
      
      throw error;
    }
  }

  async executeScheduledNote(note, options = {}) {
    const { userId, serverId, requestId } = options;
    
    // Refresh the note to get the latest data with dependencies
    const freshNote = await ScheduledNote.findByPk(note.id, {
      include: [
        {
          model: ScheduledNoteDependency,
          as: 'dependencies',
          required: false
        }
      ]
    });
    
    // Log the start of execution
    await auditService.log({
      action: 'execute',
      entity: 'ScheduledNote',
      entityId: note.id,
      userId,
      serverId: serverId || note.serverId,
      status: 'started',
      metadata: { requestId }
    });
    
    // Track the original state for change detection
    const originalNote = { ...freshNote.get({ plain: true }) };
    
    if (!freshNote) {
      logger.warn(`Note ${note.id} not found, skipping execution`);
      return;
    }
    
    note = freshNote;
    
    try {
      logger.info(`Executing scheduled note: ${note.name}`);
      
      // Check conditions
      if (note.condition) {
        const conditionContext = {
          ...note.templateVariables,
          executionCount: note.executionCount,
          lastExecution: note.lastExecutionTime,
          lastStatus: note.lastExecutionStatus,
          now: new Date(),
          hour: new Date().getHours(),
          minute: new Date().getMinutes(),
          day: new Date().getDay(),
          date: new Date().getDate(),
          month: new Date().getMonth() + 1,
          year: new Date().getFullYear(),
          tags: note.tags || []
        };
        
        const shouldExecute = parseCondition(note.ondition, conditionContext);
        if (!shouldExecute) {
          logger.info(`Skipping note "${note.name}" due to condition not being met`);
          await note.update({
            lastExecutionTime: new Date(),
            lastExecutionStatus: 'skipped',
            executionCount: note.executionCount + 1
          });
          return;
        }
      }
      
      // Check dependencies if any
      if (note.dependencies && note.dependencies.length > 0) {
        const { satisfied, results } = await checkDependencies(note, note.dependencies);
        
        if (!satisfied) {
          logger.info(`Note "${note.name}" has unsatisfied dependencies, marking as waiting`);
          await note.update({ isWaitingForDependencies: true });
          
          // Reschedule the job to run later
          if (this.jobs.has(note.id)) {
            this.jobs.get(note.id).stop();
            this.jobs.delete(note.id);
          }
          
          return;
        }
      }
      
      // Process template with variables
      const templateVars = {
        ...(note.templateVariables || {}),
        executionCount: note.executionCount + 1,
        lastExecution: note.lastExecutionTime?.toISOString() || null,
        now: new Date().toISOString(),
        timestamp: Date.now()
      };
      
      const processedContent = templateService.process(
        note.content,
        templateVars,
        note.id
      );
      
      // Prepare broadcast options
      const options = {
        message: processedContent,
        tags: note.tags,
        webhookIds: note.webhookIds,
        username: 'Shadow-Nexus',
        metadata: {
          scheduledNoteId: note.id,
          scheduledNoteName: note.name,
          executionCount: note.executionCount + 1,
          templateVariables: templateVars
        },
      };

      // Execute the broadcast
      const result = await broadcastService.broadcastMessage(options);
      
      // Prepare update data
      const updateData = {
        lastExecutionTime: new Date(),
        executionCount: note.executionCount + 1,
        lastExecutionStatus: 'success',
        isWaitingForDependencies: false,
        nextExecutionTime: this.jobs.get(note.id)?.nextDate()?.toDate() || null
      };
      
      // Update note with execution details
      await note.update(updateData);
      
      // Log successful execution
      await auditService.log({
        action: 'execute',
        entity: 'ScheduledNote',
        entityId: note.id,
        userId,
        serverId: serverId || note.serverId,
        changes: getObjectChanges(originalNote, note.get({ plain: true }), ['updatedAt']),
        status: 'success',
        metadata: { 
          requestId,
          executionCount: updateData.executionCount,
          nextExecutionTime: updateData.nextExecutionTime
        }
      });
      
      // Trigger any notes that depend on this one
      await this.triggerDependentNotes(note.id, { userId, serverId, requestId });
      note.lastExecutionError = null;
      
      // Update next send time from the job
      const job = this.jobs.get(note.id);
      if (job) {
        const nextRuns = job.nextDates(1);
        if (nextRuns && nextRuns.length > 0) {
          note.nextSend = nextRuns[0].toDate();
        }
      }
      
      await note.save();
      
      logger.info(`Successfully executed scheduled note: ${note.name}`, {
        broadcastId: result.broadcastId,
        successCount: result.results.filter(r => r.success).length,
        failureCount: result.results.filter(r => !r.success).length,
      });
      
      return result;
    } catch (error) {
      // Update note with error details
      note.lastExecutionStatus = 'failed';
      note.lastExecutionError = error.message;
      
      try {
        await note.save();
      } catch (saveError) {
        logger.error('Failed to save error details for note:', {
          noteId: note.id,
          error: saveError.message
        });
      }
      
      logger.error(`Error executing scheduled note ${note.id}:`, error);
      throw error;
    }
  }

  async createScheduledNote(data) {
    try {
      const note = await ScheduledNote.create(data);
      if (note.isActive) {
        this.scheduleNote(note);
      }
      return note;
    } catch (error) {
      logger.error('Failed to create scheduled note:', error);
      throw error;
    }
  }

  async updateScheduledNote(id, data) {
    try {
      const note = await ScheduledNote.findByPk(id);
      if (!note) {
        throw new Error('Scheduled note not found');
      }

      const updatedNote = await note.update(data);
      
      // Reschedule if active status or schedule changed
      if (data.isActive !== undefined || data.schedule) {
        if (updatedNote.isActive) {
          this.scheduleNote(updatedNote);
        } else {
          this.unscheduleNote(id);
        }
      }
      
      return updatedNote;
    } catch (error) {
      logger.error(`Failed to update scheduled note ${id}:`, error);
      throw error;
    }
  }

  async deleteScheduledNote(id) {
    try {
      this.unscheduleNote(id);
      const result = await ScheduledNote.destroy({ where: { id } });
      return result > 0;
    } catch (error) {
      logger.error(`Failed to delete scheduled note ${id}:`, error);
      throw error;
    }
  }

  unscheduleNote(id) {
    if (this.jobs.has(id)) {
      this.jobs.get(id).stop();
      this.jobs.delete(id);
      logger.info(`Unscheduled note: ${id}`);
    }
  }

  getScheduledJobs() {
    return Array.from(this.jobs.entries()).map(([id, job]) => ({
      id,
      nextRun: job.nextDate().toISO(),
    }));
  }
}

module.exports = new SchedulerService();
