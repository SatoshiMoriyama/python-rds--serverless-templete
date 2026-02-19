# TypeScript と Python が共存する AWS サーバーレス API テンプレートを CDK で作ってみた

## はじめに

最近の個人的な開発や、動作確認は基本 TypeScript を使っているのですが、今回は久しぶりに Python を使った開発をしてみたいと思います。

モダンなフレームワークを調べ、RDS に CRUD を行うサーバーレスなバックエンド API を作るためのテンプレートを作ってみました。

インフラは TypeScript（CDK）、アプリは Python（FastAPI）という珍しい構成かもしれませんが、紹介します！

### この記事で学べること

- TypeScript と Python が共存するモノレポ構成の考え方
- AWS CDK を使ったサーバーレス API のインフラ定義
- FastAPI + SQLModel + Alembic を使った Python API の構成
- ローカル（Docker）から AWS（Lambda + Aurora）まで一貫した開発フロー

### 前提知識・条件

各 AWS サービスやフレームワークの説明は紹介程度になります。
詳細な使い方については公式ドキュメントをご参照ください。

- AWS CLI と CDK CLI がインストール済み
- Node.js / pnpm / uv がインストール済み

## 全体構成

### ソースコード

ソースコードは以下格納済みです。

https://github.com/SatoshiMoriyama/python-rds--serverless-templete

リポジトリ名のタイポはご容赦ください…！

### モノレポ構成（packages/cdk / packages/api / packages/db）

このテンプレートは pnpm workspaces を使ったモノレポ構成になっています。

```text
.
├── packages/
│   ├── cdk/   # インフラ定義（TypeScript）
│   ├── api/   # FastAPI アプリ（Python）
│   └── db/    # DB モデル・マイグレーション（Python）
└── docker/    # ローカル開発用 PostgreSQL
```

モノレポにした理由は主に 2 つあります。

- AI との親和性が良い：コードベースが一箇所にまとまっているため、AI ツールがインフラとアプリの両方のコンテキストを把握しやすくなります
- 各パッケージのコマンドを覚えなくて良い：ルートの `package.json` にスクリプトをまとめることで、`pnpm cdk:deploy` や `pnpm db:seed` のように直感的な操作に統一できます

パッケージたちの役割は以下の通りです。

| パッケージ | 言語 | 役割 |
| --- | --- | --- |
| `packages/cdk` | TypeScript | AWS CDK でインフラを定義 |
| `packages/api` | Python | FastAPI で REST API を実装 |
| `packages/db` | Python | SQLModel でモデル定義、Alembic でマイグレーション管理 |

API が Python のため、CDK 側も Python で書くべきかなと悩みましたが、CDK は TypeScript が最も情報が多く書きやすいため TypeScript を採用。

API と DB は Python で統一し、`db` パッケージを `api` から共有する構成にしています。

### アーキテクチャ図

Draw.io MCP で構成図を書いてみました。

![alt text](architecture.drawio.svg)

シンプルな構成としていますが、
クライアントからのリクエストは API Gateway → Lambda → Aurora Serverless v2 の順に流れます。

ローカル PC からは SSM ポートフォワード経由で踏み台サーバを通じて Aurora に直接接続できます。

#### （補足）RDS Data APIの採用について

Aurora には RDS Data API という HTTP 経由で SQL を実行できる接続方法もあります。

https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/data-api.html

VPC 内に Lambda を置かなくて済むためシンプルな構成になりますが、
今回は SQLAlchemy / SQLModel をそのまま使いたかったため、通常の TCP 接続を採用しました。

VPC に Lambda を置くと、リソース(ENI（Elastic Network Interface）)の削除に非常に時間がかかるなどデメリットもあるので、 RDS Data API も有力な選択肢です。

また、一部制限もあるので採用される際は事前に目を通しておくことをおすすめします。

https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/data-api.limitations.html

#### （補足）RDS Proxy の採用について

Lambda から RDS に接続する際、コネクションプールの枯渇を防ぐために RDS Proxy を挟む構成も候補になります。

https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html

ただし Aurora Serverless v2 では RDS Proxy は利用可能ですが、コスト面での追加が発生します。
今回はテンプレートとしてシンプルに保ちたかったため採用しませんでした。

制限事項については以下をご参照ください。

https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/rds-proxy.html#rds-proxy.limitations

## 採用技術・フレームワーク紹介

次に採用した技術・フレームワークを簡単に紹介していきます。

### AWS CDK（TypeScript）

