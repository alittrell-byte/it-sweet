#!/bin/sh
set -e

echo "Running database migrations..."
npx sequelize-cli db:migrate

if [ "$SEED_ON_START" = "true" ]; then
  echo "Seeding default data..."
  npx sequelize-cli db:seed:all || true
fi

echo "Starting backend..."
exec node dist/server.js
