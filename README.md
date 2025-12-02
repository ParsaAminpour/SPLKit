# ITA Token CLI

A comprehensive command-line tool for managing and interacting with ITA Token on Solana. This versatile CLI provides complete control over token operations, Raydium liquidity pool management, analytics, and monitoring.

## 🚀 Features

### Core Token Operations

#### Read Operations
- **Token Information** - View complete token metadata, authorities, and configuration
- **Supply Tracking** - Monitor total and circulating supply in real-time
- **Balance Queries** - Check token balances for any wallet address
- **Account Management** - Get detailed information about token accounts
- **Holder Analytics** - View top holders and distribution metrics
- **Distribution Analysis** - Analyze tokenomics and concentration metrics

#### Write Operations
- **Minting** - Mint new tokens to specified addresses
- **Burning** - Burn tokens to reduce supply
- **Transfers** - Send tokens between wallets
- **Batch Airdrops** - Distribute tokens to multiple addresses from CSV
- **Account Creation** - Create token accounts for wallets
- **Authority Management** - Transfer or revoke mint/freeze authorities
- **Account Closure** - Close empty accounts and reclaim rent

### Raydium CLMM Integration

#### Pool Read Operations
- **Pool Information** - View pool reserves, fee tiers, and liquidity depth
- **Pool Discovery** - List all pools containing ITA token
- **Price Tracking** - Get real-time token price from pools
- **Position Overview** - View your active liquidity positions
- **Pool Statistics** - Monitor trading volume, fees earned, and TVL
- **Price History** - Access historical price data (24h, 7d, 30d)
- **APR Calculator** - Calculate current Annual Percentage Rate

#### Pool Write Operations
- **Add Liquidity** - Provide liquidity to CLMM pools
- **Remove Liquidity** - Withdraw liquidity from pools
- **Position Management** - Create, increase, decrease, or close positions
- **Fee Collection** - Claim earned trading fees from positions
- **Range Orders** - Create concentrated liquidity positions with custom price ranges

### Analytics & Monitoring

- **Transaction History** - View recent token transactions
- **Volume Analytics** - Track trading volume over various timeframes
- **Market Capitalization** - Calculate current market cap
- **Tokenomics Dashboard** - Complete overview of token economics
- **Holder Growth** - Track holder count evolution
- **Whale Monitoring** - Monitor large holder activities
- **Portfolio Tracking** - View your complete ITA token portfolio value

### Advanced Features

- **Holder Snapshots** - Capture holder data at specific blocks
- **Data Export** - Export holders and transactions to CSV/JSON
- **Watch Mode** - Real-time monitoring of price and volume
- **Custom Alerts** - Set notifications for price or volume thresholds
- **Multi-signature Support** - Manage tokens with multi-sig authorities

## 📋 Command Reference

### Configuration Management

```bash
# View current configuration
ita-cli config --show

# Set global configuration
ita-cli config --set cluster=mainnet --global

# Set local project configuration
ita-cli config --set rpcUrl=https://custom-rpc.com --local

# Get specific config value
ita-cli config --get cluster
```

### Token Information

```bash
# Display complete token information
ita-cli info

# Check total supply
ita-cli supply

# Check balance of any address
ita-cli balance <address>

# View top token holders
ita-cli holders --limit 50

# Analyze token distribution
ita-cli distribution

# View tokenomics overview
ita-cli tokenomics
```

### Token Operations

```bash
# Mint tokens
ita-cli mint --amount 1000 --to <address>

# Burn tokens
ita-cli burn --amount 500

# Transfer tokens
ita-cli transfer --to <address> --amount 100

# Batch airdrop from CSV
ita-cli airdrop --file recipients.csv

# Create token account
ita-cli create-account --owner <address>

# Set mint authority
ita-cli set-authority --type mint --new <address>

# Permanently disable minting
ita-cli disable-mint
```

### Raydium Pool Operations

```bash
# View pool information
ita-cli pool info

# List all ITA token pools
ita-cli pool list

# Get current token price
ita-cli price

# View your liquidity positions
ita-cli pool positions

# Get pool statistics
ita-cli pool stats

# View historical price data
ita-cli price history --period 7d

# Add liquidity to pool
ita-cli pool add --amountA 1000 --amountB 5000

# Remove liquidity
ita-cli pool remove --position <positionId>

# Create new CLMM position
ita-cli pool create-position --min-price 0.9 --max-price 1.1

# Collect earned fees
ita-cli pool collect-fees --position <positionId>

# Close position
ita-cli pool close --position <positionId>
```

