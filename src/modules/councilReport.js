const axios = require('axios');
const { EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const logger = require('../utils/logger')('modules:councilReport');

// Helper to query MCP for a brief status summary
async function getMcpStatus() {
  const baseUrl = process.env.MCP_URL;
  if (!baseUrl) {
    return '(MCP_URL not configured)';
  }
  try {
    const res = await axios.post(`${baseUrl}/ask-gemini`, {
      prompt: 'Summarize system health in one sentence.'
    });
    return res.data?.response || '(no data)';
  } catch (error) {
    logger.warn('Failed to fetch MCP status', { error: error.message });
    return '(MCP unreachable)';
  }
}

// Fetch recent commit messages for a repository
async function getRepoDigest(repo) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const url = `https://api.github.com/repos/${repo}/commits?since=${encodeURIComponent(since)}&per_page=5`;
  try {
    const res = await axios.get(url, {
      headers: { 'Accept': 'application/vnd.github+json' }
    });
    const commits = res.data;
    if (!Array.isArray(commits) || commits.length === 0) {
      return `• ${repo}: 0 commits in last 24h`;
    }
    return commits
      .map(c => `• ${repo}@${c.sha.substring(0,7)} — ${c.commit.message.split('\n')[0]}`)
      .join('\n');
  } catch (error) {
    logger.warn(`Failed to fetch digest for ${repo}`, { error: error.message });
    return `• ${repo}: (error fetching commits)`;
  }
}

// Build the Discord embed for the council report
async function buildCouncilReportEmbed() {
  const mcp = await getMcpStatus();
  const repos = (process.env.NAV_REPOS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const repoLines = repos.length ? (await Promise.all(repos.map(getRepoDigest))).join('\n') : '—';

  return new EmbedBuilder()
    .setTitle('🌙 Nightly Council Report')
    .setDescription('Summary of the last 24h across our realm.')
    .setColor(0x9b59b6)
    .addFields(
      { name: 'System Health (MCP)', value: mcp.slice(0, 1024) || '—' },
      { name: 'Recent Commits', value: repoLines.slice(0, 1024) || '—' }
    )
    .setFooter({ text: 'Reported by Lilybear' })
    .setTimestamp(new Date());
}

// Send the council report to the configured channel
async function sendCouncilReport(client) {
  const channelId = process.env.COUNCIL_CHANNEL_ID;
  if (!channelId) {
    logger.warn('COUNCIL_CHANNEL_ID is not set');
    return;
  }
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    logger.warn(`Council channel ${channelId} not found`);
    return;
  }
  const embed = await buildCouncilReportEmbed();
  await channel.send({ embeds: [embed] });
}

// Schedule the nightly council report at 08:00 UTC
function scheduleNightlyCouncilReport(client) {
  cron.schedule('0 8 * * *', async () => {
    try {
      await sendCouncilReport(client);
      logger.info('Nightly council report dispatched');
    } catch (error) {
      logger.error('Failed to dispatch nightly council report', { error: error.message });
    }
  }, { timezone: 'UTC' });
}

module.exports = {
  scheduleNightlyCouncilReport,
  sendCouncilReport,
  buildCouncilReportEmbed,
};

