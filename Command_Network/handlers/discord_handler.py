"""
Discord command handler for Shadow Nexus
"""

import os
import logging
import discord
from typing import Dict, Any, Optional
from discord.ext import commands

from Core_Control.command_router import Command, CommandHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DiscordCommandHandler(CommandHandler):
    """
    Handles commands received through Discord
    """
    
    def __init__(self):
        """Initialize the Discord command handler"""
        self.bot = commands.Bot(command_prefix="!", intents=discord.Intents.all())
        self.token = os.getenv("DISCORD_BOT_TOKEN")
        if not self.token:
            raise ValueError("DISCORD_BOT_TOKEN environment variable not set")
        
        # Register event handlers
        self.bot.event(self.on_ready)
        self.bot.event(self.on_message)
        
        logger.info("Discord command handler initialized")
    
    async def handle_command(self, command: Command) -> Dict[str, Any]:
        """
        Handle a command from the command router
        
        Args:
            command: Command object to handle
            
        Returns:
            Dict containing the command response
        """
        try:
            # Extract channel ID from payload if present
            channel_id = command.payload.get("channel_id")
            content = command.payload.get("content", "No content provided")
            
            if channel_id:
                channel = await self.bot.fetch_channel(int(channel_id))
                if channel:
                    await channel.send(content)
                    return {"status": "success", "message": "Message sent"}
            
            return {
                "status": "error",
                "message": "Invalid channel ID or missing content"
            }
            
        except Exception as e:
            error_msg = f"Error handling Discord command: {str(e)}"
            logger.error(error_msg)
            return {"status": "error", "message": error_msg}
    
    async def on_ready(self):
        """Called when the bot is ready"""
        logger.info(f"Discord bot logged in as {self.bot.user}")
    
    async def on_message(self, message: discord.Message):
        """
        Handle incoming Discord messages
        
        Args:
            message: Discord message object
        """
        # Ignore messages from the bot itself
        if message.author == self.bot.user:
            return
        
        try:
            # Process commands with the prefix
            await self.bot.process_commands(message)
            
            # Check for hashtag commands
            if message.content.startswith("#"):
                # TODO: Forward to Core_Control for processing
                pass
                
        except Exception as e:
            logger.error(f"Error processing Discord message: {str(e)}")
    
    async def start(self):
        """Start the Discord bot"""
        await self.bot.start(self.token)
    
    async def stop(self):
        """Stop the Discord bot"""
        await self.bot.close()
        logger.info("Discord bot stopped") 