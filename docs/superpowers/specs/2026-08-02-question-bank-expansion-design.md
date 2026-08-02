# 問題集の精度向上・拡充・最新化 設計書

## 背景・目的

[2026-08-01の設計書](./2026-08-01-claude-code-understanding-diagnosis-design.md)で実装したClaude Code理解度診断アプリについて、以下3点を改善する。

1. **精度向上**: 既存4領域64問の記述を公式ドキュメントと照合し、曖昧・古い内容を修正する
2. **拡充と最新化**: 各領域の問題プールを拡大し、公式ドキュメントに基づく最新仕様を反映する。あわせて「トークン効率・コスト管理」を新領域として追加する
3. **復習機能**: 診断結果ページに、間違えた問題の正解と解説を表示する

個人・チーム利用という現行スコープ（サーバーなし、localStorageのみ、チーム集計機能なし）は変更しない。

## スコープ外

- チーム全体の結果を自動集計するダッシュボード（既存スコープ外を継続）
- サーバーサイドでのユーザー管理・認証
- 出題形式の変更（単一選択式4択のまま）
- 間違えた問題の外部共有・エクスポート機能（レポートPDFへの同梱のみ）

## 1. 新領域「トークン効率・コスト管理」

### ドメイン定義

- ファイル: `data/questions/token-efficiency.json`
- `domain`: `"token-efficiency"`
- `domainLabel`: `"トークン効率・コスト管理"`
- IDプレフィックス: `token-`（既存の`basic-`/`feature-`/`prompt-`/`security-`規約に合わせる）

### 出題の観点とレベル配分（各レベル10問、計40問）

公式ドキュメント（`code.claude.com/docs/en/costs`、`code.claude.com/docs/en/model-config`）で確認した仕様に基づく。

| レベル | 出題の重点 |
|---|---|
| 初級 | `/clear`と`/compact`の基本的な使い分け、`/usage`・`/cost`・`/status`の違い、デフォルトモデル（Pro/Team StandardはSonnet、Max/Team PremiumはOpus）の位置づけ |
| 中級 | プロンプトキャッシングの概念（自動適用され再利用でコストが下がる）、`/model`でのモデル切り替えとタスクに応じた選び方、CLAUDE.mdを200行程度に保つ指針 |
| 上級 | キャッシュのTTL（5分・1時間）とキャッシュミスが起きる条件、`opusplan`のようなプラン/実行のハイブリッド運用、MCPツール定義の遅延ロード（`/context`で確認）、hookによる出力フィルタでのcontext削減 |
| エキスパート | 長時間セッションで使用量が増える要因（キャッシュミス、スケジュールタスク、agent teamsの並列実行）、`/usage`のブレークダウン（skills/subagents/plugins/MCPごとの内訳）活用、組織のスペンド管理（workspace spend limit、TPM/RPM推奨値）、effortレベルの調整による トークン消費の最適化 |

### 総合レベル判定への統合

既存の「4領域のうち最も低いレベルを総合レベルとする」ロジック（木桶原理）に5領域目としてそのまま組み込む。`level-judge.js`の`judgeAllLevels`はドメイン数に依存しない実装のため、コード変更は不要。`quiz-page.js`の`DOMAIN_FILES`に新ファイルを追加するのみ。

### 1回の診断あたりの出題数

問題プール（各レベル10問）を拡大する一方、1回の診断で抽選する`COUNT_PER_LEVEL`（初級3・中級3・上級2・エキスパート2 = 1領域10問）は変更しない。プールを増やす狙いは、同じ受診者が繰り返し診断しても毎回異なる問題に当たるようにすることであり、1回あたりの所要時間は現行と同じ（5領域×10問=50問）に保つ。

## 2. 既存4領域の拡充・見直し

### 対象

- `basic-operations.json` / `feature-usage.json` / `prompt-design.json` / `security-permissions.json`
- 各16問（4レベル×4問）→ 各40問（4レベル×10問）に拡充

### レビュー方針

- 既存64問を全問レビューし、公式ドキュメントと照合する
- 曖昧な表現・古い仕様・不正確な記述がある問題は書き換える
- 選択肢の質（誤答が紛らわしいか、明らかに除外できる選択肢だけになっていないか）も見直す
- IDや`level`フィールドなど構造は維持する。書き換えで`id`が変わることはない

