const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
require('dotenv').config();

class HealthMonitor {
  constructor() {
    this.client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });
    
    this.commandChannelId = process.env.COMMAND_CENTER_CHANNEL_ID;
    this.serviceUrls = {
      "ShadowFlower": process.env.SHADOWFLOWER_HEALTH_URL || "http://localhost:8001/health",
      "AthenaCore": process.env.ATHENACORE_HEALTH_URL || "http://localhost:8002/health",
      "Serafina": process.env.SERAFINA_HEALTH_URL || "http://localhost:8003/health",
      "Divina": process.env.DIVINA_HEALTH_URL || "http://localhost:8004/health",
      "GameDin": process.env.GAMEDIN_HEALTH_URL || "http://localhost:8005/health"
    };
    
    this.setupEventHandlers();
  }
  
  async start() {
    try {
      await this.client.login(process.env.DISCORD_TOKEN);
      console.log(`[✅] Health Monitor active as ${this.client.user.tag}`);
      this.startHeartbeat();
    } catch (error) {
      console.error('Failed to start Health Monitor:', error);
      process.exit(1);
    }
  }
  
  setupEventHandlers() {
    this.client.once('ready', () => {
      console.log(`[✅] Health Monitor connected to Discord as ${this.client.user.tag}`);
    });
    
    this.client.on('messageCreate', async (message) => {
      if (message.content === '#status' && message.channelId === this.commandChannelId) {
        await this.sendStatusReport(message.channel);
      }
    });
  }
  
  async checkServiceHealth(serviceName, url) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      return {
        status: response.status === 200 ? 'online' : 'error',
        statusCode: response.status,
        data: response.data || {}
      };
    } catch (error) {
      return {
        status: 'offline',
        error: error.message
      };
    }
  }
  
  async sendStatusReport(channel) {
    const embed = new EmbedBuilder()
      .setTitle('📡 System Status Report')
      .setColor(0x5f4b8b)
      .setTimestamp();
    
    const statusFields = [];
    
    for (const [name, url] of Object.entries(this.serviceUrls)) {
      const status = await this.checkServiceHealth(name, url);
      let statusText, statusEmoji;
      
      if (status.status === 'online') {
        statusEmoji = '🟢';
        statusText = 'Online';
      } else if (status.status === 'error') {
        statusEmoji = '🔴';
        statusText = `Error (${status.statusCode})`;
      } else {
        statusEmoji = '⚠️';
        statusText = `Offline (${status.error?.substring(0, 30)}...)`;
      }
      
      statusFields.push({
        name: `${statusEmoji} ${name}`,
        value: statusText,
        inline: true
      });
    }
    
    embed.addFields(statusFields);
    await channel.send({ embeds: [embed] });
  }
  
  startHeartbeat() {
    setInterval(async () => {
      const channel = await this.client.channels.fetch(this.commandChannelId);
      if (!channel) return;
      
      const now = new Date().toISOString();
      await channel.send(`[🕓] Nexus Heartbeat: ${now}`);
      
      for (const [name, url] of Object.entries(this.serviceUrls)) {
        const status = await this.checkServiceHealth(name, url);
        if (status.status === 'online') {
          await channel.send(`✅ ${name} is up.`);
        } else if (status.status === 'error') {
          await channel.send(`🔴 ${name} returned error code ${status.statusCode}.`);
        } else {
          await channel.send(`⚠️ ${name} is offline: ${status.error}`);
        }
      }
    }, 5 * 60 * 1000); // Every 5 minutes
  }
}

// Start the health monitor if this file is run directly
if (require.main === module) {
  const monitor = new HealthMonitor();
  monitor.start();
}

module.exports = HealthMonitor;
