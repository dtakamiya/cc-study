# 問題集 陳腐化検出レポート — 2026-09-01（ISO週36）

## 今回の対象範囲

Ryoko の負荷分散方針により、本サイクルは全8領域のうち**6領域のみ**を対象とした。

**対象6領域:**

| 領域 | 更新方針 | 問題数 |
|---|---|---|
| recent-features | replace（入れ替え型・nextIdSeq=79） | 56 |
| feature-usage | append | 81 |
| security-permissions | append | 82 |
| basic-operations | append | 77 |
| prompt-design | append | 79 |
| harness-design | append | 74 |

**対象外2領域（今回未照合）:** `slash-commands`, `token-efficiency`

対象外領域の JSON は読み込んでいない。次サイクル以降で照合する。

## 実施方法

- モード: `stale`（quality-checklist.md「事実照合」観点のみ。構造・偏り・重複・読解は対象外）
- 実行主体: 領域ごとの並列サブエージェント6本 + レポート保存専用サブエージェント1本
- 一次情報のみを根拠とした（記憶・古い日本語記事は不可）:
  - https://code.claude.com/docs/en/ 配下の Claude Code ドキュメント
  - https://www.anthropic.com/engineering 配下のブログ
  - https://github.com/anthropics/claude-code の CHANGELOG.md / リリースノート
- 参照日: すべて 2026-09-01

## 参照した一次情報（領域横断で使用した主なもの）

| URL | 主な確認内容 |
|---|---|
| https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md | v2.1.100〜v2.1.252 のハーネス・権限・auto mode・サブエージェント関連エントリ。最新は v2.1.252 |
| https://code.claude.com/docs/en/cli-reference | CLI フラグ・短縮形、`--restricted`（v2.1.248）、`--from-pr`、`--bare` |
| https://code.claude.com/docs/en/interactive-mode | キーボードショートカット、シェルモード、Background Bash、`Ctrl+R` 逆検索、絵文字ショートコード、`/btw` |
| https://code.claude.com/docs/en/permission-modes | 全モード名（default/Manual・acceptEdits・plan・auto・dontAsk・bypassPermissions）、Pro/Max/Team の組み込み既定 = auto mode（v2.1.228/v2.1.233） |
| https://code.claude.com/docs/en/permissions | ルール評価順 deny→ask→allow、bare tool 名 deny、シンボリックリンク二重チェック、`Cd` ルール |
| https://code.claude.com/docs/en/sandboxing | FS/ネットワーク二層分離、`sandbox.credentials` の mask/deny、`docker` 非互換 |
| https://code.claude.com/docs/en/sub-agents | `.claude/agents/*.md` フロントマター、優先順位、ネスト深さ既定3、`isolation: worktree`、fork 既定 ON（v2.1.232） |
| https://code.claude.com/docs/en/skills | SKILL.md 形式、`disable-model-invocation` / `user-invocable`、`context: fork`、`allowed-tools` のターン限定付与、compaction 再添付予算（5,000/25,000） |
| https://code.claude.com/docs/en/memory | CLAUDE.md 配置階層、`@path` インポート最大4hop、`.claude/rules/` の `paths:`、`claudeMdExcludes`、auto memory（MEMORY.md 先頭200行/25KB） |
| https://code.claude.com/docs/en/output-styles | `keep-coding-instructions`（既定 false）、組み込み Concise（v2.1.237）、システムプロンプト書き換え |
| https://code.claude.com/docs/en/hooks | イベント名、マッチャー評価規則、`PreModelSwitch`/`PostModelSwitch`（v2.1.251）、`updatedInput` |
| https://code.claude.com/docs/en/cross-session-messaging | `SendMessage`/`ListAgents`、バージョン要件 v2.1.224（macOS/Linux/WSL）・v2.1.234（Windows） |
| https://code.claude.com/docs/en/fast-mode | Fast Mode = Opus 5 / Opus 4.8、usage credits から課金 |
| https://code.claude.com/docs/en/context-window | "What survives compaction" 表 |
| https://code.claude.com/docs/en/model-config | 現行モデル ID、`availableModels` / `enforceAvailableModels` |
| https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents | right altitude の2失敗モード、attention budget、context rot、just-in-time retrieval |
| https://www.anthropic.com/engineering/building-effective-agents | workflows vs agents、orchestrator-workers、ACI 設計 |
| https://www.anthropic.com/engineering/claude-code-auto-mode | 二層防御、transcript classifier の入力除外、deny-and-continue、脅威4分類、3連続/20通算 |
| https://www.anthropic.com/engineering/claude-code-sandboxing | approval fatigue、FS分離とネットワーク分離の両立 |

