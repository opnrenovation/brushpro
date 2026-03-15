#!/bin/bash
echo "=== BrushPro API Startup ==="

echo "--- Running migrations ---"
npx prisma migrate deploy
if [ $? -ne 0 ]; then
  echo "ERROR: migrations failed — aborting"
  exit 1
fi
echo "--- Migrations complete ---"

echo "--- Running seed ---"
npx tsx api/prisma/seed.ts
echo "--- Seed complete ---"

echo "--- Starting server ---"
exec node api/dist/index.js
