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

# Start services in parallel
echo "🔧 Starting services..."

# Start frontend in background
echo "📱 Starting frontend (Next.js)..."
cd app && npm run dev &
FRONTEND_PID=$!

# Wait a moment
sleep 2

# Start backend in background
echo "🔗 Starting backend (Verifier service)..."
cd ../verifier && npm run dev &
BACKEND_PID=$!

# Wait a moment
sleep 2

echo ""
echo "🎉 zk-SLA development environment is ready!"
echo ""
echo "📍 Services running:"
echo "   Frontend: http://localhost:3000"
echo "   Backend:  ws://localhost:3001"
echo ""
echo "🔧 Development commands:"
echo "   Test contracts: cd contracts && forge test"
echo "   Deploy locally: cd contracts && forge script script/Deploy.s.sol"
echo ""
echo "Press Ctrl+C to stop all services"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping services..."
    kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Register cleanup function
trap cleanup SIGINT SIGTERM

# Wait for services
wait