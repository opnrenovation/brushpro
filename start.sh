#!/bin/bash
echo "=== BrushPro API Startup ==="

echo "--- Syncing database schema ---"
npx prisma db push --accept-data-loss --schema api/prisma/schema.prisma && echo "--- Schema sync OK ---" || echo "--- Schema sync failed (non-fatal) ---"

echo "--- Running seed ---"
npx tsx api/prisma/seed.ts && echo "--- Seed OK ---" || echo "--- Seed failed (non-fatal) ---"

echo "--- Starting server ---"
exec node api/dist/index.js
