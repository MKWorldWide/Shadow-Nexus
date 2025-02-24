"""
Telegram command handler for Shadow Nexus
"""

import os
import logging
from typing import Dict, Any, Optional
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler as TelegramCommandHandler,
    MessageHandler,
    filters,
    ContextTypes
)

from Core_Control.command_router import Command, CommandHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TelegramHandler(CommandHandler):
    """
    Handles commands received through Telegram
    """
    
    def __init__(self):
        """Initialize the Telegram command handler"""
        self.token = os.getenv("TELEGRAM_BOT_TOKEN")
        if not self.token:
            raise ValueError("TELEGRAM_BOT_TOKEN environment variable not set")
        
        self.application = Application.builder().token(self.token).build()
        
        # Register handlers
        self.application.add_handler(
            TelegramCommandHandler("start", self._start_command)
        )
        self.application.add_handler(
            MessageHandler(filters.TEXT & ~filters.COMMAND, self._handle_message)
        )
        
        logger.info("Telegram command handler initialized")
    
    async def handle_command(self, command: Command) -> Dict[str, Any]:
        """
        Handle a command from the command router
        
        Args:
            command: Command object to handle
            
        Returns:
            Dict containing the command response
        """
        try:
            # Extract chat ID from payload if present
            chat_id = command.payload.get("chat_id")
            content = command.payload.get("content", "No content provided")
            
            if chat_id:
                await self.application.bot.send_message(
                    chat_id=chat_id,
                    text=content
                )
                return {"status": "success", "message": "Message sent"}
            
            return {
                "status": "error",
                "message": "Invalid chat ID or missing content"
            }
            
        except Exception as e:
            error_msg = f"Error handling Telegram command: {str(e)}"
            logger.error(error_msg)
            return {"status": "error", "message": error_msg}
    
    async def _start_command(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """
        Handle the /start command
        
        Args:
            update: Telegram update object
            context: Telegram context object
        """
        welcome_message = (
            "Welcome to Shadow Nexus! 🌐\n\n"
            "I'm your AI command network bot. You can control me using hashtag commands.\n"
            "Example: #status@system{\"check\": \"all\"}"
        )
        await update.message.reply_text(welcome_message)
    
    async def _handle_message(
        self,
        update: Update,
        context: ContextTypes.DEFAULT_TYPE
    ) -> None:
        """
        Handle incoming messages
        
        Args:
            update: Telegram update object
            context: Telegram context object
        """
        try:
            message = update.message.text
            
            # Check for hashtag commands
            if message.startswith("#"):
                # TODO: Forward to Core_Control for processing
                await update.message.reply_text(
                    "Command received, processing..."
                )
            
        except Exception as e:
            logger.error(f"Error processing Telegram message: {str(e)}")
            await update.message.reply_text(
                "Error processing command. Please try again."
            )
    
    async def start(self):
        """Start the Telegram bot"""
        await self.application.initialize()
        await self.application.start()
        await self.application.run_polling()
    
    async def stop(self):
        """Stop the Telegram bot"""
        await self.application.stop()
        await self.application.shutdown()
        logger.info("Telegram bot stopped") 