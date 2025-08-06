// Export all webhook commands
module.exports = {
  WebhookAddCommand: require('./add'),
  WebhookListCommand: require('./list'),
  WebhookTestCommand: require('./test'),
  WebhookDeleteCommand: require('./delete'),
  WebhookSendCommand: require('./send')
};
