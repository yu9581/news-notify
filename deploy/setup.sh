#!/bin/bash
# GCP Compute Engine (e2-micro) 初期セットアップスクリプト
# 実行: bash deploy/setup.sh

set -euo pipefail

echo "=== news-notify VM セットアップ ==="

# Node.js 20 インストール
if ! command -v node &> /dev/null; then
  echo "Node.js インストール中..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# アプリディレクトリ
APP_DIR="/opt/news-notify"

if [ ! -d "$APP_DIR" ]; then
  echo "リポジトリをクローン中..."
  sudo git clone https://github.com/kakui-lau/news-notify.git "$APP_DIR"
  sudo chown -R "$(whoami):$(whoami)" "$APP_DIR"
fi

cd "$APP_DIR"
npm install

# 環境変数ファイルの確認
if [ ! -f "$APP_DIR/.env" ]; then
  echo ""
  echo "環境変数ファイルを作成してください:"
  echo "  sudo nano $APP_DIR/.env"
  echo ""
  echo "必要な環境変数:"
  echo "  GEMINI_API_KEY=..."
  echo "  DISCORD_BOT_TOKEN=..."
  echo "  DISCORD_CHANNEL_ID=..."
  echo ""
fi

# systemd サービスをインストール
echo "systemd サービスを登録中..."
sudo cp "$APP_DIR/deploy/news-notify.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable news-notify

echo ""
echo "セットアップ完了!"
echo ""
echo "次のステップ:"
echo "  1. .env ファイルを作成: sudo nano $APP_DIR/.env"
echo "  2. サービス起動: sudo systemctl start news-notify"
echo "  3. ログ確認: sudo journalctl -u news-notify -f"
