#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for Postgres at $DB_HOST:$DB_PORT..."
while ! nc -z "$DB_HOST" "$DB_PORT"; do
  sleep 1
done
echo "Postgres is up."

echo "Running migrations..."
npm run typeorm -- migration:run -d src/database/data-source.ts

echo "Running seed..."
npm run seed

echo "Starting bot..."
exec npm start
