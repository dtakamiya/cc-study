# 週次問題集メンテナンス（stale モード）レポート — 2026-09-22（ISO週39・奇数週）

## 対象領域

今回対象（Ryoko側の負荷分散方針により3領域のみ）:
- recent-features（毎週必須）
- slash-commands（奇数週）
- token-efficiency（奇数週）

今回対象外（次回以降の偶数週サイクルで実施）:
- basic-operations
- feature-usage
- harness-design
- prompt-design
- security-permissions

## 参照した公式情報源

- code.claude.com/docs/en/ 配下: permission-modes, fast-mode, artifacts, cross-session-messaging, plugin-marketplaces, self-hosted-environments, agent-teams, settings-reference, commands, skills, mcp, checkpointing, sessions, scheduled-tasks, costs, prompt-caching, context-window, model-config, tools-reference（すべて2026-09-22取得）
- platform.claude.com/docs/en/build-with-claude/prompt-caching（2026-09-22取得）
- github.com/anthropics/claude-code の生CHANGELOG.md（`git`ではなくraw取得し`grep`でバージョン行を全件裏取り。recent-074の反省を踏まえ、バージョン番号は記憶ではなく生ファイル照合で確定）

## 陳腐化した問題の一覧（深刻度順）

### recent-features.json（56問中1件検出、updatePolicy: replace, nextIdSeq: 79）

**recent-072（要修正）**
- 現状: 「agent teamsのteammate定義で`skills`と`mcpServers`のフロントマターはteammateとしては適用されない」と断定
- 正しい仕様: `mcpServers`は**split-paneモード**のteammateには適用される（`--agent`起動時と同じルール）。in-processモードのteammateのみ無視してプロジェクト/ユーザー設定から読み込む。また定義本文（body）も、in-processでは既定システムプロンプトへの追加指示だが、**split-paneでは既定システムプロンプトを完全に置き換える**
- 根拠: https://code.claude.com/docs/en/agent-teams （"Use subagent definitions for teammates" セクション）
- 備考: 表示モード（in-process/split-pane）で挙動が異なる点が問題文・選択肢に反映されておらず、正解が不正確

### slash-commands.json（76問中2件検出、updatePolicy: 未設定=append）

**slash-043（要修正）**
- 現状: 「スタンドアロンの`/output-style`コマンドはv2.1.73で非推奨、v2.1.91で削除された。現在は`/config`経由のみ」
- 正しい仕様: `/output-style [style]`はv2.1.269で**復活（再導入）**。現行では独立コマンドとして再びリスト・切替可能
- 根拠: https://code.claude.com/docs/en/commands（"Requires Claude Code v2.1.269 or later"）／CHANGELOG.md 2.1.269
- 対応案: 正解を「`/output-style`または`/config`どちらでも切替可能（`/output-style`はv2.1.269で再導入）」に更新、または設問をreplace

**slash-069（検討推奨）**
- 現状: 解説文で「`/apps/web:deploy`のような修飾名の挙動にはv2.1.203以降が必要」
- 正しい仕様: ネストスキルの`<dir>:<name>`修飾名機能はCHANGELOG.mdの**v2.1.178**セクションで導入（v2.1.203には該当記述なし）
- 根拠: CHANGELOG.md `## 2.1.178`（生grep裏取り済み）
- 備考: 設問本体・正解選択肢自体は正しい。解説内のバージョン番号のみ誤り（recent-074と同種パターン）

### token-efficiency.json（80問中1件検出＋1件要フォロー、updatePolicy/nextIdSeq: なし=append）

**token-027（要修正）**
- 現状: 「Bashを丸ごと拒否するdenyルールは、セッション途中でもキャッシュを無効化する」
- 正しい仕様: tool search（対応モデルで既定有効）が効いている場合、リクエストのツール定義は変わらずキャッシュされたプレフィックスは維持される。tool searchが使えない/無効なときのみキャッシュが無効化される
- 根拠: https://code.claude.com/docs/en/prompt-caching#denying-an-entire-tool

**token-066/071（検討推奨・未確定）**
- `/autocompact`の値域「100K〜1M」・`CLAUDE_CODE_AUTO_COMPACT_WINDOW`の優先順位に関する記述が、該当ページを直接特定できず一次情報での裏取りが未完了（矛盾は未検出、要フォロー）
- 次回確認先: code.claude.com/docs/en/model-config#set-the-auto-compact-window

## クイズ化すべき新機能の候補（領域ごと）

**recent-features**
- AGENTS.mdサポート（CHANGELOG v2.1.277）: CLAUDE.mdが無い場合にAGENTS.mdを読む。`/config`の「Project instructions」から切替。Bedrock/Vertex/Foundry未対応
- auto modeのサーバーサイド分類器がAPI/Enterprise/Bedrock/Vertex/Foundry/gatewayで既定化（CHANGELOG v2.1.278）。課金面の変更あり
- `/design`によるDesign Artifact（v2.1.265以降）: artboard群をcanvasに描きPNG/PDFエクスポート可能
- `keybindingFlavor: "readline"`設定（v2.1.238）: Ctrl+Wの単語削除挙動変更

**slash-commands**
- `/goal [condition|clear]`: セッションが複数ターンにまたがり条件達成まで自律的に作業を続ける機能
- `/teleport`（エイリアス`/tp`）: クラウドセッションをローカル端末に引き込む機能（claude.ai購読要）
- 注意: `/ultraplan`は廃止済み（"Removed. Use plan mode instead"）— 将来この名前での出題は不可

**token-efficiency**
- `Prompt cache (main)`統計行（v2.1.251+）: `/usage`のSessionブロックにキャッシュヒット率等を表示
- `modelPricing`による組織契約レート反映（v2.1.242+）: `/usage`等のコスト表示を契約単価に合わせる設定
- Goal check-insのアイドル時トークン消費（v2.1.236導入、v2.1.246でキャップ）: アクティブgoalの背景確認が最大3回までアイドル時に全コンテキスト送信

## チェック範囲の明記
- recent-features: 全56問チェック、上記1件以外は矛盾なし
- slash-commands: 全76問チェック、上記2件以外は矛盾なし
- token-efficiency: 全80問チェック、上記1件（要修正）＋1件（検討推奨・未確定）以外は矛盾なし
