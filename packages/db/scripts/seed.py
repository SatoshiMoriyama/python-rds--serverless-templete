"""開発用シードデータ投入スクリプト

Usage:
    cd packages/db
    uv run python scripts/seed.py
"""

from sqlalchemy import text

from db.database import engine


def seed():
    with engine.connect() as conn:
        conn.execute(text("DELETE FROM todos"))

        conn.execute(
            text("""
            INSERT INTO todos (id, title, completed, created_at, updated_at)
            VALUES
            (gen_random_uuid(), '牛乳を買う', false, NOW(), NOW()),
            (gen_random_uuid(), 'ドキュメントを書く', false, NOW(), NOW()),
            (gen_random_uuid(), 'PRをレビューする', true, NOW(), NOW()),
            (gen_random_uuid(), 'テストを書く', false, NOW(), NOW()),
            (gen_random_uuid(), 'デプロイする', true, NOW(), NOW())
            """)
        )

        conn.commit()
        print("シードデータの投入が完了しました")


if __name__ == "__main__":
    seed()
