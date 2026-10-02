# 問題集 陳腐化検出レポート（2026-09-29 / ISO週40）

- モード: stale（JSON本体は変更していない）
- 照合対象スナップショット: origin/main `3f375d8`（PR #28 マージ後）
- 取得日: 2026-09-29 / CHANGELOG 最新: 2.1.284（生 CHANGELOG を grep して裏取り）

## 対象領域

| 区分 | 領域 |
|---|---|
| 今回の対象（6領域） | recent-features, feature-usage, security-permissions, basic-operations, prompt-design, harness-design |
| 対象外（2領域・今回未照合） | slash-commands, token-efficiency |

負荷分散ルール: ISO週40は偶数かつ4の倍数のため6領域（前例: 2026-09-01週）。

## 参照した一次情報

- code.claude.com/docs/en/: permissions, permission-modes, sandboxing, security, hooks, settings, managed-settings, server-managed-settings, memory, sub-agents, skills, mcp, agent-teams, checkpointing, output-styles, statusline, plugins-reference, interactive-mode, fullscreen, terminal-config, commands, cli-reference, overview, best-practices, context-window, goal, common-workflows, costs, github-actions, headless
- Anthropic Engineering blog: effective-context-engineering-for-ai-agents, claude-code-auto-mode, claude-code-sandboxing, building-effective-agents
- github.com/anthropics/claude-code CHANGELOG.md（2.1.284）
- 未照合: security-041〜051 のブログ本文（一部）、security-042〜045（Anthropic Academy 由来）

## サマリ

| 領域 | 検査 | 要修正 | 検討推奨 | 参考 |
|---|---|---|---|---|
| recent-features | 56問 | 0 | 1 | 1 |
| feature-usage | 81問 | 1 | 0 | 4 |
| security-permissions | 82問 | 3 | 1 | 3 |
| basic-operations | 76/77問 | 4 | 3 | 3 |
| prompt-design | 79問 | 0 | 0 | 1 |
| harness-design | 74問 | 2 | 1 | 2 |

## 要修正

### security-061
- 現状: 許可プロンプトで Ctrl+E → 説明とリスクラベル表示、`permissionExplainerEnabled` で無効化
- 正: 機能は削除済み。CHANGELOG 1667行（2.1.257）「Removed the Ctrl+E command explanation on Bash and PowerShell permission prompts」
- 根拠: https://code.claude.com/docs/en/permissions / CHANGELOG 2.1.257
- 対応: 問題ごと入れ替え候補

### security-081
- 現状: PermissionRequest の判断は「トップレベルの `decision` オブジェクト（allow/deny/ask）」
- 正: `hookSpecificOutput.decision.behavior` に `"allow"`/`"deny"` の2値（`ask` は無い）。exit 2 でブロックできない点は現行どおり
- 根拠: https://code.claude.com/docs/en/hooks（Decision pattern 表 / PermissionRequest decision control）

### security-066
- 現状: auto mode が組み込み既定なのは Pro/Max/Team のみ。Enterprise/Console/Bedrock/Vertex/Foundry/gateway は `default`
- 正: 全プラン・全プロバイダの対話ターミナル/VS Code で組み込み既定が auto。`default` になるのは `disableAutoMode: "disable"` 設定時と `claude -p`/Agent SDK
- 根拠: https://code.claude.com/docs/en/permission-modes / CHANGELOG 66行（2.1.284節）、170行
- 注意: docs 本文は「v2.1.283以降」、CHANGELOG 66行は 2.1.284 節にある。版番号は問題文に載せず「最新版では」と書くのが安全

### basic-063
- 現状: Ctrl+L を2秒以内に2回押すと `/clear` 実行（正解選択肢）
- 正: 2回押しの `/clear` は v2.1.238 で廃止、Ctrl+L は再描画のみ
- 根拠: CHANGELOG 2090行（2.1.238）/ https://code.claude.com/docs/en/fullscreen

### basic-068
- 現状: explanation「サブエージェント所有のバックグラウンドコマンドは60分で終了、`CLAUDE_SUBAGENT_BG_SHELL_MAX_MS` で調整」
- 正: 1時間制限は撤廃。CHANGELOG 1518行（2.1.260）。正解自体は有効（explanation の該当1文のみ修正）
- 根拠: https://code.claude.com/docs/en/interactive-mode

### basic-077
- 現状・正: basic-068 と同じ（explanation の60分上限の記述のみ修正）

