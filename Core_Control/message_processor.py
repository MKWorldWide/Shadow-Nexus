"""
MessageProcessor - Handles incoming messages and command extraction
"""

import re
import json
import logging
from typing import Dict, Optional, Any, Tuple
from datetime import datetime

from .command_router import Command

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MessageProcessor:
    """
    Processes incoming messages and extracts commands
    """
    
    # Command pattern: #command_type@target_system{payload}
    COMMAND_PATTERN = r'#(\w+)@(\w+)\{([^}]+)\}'
    
    def __init__(self):
        """Initialize the message processor"""
        self._command_cache: Dict[str, Command] = {}
        logger.info("Initialized MessageProcessor")
    
    def extract_command(self, message: str) -> Optional[Command]:
        """
        Extract a command from a message
        
        Args:
            message: Raw message text
            
        Returns:
            Command object if found, None otherwise
        """
        try:
            match = re.search(self.COMMAND_PATTERN, message)
            if not match:
                logger.debug("No command found in message")
                return None
            
            command_type, target_system, payload_str = match.groups()
            
            try:
                payload = json.loads(payload_str)
            except json.JSONDecodeError:
                logger.error("Invalid JSON payload in command")
                return None
            
            command = Command(
                command_type=command_type,
                target_system=target_system,
                payload=payload,
                timestamp=datetime.now().timestamp()
            )
            
            # Cache the command
            self._command_cache[self._generate_cache_key(command)] = command
            
            logger.info(f"Extracted command: {command_type} for {target_system}")
            return command
            
        except Exception as e:
            logger.error(f"Error extracting command: {str(e)}")
            return None
    
    def process_message(self, message: str) -> Tuple[Optional[Command], Dict[str, Any]]:
        """
        Process a message and extract metadata
        
        Args:
            message: Raw message text
            
        Returns:
            Tuple of (Command object if found, metadata dictionary)
        """
        metadata = {
            'timestamp': datetime.now().timestamp(),
            'length': len(message),
            'has_command': False
        }
        
        command = self.extract_command(message)
        if command:
            metadata['has_command'] = True
            metadata['command_type'] = command.command_type
            metadata['target_system'] = command.target_system
        
        return command, metadata
    
    def _generate_cache_key(self, command: Command) -> str:
        """Generate a unique cache key for a command"""
        return f"{command.command_type}_{command.target_system}_{command.timestamp}"
    
    def get_cached_command(self, cache_key: str) -> Optional[Command]:
        """
        Retrieve a command from the cache
        
        Args:
            cache_key: Cache key for the command
            
        Returns:
            Cached Command object if found, None otherwise
        """
        return self._command_cache.get(cache_key)
    
    def clear_cache(self) -> None:
        """Clear the command cache"""
        self._command_cache.clear()
        logger.info("Command cache cleared") 