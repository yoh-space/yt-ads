#!/bin/bash

# expo-push-easy Convex Example Setup Script

echo "🚀 Setting up expo-push-easy Convex Example..."
echo ""

# Check if pnpm is installed
if ! command -v pnpm &> /dev/null; then
    echo "❌ pnpm is not installed. Please install it first:"
    echo "   npm install -g pnpm"
    exit 1
fi

# Check if Convex CLI is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx is not available. Please install Node.js"
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Copy env example
if [ ! -f .env.local ]; then
    echo "📝 Creating .env.local from .env.example..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your Convex URL"
else
    echo "✅ .env.local already exists"
fi

# Check for service account
if [ ! -f service-account.json ]; then
    echo ""
    echo "⚠️  service-account.json not found"
    echo ""
    echo "To complete setup:"
    echo "1. Get your Firebase service account from:"
    echo "   https://console.firebase.google.com"
    echo "   → Project Settings → Service Accounts → Generate new private key"
    echo ""
    echo "2. Save it as service-account.json in this directory"
    echo ""
    echo "3. Set it in Convex:"
    echo "   npx convex env set FCM_SERVICE_ACCOUNT \"\$(cat service-account.json)\""
    echo ""
else
    echo "✅ service-account.json found"
    echo ""
    echo "To set it in Convex, run:"
    echo "   npx convex env set FCM_SERVICE_ACCOUNT \"\$(cat service-account.json)\""
    echo ""
fi

echo ""
echo "📚 Next steps:"
echo "1. Run: npx convex dev"
echo "2. In another terminal: npx expo start"
echo ""
echo "📖 See README.md for detailed instructions"
echo ""
echo "✨ Setup complete!"
