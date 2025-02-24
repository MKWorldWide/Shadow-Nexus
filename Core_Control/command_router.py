"""
CommandRouter - Core routing system for Shadow Nexus commands
"""

from typing import Dict, Optional, Type, Any
from abc import ABC, abstractmethod
import logging
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Command(BaseModel):
    """Base model for command structure"""
    command_type: str
    target_system: str
    payload: Dict[str, Any]
    signature: Optional[str] = None
    timestamp: Optional[float] = None

class CommandHandler(ABC):
    """Abstract base class for command handlers"""
    
    @abstractmethod
    async def handle_command(self, command: Command) -> Dict[str, Any]:
        """Handle the incoming command"""
        pass

class CommandRouter:
    """
    Core command routing system that directs commands to appropriate subsystems
    """
    
    def __init__(self):
        self._handlers: Dict[str, Type[CommandHandler]] = {}
        self._initialized = False
        logger.info("Initializing CommandRouter")
    
    def register_handler(self, system_name: str, handler: Type[CommandHandler]) -> None:
        """
        Register a command handler for a specific subsystem
        
        Args:
            system_name: Name of the subsystem
            handler: Handler class for the subsystem
        """
        if system_name in self._handlers:
            logger.warning(f"Overwriting existing handler for {system_name}")
        self._handlers[system_name] = handler
        logger.info(f"Registered handler for {system_name}")
    
    async def route_command(self, command: Command) -> Dict[str, Any]:
        """
        Route a command to its appropriate handler
        
        Args:
            command: Command object containing routing information
            
        Returns:
            Dict containing the command response
            
        Raises:
            ValueError: If no handler is found for the target system
        """
        if not self._initialized:
            await self._initialize_handlers()
        
        handler_class = self._handlers.get(command.target_system)
        if not handler_class:
            error_msg = f"No handler found for system: {command.target_system}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            handler = handler_class()
            response = await handler.handle_command(command)
            logger.info(f"Successfully routed command to {command.target_system}")
            return response
        except Exception as e:
            error_msg = f"Error handling command for {command.target_system}: {str(e)}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
    
    async def _initialize_handlers(self) -> None:
        """Initialize all command handlers"""
        # TODO: Implement dynamic handler discovery and initialization
        self._initialized = True
        logger.info("Command handlers initialized") 