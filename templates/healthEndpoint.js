const express = require('express');
const router = express.Router();

/**
 * Health check endpoint
 * @route GET /health
 * @returns {object} 200 - Service status information
 */
router.get('/health', async (req, res) => {
  try {
    // Add any service-specific health checks here
    const healthCheck = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: process.env.SERVICE_NAME || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      // Add any additional health metrics here
    };
    
    res.status(200).json(healthCheck);
  } catch (error) {
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      error: error.message
    });
  }
});

module.exports = router;
