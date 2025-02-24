"""
SignatureVerifier - Command authentication and verification system
"""

import hmac
import hashlib
import base64
import logging
from typing import Optional
from datetime import datetime, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SignatureVerifier:
    """
    Handles command signature verification and authentication
    """
    
    def __init__(self, secret_key: str, max_age: int = 300):
        """
        Initialize the signature verifier
        
        Args:
            secret_key: Secret key for HMAC signature verification
            max_age: Maximum age of signatures in seconds (default: 5 minutes)
        """
        self._secret_key = secret_key.encode('utf-8')
        self._max_age = timedelta(seconds=max_age)
        logger.info("Initialized SignatureVerifier")
    
    def generate_signature(self, message: str, timestamp: Optional[float] = None) -> str:
        """
        Generate a signature for a message
        
        Args:
            message: Message to sign
            timestamp: Optional timestamp to include in signature
            
        Returns:
            Base64 encoded signature
        """
        if timestamp is None:
            timestamp = datetime.now().timestamp()
        
        message_with_timestamp = f"{message}|{timestamp}"
        signature = hmac.new(
            self._secret_key,
            message_with_timestamp.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        return base64.b64encode(signature).decode('utf-8')
    
    def verify_signature(
        self,
        message: str,
        signature: str,
        timestamp: Optional[float] = None
    ) -> bool:
        """
        Verify a message signature
        
        Args:
            message: Original message
            signature: Signature to verify
            timestamp: Optional timestamp from the signature
            
        Returns:
            True if signature is valid, False otherwise
        """
        try:
            if timestamp:
                # Check signature age
                sig_time = datetime.fromtimestamp(timestamp)
                if datetime.now() - sig_time > self._max_age:
                    logger.warning("Signature has expired")
                    return False
            
            expected_signature = self.generate_signature(message, timestamp)
            is_valid = hmac.compare_digest(
                signature.encode('utf-8'),
                expected_signature.encode('utf-8')
            )
            
            if not is_valid:
                logger.warning("Invalid signature detected")
            
            return is_valid
            
        except Exception as e:
            logger.error(f"Error verifying signature: {str(e)}")
            return False
    
    def update_secret_key(self, new_secret_key: str) -> None:
        """
        Update the secret key used for signature verification
        
        Args:
            new_secret_key: New secret key to use
        """
        self._secret_key = new_secret_key.encode('utf-8')
        logger.info("Updated secret key") 