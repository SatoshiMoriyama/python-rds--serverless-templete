#!/bin/bash

# ローカル開発用 PostgreSQL を停止

set -e

cd "$(dirname "$0")"

echo "Stopping PostgreSQL..."
docker compose down -v

echo "PostgreSQL stopped."
