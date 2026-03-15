#!/bin/bash
echo "=== BrushPro API Startup ==="

echo "--- Syncing database schema ---"
npx prisma db push --accept-data-loss --schema api/prisma/schema.prisma
if [ $? -ne 0 ]; then
  echo "ERROR: schema sync failed — aborting"
  exit 1
fi
echo "--- Schema sync complete ---"

echo "--- Running seed ---"
npx tsx api/prisma/seed.ts
echo "--- Seed complete ---"

echo "--- Starting server ---"
exec node api/dist/index.js
