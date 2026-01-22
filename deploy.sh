#!/bin/bash

# Deployment script for AMS Backend
# Run this script on your production server after pulling new code

set -e  # Exit on any error

echo "🚀 Starting deployment..."

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Step 2: Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npx prisma generate

# Step 3: Run database migrations
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# Step 4: Build application
echo "🔨 Building application..."
npm run build

# Step 5: Restart application
echo "🔄 Restarting application..."
# Uncomment the appropriate command for your setup:

# If using PM2:
# pm2 restart ams-backend

# If using systemctl:
# sudo systemctl restart ams-backend

# If using Docker:
# docker-compose down && docker-compose up -d

echo "✅ Deployment completed successfully!"
echo "⚠️  Don't forget to restart your Node.js process"
