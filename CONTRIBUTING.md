# Contributing to Shadow Nexus

Thank you for your interest in contributing to Shadow Nexus! This guide will help you get started with contributing to our project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Requests](#pull-requests)
- [Reporting Issues](#reporting-issues)

## Code of Conduct

This project adheres to the [Contributor Covenant](COVENANT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites
- Node.js 20.x (see [.nvmrc](.nvmrc))
- npm 10.x or later
- SQLite3

### Installation

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/Shadow-Nexus.git
   cd Shadow-Nexus
   ```
3. Install dependencies:
   ```bash
   npm ci
   ```
4. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

## Development Workflow

1. Create a new branch for your feature/fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. Make your changes
3. Run tests:
   ```bash
   npm test
   ```
4. Lint your code:
   ```bash
   npm run lint
   ```
5. Format your code:
   ```bash
   npm run format
   ```
6. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/):
   ```bash
   git commit -m "feat: add new feature"
   ```
7. Push your changes:
   ```bash
   git push origin feature/your-feature-name
   ```
8. Open a Pull Request

## Code Style

- Follow [JavaScript Standard Style](https://standardjs.com/)
- Use 2 spaces for indentation
- Use single quotes for strings
- Include JSDoc comments for public APIs
- Keep lines under 100 characters

## Testing

- Write tests for new features
- All tests must pass before merging
- Use descriptive test names
- Mock external dependencies

## Pull Requests

1. Keep PRs small and focused on a single feature/fix
2. Update documentation as needed
3. Include relevant tests
4. Ensure all tests pass
5. Reference any related issues
6. Update CHANGELOG.md if needed

## Reporting Issues

When reporting issues, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details
- Any relevant logs

## Security

Please report security issues to security@mkworldwide.com

## License

By contributing, you agree that your contributions will be licensed under the [ISC License](LICENSE.md)
