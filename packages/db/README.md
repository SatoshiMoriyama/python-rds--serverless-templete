# db パッケージ

データベースモデル定義とマイグレーション管理用パッケージ。

## 構成

```
db/
├── src/db/
│   ├── models/      # SQLModel 定義
│   │   └── todo.py
│   ├── database.py  # DB 接続設定
│   └── config.py    # 環境変数設定
├── alembic/         # マイグレーション
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── scripts/
│   └── seed.py      # シードデータ投入スクリプト
└── alembic.ini
```

## セットアップ

```bash
cd packages/db
uv sync
cp .env.example .env
# .env を編集して DATABASE_URL を設定
```

## マイグレーション

すべてのコマンドは `packages/db` ディレクトリで実行してください。

### マイグレーションファイルの自動生成

```bash
uv run alembic revision --autogenerate -m "変更内容の説明"
```

### マイグレーションの適用

```bash
uv run alembic upgrade head
```

### ロールバック

```bash
# 1つ前に戻す
uv run alembic downgrade -1

# 全てのマイグレーションを戻す（テーブル全削除）
uv run alembic downgrade base
```

### 履歴の確認

```bash
# 現在の状態
uv run alembic current

# 履歴
uv run alembic history
```

## シードデータ

開発用のシードデータは `scripts/seed.py` で管理しています。

### シードデータの投入

```bash
uv run python scripts/seed.py
```

### シードデータの内容

- Todos: 5件（牛乳を買う、ドキュメントを書く、PRをレビューする、テストを書く、デプロイする）

### 注意事項

- シードデータ投入時、既存データは削除されます
- 本番環境では実行しないでください

## 注意事項

- マイグレーションファイル生成後、必ず内容を確認してください

## データベース接続

```bash
PGPASSWORD='devpassword123' psql -h localhost -p 5432 -U postgres -d dev
```
