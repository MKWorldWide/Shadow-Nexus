// Minimal model stubs for testing environments
// Provides CommandLog with a no-op logCommand method
class CommandLog {
  static async logCommand() {
    return { status: 'stubbed' };
  }
}

module.exports = { CommandLog };
