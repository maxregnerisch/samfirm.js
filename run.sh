#!/bin/bash
# Simple script to build and run samfirm.js with model transformation

echo "🔧 Building samfirm.js..."
NODE_OPTIONS="--openssl-legacy-provider" npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful! Running with arguments: $@"
    echo ""
    node dist/index.js "$@"
else
    echo "❌ Build failed!"
    exit 1
fi
