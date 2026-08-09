# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Claude Codeの理解度を測る学習用Webアプリ（GitHub Pages公開: https://dtakamiya.github.io/cc-study/）。
ビルドツール・依存パッケージ・バックエンドを一切持たない、素のES modules + 静的HTMLで構成されている。
`package.json`は存在しない。この制約は意図的なもので、新しい依存を追加する前に必ず確認すること。

## コマンド

```bash
# ローカル起動（file:// では fetch が失敗するため必ずHTTPサーバー経由）
python3 -m http.server 8000   # http://localhost:8000/index.html

# 全テスト実行（Node標準テストランナー、104テスト）
node --test

# 単一テストファイル
node --test tests/review.test.js

# テスト名で絞り込み
node --test --test-name-pattern="復習"
```

## アーキテクチャ

### 3ページ構成と状態の受け渡し

`index.html`（ダッシュボード）→ `quiz.html`（出題）→ `result.html`（結果）の遷移。
ページ間の状態は**ストレージ経由でのみ**渡す。3つのキーを使い分けている。

| キー | ストレージ | 用途 |
|------|-----------|------|
| `cc-diagnosis-progress` | localStorage（失敗時 sessionStorage に退避） | 合格・レベル開放のゲート |
| `cc-diagnosis-review` | localStorage のみ | 誤答履歴 |
| `cc-diagnosis-stage-result` | sessionStorage | 直前の挑戦結果をresult.htmlへ渡す |

進捗と誤答履歴を別キーにしているのは、片方が壊れて初期化されてももう片方を残すため。
誤答履歴は sessionStorage への退避をしない（タブを閉じたら消える誤答履歴は目的を果たさないため）。

### レイヤー構造

**純粋関数層**（DOMもストレージも触らない。テストはここに集中している）
- `js/progress.js` — `DOMAINS` / `DOMAIN_LABELS` / ゲート判定（`getStageStatus`）/ 進捗の正規化
- `js/level-judge.js` — `LEVELS` / `LEVEL_LABELS`（4レベル定義のみ）
- `js/quiz-engine.js` — 出題抽出・選択肢シャッフル・採点
- `js/review.js` — 誤答履歴の正規化・記録・復習対象抽出・バッジ集計
- `js/report-content.js` — 領域×レベルごとの学習アドバイス文言

**アダプタ層**
- `js/storage.js` — Web Storage の例外を全て内側で握りつぶし、成否を戻り値で返す
- `js/quiz-modes.js` — URL解釈（`parseQuizMode`）と、通常出題／復習出題の差分吸収

**ページ層**（DOM操作。ここだけがブラウザAPIに依存する）
- `js/top-page.js` / `js/quiz-page.js` / `js/result-page.js`

新しいロジックは純粋関数層に置き、ページ層は組み立てに徹する。

### 守るべき不変条件

これらは設計判断としてコード内コメントに理由が書かれている。変更前に必ずコメントを読むこと。

- **復習は進捗に一切書き込まない。** 一度見た問題で合格できると「10問中8問」のゲートが形骸化する。
  `quiz-page.js:221` の `finishReviewStage` は `recordAttempt` を呼ばない。
- **`getStageStatus` は自身の `cleared` を信じる前に下位レベルを検査する。**
  localStorage は利用者が手で書き換えられるため、偽造した記録だけで開放されないようにしている。
- **一度得た合格は再挑戦で失敗しても剥奪しない**（`recordAttempt`）。
- **保存に失敗したら画面遷移しない。** sessionStorage に結果を渡せない状態で遷移すると
  解答が黙って失われるため、その場で結果を表示する（`showSaveFailure`）。
- **`wrongCount` は 0 に戻らない。** 復習で正解すると `lastResult` が `correct` になり
  `⚠` バッジ集計から外れるだけ。

### 復習モードのURL

- `quiz.html?mode=review` — 全領域から出題
- `quiz.html?mode=review&domain=<領域>&level=<レベル>` — ステージ指定
- `domain` / `level` の片方だけ指定は壊れたリンクとして `null` を返しダッシュボードへ戻す

## 問題データ（`data/questions/*.json`）

8領域 × 4レベル × 各10問以上。ファイル名が領域IDと一致する。

領域を追加する場合、JSONを置くだけでは動かない。以下3箇所の更新が必要:
1. `js/progress.js` の `DOMAINS` 配列と `DOMAIN_LABELS`
2. `js/report-content.js` の `SUGGESTIONS`（4レベル分の学習アドバイス）
3. `index.html` / `README.md` の領域数・ステージ数の表記

### `updatePolicy` と `nextIdSeq`

トップレベルに更新方針を持てる。未指定は `append`（追記型）。

- `recent-features` のみ `replace`（入れ替え型）。領域名が相対的なため、
  「直近」でなくなった問題は削除して差し替える。目安3〜6ヶ月ごとに更新。
- `replace` 型の領域は採番の高水位マーク `nextIdSeq` を必須で持つ。
  問題を削除しても減らさない — IDを再利用すると localStorage に残った進捗・復習データが
  無関係な新問題に結びつくため。`tests/question-data.test.js` がこの不変条件を検証している。
- `append` 型はファイル内の最大連番から採番する。

### 問題を追加・修正するとき

`.claude/skills/question-bank-update/` にスキルがある（追加／監査／陳腐化検出の3モード）。
ユーザーが「問題集をアップデートして」等と言った場合はこれを使う。

出題内容は**必ず公式一次情報で裏取りする**。記憶や古い記事を根拠にしない。
情報源の優先順位と各領域の出典は README.md の「問題の追加・更新時に参照する情報源」に詳しい。

`tests/question-data.test.js` が自動検証する項目:
- `correctIndex` が選択肢の範囲内
- 各レベル10問以上
- 問題IDが全領域を通じて一意
- `updatePolicy` の値の妥当性、`replace` 型の `nextIdSeq` > 最大連番
- 選択肢の文字数偏り（**警告のみ。テストは失敗しない**ので出力を目視すること）

自動検証されないが守るべき観点:
- `correctIndex` が 0〜3 のいずれかに偏っていないか（領域内でおおよそ均等に）
- 誤答選択肢に「一切できない」「絶対に」等の極端な断定を多用しない（消去法で当たるため）

## 設計文書

`docs/superpowers/` に `specs/`（設計書）・`plans/`（実装計画）・`reports/`（監査レポート）が
日付プレフィクス付きで置かれている。specs と plans は**必ず対で作成する**。
機能追加時はまず既存の spec を読み、設計の経緯を把握してから着手する。