## 検出結果

### 陳腐化した問題

#### 要修正（0件）

なし。

> **【Ryoko レビューによる訂正 2026-09-01】** 初回報告で recent-074 を「バージョン番号が誤り（v2.1.246 → v2.1.232 にすべき）」として要修正1件に計上したが、Ryoko が生 CHANGELOG を直接照合した結果、**recent-074 の現状記述「v2.1.246」は正しい**ことを確認した。CHANGELOG 本文の v2.1.246 セクションに「Added an Auto mode tab to `/permissions` for viewing and editing auto mode classifier rules」が存在し、v2.1.232 セクションには該当エントリがない（v2.1.232 は subagent forking の既定化・`@` メンション等）。担当サブエージェントの誤照合。**recent-074 は修正不要。今サイクルの要修正はゼロ。**
> 根拠URL: https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md （v2.1.246 セクション、参照日 2026-09-01）

#### 検討推奨（0件）

なし。

#### 参考（2件）

**recent-052 — spawn 上限撤廃バージョンの記述が未裏取り**

- 現状の記述: explanation「v2.1.212で導入された『1セッションあたり200個』のspawn上限は、v2.1.224で撤廃されました」
- 確認結果: 現行 sub-agents ドキュメントは「総数上限なし」と明記しており、**設問の正解（correctIndex=0）は現行仕様と一致し正しい**。ただし「v2.1.224で撤廃」という撤廃バージョンは今回の一次情報（docs 本文・最新30エントリの CHANGELOG）では直接確認できなかった。
- 根拠URL: https://code.claude.com/docs/en/sub-agents （No Total Limit 節）
- 深刻度: 参考（正解は現行仕様と整合。explanation の細かなバージョン主張のみ未裏取り）

**recent-046 — cross-session messaging の Windows バージョン差分**

- 現状の記述: 本文「v2.1.224で追加されたクロスセッションメッセージング機能」
- 確認結果: 現行ドキュメントは「requires v2.1.224 or later on macOS and Linux (incl. WSL 2). On native Windows, it requires v2.1.234 or later」。recent-046 は機能の中核（`ListAgents`/`SendMessage`、`/list-agents`（別名 `/peers`））を問うており、選択肢・正解・explanation に誤りはない。「v2.1.224で追加」は macOS/Linux 基準として正しく、修正不要。
- 根拠URL: https://code.claude.com/docs/en/cross-session-messaging
- 深刻度: 参考（誤りではない。recent 領域から外す際に Windows 差分に注意）

### 領域別 照合結果一覧

| 領域 | 照合問題数 | 要修正 | 検討推奨 | 参考 |
|---|---|---|---|---|
| recent-features | 56 | 0 | 0 | 2（recent-052, recent-046） |
| feature-usage | 81 | 0 | 0 | 0 |
| security-permissions | 82 | 0 | 0 | 0 |
| basic-operations | 77 | 0 | 0 | 0 |
| prompt-design | 79 | 0 | 0 | 0 |
| harness-design | 74 | 0 | 0 | 0 |
| **合計** | **449** | **1** | **0** | **2** |

feature-usage・security-permissions・basic-operations・prompt-design・harness-design の5領域は、事実照合の観点で現行仕様と矛盾する記述なし。特に近年動きの大きい plan mode・auto mode・サブエージェント・skills frontmatter・CLAUDE.md 階層・hooks イベント名・sandbox 挙動はいずれも最新ドキュメントと一致していることを確認済み。

## クイズ化すべき新機能の問題案（別ドキュメントで詳細管理・ここでは見出しのみ）

