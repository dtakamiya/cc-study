# Claude Code 理解度診断

Claude Codeの理解度を4領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理）
×4レベル（初級／中級／上級／エキスパート）の観点で診断するWebアプリです。

チーム内の育成・研修を目的とした個人向け診断ツールで、サーバーは使わずブラウザだけで完結します。
診断結果はブラウザの`localStorage`にのみ保存され、外部には送信されません。

## ローカルでの動作確認

ビルド不要です。プロジェクトルートで簡易HTTPサーバーを起動してください。

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` を開いて診断を開始できます。

`file://`で直接HTMLを開くと`fetch`によるJSON読み込みがブラウザのセキュリティ制限で失敗するため、
必ず簡易サーバー経由でアクセスしてください。

## テストの実行

```bash
node --test tests/
```

## GitHub Pagesでの公開

1. GitHubリポジトリの Settings → Pages を開く
2. "Build and deployment" の Source を "Deploy from a branch" に設定
3. Branch を `main`（またはデフォルトブランチ）、フォルダを `/ (root)` に設定して保存
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

## 問題の追加・修正

`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低4問ずつ必要です
（1回の診断で各レベルから抽出する問題数: 初級3問・中級3問・上級2問・エキスパート2問）。