### Analytics

```bash
# View recent transactions
ita-cli tx list --limit 20

# Check trading volume
ita-cli volume --period 24h

# Calculate market cap
ita-cli marketcap

# Monitor whale activities
ita-cli whales --threshold 1000000

# View your portfolio
ita-cli portfolio
```

### Utility Commands

```bash
# Generate new wallet
ita-cli wallet generate

# Check SOL balance
ita-cli sol balance

# Request devnet SOL
ita-cli sol airdrop --amount 2

# Validate address format
ita-cli validate <address>

# Show version
ita-cli version
```

## 🛠️ Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ita-token-cli.git
cd ita-token-cli

# Install dependencies
npm install

# Build the project
npm run build

# Link for global usage (optional)
npm link
```

## ⚙️ Configuration

The CLI uses a layered configuration system with the following priority (highest to lowest):

1. **Command-line flags** - Direct overrides for single commands
2. **Environment variables** - Session-specific settings
3. **Local config** - Project-specific configuration (`.ita-cli.config.json`)
4. **Global config** - User-wide defaults (`~/.ita-cli/config.json`)
5. **Built-in defaults** - Fallback values

### Configuration Options

- `cluster` - Solana cluster (devnet, testnet, mainnet-beta)
- `rpcUrl` - Custom RPC endpoint URL
- `commitment` - Transaction commitment level (processed, confirmed, finalized)
- `walletPath` - Path to wallet keypair file
- `programId` - ITA Token program ID
- `tokenMint` - ITA Token mint address

### Environment Variables

```bash
export ITA_CLUSTER=devnet
export ITA_RPC_URL=https://api.devnet.solana.com
export ITA_WALLET=~/.config/solana/id.json
```

## 📊 Example Workflows

### Initial Setup

```bash
# Configure for devnet
ita-cli config --set cluster=devnet --global
ita-cli config --set walletPath=~/.config/solana/id.json --global

# View token information
ita-cli info
ita-cli supply
```

### Managing Tokens

```bash
# Mint new tokens
ita-cli mint --amount 10000 --to YOUR_WALLET_ADDRESS

# Check your balance
ita-cli balance YOUR_WALLET_ADDRESS

# Transfer to another wallet
ita-cli transfer --to RECIPIENT_ADDRESS --amount 1000

# Burn excess supply
ita-cli burn --amount 500
```

### Managing Liquidity

```bash
# Check current pools
ita-cli pool list

# View pool details
ita-cli pool info

# Add liquidity
ita-cli pool add --amountA 5000 --amountB 10000

# Monitor your positions
ita-cli pool positions

# Collect fees
ita-cli pool collect-fees
```

### Monitoring & Analytics

```bash
# Watch price in real-time
ita-cli watch price

# Check holder distribution
ita-cli holders --limit 100
ita-cli distribution

# Export holder data
ita-cli export holders --format csv --output holders.csv

# View trading volume
ita-cli volume --period 7d
```

## 🔐 Security Best Practices

- **Never commit wallet keypairs** to version control
- **Use environment variables** for sensitive configuration
- **Store keypairs securely** with appropriate file permissions
- **Verify addresses** before sending large amounts
- **Test on devnet** before mainnet operations
- **Use hardware wallets** for production/mainnet operations
- **Review transactions** before confirming

## 🐛 Troubleshooting

### Common Issues

**Connection Errors**
```bash
# Test connection
ita-cli config --get rpcUrl
# Try alternative RPC
ita-cli config --set rpcUrl=https://alternative-rpc.com
```

**Insufficient SOL for Transactions**
```bash
# Check SOL balance
ita-cli sol balance
# Request devnet airdrop
ita-cli sol airdrop --amount 2
```

**Invalid Wallet Path**
```bash
# Verify wallet exists
ls -la ~/.config/solana/id.json
# Update wallet path
ita-cli config --set walletPath=/correct/path/to/keypair.json
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - See LICENSE file for details

## 🔗 Links

- [Solana Documentation](https://docs.solana.com)
- [Raydium Documentation](https://docs.raydium.io)
- [SPL Token Program](https://spl.solana.com/token)


**⚠️ Disclaimer**: This tool is provided as-is. Always verify transactions and test thoroughly on devnet before using on mainnet. The developers are not responsible for any loss of funds.