本レポートは陳腐化検出が主目的。新機能クイズ案の詳細（level/question/choices/correctIndex/explanation/出典URL）は Ryoko への集約報告に含める。検出された未出題トピックの見出し:

- **recent-features**: `--restricted` の設定ファイル読み込み挙動 / `PreModelSwitch`・`PostModelSwitch` フック（v2.1.251）/ `modelPricing` managed 設定（v2.1.243）/ cross-session peer メッセージの1行プレビュー折り畳み（v2.1.247）/ 組み込み "Concise" 出力スタイル（v2.1.237）
- **feature-usage**: `PreModelSwitch`/`PostModelSwitch` フック / `TaskCreated`・`TaskCompleted` フックによる品質ゲート / クロスセッションメッセージング（`SendMessage`/`ListAgents`, v2.1.236）/ `context: fork` スキルの `background: false`（v2.1.218）
- **security-permissions**: `--restricted` フラグ（v2.1.248）/ ネストした git リポジトリのワークスペーストラスト（v2.1.233）/ `PreModelSwitch`・`PostModelSwitch` フック（v2.1.251）/ シンボリックリンク差し替え（TOCTOU）へのファイルツール防御（v2.1.252）
- **basic-operations**: フルスクリーン `Ctrl+R` 逆検索の `Ctrl+S` スコープ切替 / `/cd <path>` によるセッション移動 / `/config key=value` 直接指定（v2.1.181）/ `claude --from-pr <number>`
- **prompt-design**: `AGENTS.md` を `CLAUDE.md` から `@AGENTS.md` でインポート / 組み込み "Concise" 出力スタイル / plan mode の計画が compaction をまたいでディスクから再注入される / `disable-model-invocation: true` スキルとスケジュール実行 / `/btw` とサブエージェントの使い分け基準
- **harness-design**: `isolation: worktree`（サブエージェント）/ `CLAUDE_CODE_SUBAGENT_MODEL` の挙動変更（override→default, v2.1.242）/ `subagent_type: 'fork'` の既定挙動（v2.1.232）/ 組み込み "Concise" 出力スタイル / `claudeMdExcludes` とシンボリックリンク経由ルール（v2.1.240）/ `experimental.cacheTtl`（v2.1.251）/ `permissions.disableAutoMode`

## スタイル面の気づき（`audit` モード向け・今回は対象外）

- **recent-features**: `recent-043`/`recent-052`/`recent-072` の explanation が長大（400字前後）。バージョン番号を explanation に直書きする問題（recent-044〜078 の多く）は陳腐化リスクが高く、更新時は各 explanation のバージョン番号を CHANGELOG と再照合する運用を徹底すべき（今回 recent-074 で1件検出）。cross-session messaging 系が56問中7問とやや偏り。
- **feature-usage**: `feature-065` が欠番（append 型のため実害なし、audit 時に留意）。`feature-030`/`035`/`037` は agent teams が実験的機能（`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 必須）である点に問題文・explanation で触れていない。
- **security-permissions**: `security-033`/`035`/`082` の explanation・正解選択肢が長め（quality-checklist の長さ偏り基準に近い）。`security-025` は settings-reference のスコープ列と model-config 本文で解釈が割れうる。
- **basic-operations**: `basic-044` の「Thinking Mode（拡張思考モード）」は公式用語 "extended thinking" に寄せると一次情報との一致度が上がる。77問中 statusline 関連が約20問と厚め。
- **prompt-design**: CLAUDE.md／メモリ関連が約35問と偏り。`prompt-063` と `prompt-070` で `--append-system-prompt` の同一論点が重複。
- **harness-design**: `harness-034`/`harness-059` の explanation が長い（複数の付随事実を1解説に集約）。

## 次サイクルへの申し送り

1. **対象外だった `slash-commands`・`token-efficiency` を次回優先で照合する。**
2. 今サイクルの要修正はゼロ（recent-074 は Ryoko レビューで「現状記述が正しい」と確定、初回報告の要修正1件は誤照合として取り下げ）。JSON 本体は未変更。
3. 新機能クイズ案（特に v2.1.232〜v2.1.252 由来のもの）は recent-features の replace サイクルと恒久領域への追加を Ryoko が仕分ける。
