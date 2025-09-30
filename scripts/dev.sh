#!/bin/bash

# zk-SLA Development Environment Setup
echo "🚀 Starting zk-SLA development environment..."

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Node.js is required but not installed."
    exit 1
fi

if ! command_exists forge; then
    echo "❌ Foundry is required but not installed."
    echo "   Install: curl -L https://foundry.paradigm.xyz | bash"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Start Next.js app (includes frontend + API routes)
echo "🔧 Starting Next.js application..."
cd "$PROJECT_ROOT/app" && npm run dev &
APP_PID=$!

# Wait a moment
sleep 3

echo ""
echo "🎉 zk-SLA development environment is ready!"
echo ""
echo "📍 Services running:"
echo "   Application: http://localhost:3000"
echo "   - Frontend (Next.js)"
echo "   - Backend API routes"
echo "   - ZK proving (browser-based)"
echo ""
echo "🔧 Development commands:"
echo "   Test contracts: cd contracts && forge test"
echo "   Deploy to testnet: cd contracts && forge script script/DeployProduction.s.sol --broadcast"
echo ""
echo "📝 Logs: tail -f $PROJECT_ROOT/app/dev.log"
echo ""
echo "Press Ctrl+C to stop"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $APP_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Register cleanup function
trap cleanup SIGINT SIGTERM

# Wait for service
wait