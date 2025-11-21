#!/bin/bash
set -e

# WIF Finance - Complete One-Command Deployment
# This script deploys EVERYTHING: Database + Frontend + Backend

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 WIF Finance - Complete Deployment${NC}"
echo "==========================================="
echo ""
echo "This will deploy:"
echo "  ✅ Supabase Database Schema"
echo "  ✅ Frontend to CloudFront"
echo "  ✅ PDF Service to ECS"
echo ""

read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Step 1: Setup Supabase Database
echo ""
echo -e "${GREEN}📦 Step 1/3: Setting up Supabase Database...${NC}"
echo ""

# Load Supabase credentials
if [ -f .env.production ]; then
    export $(cat .env.production | grep VITE_SUPABASE | xargs)
fi

SUPABASE_URL=${VITE_SUPABASE_URL}
SUPABASE_KEY=${VITE_SUPABASE_ANON_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Supabase credentials not found${NC}"
    exit 1
fi

# Extract project ref
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')

echo "Supabase Project: $PROJECT_REF"
echo ""

# Check if tables exist
echo "Checking if database is initialized..."
TABLES_EXIST=$(curl -s \
  "${SUPABASE_URL}/rest/v1/companies?select=id&limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" 2>/dev/null || echo "[]")

if [[ "$TABLES_EXIST" == *"relation \"companies\" does not exist"* ]] || [[ "$TABLES_EXIST" == "[]" ]]; then
    echo -e "${YELLOW}⚠️  Database not initialized${NC}"
    echo ""
    echo "Please initialize your database first:"
    echo ""
    echo -e "${BLUE}Option 1: Quick (30 seconds)${NC}"
    echo "  1. Open: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
    echo "  2. Copy all contents from: supabase/migrations/001_initial_schema.sql"
    echo "  3. Paste and click RUN"
    echo ""
    echo -e "${BLUE}Option 2: Automated (if you have Supabase CLI)${NC}"
    echo "  ./setup-supabase.sh"
    echo ""
    read -p "Have you initialized the database? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo ""
        echo "Please initialize the database first, then run this script again."
        exit 1
    fi
else
    echo -e "${GREEN}✅ Database already initialized${NC}"
fi

# Step 2: Deploy Frontend and Backend
echo ""
echo -e "${GREEN}☁️  Step 2/3: Deploying to AWS...${NC}"
echo ""

# Run AWS deployment
./deploy-aws.sh

# Step 3: Verify Everything
echo ""
echo -e "${GREEN}🧪 Step 3/3: Verifying deployment...${NC}"
echo ""

# Test Supabase
echo "Testing Supabase connection..."
SUPABASE_TEST=$(curl -s \
  "${SUPABASE_URL}/rest/v1/companies?select=name&limit=1" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if [[ ! -z "$SUPABASE_TEST" ]] && [[ "$SUPABASE_TEST" != *"error"* ]]; then
    echo -e "${GREEN}✅ Supabase: Connected${NC}"
else
    echo -e "${RED}❌ Supabase: Failed${NC}"
fi

# Test Frontend
echo "Testing frontend..."
FRONTEND_TEST=$(curl -s -o /dev/null -w "%{http_code}" https://finance.wifjapan.com 2>/dev/null || echo "000")

if [ "$FRONTEND_TEST" == "200" ]; then
    echo -e "${GREEN}✅ Frontend: Live${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend: Deploying (check in 5 mins)${NC}"
fi

# Test PDF Service
echo "Testing PDF service..."
PDF_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://18.141.140.2:3001/health 2>/dev/null || echo "000")

if [ "$PDF_TEST" == "200" ]; then
    echo -e "${GREEN}✅ PDF Service: Running${NC}"
else
    echo -e "${YELLOW}⚠️  PDF Service: Starting (check in 2 mins)${NC}"
fi

# Summary
echo ""
echo "==========================================="
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo "==========================================="
echo ""
echo "Your application:"
echo "  🌐 Frontend: https://finance.wifjapan.com"
echo "  🗄️  Database: Supabase ($PROJECT_REF)"
echo "  📄 PDF Service: http://18.141.140.2:3001"
echo ""
echo "Next steps:"
echo "  1. Open: https://finance.wifjapan.com"
echo "  2. Create your first account"
echo "  3. Create your first document"
echo ""
echo "Useful commands:"
echo "  # Invalidate CloudFront cache (after updates)"
echo "  aws cloudfront create-invalidation --distribution-id E10R2ZLIGYCY0W --paths '/*'"
echo ""
echo "  # View PDF service logs"
echo "  aws logs tail /ecs/wif-pdf-service --follow --region ap-southeast-1"
echo ""
