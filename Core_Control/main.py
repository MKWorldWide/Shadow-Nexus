"""
Main entry point for Shadow Nexus Core Control
"""

import os
import asyncio
import logging
from typing import Dict, Any
from dotenv import load_dotenv

from .command_router import CommandRouter, Command
from .signature_verifier import SignatureVerifier
from .message_processor import MessageProcessor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class CoreControl:
    """
    Main controller class for Shadow Nexus
    """
    
    def __init__(self):
        """Initialize the core control system"""
        # Load environment variables
        load_dotenv()
        
        # Initialize components
        self.router = CommandRouter()
        self.verifier = SignatureVerifier(
            os.getenv('SIGNATURE_KEY', 'default-key-change-in-production')
        )
        self.processor = MessageProcessor()
        
        logger.info("Core Control system initialized")
    
    async def process_input(self, input_text: str) -> Dict[str, Any]:
        """
        Process input text and execute commands
        
        Args:
            input_text: Raw input text containing commands
            
        Returns:
            Dictionary containing the response
        """
        try:
            # Extract and validate command
            command, metadata = self.processor.process_message(input_text)
            
            if not command:
                return {
                    'status': 'error',
                    'message': 'No valid command found',
                    'metadata': metadata
                }
            
            # Verify command signature if present
            if command.signature and not self.verifier.verify_signature(
                str(command.payload),
                command.signature,
                command.timestamp
            ):
                return {
                    'status': 'error',
                    'message': 'Invalid command signature',
                    'metadata': metadata
                }
            
            # Route command to appropriate handler
            response = await self.router.route_command(command)
            
            return {
                'status': 'success',
                'message': 'Command executed successfully',
                'result': response,
                'metadata': metadata
            }
            
        except Exception as e:
            logger.error(f"Error processing input: {str(e)}")
            return {
                'status': 'error',
                'message': f"Error processing command: {str(e)}",
                'metadata': {'error': str(e)}
            }

async def main():
    """Main entry point"""
    try:
        core = CoreControl()
        logger.info("Shadow Nexus Core Control started")
        
        # TODO: Implement main event loop and input handling
        while True:
            # Placeholder for actual input handling
            await asyncio.sleep(1)
            
    except KeyboardInterrupt:
        logger.info("Shutting down Shadow Nexus Core Control")
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 