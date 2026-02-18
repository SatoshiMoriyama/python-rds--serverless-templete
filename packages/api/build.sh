#!/bin/bash
# CDK の Lambda デプロイ時に Docker コンテナ内で実行されるビルドスクリプト。
# api と db の依存パッケージを /asset-output に集め、Lambda zip を作成する。
# cdk-stack.ts の lambda.Code.fromAsset bundling.command から呼び出される。
set -e

# アプリケーションコードをコピー
cp -r /asset-input/src /asset-output/src

# db のソースコードをコピー
cp -r /shared-input/src/db /asset-output/db

# API の依存パッケージをインストール（db 除外）
pip install uv
cd /asset-input && uv export --frozen --no-emit-workspace --no-dev --no-editable --no-emit-package db -o /tmp/requirements.txt
pip install -r /tmp/requirements.txt -t /asset-output

# db の依存パッケージもインストール
cd /shared-input && uv export --frozen --no-emit-workspace --no-dev --no-editable -o /tmp/shared-requirements.txt
pip install -r /tmp/shared-requirements.txt -t /asset-output
