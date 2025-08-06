const { Events, EmbedBuilder } = require('discord.js');
const { WebhookClient } = require('discord.js');
const logger = require('../../utils/logger')('discord:interaction');
const { CommandLog } = require('../../models');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction, client) {
    // Defer the reply if it's a command and hasn't been deferred yet
    if (interaction.isCommand() || interaction.isContextMenuCommand()) {
      await this.handleCommand(interaction, client);
    } else if (interaction.isButton()) {
      await this.handleButton(interaction, client);
    } else if (interaction.isModalSubmit()) {
      await this.handleModal(interaction, client);
    } else if (interaction.isAutocomplete()) {
      await this.handleAutocomplete(interaction, client);
    }
  },

  async handleCommand(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Create command log entry
    const logEntry = await CommandLog.logCommand({
      command: interaction.commandName,
      subcommand: interaction.options?.getSubcommand(false),
      options: interaction.options?.data.reduce((acc, opt) => ({
        ...acc,
        [opt.name]: opt.value
      }), {}),
      serverId: interaction.guildId,
      userId: interaction.user.id,
      userAgent: interaction.client.options.http.userAgent,
      metadata: {
        channelId: interaction.channelId,
        channelType: interaction.channel?.type,
        guildId: interaction.guildId,
        memberId: interaction.member?.id,
        messageId: interaction.id,
        isDM: !interaction.inGuild(),
        locale: interaction.locale,
        guildLocale: interaction.guildLocale
      }
    });

    try {
      // Defer reply if the command takes longer than 2 seconds
      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply({ ephemeral: command.ephemeral });
      }

      // Execute the command
      await command.execute(interaction, client, logger);
      
      // Update command log with success
      await logEntry.update({ 
        status: 'COMPLETED',
        completed_at: new Date(),
        execution_time: Date.now() - logEntry.started_at
      });
    } catch (error) {
      logger.error(`Error executing command ${interaction.commandName}:`, error);
      
      // Update command log with error
      await logEntry.update({
        status: 'FAILED',
        error: error.message,
        completed_at: new Date(),
        execution_time: Date.now() - logEntry.started_at
      });

      // Send error message to user
      const errorEmbed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('❌ An error occurred')
        .setDescription('There was an error executing this command. The error has been logged.')
        .addFields(
          { name: 'Command', value: `\`/${interaction.commandName}\``, inline: true },
          { name: 'Error', value: `\`\`\`${error.message.substring(0, 1000)}\`\`\`` }
        )
        .setTimestamp();

      // Try to reply with the error, fall back to direct message if needed
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({ 
            embeds: [errorEmbed],
            ephemeral: true 
          });
        } else {
          await interaction.reply({ 
            embeds: [errorEmbed],
            ephemeral: true 
          });
        }
      } catch (replyError) {
        logger.error('Failed to send error message:', replyError);
        try {
          await interaction.user.send({ 
            content: 'An error occurred while processing your command:',
            embeds: [errorEmbed] 
          });
        } catch (dmError) {
          logger.error('Failed to send DM with error:', dmError);
        }
      }

      // Log to error channel if configured
      if (process.env.ERROR_WEBHOOK_URL) {
        try {
          const webhookClient = new WebhookClient({ url: process.env.ERROR_WEBHOOK_URL });
          const errorLogEmbed = new EmbedBuilder()
            .setColor('#FF0000')
            .setTitle('Command Error')
            .setDescription(`\`\`\`${error.stack || error.message}\`\`\``)
            .addFields(
              { name: 'Command', value: `\`/${interaction.commandName}\``, inline: true },
              { name: 'User', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
              { name: 'Guild', value: interaction.guild ? `${interaction.guild.name} (${interaction.guildId})` : 'DM', inline: true },
              { name: 'Channel', value: interaction.channel ? `${interaction.channel.name} (${interaction.channelId})` : 'N/A', inline: true },
              { name: 'Message', value: `[Jump to message](${interaction.url})`, inline: true }
            )
            .setTimestamp();

          await webhookClient.send({
            username: 'Shadow Nexus - Error',
            avatarURL: client.user.displayAvatarURL(),
            embeds: [errorLogEmbed]
          });
        } catch (webhookError) {
          logger.error('Failed to send error to webhook:', webhookError);
        }
      }
    }
  },

  async handleButton(interaction, client) {
    const [action, ...params] = interaction.customId.split(':');
    const button = client.buttons.get(action);
    
    if (!button) {
      logger.warn(`No button handler found for ${interaction.customId}`);
      return interaction.reply({
        content: 'This button is no longer valid.',
        ephemeral: true
      }).catch(console.error);
    }

    try {
      await button.execute(interaction, client, ...params);
    } catch (error) {
      logger.error(`Error handling button ${interaction.customId}:`, error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error processing this button.',
          ephemeral: true
        }).catch(console.error);
      } else {
        await interaction.followUp({
          content: 'There was an error processing this button.',
          ephemeral: true
        }).catch(console.error);
      }
    }
  },

  async handleModal(interaction, client) {
    const [modalId] = interaction.customId.split(':');
    const modal = client.modals.get(modalId);
    
    if (!modal) {
      logger.warn(`No modal handler found for ${interaction.customId}`);
      return interaction.reply({
        content: 'This form is no longer valid.',
        ephemeral: true
      }).catch(console.error);
    }

    try {
      await modal.execute(interaction, client);
    } catch (error) {
      logger.error(`Error handling modal ${interaction.customId}:`, error);
      
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          content: 'There was an error processing this form.',
          ephemeral: true
        }).catch(console.error);
      } else {
        await interaction.followUp({
          content: 'There was an error processing this form.',
          ephemeral: true
        }).catch(console.error);
      }
    }
  },

  async handleAutocomplete(interaction, client) {
    const command = client.commands.get(interaction.commandName);
    if (!command || !command.autocomplete) return;

    try {
      await command.autocomplete(interaction, client);
    } catch (error) {
      logger.error(`Error handling autocomplete for ${interaction.commandName}:`, error);
    }
  }
};