https://docs.aws.amazon.com/ja_jp/cdk/v2/guide/home.html

AWS CDK（Cloud Development Kit）は、TypeScript などのプログラミング言語で AWS インフラを定義できるツールです。

YAML を手書きする CloudFormation と違い、型補完が効いて書きやすく、ループや条件分岐も使えます。

以前紹介記事を書いたので紹介しておきます。

https://qiita.com/s_moriyama/items/00a926d1373606fd8ee1

### AWS Lambda / Amazon API Gateway

https://aws.amazon.com/jp/lambda/

https://aws.amazon.com/jp/api-gateway/

API をサーバーレスで構築する際の王道の組み合わせです。

Lambda はサーバーレスでコードを実行できる AWS のサービスです。サーバーの管理が不要で、リクエストがあったときだけ起動します。

API Gateway は Lambda の前段に置く HTTP エンドポイントで、URL のルーティングやスロットリングを担います。

### Aurora Serverless v2

https://docs.aws.amazon.com/ja_jp/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.html

Aurora Serverless v2 は、アクセス量に応じて自動でスケールする RDS です。
今回は PostgreSQL 互換を利用しています。

使った分だけ課金されるため、開発環境や低トラフィックな API に向いています。

最小キャパシティを 0 に設定すると、アイドル時のコストをほぼゼロにできるのが良いですね。

https://aws.amazon.com/jp/about-aws/whats-new/2024/11/amazon-aurora-serverless-v2-scaling-zero-capacity/

### FastAPI

FastAPI は Python の高速な Web フレームワークです。
型ヒントをベースに自動でバリデーションと OpenAPI ドキュメントを生成してくれるのが特徴です。

https://fastapi.tiangolo.com/

FastAPI アプリは `Mangum` というライブラリを使って Lambda に対応させています。

https://github.com/jordaneremieff/mangum

以下のように非常に少ないコードで API を実装できます。

```python
from fastapi import FastAPI
from mangum import Mangum

app = FastAPI()
handler = Mangum(app)  # Lambda ハンドラー

@app.get("/")
def read_root():
    return {"message": "Hello"}
```

### Pydantic

https://docs.pydantic.dev/latest/

Pydantic は Python のデータバリデーションライブラリです。

型ヒントをベースにデータの検証や変換を行ってくれ、面倒なデータ整合性のチェックを行うコードを書かなくて済みます。

### SQLModel

https://sqlmodel.tiangolo.com/

SQLModel は SQLAlchemy と Pydantic を統合した O/R マッパです。

FastAPI と同じ作者が作成しており、モデル定義が一箇所で済み、DB テーブルの定義と API のスキーマを兼ねられます。

### Alembic

https://alembic.sqlalchemy.org/en/latest/

Alembic は SQLAlchemy 向けのマイグレーションツールです。

`pnpm db:generate "変更内容"` を実行するだけで、モデルの差分を検知して自動でマイグレーションファイルを生成してくれます。手動で SQL を書く必要がなく、モデルを変更したらコマンド一発で DB に反映できるのが気に入っています。

最近この仕組みを TypeScript でも利用していますが、一度慣れると手放せなくなりますね。

### uv

https://docs.astral.sh/uv/

uv は Rust 製の高速な Python パッケージマネージャーです。

pip と比べて圧倒的に速く、仮想環境の作成も楽で、`uv sync` のみで仮想環境のセットアップが完了します。

### pnpm

https://pnpm.io/ja/

pnpm は高速な Node.js パッケージマネージャーです。

npm や yarn と比べてディスク使用量が少なく、インストールが速いのが特徴です。
今回はモノレポ管理に pnpm workspaces を使っています。

ただ早いだけではなくセキュリティ対策にもなるのでおすすめです！

https://dev.classmethod.jp/articles/20260210-cm-sapporo-study-12-pnpm/

## やってみた

では、開発の流れを紹介していきます。

各種作業でコマンドを入力するのが面倒なので、基本スクリプトで対応しています。

今回使うスクリプトは以下の通りです。

