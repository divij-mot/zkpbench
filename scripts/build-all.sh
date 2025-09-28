#!/bin/bash

# zk-SLA Build Script
echo "🏗️ Building zk-SLA project..."

set -e  # Exit on any error

# Build contracts
echo "📄 Building smart contracts..."
cd contracts
forge build
echo "✅ Contracts built successfully"

# Build circuits (when nargo is available)
echo "🔐 Building ZK circuits..."
cd ../circuits
if command -v nargo >/dev/null 2>&1; then
    cd rtt_threshold
    nargo check
    nargo compile
    echo "✅ Circuits built successfully"
else
    echo "⚠️ Nargo not available, skipping circuit build"
fi

# Build backend
echo "🔗 Building backend service..."
cd ../../verifier
npm run build
echo "✅ Backend built successfully"

# Build frontend
echo "📱 Building frontend..."
cd ../app
npm run build
echo "✅ Frontend built successfully"

echo ""
echo "🎉 All components built successfully!"
echo "📦 Ready for deployment"