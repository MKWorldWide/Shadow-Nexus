const axios = require('axios');
const logger = require('../utils/logger')('modules:guardianBridge');

/**
 * Send a message to a Unity guardian bridge service.
 * @param {string} guardian - Target guardian identifier.
 * @param {string} message - Message content to deliver.
 */
async function sendGuardianMessage(guardian, message) {
  const url = process.env.GUARDIAN_BRIDGE_URL;
  if (!url) {
    // No bridge configured; log and exit silently to avoid runtime failures.
    logger.warn('GUARDIAN_BRIDGE_URL is not configured');
    return;
  }
  try {
    await axios.post(url, { guardian, message });
    logger.debug(`Guardian message dispatched to ${guardian}`);
  } catch (error) {
    logger.error('Failed to send guardian message', { error: error.message });
  }
}

module.exports = {
  sendGuardianMessage,
};