| コマンド | 内容 | 実際のコマンド |
| --- | --- | --- |
| `pnpm setup:node` | Node.js 依存関係のインストール | `pnpm install` |
| `pnpm setup:python` | Python 仮想環境の作成と依存関係のインストール | `cd packages/db && uv sync && cd ../api && uv sync` |
| `pnpm docker:up` | ローカル PostgreSQL の起動 | `cd docker && ./start.sh` |
| `pnpm docker:down` | ローカル PostgreSQL の停止 | `cd docker && ./stop.sh` |
| `pnpm db:migrate` | マイグレーションの適用 | `uv run alembic upgrade head` |
| `pnpm db:seed` | シードデータの投入 | `uv run python scripts/seed.py` |
| `pnpm db:generate` | マイグレーションファイルの生成 | `uv run alembic revision --autogenerate -m "メッセージ"` |
| `pnpm api:dev` | API の開発サーバー起動 | `uv run uvicorn src.main:app --reload --host 0.0.0.0 --port 8000` |
| `pnpm cdk:deploy` | AWS へのデプロイ | `cdk deploy` |
| `pnpm cdk:destroy` | AWS リソースの削除 | `cdk destroy` |


### ローカル開発の流れ

1. 依存関係をインストールします。

```bash
pnpm setup:node
pnpm setup:python
```

2. Docker で PostgreSQL を起動します。

```bash
pnpm docker:up
```

3. `.env` ファイルを作成します。

```bash
cp packages/db/.env.example packages/db/.env
cp packages/api/.env.example packages/api/.env
```

Docker で起動した PostgreSQL に接続するため、デフォルト値のままで動作します。
パスワードを変更した場合は `your_password` の部分を合わせて修正してください。

```text
DATABASE_URL=postgresql+psycopg://postgres:your_password@localhost:5432/dev
```

4. マイグレーションを実行します。

```bash
pnpm db:migrate
```

5. シードデータを投入します。

```bash
pnpm db:seed
```

6. API を起動します。

```bash
pnpm api:dev
```

`http://localhost:8000/docs` にアクセスすると Swagger UI が開き、API を試せます。

### モデルの更新・DB への反映

モデルを変更した場合は、マイグレーションファイルを生成して適用します。

1. `packages/db/src/db/models/` 配下のモデルを編集します。

2. マイグレーションファイルを自動生成します。

```bash
pnpm db:generate "add_description_to_todos"
```

Alembic がモデルの差分を検知して、`alembic/versions/` にマイグレーションファイルを生成します。

3. 生成されたファイルを確認して、マイグレーションを適用します。

```bash
pnpm db:migrate
```

### AWS にデプロイしてみる

CDK の依存関係をインストールして、デプロイします。（CDK を対象リージョンで初めて利用する際は bootstrap が別途必要です）

```bash
pnpm cdk:deploy
```

デプロイが完了すると、ターミナルに API Gateway の URL が出力されます。

```text
Outputs:
CdkStack.ApiUrl = https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/
```

この URL にアクセスして動作確認できます。

```bash
curl https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com/dev/health
# {"status":"ok","database":"connected"}
```

#### Aurora への migrate / seed

デプロイ後、Aurora に対して migrate / seed を実行するには SSM ポートフォワードで踏み台経由で接続します。

デプロイ完了時に以下のような出力が表示されます。

```text
CdkStack.PortForwardCommand = aws ssm start-session --region ap-northeast-1 --target i-xxxxxxxxxx --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{"portNumber":["5432"], "localPortNumber":["5432"], "host": ["xxxx.ap-northeast-1.rds.amazonaws.com"]}'
CdkStack.DatabaseSecretsCommand = aws secretsmanager get-secret-value --secret-id AuroraClusterSecret-xxxxxxxx --region ap-northeast-1
```

1. `DatabaseSecretsCommand` をそのまま実行して DB 認証情報を取得し、`packages/db/.env` に設定します。

2. 別ターミナルで `PortForwardCommand` をそのまま実行してポートフォワードを開始します。

3. ポートフォワードが繋がった状態で migrate / seed を実行します。

```bash
pnpm db:migrate
pnpm db:seed
```

## まとめ

FastAPI × Aurora Serverless v2 を CDK でデプロイするテンプレートを紹介しました。

- TypeScript（CDK）と Python（API/DB）をモノレポで共存させる構成
- `cdk deploy` 一発でインフラとアプリが揃う
- ローカルは Docker、本番は Lambda + Aurora で環境差異を最小化

テンプレートとして使えるよう設計しているので、モデルを追加したりエンドポイントを増やしたりするだけで自分のプロジェクトに応用できます。

個人的には FastAPI の `/docs` に初めてアクセスしたとき、コードを書いただけで Swagger UI が自動生成されていたのには驚きました。Python のエコシステムも進化していますね。

今後何か使うことがあったらもっと発展させていきたいと思います！