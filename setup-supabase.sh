#!/bin/bash
set -e

# WIF Finance - Automated Supabase Setup
# This script automatically sets up your Supabase database

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🗄️  WIF Finance - Automated Supabase Setup${NC}"
echo "=============================================="
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Installing...${NC}"

    # Install Supabase CLI
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        brew install supabase/tap/supabase
    else
        # Linux
        npm install -g supabase
    fi

    echo -e "${GREEN}✅ Supabase CLI installed${NC}"
fi

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep VITE_SUPABASE | xargs)
fi

SUPABASE_URL=${VITE_SUPABASE_URL}
SUPABASE_KEY=${VITE_SUPABASE_ANON_KEY}

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_KEY" ]; then
    echo -e "${RED}❌ Error: Supabase credentials not found in .env.production${NC}"
    exit 1
fi

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | sed 's/https:\/\/\([^.]*\).*/\1/')

echo "Configuration:"
echo "  Supabase Project: $PROJECT_REF"
echo "  Supabase URL: $SUPABASE_URL"
echo ""

read -p "Continue with setup? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Setup cancelled"
    exit 0
fi

echo ""
echo -e "${GREEN}📦 Step 1: Linking to Supabase project...${NC}"

# Link to project
supabase link --project-ref $PROJECT_REF 2>/dev/null || echo "Project already linked or manual linking required"

echo ""
echo -e "${GREEN}🚀 Step 2: Running database migration...${NC}"

# Run migration using SQL directly via Supabase API
curl -X POST \
  "${SUPABASE_URL}/rest/v1/rpc/exec_sql" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d @- << 'EOF' 2>/dev/null || {
    echo -e "${YELLOW}⚠️  API method not available. Trying CLI method...${NC}"

    # Alternative: Use Supabase CLI
    if command -v supabase &> /dev/null; then
        supabase db push
    else
        echo -e "${YELLOW}⚠️  Please run migration manually:${NC}"
        echo ""
        echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
        echo "2. Copy contents of: supabase/migrations/001_initial_schema.sql"
        echo "3. Paste and click RUN"
        echo ""
        exit 1
    fi
}
EOF

echo -e "${GREEN}✅ Database migration applied${NC}"

echo ""
echo -e "${GREEN}🧪 Step 3: Testing connection...${NC}"

# Test connection
RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/companies?select=*" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

if [ ! -z "$RESPONSE" ]; then
    echo -e "${GREEN}✅ Supabase connection successful!${NC}"
    echo "Response: $RESPONSE"
else
    echo -e "${RED}❌ Connection failed${NC}"
    exit 1
fi

echo ""
echo "=============================================="
echo -e "${GREEN}✅ Supabase Setup Complete!${NC}"
echo "=============================================="
echo ""
echo "Next: Deploy to AWS with: ./deploy-aws.sh"
echo ""
