# Deployment script for AMS Backend (Windows PowerShell)
# Run this script on your production server after pulling new code

Write-Host "🚀 Starting deployment..." -ForegroundColor Green

# Step 1: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
npm ci --only=production

# Step 2: Generate Prisma Client
Write-Host "🔧 Generating Prisma Client..." -ForegroundColor Cyan
npx prisma generate

# Step 3: Run database migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Cyan
npx prisma migrate deploy

# Step 4: Build application
Write-Host "🔨 Building application..." -ForegroundColor Cyan
npm run build

# Step 5: Restart application
Write-Host "🔄 Restarting application..." -ForegroundColor Cyan
# Uncomment the appropriate command for your setup:

# If using PM2:
# pm2 restart ams-backend

# If using systemctl (WSL):
# wsl sudo systemctl restart ams-backend

Write-Host "✅ Deployment completed successfully!" -ForegroundColor Green
Write-Host "⚠️  Don't forget to restart your Node.js process" -ForegroundColor Yellow
