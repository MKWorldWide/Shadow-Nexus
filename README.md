A Project Blessed by Solar Khan & Lilith.Aethra

# Shadow Nexus

Advanced AI Command & Control System with Forex Trading, Data Retrieval, and Information Gathering capabilities.

## Features

### AthenaMist - Precision Forex Scalping AI
- Real-time trading signal processing with Ichimoku Cloud analysis
- Integration with TradingView webhooks
- Sentiment analysis for trade refinement
- Risk management with customizable parameters
- Trade execution via AWS Lambda
- Trade history storage in DynamoDB

### Phantom - Data Retrieval & Surveillance
- Stealth data collection with randomized delays and user agents
- AES-256 encryption for secure data storage
- Proxy support for enhanced anonymity
- Secure storage in AWS S3
- Asynchronous operation for improved performance

### SovereignCore - Information Gathering & Monitoring
- Multi-source data collection (RSS, API, Web)
- Real-time data processing and analysis
- Structured storage in DynamoDB
- Unstructured data storage in S3
- Continuous monitoring with configurable intervals

### Command Network
- Multi-platform command handling:
  - Discord integration
  - Telegram bot support
  - Email command processing
- Secure command routing and verification
- Async support for real-time operations

### Council Report & Guardian Bridge
- Automated nightly report delivering system health and recent commit summaries
- Manual `/council report` slash command for on-demand status checks
- Guardian bridge to relay Discord messages into Unity guardians

## Installation

1. Install Poetry for dependency management:
```bash
pip install poetry
```

2. Install project dependencies:
```bash
poetry install
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

## AWS Amplify Setup

1. Initialize Amplify:
```bash
amplify init
```

2. Configure AWS services:
```bash
amplify add auth  # Configure authentication
amplify add api   # Add API Gateway and Lambda functions
amplify add storage  # Add DynamoDB tables and S3 buckets
```

3. Push configuration:
```bash
amplify push
```

## Environment Variables

Required environment variables:

### Discord Integration
- `DISCORD_BOT_TOKEN`: Discord bot token

### Council Report & Guardian Bridge
- `MCP_URL`: Base URL of the MCP server for health queries
- `COUNCIL_CHANNEL_ID`: Discord channel ID for report delivery
- `LILYBEAR_WEBHOOK`: Optional webhook for sending reports as Lilybear
- `NAV_REPOS`: Comma-separated GitHub repositories to include in the digest
- `GUARDIAN_BRIDGE_URL`: HTTP endpoint to forward guardian messages

### Telegram Integration
- `TELEGRAM_BOT_TOKEN`: Telegram bot token

### Email Integration
- `EMAIL_USERNAME`: Email account username
- `EMAIL_PASSWORD`: Email account password
- `EMAIL_SERVER`: IMAP/SMTP server address
- `EMAIL_PORT`: Server port number

### Trading Configuration
- `TRADINGVIEW_WEBHOOK_SECRET`: Secret for TradingView webhook verification
- `TRADE_HISTORY_TABLE`: DynamoDB table for trade history
- `TRADE_EXECUTION_LAMBDA`: Lambda function for trade execution

### Data Storage
- `PHANTOM_DATA_BUCKET`: S3 bucket for Phantom data
- `DATA_PROCESSOR_LAMBDA`: Lambda function for data processing
- `DATA_TABLE`: DynamoDB table for structured data
- `DATA_BUCKET`: S3 bucket for unstructured data
- `ENCRYPTION_KEY`: AES-256 encryption key

### AWS Configuration
- `AWS_REGION`: AWS region for services
- `AWS_ACCESS_KEY_ID`: AWS access key
- `AWS_SECRET_ACCESS_KEY`: AWS secret key

## Usage

### Starting the System

1. Start the Command Network:
```python
from Command_Network import DiscordCommandHandler, TelegramHandler, EmailHandler

# Initialize handlers
discord_handler = DiscordCommandHandler()
telegram_handler = TelegramHandler()
email_handler = EmailHandler()

# Start handlers
await discord_handler.start()
await telegram_handler.start()
await email_handler.start()
```

2. Initialize AthenaMist:
```python
from AthenaMist import AthenaMist

# Initialize trading system
athena = AthenaMist()

# Process trading signal
result = await athena.process_trading_signal(signal_data)
```

3. Start Phantom:
```python
from Phantom import Phantom

# Initialize surveillance system
phantom = Phantom()

# Execute retrieval operation
result = await phantom.execute_retrieval(target_url, operation_id)
```

4. Launch SovereignCore:
```python
from SovereignCore import SovereignCore, DataSource

# Initialize system
sovereign = SovereignCore()

# Add data sources
sovereign.add_source({
    "source_id": "news_feed",
    "source_type": "rss",
    "url": "https://example.com/feed",
    "update_interval": 300
})

# Start monitoring
await sovereign.start_monitoring()
```

## Testing

Run tests with pytest:
```bash
poetry run pytest
```

Generate coverage report:
```bash
poetry run coverage run -m pytest
poetry run coverage report
```

## Security

- All commands are verified using HMAC-SHA256 signatures
- Data is encrypted using AES-256 before storage
- Secure communication channels with proper error handling
- Comprehensive logging for security monitoring
- AWS IAM roles with minimal required permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## ⚠️ Disclaimer

This system is designed for educational and research purposes. Users are responsible for compliance with applicable laws and regulations.

---
Built with ❤️ using AWS Amplify Gen 2 and Python 