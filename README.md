# zk-SLA: Zero-Knowledge Service-Level Proofs

**A zero-knowledge speed test: prove you met an SLA and mint the proof on-chain — no logs, no leaks.**

![zk-SLA Demo](https://img.shields.io/badge/Status-Demo%20Ready-brightgreen)
![Next.js](https://img.shields.io/badge/Next.js-15-black)
![Solidity](https://img.shields.io/badge/Solidity-0.8.25-blue)
![Noir](https://img.shields.io/badge/Noir-ZK%20Circuits-purple)

zk-SLA enables users to prove their network performance privately using zero-knowledge proofs. Users can demonstrate they met specific RTT (Round Trip Time) Service Level Agreements without revealing their actual measurements, IP addresses, or timestamps.

## ✨ Features

- **🛡️ Zero-Knowledge Privacy**: Prove performance without revealing raw RTT data
- **⚡ Real-Time Testing**: 32 cryptographic challenges over 45 seconds
- **🏆 Tiered Badges**: ERC-1155 NFTs for different performance levels (≤75ms, ≤150ms, ≤300ms)
- **🔗 On-Chain Verification**: Smart contracts verify proofs before minting badges
- **🎨 Sleek UI**: Modern, responsive interface with wallet integration
- **⚡ Fast Proving**: Browser-based ZK proof generation in <20 seconds

## 🏗️ Architecture

### Components

1. **Frontend (Next.js)** - Wallet connection, test interface, proof generation UI
2. **Verifier Service (Node.js)** - WebSocket challenges, RTT measurement, Merkle tree construction
3. **ZK Circuits (Noir)** - Zero-knowledge proof generation for m-of-n RTT compliance
4. **Smart Contracts (Solidity)** - On-chain proof verification and badge minting

### Flow

1. **Connect Wallet** → User connects Web3 wallet
2. **Run Test** → WebSocket challenges measure RTTs in real-time
3. **Generate Proof** → Browser creates ZK proof of performance
4. **Mint Badge** → Smart contract verifies proof and mints ERC-1155 badge

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Foundry (for smart contracts)
- Rust (for Noir circuits)
- Web3 wallet with testnet ETH

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/zk-sla.git
cd zk-sla

# Install dependencies
npm install

# Set up environment
cp app/.env.example app/.env
# Edit app/.env with your configuration
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start individually:
cd app && npm run dev          # Frontend (http://localhost:3000)
cd verifier && npm run dev     # Backend (ws://localhost:3001)
cd contracts && forge test     # Test contracts
```

### Deployment

```bash
# Deploy smart contracts
cd contracts
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast

# Build and deploy frontend
cd app
npm run build

# Start production services
npm start
```

## 📁 Project Structure

```
zk-sla/
├── contracts/           # Solidity smart contracts
│   ├── src/
│   │   ├── EpochManager.sol    # Manages epoch roots
│   │   ├── ZkSLA1155.sol       # Badge minting contract
│   │   └── MockVerifier.sol    # Demo ZK verifier
│   ├── script/Deploy.s.sol     # Deployment script
│   └── test/                   # Contract tests
├── circuits/            # Noir ZK circuits
│   └── rtt_threshold/
│       └── src/main.nr         # Main circuit logic
├── verifier/           # Backend service
│   ├── src/
│   │   ├── server.ts          # WebSocket server
│   │   ├── merkle.ts          # Merkle tree utilities
│   │   └── submitRoot.ts      # Blockchain integration
│   └── package.json
├── app/                # Next.js frontend
│   ├── src/
│   │   ├── app/               # Pages and layouts
│   │   ├── components/        # Reusable components
│   │   └── lib/               # Utilities and services
│   └── package.json
└── scripts/            # Development utilities
```

## 🔧 Configuration

### Environment Variables

Create `app/.env` from `app/.env.example`:

```bash
# Wallet Connect Project ID
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id

# RPC URLs
NEXT_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
NEXT_PUBLIC_SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com

# Contract Addresses (set after deployment)
NEXT_PUBLIC_EPOCH_MANAGER_ADDR=0x...
NEXT_PUBLIC_ZKSLA_ADDR=0x...
NEXT_PUBLIC_MOCK_VERIFIER_ADDR=0x...

# Backend Service
NEXT_PUBLIC_VERIFIER_URL=ws://localhost:3001
```

Backend `.env` (verifier service):

```bash
RPC_URL=https://sepolia.base.org
VERIFIER_PRIVKEY=0x...  # Private key for submitting roots
EPOCH_MANAGER_ADDR=0x...
PORT=3001
```

## 🧪 Testing

```bash
# Test smart contracts
cd contracts && forge test

# Test backend services
cd verifier && npm test

# Test frontend components
cd app && npm test

# Run end-to-end tests
npm run test:e2e
```

## 📊 Performance Tiers

Users can earn badges for different performance levels:

- **🥇 Premium (≤75ms)**: High-performance networks
- **🥈 Standard (≤150ms)**: Most common tier for good connections
- **🥉 Basic (≤300ms)**: Acceptable performance level

Each tier requires proving that ≥28 out of 32 RTT samples meet the threshold.

## 🔐 Security & Privacy

- **Zero-Knowledge**: Raw RTT measurements never leave the user's device
- **Anti-Replay**: Fresh cryptographic nonces prevent replay attacks
- **Merkle Commitment**: All samples are committed in a Merkle tree root on-chain
- **m-of-n Proofs**: Users prove compliance without revealing all measurements

## 🛠️ Technical Details

### ZK Circuit

The Noir circuit proves:
1. **m-of-n compliance**: ≥28 out of 32 RTTs are ≤ threshold
2. **Merkle inclusion**: Each sample belongs to the committed tree
3. **Uniqueness**: No duplicate indices used
4. **Bounds checking**: All indices within valid range

### Smart Contracts

- **EpochManager**: Stores Merkle roots for each epoch
- **ZkSLA1155**: Verifies proofs and mints performance badges
- **Gas Optimized**: ~200-300k gas per verification on Base Sepolia

### Cryptography

- **Hash Function**: Poseidon (ZK-friendly)
- **Merkle Trees**: Poseidon-based with 16-level depth
- **Proof System**: Groth16 via Noir/Barretenberg
- **Field**: BN254 for Ethereum compatibility

## 🎨 UI Design

The interface features a minimalist dark theme with:
- **Colors**: Dark background (`#0B0D10`) with gradient accents
- **Typography**: Inter font with tight tracking
- **Components**: Shadcn/ui with custom styling
- **Animation**: Framer Motion for smooth transitions
- **Icons**: Lucide React icon set

## 🚀 Deployment Guide

### 1. Deploy Smart Contracts

```bash
cd contracts

# Deploy to Base Sepolia
forge script script/Deploy.s.sol \
  --rpc-url https://sepolia.base.org \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify
```

### 2. Start Backend Service

```bash
cd verifier
npm run build
npm start
```

### 3. Deploy Frontend

```bash
cd app
npm run build

# Deploy to Vercel
npx vercel deploy

# Or serve locally
npm start
```

## 📈 Future Enhancements

- **Multi-Verifier**: Decentralized network of RTT verifiers
- **Advanced Metrics**: Bandwidth, jitter, packet loss proofs
- **DeFi Integration**: Use badges as collateral or governance tokens
- **Mobile Support**: React Native app with mobile proving
- **Analytics**: Performance trends and network insights

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Aztec Labs** - Noir zero-knowledge language
- **Foundry** - Ethereum development framework
- **RainbowKit** - Wallet connection components
- **Vercel** - Deployment and hosting platform

---

**Built with ❤️ for the future of private DePIN verification**