### 新規追加分の観点（各領域24問追加）

公式ドキュメント（`code.claude.com/docs/en/*`）で確認した最新仕様を反映する。実装時に該当ページを個別にリサーチする。

- **基本操作・CLI使用法**: `/rewind`によるチェックポイント復元、セッション管理（`--resume`/`--continue`/`/resume`）、ステータスライン設定など
- **機能活用**: フックのhandler type（command/http/mcp_tool/prompt/agent）、plan mode、agent teams、スキル・サブエージェントの使い分けなど
- **プロンプト設計・協働作法**: CLAUDE.mdの粒度設計、スキルへの指示移譲、明確な指示がトークン消費に与える影響など
- **安全性・権限管理**: `permissions`のallow/deny/ask構造、`availableModels`による組織制限、sandboxモードなど

## 3. 間違えた問題の正解・解説表示

### データフロー

現在`quiz-page.js`の`finishQuiz()`は`quiz`（各問題の`choices`・`correctIndex`・`explanation`を含む完全な出題データ）と`answers`（`questionId → 選択index`）の両方をメモリ上に保持している。この時点で不正解だった問題の詳細を抽出し、`resultObject`に含めて保存する。

### storage.jsへの保存内容の変更

`resultObject`に`wrongAnswers`配列を追加する。既存の`domains`/`overall`/`completedAt`構造はそのまま維持する（後方互換のため、フィールド追加のみで既存フィールドは変更しない）。

```json
{
  "domains": { "...": "既存のまま" },
  "overall": "intermediate",
  "completedAt": "2026-08-02T12:00:00.000Z",
  "wrongAnswers": [
    {
      "questionId": "basic-003",
      "domainLabel": "基本操作・CLI使用法",
      "question": "...",
      "choices": ["...", "...", "...", "..."],
      "selectedIndex": 1,
      "correctIndex": 0,
      "explanation": "..."
    }
  ]
}
```

`quiz-page.js`の`finishQuiz()`で、`flatQuestions`から不正解だった項目（`answers[q.id] !== q.correctIndex`）を抽出して`wrongAnswers`を組み立てる。

### result-page.jsでの表示

- 既存の「弱点領域への改善提案」セクションの後に「間違えた問題」セクションを追加する
- `wrongAnswers`が空配列の場合は「全問正解でした」の一文のみ表示する
- 各項目は、問題文・選択肢一覧（選んだ回答と正解を視覚的に区別）・解説を表示する
- 表示順は出題順（`wrongAnswers`配列の順序どおり）とする

### 印刷（PDF化）対応

`css/style.css`の`@media print`スタイルに、新セクションのレイアウトを追加する。既存の印刷スタイル方針（不要なUI要素の非表示、読みやすいレイアウト）を踏襲する。

### 後方互換性

`wrongAnswers`を持たない旧形式の保存データ（既存ユーザーが過去に保存した結果）を再訪時に読み込んだ場合、新セクションは「保存データに詳細情報がありません」等のフォールバック表示、またはセクション自体を非表示にする。

## エラーハンドリング

既存方針を継続する。

- 問題データの読み込み失敗時: エラーメッセージ表示、再読み込みを促す（新領域ファイルの読み込み失敗も同様に扱う）
- localStorage利用不可環境: `saveFallbackResult`によるセッション限りの保存にフォールバック（`wrongAnswers`を含む）

## ドキュメント更新

`README.md`の「問題の追加・修正」節を、5領域構成・各レベル最低10問という新しい前提に合わせて更新する。

## テスト方針

- `quiz-engine.js`: 5領域構成での出題ロジック（各領域・各レベルから重複なく指定数を選ぶ）の単体テスト
- `level-judge.js`: 既存の閾値判定・総合レベル集約ロジックは変更なしのため追加テスト不要（5領域での動作は`quiz-engine.js`側のテストでカバー）
- `question-data.test.js`: 新領域ファイルを含めた全5ファイルについて、各レベル最低10問・ID一意性・必須フィールド（`id`/`level`/`question`/`choices`/`correctIndex`/`explanation`）の検証
- 不正解抽出ロジック（`wrongAnswers`組み立て）の単体テスト
- ブラウザでの手動確認: 全問正解時・一部不正解時それぞれの結果ページ表示、印刷レイアウト確認
