"""
Phantom - Data Retrieval & Surveillance Module with Stealth Capabilities
"""

import os
import json
import logging
import asyncio
import random
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List
import aiohttp
import boto3
from botocore.exceptions import ClientError
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from fake_useragent import UserAgent

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class StealthConfig:
    """Configuration for stealth operations"""
    
    def __init__(
        self,
        min_delay: float = 1.0,
        max_delay: float = 5.0,
        rotate_user_agent: bool = True,
        use_proxies: bool = False
    ):
        self.min_delay = min_delay
        self.max_delay = max_delay
        self.rotate_user_agent = rotate_user_agent
        self.use_proxies = use_proxies
        self.user_agent = UserAgent()
        
        # Load proxy list if enabled
        self.proxies = []
        if use_proxies:
            self._load_proxies()
    
    def _load_proxies(self):
        """Load proxy list from environment or config"""
        proxy_list = os.getenv('PROXY_LIST', '').split(',')
        self.proxies = [p.strip() for p in proxy_list if p.strip()]
    
    def get_headers(self) -> Dict[str, str]:
        """Get randomized headers for requests"""
        headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Connection': 'keep-alive'
        }
        
        if self.rotate_user_agent:
            headers['User-Agent'] = self.user_agent.random
        
        return headers
    
    async def get_delay(self) -> float:
        """Get random delay between requests"""
        return random.uniform(self.min_delay, self.max_delay)
    
    def get_proxy(self) -> Optional[str]:
        """Get random proxy if enabled"""
        return random.choice(self.proxies) if self.proxies else None

class Encryptor:
    """Handles data encryption using AES-256"""
    
    def __init__(self):
        """Initialize encryptor with key from environment"""
        self.key = os.getenv('ENCRYPTION_KEY', get_random_bytes(32))
        if isinstance(self.key, str):
            self.key = self.key.encode()
    
    def encrypt(self, data: bytes) -> Dict[str, bytes]:
        """
        Encrypt data using AES-256
        
        Returns:
            Dict containing encrypted data and IV
        """
        iv = get_random_bytes(16)
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        
        # Pad data to be multiple of 16 bytes
        pad_length = 16 - (len(data) % 16)
        padded_data = data + bytes([pad_length] * pad_length)
        
        encrypted_data = cipher.encrypt(padded_data)
        return {
            "encrypted_data": encrypted_data,
            "iv": iv
        }
    
    def decrypt(self, encrypted_data: bytes, iv: bytes) -> bytes:
        """Decrypt data using AES-256"""
        cipher = AES.new(self.key, AES.MODE_CBC, iv)
        decrypted_data = cipher.decrypt(encrypted_data)
        
        # Remove padding
        pad_length = decrypted_data[-1]
        return decrypted_data[:-pad_length]

