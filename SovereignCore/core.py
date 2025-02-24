"""
SovereignCore - Large-Scale Information Gathering & System Monitoring
"""

import os
import json
import logging
import asyncio
import feedparser
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Set
import aiohttp
import boto3
from botocore.exceptions import ClientError
from bs4 import BeautifulSoup
from pydantic import BaseModel

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataSource(BaseModel):
    """Data source configuration"""
    source_id: str
    source_type: str  # "rss", "api", "web"
    url: str
    update_interval: int  # seconds
    headers: Optional[Dict[str, str]] = None
    api_key: Optional[str] = None
    parser_config: Optional[Dict[str, Any]] = None

class DataItem(BaseModel):
    """Collected data item"""
    item_id: str
    source_id: str
    timestamp: datetime
    content: Dict[str, Any]
    metadata: Dict[str, Any]

class DataCollector:
    """Handles data collection from various sources"""
    
    def __init__(self):
        """Initialize data collector"""
        self.session = None
        self.sources: Dict[str, DataSource] = {}
        self.last_update: Dict[str, datetime] = {}
        self.processed_items: Set[str] = set()
    
    async def initialize(self):
        """Initialize aiohttp session"""
        if not self.session:
            self.session = aiohttp.ClientSession()
    
    async def close(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()
            self.session = None
    
    def add_source(self, source: DataSource):
        """Add a data source"""
        self.sources[source.source_id] = source
        self.last_update[source.source_id] = datetime.min.replace(tzinfo=timezone.utc)
    
    async def collect_from_source(
        self,
        source: DataSource
    ) -> List[DataItem]:
        """
        Collect data from a specific source
        
        Args:
            source: Data source configuration
            
        Returns:
            List of collected data items
        """
        try:
            if source.source_type == "rss":
                return await self._collect_rss(source)
            elif source.source_type == "api":
                return await self._collect_api(source)
            elif source.source_type == "web":
                return await self._collect_web(source)
            else:
                logger.error(f"Unknown source type: {source.source_type}")
                return []
                
        except Exception as e:
            logger.error(f"Error collecting from {source.source_id}: {str(e)}")
            return []
    
    async def _collect_rss(self, source: DataSource) -> List[DataItem]:
        """Collect data from RSS feed"""
        try:
            feed = feedparser.parse(source.url)
            items = []
            
            for entry in feed.entries:
                item_id = entry.get('id', entry.get('link', ''))
                
                if item_id not in self.processed_items:
                    self.processed_items.add(item_id)
                    
                    items.append(DataItem(
                        item_id=item_id,
                        source_id=source.source_id,
                        timestamp=datetime.now(timezone.utc),
                        content={
                            "title": entry.get('title', ''),
                            "description": entry.get('description', ''),
                            "link": entry.get('link', ''),
                            "published": entry.get('published', '')
                        },
                        metadata={
                            "feed_title": feed.feed.get('title', ''),
                            "feed_link": feed.feed.get('link', '')
                        }
                    ))
            
            return items
            
        except Exception as e:
            logger.error(f"Error collecting RSS from {source.url}: {str(e)}")
            return []
    
    async def _collect_api(self, source: DataSource) -> List[DataItem]:
        """Collect data from API endpoint"""
        if not self.session:
            await self.initialize()
        
        try:
            headers = source.headers or {}
            if source.api_key:
                headers['Authorization'] = f'Bearer {source.api_key}'
            
            async with self.session.get(source.url, headers=headers) as response:
                response.raise_for_status()
                data = await response.json()
                
                items = []
                for item in data:
                    item_id = str(item.get('id', ''))
                    
                    if item_id not in self.processed_items:
                        self.processed_items.add(item_id)
                        
                        items.append(DataItem(
                            item_id=item_id,
                            source_id=source.source_id,
                            timestamp=datetime.now(timezone.utc),
                            content=item,
                            metadata={
                                "api_endpoint": source.url,
                                "response_headers": dict(response.headers)
                            }
                        ))
                
                return items
                
        except Exception as e:
            logger.error(f"Error collecting API data from {source.url}: {str(e)}")
            return []
    
    async def _collect_web(self, source: DataSource) -> List[DataItem]:
        """Collect data from web page"""
        if not self.session:
            await self.initialize()
        
        try:
            async with self.session.get(source.url) as response:
                response.raise_for_status()
                html = await response.text()
                
                soup = BeautifulSoup(html, 'html.parser')
                parser_config = source.parser_config or {}
                
                items = []
                for selector in parser_config.get('selectors', []):
                    elements = soup.select(selector['css'])
                    
                    for element in elements:
                        item_id = f"{source.url}#{selector['css']}#{len(items)}"
                        
                        if item_id not in self.processed_items:
                            self.processed_items.add(item_id)
                            
                            items.append(DataItem(
                                item_id=item_id,
                                source_id=source.source_id,
                                timestamp=datetime.now(timezone.utc),
                                content={
                                    "text": element.get_text(strip=True),
                                    "html": str(element),
                                    "attributes": dict(element.attrs)
                                },
                                metadata={
                                    "url": source.url,
                                    "selector": selector['css']
                                }
                            ))
                
                return items
                
        except Exception as e:
            logger.error(f"Error collecting web data from {source.url}: {str(e)}")
            return []

class DataProcessor:
    """Processes and analyzes collected data"""
    
    def __init__(self):
        """Initialize data processor"""
        self.lambda_client = boto3.client('lambda')
    
    async def process_items(
        self,
        items: List[DataItem]
    ) -> List[Dict[str, Any]]:
        """
        Process collected data items
        
        Args:
            items: List of data items to process
            
        Returns:
            List of processing results
        """
        results = []
        for item in items:
            try:
                # Prepare payload for Lambda
                payload = {
                    "item_id": item.item_id,
                    "source_id": item.source_id,
                    "timestamp": item.timestamp.isoformat(),
                    "content": item.content,
                    "metadata": item.metadata
                }
                
                # Invoke Lambda for processing
                response = self.lambda_client.invoke(
                    FunctionName=os.getenv('DATA_PROCESSOR_LAMBDA'),
                    InvocationType='RequestResponse',
                    Payload=json.dumps(payload)
                )
                
                result = json.loads(response['Payload'].read())
                results.append(result)
                
            except Exception as e:
                logger.error(f"Error processing item {item.item_id}: {str(e)}")
                results.append({
                    "status": "error",
                    "item_id": item.item_id,
                    "error": str(e)
                })
        
        return results

class DataStorage:
    """Handles data storage in DynamoDB and S3"""
    
    def __init__(self):
        """Initialize data storage"""
        self.dynamodb = boto3.resource('dynamodb')
        self.s3 = boto3.client('s3')
        
        # Get table and bucket names from environment
        self.table_name = os.getenv('DATA_TABLE', 'SovereignCoreData')
        self.bucket_name = os.getenv('DATA_BUCKET')
        
        self.table = self.dynamodb.Table(self.table_name)
    
    async def store_items(
        self,
        items: List[DataItem],
        results: List[Dict[str, Any]]
    ) -> None:
        """
        Store processed items and results
        
        Args:
            items: Original data items
            results: Processing results
        """
        for item, result in zip(items, results):
            try:
                # Store structured data in DynamoDB
                self.table.put_item(Item={
                    "item_id": item.item_id,
                    "source_id": item.source_id,
                    "timestamp": item.timestamp.isoformat(),
                    "content_summary": result.get("summary", ""),
                    "analysis_results": result.get("analysis", {}),
                    "metadata": item.metadata
                })
                
                # Store full content in S3 if configured
                if self.bucket_name:
                    key = f"data/{item.source_id}/{item.item_id}.json"
                    self.s3.put_object(
                        Bucket=self.bucket_name,
                        Key=key,
                        Body=json.dumps({
                            "item": item.dict(),
                            "processing_result": result
                        })
                    )
                
            except Exception as e:
                logger.error(f"Error storing item {item.item_id}: {str(e)}")

class SovereignCore:
    """
    Main system for large-scale information gathering
    and continuous monitoring
    """
    
    def __init__(self):
        """Initialize SovereignCore system"""
        self.collector = DataCollector()
        self.processor = DataProcessor()
        self.storage = DataStorage()
        self._running = False
        
        logger.info("SovereignCore initialized")
    
    def add_source(self, source_config: Dict[str, Any]):
        """Add a data source"""
        source = DataSource(**source_config)
        self.collector.add_source(source)
        logger.info(f"Added source: {source.source_id}")
    
    async def start_monitoring(self):
        """Start continuous monitoring"""
        self._running = True
        await self.collector.initialize()
        
        while self._running:
            try:
                for source in self.collector.sources.values():
                    # Check if it's time to update
                    last_update = self.collector.last_update[source.source_id]
                    now = datetime.now(timezone.utc)
                    
                    if (now - last_update).total_seconds() >= source.update_interval:
                        # Collect new data
                        items = await self.collector.collect_from_source(source)
                        
                        if items:
                            # Process collected data
                            results = await self.processor.process_items(items)
                            
                            # Store results
                            await self.storage.store_items(items, results)
                            
                            self.collector.last_update[source.source_id] = now
                            logger.info(
                                f"Processed {len(items)} items from {source.source_id}"
                            )
                
                await asyncio.sleep(1)  # Prevent CPU overload
                
            except Exception as e:
                logger.error(f"Error in monitoring loop: {str(e)}")
                await asyncio.sleep(5)  # Back off on error
    
    async def stop_monitoring(self):
        """Stop continuous monitoring"""
        self._running = False
        await self.collector.close()
        logger.info("SovereignCore monitoring stopped")
    
    async def execute_observation(
        self,
        target_sources: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Execute immediate observation of specified sources
        
        Args:
            target_sources: List of source IDs to observe (None for all)
            
        Returns:
            Dict containing observation results
        """
        try:
            results = {}
            sources = (
                [self.collector.sources[sid] for sid in target_sources]
                if target_sources
                else self.collector.sources.values()
            )
            
            for source in sources:
                items = await self.collector.collect_from_source(source)
                if items:
                    processing_results = await self.processor.process_items(items)
                    await self.storage.store_items(items, processing_results)
                    
                    results[source.source_id] = {
                        "items_collected": len(items),
                        "processing_results": processing_results
                    }
            
            return {
                "status": "success",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "results": results
            }
            
        except Exception as e:
            logger.error(f"Error in observation: {str(e)}")
            return {"status": "error", "message": str(e)} 