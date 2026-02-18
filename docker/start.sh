#!/bin/bash

# ローカル開発用 PostgreSQL を起動

set -e

cd "$(dirname "$0")"

echo "Starting PostgreSQL..."
docker compose up -d

echo "Waiting for PostgreSQL to be ready..."
until docker compose exec postgres pg_isready -U postgres > /dev/null 2>&1; do
  echo "  waiting..."
  sleep 2
done

echo ""
echo "PostgreSQL is ready!"
echo ""
echo "Connection info:"
echo "  Host: localhost"
echo "  Port: 5432"
echo "  User: postgres"
echo "  Database: dev"
echo ""
echo "To stop: docker compose down"
echo "To remove data: docker compose down -v"