class DataRetriever:
    """Handles data retrieval with stealth capabilities"""
    
    def __init__(self, stealth_config: StealthConfig):
        self.stealth_config = stealth_config
        self.session = None
    
    async def initialize(self):
        """Initialize aiohttp session"""
        if not self.session:
            self.session = aiohttp.ClientSession(
                headers=self.stealth_config.get_headers()
            )
    
    async def close(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    async def fetch_url(self, url: str) -> bytes:
        """
        Fetch data from URL with stealth measures
        
        Args:
            url: Target URL
            
        Returns:
            Raw response data
        """
        if not self.session:
            await self.initialize()
        
        # Apply stealth delay
        await asyncio.sleep(await self.stealth_config.get_delay())
        
        # Get proxy if enabled
        proxy = self.stealth_config.get_proxy()
        
        try:
            async with self.session.get(url, proxy=proxy) as response:
                response.raise_for_status()
                return await response.read()
                
        except Exception as e:
            logger.error(f"Error fetching URL {url}: {str(e)}")
            raise

class Phantom:
    """
    Main surveillance and data retrieval system with
    stealth capabilities and secure storage
    """
    
    def __init__(self):
        """Initialize Phantom system"""
        # Initialize components
        self.stealth_config = StealthConfig()
        self.retriever = DataRetriever(self.stealth_config)
        self.encryptor = Encryptor()
        
        # Initialize AWS clients
        self.s3 = boto3.client('s3')
        self.lambda_client = boto3.client('lambda')
        
        # Get bucket name from environment
        self.bucket_name = os.getenv('PHANTOM_DATA_BUCKET')
        if not self.bucket_name:
            raise ValueError("PHANTOM_DATA_BUCKET environment variable not set")
        
        logger.info("Phantom system initialized")
    
    async def execute_retrieval(
        self,
        target_url: str,
        operation_id: str
    ) -> Dict[str, Any]:
        """
        Execute data retrieval operation
        
        Args:
            target_url: URL to retrieve data from
            operation_id: Unique identifier for the operation
            
        Returns:
            Dict containing operation results
        """
        try:
            # Retrieve data with stealth measures
            raw_data = await self.retriever.fetch_url(target_url)
            
            # Encrypt data
            encrypted = self.encryptor.encrypt(raw_data)
            
            # Generate metadata
            metadata = {
                "operation_id": operation_id,
                "timestamp": datetime.utcnow().isoformat(),
                "target_url": target_url,
                "data_hash": hashlib.sha256(raw_data).hexdigest()
            }
            
            # Store encrypted data and metadata in S3
            await self._store_data(
                operation_id,
                encrypted["encrypted_data"],
                encrypted["iv"],
                metadata
            )
            
            return {
                "status": "success",
                "operation_id": operation_id,
                "data_hash": metadata["data_hash"]
            }
            
        except Exception as e:
            logger.error(f"Error in retrieval operation: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def _store_data(
        self,
        operation_id: str,
        encrypted_data: bytes,
        iv: bytes,
        metadata: Dict[str, Any]
    ) -> None:
        """Store encrypted data and metadata in S3"""
        try:
            # Store encrypted data
            data_key = f"data/{operation_id}/encrypted_data"
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=data_key,
                Body=encrypted_data
            )
            
            # Store IV
            iv_key = f"data/{operation_id}/iv"
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=iv_key,
                Body=iv
            )
            
            # Store metadata
            metadata_key = f"data/{operation_id}/metadata.json"
            self.s3.put_object(
                Bucket=self.bucket_name,
                Key=metadata_key,
                Body=json.dumps(metadata).encode()
            )
            
            logger.info(f"Data stored for operation {operation_id}")
            
        except ClientError as e:
            logger.error(f"Error storing data: {str(e)}")
            raise
    
    async def retrieve_data(
        self,
        operation_id: str
    ) -> Dict[str, Any]:
        """
        Retrieve and decrypt data from S3
        
        Args:
            operation_id: Operation ID to retrieve
            
        Returns:
            Dict containing decrypted data and metadata
        """
        try:
            # Retrieve encrypted data
            data_key = f"data/{operation_id}/encrypted_data"
            encrypted_data = self.s3.get_object(
                Bucket=self.bucket_name,
                Key=data_key
            )['Body'].read()
            
            # Retrieve IV
            iv_key = f"data/{operation_id}/iv"
            iv = self.s3.get_object(
                Bucket=self.bucket_name,
                Key=iv_key
            )['Body'].read()
            
            # Retrieve metadata
            metadata_key = f"data/{operation_id}/metadata.json"
            metadata = json.loads(
                self.s3.get_object(
                    Bucket=self.bucket_name,
                    Key=metadata_key
                )['Body'].read()
            )
            
            # Decrypt data
            decrypted_data = self.encryptor.decrypt(encrypted_data, iv)
            
            return {
                "status": "success",
                "data": decrypted_data,
                "metadata": metadata
            }
            
        except ClientError as e:
            logger.error(f"Error retrieving data: {str(e)}")
            return {"status": "error", "message": str(e)}
    
    async def start(self):
        """Start Phantom system"""
        await self.retriever.initialize()
        logger.info("Phantom system started")
    
    async def stop(self):
        """Stop Phantom system"""
        await self.retriever.close()
        logger.info("Phantom system stopped") 