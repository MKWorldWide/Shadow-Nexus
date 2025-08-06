const { AuditLog } = require('../models');
const logger = require('../utils/logger')('audit');

class AuditService {
  /**
   * Log an audit event
   * @param {Object} options - Audit log options
   * @param {string} options.action - The action performed (e.g., 'create', 'update', 'delete', 'execute')
   * @param {string} options.entity - The entity type (e.g., 'ScheduledNote', 'Webhook')
   * @param {string} options.entityId - The ID of the entity
   * @param {string} [options.userId] - The ID of the user who performed the action
   * @param {string} [options.serverId] - The ID of the server where the action was performed
   * @param {Object} [options.changes] - Object describing the changes made
   * @param {string} [options.status] - Status of the action (e.g., 'success', 'failed')
   * @param {string} [options.error] - Error message if the action failed
   * @param {Object} [options.metadata] - Additional metadata
   * @returns {Promise<AuditLog>} - The created audit log entry
   */
  async log({
    action,
    entity,
    entityId,
    userId = null,
    serverId = null,
    changes = {},
    status = 'success',
    error = null,
    metadata = {}
  }) {
    try {
      const logEntry = await AuditLog.create({
        action,
        entity,
        entityId,
        userId,
        serverId,
        changes: JSON.stringify(changes),
        status,
        error,
        metadata: JSON.stringify(metadata)
      });

      // Also log to the application log
      const logMessage = `[AUDIT] ${action} ${entity} ${entityId} ${status}`;
      if (status === 'success') {
        logger.info(logMessage, { entity, entityId, action, status, userId, serverId });
      } else {
        logger.warn(logMessage, { 
          entity, 
          entityId, 
          action, 
          status, 
          error,
          userId, 
          serverId 
        });
      }

      return logEntry;
    } catch (error) {
      logger.error('Failed to create audit log entry:', error);
      // Don't throw to avoid breaking the main operation
      return null;
    }
  }

  /**
   * Get audit logs with pagination and filtering
   * @param {Object} options - Query options
   * @param {string} [options.entity] - Filter by entity type
   * @param {string} [options.entityId] - Filter by entity ID
   * @param {string} [options.action] - Filter by action
   * @param {string} [options.status] - Filter by status
   * @param {string} [options.userId] - Filter by user ID
   * @param {string} [options.serverId] - Filter by server ID
   * @param {Date} [options.startDate] - Start date for filtering
   * @param {Date} [options.endDate] - End date for filtering
   * @param {number} [options.page=1] - Page number (1-based)
   * @param {number} [options.limit=50] - Number of items per page
   * @returns {Promise<{logs: Array<AuditLog>, total: number, pages: number}>} - Paginated results
   */
  async getLogs({
    entity,
    entityId,
    action,
    status,
    userId,
    serverId,
    startDate,
    endDate,
    page = 1,
    limit = 50
  } = {}) {
    try {
      const where = {};
      
      if (entity) where.entity = entity;
      if (entityId) where.entityId = entityId;
      if (action) where.action = action;
      if (status) where.status = status;
      if (userId) where.userId = userId;
      if (serverId) where.serverId = serverId;
      
      // Date range filtering
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = startDate;
        if (endDate) where.createdAt[Op.lte] = endDate;
      }

      const offset = (page - 1) * limit;
      
      const { count, rows } = await AuditLog.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        raw: true
      });

      // Parse JSON fields
      const logs = rows.map(log => ({
        ...log,
        changes: log.changes ? JSON.parse(log.changes) : {},
        metadata: log.metadata ? JSON.parse(log.metadata) : {}
      }));

      return {
        logs,
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: page,
        limit
      };
    } catch (error) {
      logger.error('Failed to fetch audit logs:', error);
      throw error;
    }
  }
}

module.exports = new AuditService();