### basic-002
- 現状: 選択肢 `/clear` `/reset` `/new` `/restart`、正解 `/clear` のみ
- 正: `/reset`・`/new` も `/clear` のエイリアスで正解が複数化
- 根拠: https://code.claude.com/docs/en/commands
- 対応: 誤答選択肢を実在しないコマンドに差し替え

### feature-052
- 現状: 正解は `keep-coding-instructions: true`。explanation「変更は `/clear` か新規セッション後に反映」
- 正: 出力スタイルの切替は次のメッセージから反映（v2.1.251 より前は `/clear` か新規セッションが必要だった）。選択肢2「途中から即座に反映」が現行と一致し正解が複数化
- 根拠: https://code.claude.com/docs/en/output-styles
- 注意: 2.1.251 の版番号は docs 記述に依存。CHANGELOG の 2.1.251 節に該当行は見つからず未裏取り

### harness-058
- 現状: 前提が「default モードで起動」。explanation は「組み込み既定は Pro/Max/Team で auto（v2.1.228以降/Windows v2.1.233以降）」
- 正: v2.1.283 以降は全プラン・全プロバイダで auto。前提が成立しない
- 根拠: https://code.claude.com/docs/en/permission-modes / CHANGELOG 66行

### harness-023
- 現状: 正解「ユーザーレベルのルールが先に読み込まれ、プロジェクトレベルの方が優先度が高い」
- 正: 読み込み順はユーザー→プロジェクトだが「Neither set overrides the other」。優先度が高いとは書かれていない。harness-060 の解説にも同前提あり
- 根拠: https://code.claude.com/docs/en/memory（User-level rules）

## 検討推奨

- **recent-004**: 「現行モデルID」に `claude-sonnet-5-5`（v2.1.284、Anthropic API 既定 Sonnet）が未反映。「現行」表現の更新を検討。根拠: CHANGELOG 2.1.284 先頭行
- **security-082**: 「server-managed が1キーでも配信すれば endpoint-managed は無視、マージされない」は既定挙動。`managedSourcesBehavior: "merge"` で変更可。「既定では」を補う。根拠: https://code.claude.com/docs/en/managed-settings / CHANGELOG 1658行
- **basic-017**: `/undo`・`/checkpoint` も `/rewind` のエイリアスで正解が複数化（basic-002 と同型・要修正に格上げも可）。根拠: commands docs / CHANGELOG 4743行
- **basic-064**: `/btw` の `f` はドキュメント上「バックグラウンド subagent へフォーク」。問題は「新しいセッションへフォーク」。CHANGELOG 該当行は未特定
- **basic-071**: Ctrl+T タスクリストは現行が許可リスト方式（Claude 3.x / Opus 4〜4.7 / Sonnet 4〜4.6 / Haiku 4.5 のみ提供）。「Opus 4.8以降は提供されない」の書き方が古い。根拠: CHANGELOG 1232行（2.1.268）
- **harness-064**: 「サブエージェントの通信は1対1のみ」は、名前付きサブエージェント同士のメッセージが可能と現行 docs にあり弱める。根拠: https://code.claude.com/docs/en/agent-teams

## 参考

- prompt-060: 画像貼り付けに Alt+V（Windows/WSL）が追加。記述は誤りでない（interactive-mode）
- feature-038: managedMcpServers（組織配布）が全スコープの上位（v2.1.259以降）。解説に追記余地
- feature-068: `/` メニュー表示は `/servername:promptname (MCP)`。`/mcp__…` も有効
- feature-058: plugin monitors は `experimental.monitors` 配下に移動・`when` 追加
- feature-044: ドキュメント名は "Run Claude Code programmatically"（用語ゆれ）
- security-023: default モードは「初回利用時に確認」ではなく「読み取りのみ確認なし」と現行 docs は記述
- security-059/068: protected paths は auto では分類器、dontAsk では拒否
- security-031: auto mode ではホストを Claude が指定する方式
- basic-043: 「スマホ専用ネイティブアプリなし」は Claude アプリ（iOS/Android）の存在と紛らわしい
- basic-075: 貼り付け折りたたみ閾値が docs（3行超）と CHANGELOG 565行（2 line breaks超）で揺れ
- harness-058: 解説の v2.1.142 は CHANGELOG で裏取りできず、削除を推奨
- harness-027: 解説の引用文言が現行 docs と不一致（実質同じ）

## 指摘なしの範囲

prompt-design は 79問中、要修正・検討推奨ゼロ。全領域とも上記以外は現行仕様と一致。スタイル面（偏り・重複・読解）は stale モード対象外のため未検査。
