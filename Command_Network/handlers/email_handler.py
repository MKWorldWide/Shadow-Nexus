"""
Email command handler for Shadow Nexus
"""

import os
import ssl
import email
import imaplib
import logging
import smtplib
import asyncio
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, Optional, List, Tuple

from Core_Control.command_router import Command, CommandHandler

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EmailHandler(CommandHandler):
    """
    Handles commands received through email
    """
    
    def __init__(self):
        """Initialize the email command handler"""
        # Load email configuration
        self.email_server = os.getenv("EMAIL_SERVER", "imap.gmail.com")
        self.email_port = int(os.getenv("EMAIL_PORT", "993"))
        self.username = os.getenv("EMAIL_USERNAME")
        self.password = os.getenv("EMAIL_PASSWORD")
        
        if not all([self.username, self.password]):
            raise ValueError("Email credentials not properly configured")
        
        self.imap = None
        self.smtp = None
        self._running = False
        self._check_interval = 60  # Check email every 60 seconds
        
        logger.info("Email command handler initialized")
    
    async def handle_command(self, command: Command) -> Dict[str, Any]:
        """
        Handle a command from the command router
        
        Args:
            command: Command object to handle
            
        Returns:
            Dict containing the command response
        """
        try:
            # Extract email details from payload
            to_email = command.payload.get("to")
            subject = command.payload.get("subject", "Shadow Nexus Response")
            content = command.payload.get("content", "No content provided")
            
            if to_email:
                await self._send_email(to_email, subject, content)
                return {"status": "success", "message": "Email sent"}
            
            return {
                "status": "error",
                "message": "Invalid email address or missing content"
            }
            
        except Exception as e:
            error_msg = f"Error handling email command: {str(e)}"
            logger.error(error_msg)
            return {"status": "error", "message": error_msg}
    
    async def _connect_imap(self) -> None:
        """Establish IMAP connection"""
        try:
            context = ssl.create_default_context()
            self.imap = imaplib.IMAP4_SSL(self.email_server, self.email_port, ssl_context=context)
            self.imap.login(self.username, self.password)
            logger.info("IMAP connection established")
        except Exception as e:
            logger.error(f"IMAP connection error: {str(e)}")
            raise
    
    async def _connect_smtp(self) -> None:
        """Establish SMTP connection"""
        try:
            context = ssl.create_default_context()
            self.smtp = smtplib.SMTP(self.email_server, 587)
            self.smtp.starttls(context=context)
            self.smtp.login(self.username, self.password)
            logger.info("SMTP connection established")
        except Exception as e:
            logger.error(f"SMTP connection error: {str(e)}")
            raise
    
    async def _send_email(self, to_email: str, subject: str, content: str) -> None:
        """
        Send an email
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            content: Email content
        """
        try:
            if not self.smtp:
                await self._connect_smtp()
            
            msg = MIMEMultipart()
            msg["From"] = self.username
            msg["To"] = to_email
            msg["Subject"] = subject
            
            msg.attach(MIMEText(content, "plain"))
            
            self.smtp.send_message(msg)
            logger.info(f"Email sent to {to_email}")
            
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")
            raise
    
    async def _check_email(self) -> List[Tuple[str, str]]:
        """
        Check for new emails with commands
        
        Returns:
            List of tuples containing (from_email, command_text)
        """
        try:
            if not self.imap:
                await self._connect_imap()
            
            self.imap.select("INBOX")
            _, messages = self.imap.search(None, "UNSEEN")
            
            commands = []
            for num in messages[0].split():
                _, msg_data = self.imap.fetch(num, "(RFC822)")
                email_body = msg_data[0][1]
                email_message = email.message_from_bytes(email_body)
                
                # Extract sender
                from_email = email.utils.parseaddr(email_message["From"])[1]
                
                # Extract command from subject or body
                if email_message.is_multipart():
                    for part in email_message.walk():
                        if part.get_content_type() == "text/plain":
                            content = part.get_payload(decode=True).decode()
                            if content.strip().startswith("#"):
                                commands.append((from_email, content.strip()))
                else:
                    content = email_message.get_payload(decode=True).decode()
                    if content.strip().startswith("#"):
                        commands.append((from_email, content.strip()))
            
            return commands
            
        except Exception as e:
            logger.error(f"Error checking email: {str(e)}")
            return []
    
    async def _email_loop(self) -> None:
        """Main email checking loop"""
        while self._running:
            try:
                commands = await self._check_email()
                for from_email, command_text in commands:
                    # TODO: Forward to Core_Control for processing
                    logger.info(f"Received command from {from_email}: {command_text}")
                
                await asyncio.sleep(self._check_interval)
                
            except Exception as e:
                logger.error(f"Error in email loop: {str(e)}")
                await asyncio.sleep(self._check_interval)
    
    async def start(self) -> None:
        """Start the email handler"""
        self._running = True
        await self._connect_imap()
        await self._connect_smtp()
        asyncio.create_task(self._email_loop())
        logger.info("Email handler started")
    
    async def stop(self) -> None:
        """Stop the email handler"""
        self._running = False
        if self.imap:
            self.imap.logout()
        if self.smtp:
            self.smtp.quit()
        logger.info("Email handler stopped") 