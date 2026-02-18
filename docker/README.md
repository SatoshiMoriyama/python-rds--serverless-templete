# ローカル開発用 PostgreSQL

## 起動

```bash
cd docker
chmod +x start.sh stop.sh
./start.sh
```

## 停止（ボリュームも削除）

```bash
./stop.sh
```

## 接続情報

- Host: `localhost`
- Port: `5432`
- User: `postgres`
- Password: `devpassword123`
- Database: `dev`

## psql で接続

```bash
PGPASSWORD='devpassword123' psql -h localhost -p 5432 -U postgres -d dev
```

## マイグレーション

```bash
cd ../packages/db
uv run alembic upgrade head
```

## シードデータ投入

```bash
pnpm db:seed
```
