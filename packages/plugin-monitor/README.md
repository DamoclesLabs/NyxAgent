# Token Monitor Plugin

This plugin monitors and analyzes tokens deployed on Raydium for potential risks.

## Features

- Monitors new token deployments on Raydium
- Analyzes token creator history
- Tracks token price movements
- Analyzes token holder distribution
- Monitors token creation timeline
- Analyzes trading volume patterns
- Checks token permissions and authority
- Generates risk analysis reports using LLM
- Posts analysis results to Twitter

## Installation

```bash
pnpm install
```

## Development

```bash
# Build
pnpm build

# Run tests
pnpm test

# Development mode
pnpm dev
```

## Configuration

Create a `.env` file with the following variables:

```env
# Solana RPC endpoint
SOLANA_RPC_ENDPOINT=

# Twitter API credentials
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=

# LLM configuration
LLM_API_KEY=
```

## Architecture

The plugin is organized into several modules:

- `services/`: Core service implementations
- `analyzers/`: Token analysis components
- `models/`: Data models and types
- `llm/`: LLM integration for risk analysis
- `twitter/`: Twitter integration
- `utils/`: Utility functions and helpers

## Testing

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test <pattern>

# Run tests in watch mode
pnpm test --watch
```