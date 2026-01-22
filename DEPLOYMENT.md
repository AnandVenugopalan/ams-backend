# AMS Backend - Production Deployment Guide

## Current Issue (Solved)
Your production database was missing the `assetId` and `registeredBy` columns in the `QrCode` table. This has been fixed by creating migration `20260121070753_add_user_roles`.

## Immediate Fix for Production Server

SSH into your production server and run these commands:

```bash
cd /path/to/ams-backend

# Pull latest code (including the new migration)
git pull origin main

# Run migrations to update the database
npx prisma migrate deploy

# Regenerate Prisma Client
npx prisma generate

# Rebuild application
npm run build

# Restart your application
pm2 restart ams-backend
# OR
sudo systemctl restart ams-backend
# OR (if using Docker)
docker-compose restart
```

## Future Deployments (Permanent Solution)

### Option 1: Using the Deployment Script

1. **Copy the deployment script to your server:**
   ```bash
   scp deploy.sh user@3.111.170.7:/path/to/ams-backend/
   chmod +x /path/to/ams-backend/deploy.sh
   ```

2. **After pushing code changes, run on server:**
   ```bash
   cd /path/to/ams-backend
   git pull origin main
   ./deploy.sh
   pm2 restart ams-backend  # or your restart command
   ```

### Option 2: Using Docker (Recommended)

Your Dockerfile already includes migrations! Just rebuild and redeploy:

```bash
# On your local machine
docker build -t ams-backend:latest .
docker tag ams-backend:latest your-registry/ams-backend:latest
docker push your-registry/ams-backend:latest

# On production server
docker pull your-registry/ams-backend:latest
docker-compose down
docker-compose up -d
```

### Option 3: CI/CD Pipeline (Best Practice)

Set up GitHub Actions or GitLab CI to automatically:
1. Build the Docker image
2. Push to registry
3. Deploy to server
4. Run migrations automatically

## Critical: Always Run After Schema Changes

Whenever you modify `prisma/schema.prisma`:

1. **Local development:**
   ```bash
   npx prisma migrate dev --name descriptive_name
   ```

2. **Commit the migration files:**
   ```bash
   git add prisma/migrations/
   git commit -m "Add migration: descriptive_name"
   git push
   ```

3. **Production deployment:**
   ```bash
   npx prisma migrate deploy  # This applies migrations safely
   ```

## Docker Deployment (Current Setup)

Your Dockerfile already handles this correctly:
- Line 44-46: Runs `prisma migrate deploy` and `prisma generate` on container startup
- This ensures migrations run before the app starts

Just rebuild and redeploy:
```bash
docker build -t ams-backend .
docker run -d -p 3000:3000 --env-file .env ams-backend
```

## Troubleshooting

**If you get "column does not exist" error:**
```bash
npx prisma migrate deploy  # Apply pending migrations
npx prisma generate        # Regenerate client
npm run build             # Rebuild app
# Restart process
```

**To check migration status:**
```bash
npx prisma migrate status
```

**To see what migrations are pending:**
```bash
npx prisma migrate diff --from-migrations --to-schema-datamodel prisma/schema.prisma
```

## Database Backup Before Migration

Always backup production database before running migrations:
```bash
pg_dump -U postgres -d ams_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Summary

The permanent solution is:
✅ Migration file created: `20260121070753_add_user_roles/migration.sql`
✅ Deployment scripts created: `deploy.sh` and `deploy.ps1`
✅ Dockerfile already configured correctly
✅ Future deployments will automatically apply migrations

**Next Step:** Run the commands in the "Immediate Fix for Production Server" section on your production server at 3.111.170.7.
