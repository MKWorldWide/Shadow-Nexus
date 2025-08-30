<div align="center">
  <h1>🌌 Shadow Nexus</h1>
  <p>A Multi-Discord Webhook Command Center</p>
  
  [![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
  [![Node.js CI](https://github.com/MKWorldWide/Shadow-Nexus/actions/workflows/ci.yml/badge.svg)](https://github.com/MKWorldWide/Shadow-Nexus/actions/workflows/ci.yml)
  [![codecov](https://codecov.io/gh/MKWorldWide/Shadow-Nexus/graph/badge.svg?token=YOUR-TOKEN-HERE)](https://codecov.io/gh/MKWorldWide/Shadow-Nexus)
  [![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-%23FE5196?logo=conventionalcommits&logoColor=white)](https://conventionalcommits.org)
  [![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/MKWorldWide/Shadow-Nexus/pulls)
  [![Discord](https://img.shields.io/discord/YOUR-DISCORD-SERVER-ID?logo=discord)](https://discord.gg/YOUR-DISCORD-INVITE)
</div>

## ✨ Features

- **Multi-Webhook Management**: Centralized control for multiple Discord webhooks
- **Automated Workflows**: Schedule and automate Discord messages and embeds
- **Role-Based Access Control**: Fine-grained permissions for team members
- **Audit Logging**: Comprehensive logging of all actions
- **RESTful API**: Easy integration with other services
- **Real-time Updates**: WebSocket support for live updates
- **Modular Architecture**: Easy to extend and customize

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x
- npm 10.x or later
- SQLite3

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/MKWorldWide/Shadow-Nexus.git
   cd Shadow-Nexus
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file with your configuration.

5. Run database migrations:
   ```bash
   npm run migrate
   ```

### Development

Start the development server:
```bash
npm run dev
```

### Production

Build and start the production server:
```bash
npm run build
npm start
```

## 🧪 Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm run test:coverage
```

## 🤝 Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) to get started.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- [Discord.js](https://discord.js.org/) - Powerful Node.js module for interacting with the Discord API
- [Sequelize](https://sequelize.org/) - Promise-based Node.js ORM
- [Winston](https://github.com/winstonjs/winston) - A logger for just about everything
- [Jest](https://jestjs.io/) - Delightful JavaScript Testing

## 📜 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of notable changes.

## 🔒 Security

Please see [SECURITY.md](SECURITY.md) for security-related issues.

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