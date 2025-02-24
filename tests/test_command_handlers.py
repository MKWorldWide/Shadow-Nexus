"""
Tests for platform-specific command handlers
"""

import os
import pytest
import asyncio
from unittest.mock import MagicMock, patch
from typing import Dict, Any

from Core_Control.command_router import Command
from Command_Network.handlers.discord_handler import DiscordCommandHandler
from Command_Network.handlers.telegram_handler import TelegramHandler
from Command_Network.handlers.email_handler import EmailHandler

@pytest.fixture
def mock_env():
    """Mock environment variables"""
    with patch.dict(os.environ, {
        "DISCORD_BOT_TOKEN": "mock-discord-token",
        "TELEGRAM_BOT_TOKEN": "mock-telegram-token",
        "EMAIL_USERNAME": "test@example.com",
        "EMAIL_PASSWORD": "mock-password",
        "EMAIL_SERVER": "mock.email.server",
        "EMAIL_PORT": "993"
    }):
        yield

@pytest.mark.asyncio
async def test_discord_handler_initialization(mock_env):
    """Test Discord handler initialization"""
    handler = DiscordCommandHandler()
    assert handler.token == "mock-discord-token"
    assert handler.bot is not None

@pytest.mark.asyncio
async def test_discord_handler_command(mock_env):
    """Test Discord command handling"""
    handler = DiscordCommandHandler()
    
    # Mock the channel
    mock_channel = MagicMock()
    mock_channel.send = MagicMock()
    handler.bot.fetch_channel = MagicMock(return_value=mock_channel)
    
    command = Command(
        command_type="message",
        target_system="discord",
        payload={
            "channel_id": "123456789",
            "content": "Test message"
        }
    )
    
    response = await handler.handle_command(command)
    assert response["status"] == "success"
    mock_channel.send.assert_called_once_with("Test message")

@pytest.mark.asyncio
async def test_telegram_handler_initialization(mock_env):
    """Test Telegram handler initialization"""
    handler = TelegramHandler()
    assert handler.token == "mock-telegram-token"
    assert handler.application is not None

@pytest.mark.asyncio
async def test_telegram_handler_command(mock_env):
    """Test Telegram command handling"""
    handler = TelegramHandler()
    
    # Mock the bot
    mock_bot = MagicMock()
    mock_bot.send_message = MagicMock()
    handler.application.bot = mock_bot
    
    command = Command(
        command_type="message",
        target_system="telegram",
        payload={
            "chat_id": "987654321",
            "content": "Test message"
        }
    )
    
    response = await handler.handle_command(command)
    assert response["status"] == "success"
    mock_bot.send_message.assert_called_once_with(
        chat_id="987654321",
        text="Test message"
    )

@pytest.mark.asyncio
async def test_email_handler_initialization(mock_env):
    """Test email handler initialization"""
    handler = EmailHandler()
    assert handler.username == "test@example.com"
    assert handler.password == "mock-password"
    assert handler.email_server == "mock.email.server"
    assert handler.email_port == 993

@pytest.mark.asyncio
async def test_email_handler_command(mock_env):
    """Test email command handling"""
    handler = EmailHandler()
    
    # Mock SMTP connection
    with patch("smtplib.SMTP") as mock_smtp:
        mock_smtp_instance = MagicMock()
        mock_smtp.return_value = mock_smtp_instance
        
        command = Command(
            command_type="message",
            target_system="email",
            payload={
                "to": "recipient@example.com",
                "subject": "Test Subject",
                "content": "Test message"
            }
        )
        
        await handler._connect_smtp()  # Establish mock connection
        response = await handler.handle_command(command)
        
        assert response["status"] == "success"
        mock_smtp_instance.send_message.assert_called_once()

@pytest.mark.asyncio
async def test_email_handler_check_email(mock_env):
    """Test email checking functionality"""
    handler = EmailHandler()
    
    # Mock IMAP connection and responses
    with patch("imaplib.IMAP4_SSL") as mock_imap:
        mock_imap_instance = MagicMock()
        mock_imap.return_value = mock_imap_instance
        
        # Mock email search and fetch responses
        mock_imap_instance.search.return_value = (None, [b"1"])
        mock_imap_instance.fetch.return_value = (None, [(None, b"From: sender@example.com\r\n\r\n#test@system{\"action\": \"test\"}")])
        
        await handler._connect_imap()
        commands = await handler._check_email()
        
        assert len(commands) == 1
        assert commands[0][0] == "sender@example.com"
        assert commands[0][1].startswith("#test@system") 