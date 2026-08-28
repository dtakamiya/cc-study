# 問題集 陳腐化検出レポート（stale モード / 全8領域）

- **実行日**: 2026-08-28
- **モード**: `stale`（Claude Code の仕様変更による陳腐化検出）
- **対象**: `data/questions/*.json` 全8領域・計599問
  - basic-operations（77）/ feature-usage（81）/ harness-design（74）/ prompt-design（79）/ recent-features（50）/ security-permissions（82）/ slash-commands（76）/ token-efficiency（80）
- **実行方式**: 領域ごとに独立した並列サブエージェントが公式一次情報を通読し、担当領域の全問題を「事実照合」観点のみで照合。集約・保存は本レポートで実施。
- **JSON 本体は未変更**（レポート出力のみ）。

---

## 1. 参照した公式一次情報

すべて 2026-08-28 に各サブエージェントが WebFetch / WebSearch で直接取得して確認。

### 公式ドキュメント（code.claude.com/docs）

| ページ | URL |
|---|---|
| Interactive mode | https://code.claude.com/docs/en/interactive-mode |
| CLI reference | https://code.claude.com/docs/en/cli-reference |
| Checkpointing | https://code.claude.com/docs/en/checkpointing |
| Statusline | https://code.claude.com/docs/en/statusline |
| Sessions | https://code.claude.com/docs/en/sessions |
| Agent view | https://code.claude.com/docs/en/agent-view |
| Commands（組み込みコマンド一覧） | https://code.claude.com/docs/en/commands |
| Slash commands / Skills | https://code.claude.com/docs/en/skills |
| Sub-agents | https://code.claude.com/docs/en/sub-agents |
| Agent teams | https://code.claude.com/docs/en/agent-teams |
| Hooks reference | https://code.claude.com/docs/en/hooks |
| MCP | https://code.claude.com/docs/en/mcp |
| Memory（CLAUDE.md / rules / auto memory） | https://code.claude.com/docs/en/memory |
| Output styles | https://code.claude.com/docs/en/output-styles |
| Permissions | https://code.claude.com/docs/en/permissions |
| Permission modes | https://code.claude.com/docs/en/permission-modes |
| Sandboxing | https://code.claude.com/docs/en/sandboxing |
| Model configuration | https://code.claude.com/docs/en/model-config |
| Prompt caching | https://code.claude.com/docs/en/prompt-caching |
| Costs | https://code.claude.com/docs/en/costs |
| Security（ワークスペーストラスト等） | https://code.claude.com/docs/en/security |
| Managed settings | https://code.claude.com/docs/en/managed-settings |
| Tools reference | https://code.claude.com/docs/en/tools-reference |
| Artifacts | https://code.claude.com/docs/en/artifacts |
| Fast mode | https://code.claude.com/docs/en/fast-mode |
| Cross-session messaging | https://code.claude.com/docs/en/cross-session-messaging |
| Channels / Channels reference | https://code.claude.com/docs/en/channels , /channels-reference |
| Plugin marketplaces | https://code.claude.com/docs/en/plugin-marketplaces |
| Self-hosted environments | https://code.claude.com/docs/en/self-hosted-environments |
| Code Review | https://code.claude.com/docs/en/code-review |
| Goal | https://code.claude.com/docs/en/goal |
| Authentication | https://code.claude.com/docs/en/authentication |

備考: `docs.claude.com/en/docs/claude-code/*` は `code.claude.com/docs/en/*` へ 301 リダイレクト（ミラー健在、パス構造のみ変更）。

### Anthropic Engineering Blog

| 記事 | URL |
|---|---|
| Effective context engineering for AI agents | https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents |
| Building effective agents | https://www.anthropic.com/engineering/building-effective-agents |
| How we built Claude Code auto mode | https://www.anthropic.com/engineering/claude-code-auto-mode |
| Beyond permission prompts (sandboxing) | https://www.anthropic.com/engineering/claude-code-sandboxing |

いずれも 2026-08-28 時点で生存・リダイレクトなし。

### CHANGELOG / リリースノート

- Claude Code CHANGELOG: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
  - 確認時点の HEAD: **v2.1.250 / 2026-08-28**
  - recent-features は v2.1.219〜v2.1.250 を重点確認（同領域の問題内容は概ね v2.1.200〜v2.1.234 相当）

### Claude Platform Docs / Academy

- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- Claude Academy「Claude Code in Action」内「Trust It: Verifying Unsupervised Runs」

---

## 2. 検出結果サマリ

| 領域 | 問題数 | 要修正 | 検討推奨 | 参考 | 備考 |
|---|---:|---:|---:|---:|---|
| basic-operations | 77 | 0 | 0 | 0 | 版数・モデル世代まで正確に反映。矛盾なし |
| feature-usage | 81 | 0 | 0 | 9 | 参考9件は「正答は有効だが周辺仕様が詳細化」 |
| harness-design | 74 | 0 | 0 | 3 | 設計思想系は記事本文と逐語一致。バージョン注記の粒度のみ |
| prompt-design | 79 | 0 | 0 | 0 | CHANGELOG v2.1.220〜247 にも正誤を覆す変更なし |
| recent-features | 50 | 0 | **3** | 0 | Artifact 無効化キー・CSP 記述・code-review 自動起動条件 |
| security-permissions | 82 | 0 | 0 | 0 | v2.1.2xx 台の細部まで正確。矛盾ゼロ |
| slash-commands | 76 | 0 | 0 | 0 | エイリアス・バージョン要件まで現行と一致 |
| token-efficiency | 80 | 0 | **1** | 0 | token-034: デフォルトモデルの記述精度（任意） |
| **合計** | **599** | **0** | **4** | **15** | |

**「要修正」は全領域でゼロ。** JSON 本体を今すぐ書き換える必要のある陳腐化は検出されなかった。「検討推奨」4件はいずれも `correctIndex` を変えず explanation / 選択肢の精度を上げる範囲。

---

## 3. 陳腐化した問題の一覧（深刻度順）

### 検討推奨（4件）

#### recent-032 — Artifact 無効化手段の記述が非推奨キー前提

- **何が古いか**: explanation と選択肢が、Artifact 無効化手段として `disableArtifact`（設定ファイル）を現役扱い。
- **現行の正しい仕様**: 主手段は `"enableArtifact": false`（`/config` の「Artifacts」行、または設定ファイル）。`"disableArtifact": true` は **deprecated**。現行ドキュメントが挙げる経路は ①`/config` の Artifacts 行 ②`enableArtifact: false`（`disableArtifact: true` も可だが非推奨）③環境変数 `CLAUDE_CODE_DISABLE_ARTIFACT=1` ④`permissions.deny` に `Artifact` の4つ。
- **correctIndex への影響**: 正解肢（`--no-artifact` フラグ = 存在しない）は現行でも正しく、**correctIndex は維持可**。
- **根拠URL**: https://code.claude.com/docs/en/artifacts （"Disable artifacts" セクション）

#### recent-011 — Artifact の CSP 記述が現行より過度に厳格

- **何が古いか**: 正解肢と explanation が「外部ホストへのスクリプト・スタイルシート・画像の読み込みはCSPでブロックされる」と全称的に記述。
- **現行の正しい仕様**: 外部**スクリプト**は4つの公開CDN（cdnjs / Tailwind CDN / jQuery CDN / jsDelivr の `/npm/` など）から読み込み**可能**。ブロックされるのは「すべての外部画像」「許可リスト外の外部スクリプト・スタイルシート・フォント」および自オリジンと Google Fonts 以外への fetch/XHR/WebSocket。外部スタイルシートは Google Fonts のみ可。
- **correctIndex への影響**: 4肢中で当該肢が依然「最も正しい」ため correctIndex は許容できるが、表現の補正が望ましい。
- **根拠URL**: https://code.claude.com/docs/en/artifacts （"Page constraints" > "External requests"）

#### recent-070 — `/code-review` 自動起動条件の記述が緩和前のまま（軽微）

- **何が古いか**: explanation が「クラウドプロバイダ／フラグ非取得セッションでは Claude が自発的に `/code-review` スキルを起動しない」と、v2.1.246 での緩和前の挙動を記述。
- **現行の正しい仕様**: v2.1.246 以降、平易な言葉でレビューを頼まれれば Claude はスキルを自分で起動でき、`/code-review` をプロンプトに持つ scheduled task もレビューを実行する。`skillOverrides` の `user-invocable-only` は自動起動を止めつつ手動起動は残す、という点は不変。
- **correctIndex への影響**: 設問の主眼（`skillOverrides` の値）は不変のため **correctIndex は維持可**。
- **根拠URL**: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md （v2.1.246）

#### token-034 — 「日常的なデフォルトモデル = Sonnet」の断定（精度向上・任意）

- **何が古いか**: 設問・解説は「コスト効率上 Sonnet を既定に」という趣旨で公式の推奨と一致しており **誤りではない**。ただし 2026-08-28 時点の model-config では初期 `default` がアカウント種別で分岐する（Pro / Team Standard / Enterprise サブスク席 → Sonnet 5、Max / Team Premium / Enterprise pay-as-you-go / Anthropic API / Bedrock / Vertex → Opus 5）ため、「日常的なデフォルト」を一律 Sonnet と読める点に補足の余地。
- **現行の正しい仕様**: コスト削減の推奨は今も「Sonnet を既定にし、複雑なアーキテクチャ判断・多段推論のときだけ Opus」。初期 `default` はアカウント種別依存。
- **correctIndex への影響**: なし（設問の主眼はコスト効率の推奨モデル）。
- **根拠URL**: https://code.claude.com/docs/en/costs#choose-the-right-model / https://code.claude.com/docs/en/model-config#default-model-setting

### 参考（15件・修正不要）

各設問の正答自体は現行仕様と一致。周辺仕様がドキュメント側で詳細化・拡張されているもの。

| id | 内容 | 現行ドキュメントの補足 |
|---|---|---|
| feature-020 | 組み込みサブエージェント「Explore / Plan / general-purpose」 | 記述は一致。v2.1.232 で「非teammate の spawn は interactive でデフォルト background」「subagent fork がデフォルト」に変更（設問趣旨に影響なし） |
| feature-024 | MCP 3スコープ local/project/user | 正答有効。保存先は local/user=`~/.claude.json`、project=`.mcp.json`（選択肢に保存先の記述がないため実害なし） |
| feature-029 | フックハンドラ5種 command/http/mcp_tool/prompt/agent | 一致。現行はフックイベントが大幅増（Setup, PostToolBatch, PermissionRequest, SubagentStart/Stop, TaskCreated/Completed, FileChanged, ConfigChange, InstructionsLoaded 等）。設問はハンドラ**タイプ**を問うており正答は有効 |
| feature-032 | サブエージェントの `permissionMode: plan` は親が bypassPermissions/acceptEdits/auto なら親優先 | 現行ドキュメントは「親が bypassPermissions か acceptEdits → サブエージェントは継承し上書き不可」と明記。auto の扱いは明示なしだが趣旨一致 |
| feature-039 | PreToolUse `permissionDecision`: allow/deny/ask/defer | 完全一致 |
| feature-042 | 公式 GitHub Action `anthropics/claude-code-action@v1` | `@v1` が現行でも有効。変更なし |
| feature-054 | Checkpointing: 直近100スナップショット・30日・`cleanupPeriodDays` | 一致 |
| feature-056 | Ctrl+B でバックグラウンド化、tmux は2回、`/tasks` で一覧 | 完全一致 |
| feature-078 | コンパクション再添付予算: 1スキル5,000トークン・合計25,000トークン・新しい順 | 完全一致 |
| harness-058 | 組み込み既定 auto mode のバージョン要件（macOS/Linux/WSL v2.1.228+、native Windows v2.1.233+） | バージョン番号は一致。ドキュメントは追加で「feature flag のフェッチに成功したセッション」という条件も明示。解説はそこまで踏み込んでいないが誤りではない |
| harness-038 | サブエージェントのネストは既定で最大3階層、環境変数 `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | 値・環境変数名・上限到達時に `Agent` ツールを失う挙動すべて一致。ドキュメントは現在「v2.1.219+」注記を追加 |
| harness-026 | `disable-model-invocation: true` の説明 | 正確。現行は追加で「settings の `skillOverrides` に `"user-invocable-only"` で同等」「v2.1.196 以降は scheduled task のプロンプトからも発火しない」を記載 |
| basic-024（補足） | チェックポイントの誤答肢「Git 初期化されていないディレクトリでは使えない」 | 公式はチェックポイントに git 初期化を要求していない（独自スナップショット方式）。誤答として正しく機能 |
| feature-051（確認） | statusline stdin JSON のフィールド名（`model.display_name`, `cwd`, `cost.total_cost_usd`, `context_window.used_percentage` 等） | すべて現行ドキュメントと一致。誤検出だったが記録として残す |
| recent-052（確認） | 1セッションあたりのサブエージェント総数上限は撤廃 | 現行状態「総数上限なし、同時実行20・深さ3層のみ」は正しい。explanation 中の版番号（v2.1.212 導入 / v2.1.224 撤廃）は CHANGELOG 要約では明示確認できず（要留意） |

---

## 4. 監査で気づいたスタイル面の指摘

`stale` モードの担当外（`audit` モードの領分）だが、照合中に気づいた点を参考として記録する。

- **recent-032 の選択肢重複リスク**: choice 0（`disableArtifact: true`）と choice 3 は現状どちらも「ドキュメントに挙げられている無効化手段」として誤答肢が成立しているが、`disableArtifact` の非推奨化が進むと両肢の区別が曖昧になる。recent-032 を修正する際、choice 0 を「設定ファイルで `enableArtifact: false`」に置き換え、choice 3 と実質重複しないよう調整するのが望ましい。
- **prompt-019 の `argument-hint`**: 現行 skills ドキュメントの SKILL.md frontmatter 許可プロパティ一覧に `argument-hint` は含まれない（`.claude/commands/` 由来の互換フィールド）。当該設問では誤答肢かつ explanation も正しく説明しているため正誤・学習内容に問題はないが、`audit` 実行時に「SKILL.md の frontmatter を問う文脈で commands 由来フィールドを混ぜている」点を再確認する価値がある。
- **recent-052 の版番号**: explanation が「v2.1.212 で総数上限200を導入し v2.1.224 で撤廃」と具体的な版番号を挙げているが、今回の CHANGELOG 照合では該当記述を明示確認できなかった。現行状態（上限なし）は正しいので設問は成立するが、`audit` で版番号の出典を突き止めるか、版番号への言及を外すか検討したい。
- 全体として、この問題集は版数（v2.1.186 / v2.1.211 / v2.1.221 等）とモデル世代（Opus 4.8 / Sonnet 5 / Fable 5 / Mythos 5）を設問・解説に明示的に織り込む方針で書かれており、`stale` 照合の観点では非常に精度が高い。

---

## 5. クイズ化すべき新機能の問題案（stale 照合中に抽出）

`stale` モードの範囲外（新規作成は `add` モードの領分）だが、照合の過程で「現行仕様に存在するが問題集が未カバー」と判明した項目を、次回の `add` 実行の入力候補として記録する。詳細な問題案（level / question / choices / correctIndex / explanation / 出典）はチャットの報告に添付。

### recent-features（replace 型・優先度高）

| 案 | level | トピック | 出典 |
|---|---|---|---|
| A | beginner | `claude --restricted` フラグ（v2.1.248、実行系ツール+WebFetch を明示許可なしで除去、bypassPermissions も拒否） | CHANGELOG v2.1.248 / cli-reference |
| B | intermediate | `/permissions` の Auto mode タブ（v2.1.246、分類器ルールの閲覧・編集） | CHANGELOG v2.1.246 |
| C | intermediate | `modelPicker` 設定（v2.1.243、`/model` ピッカーの絞り込み） | CHANGELOG v2.1.243 |
| D | advanced | cross-session `SendMessage` の `notify_when_idle`（v2.1.236、ワンショット・同一マシン限定） | CHANGELOG v2.1.236 / cross-session-messaging |
| E | advanced | cross-session messaging のプロバイダ拡大（v2.1.248、Bedrock/Agent Platform/Foundry・per-session ソケット） | CHANGELOG v2.1.248 / cross-session-messaging |
| F | expert | `headersHelper`（v2.1.238、マーケットプレイス取得時に時間制限付き HTTP ヘッダーを生成） | CHANGELOG v2.1.238 |

### basic-operations

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | `keybindingFlavor: "readline"`（GNU readline 流の編集キー、v2.1.238+） | interactive-mode |
| 2 | beginner | セッションのデフォルト表示名（`my-app-3f` 形式、再開ハンドルではなく識別用、v2.1.196+） | sessions |

### feature-usage

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | Concise 出力スタイル（v2.1.237、結論ファースト・作業の徹底度は Default 同等） | output-styles |
| 2 | advanced | agent teams でサブエージェント定義を再利用する際の適用範囲（tools/model/本文は適用、skills/mcpServers は非適用） | agent-teams |
| 3 | expert | フックの PostToolBatch イベント（並列バッチ解決後・次のモデル呼び出し前にループ停止可） | hooks |
| 4 | intermediate | `claude mcp list` の状態表示（Connected / Needs authentication / Failed / Pending approval / Disabled / cached。「Rate limited」は存在しない） | mcp |

### harness-design

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | Manual モード（旧 `default` のラベル変更、v2.1.200+。設定値は `default` のまま、`manual` はエイリアス） | permission-modes |
| 2 | beginner | Concise 組み込み出力スタイル（v2.1.237） | output-styles |
| 3 | advanced | `InstructionsLoaded` フックによる指示ファイル読み込みのデバッグ | memory / hooks |
| 4 | expert | auto mode 分類器が信頼する git リモートの範囲（v2.1.200+、セッション開始時点のリモートのみ） | permission-modes |

### prompt-design

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | Concise 出力スタイル（システムプロンプト改変で毎ターン適用、v2.1.237） | output-styles |
| 2 | advanced | `/goal` 実行中にバックグラウンド作業がある場合の評価タイミング（そのターンの評価をスキップ、次のアイドルターン終了時に評価、チェックイン間隔は倍々バックオフ） | goal |

### security-permissions

| 案 | level | トピック | 出典 |
|---|---|---|---|
| A | advanced | auto-allow サンドボックスの plan モード例外（v2.1.212+、plan では auto-allow が承認範囲を広げない） | sandboxing |
| B | expert | critical paths のサーキットブレーカー（`rm`/`rmdir` がルート・ホーム・cwd 等を対象なら allow ルール／hook allow でも承認されない） | permission-modes |
| C | intermediate | サンドボックス承認プロンプトからの auto mode 切り替え（v2.1.247+、「Yes, and switch to auto mode」） | permission-modes |

### slash-commands

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | `/teleport`（Web セッションをターミナルに引き込む、v2.1.224） | commands / CHANGELOG |
| 2 | advanced | `/background`（エイリアス `/bg`、現セッションをバックグラウンドエージェント化） | commands |
| 3 | intermediate | `/config` の Concise 出力スタイル（v2.1.237） | CHANGELOG |
| 4 | advanced | `/list-agents`（エイリアス `/peers`、サブエージェント・チームメイト・他セッションを一覧、v2.1.224） | commands |
| 5 | expert | `${CLAUDE_EFFORT}` と ultracode（ultracode は独立レベルでなく `xhigh` として報告） | skills |
| 6 | advanced | MCP discovery cache の既定変更（v2.1.238 より前は既定有効、以降は既定無効） | mcp |

### token-efficiency

| 案 | level | トピック | 出典 |
|---|---|---|---|
| 1 | intermediate | effort レベルの拡張（low/medium/high/xhigh/max + Claude Code 設定の ultracode） | model-config |
| 2 | advanced | `ENABLE_TOOL_SEARCH` の設定値と挙動（未設定=全 defer / false=全 upfront / auto=10%閾値 / auto:N） | mcp |
| 3 | expert | 長時間セッションでアイドル時にトークンを消費する要因（goal check-ins を含む。MCP ツール定義の定期再送は含まれない） | costs |
| 4 | expert | プロンプトキャッシュ TTL 制御の優先順位（`FORCE_PROMPT_CACHING_5M` → バケット環境変数 → バケット設定キー → `ENABLE_PROMPT_CACHING_1H` → 既定） | prompt-caching |
| 5 | advanced | `/usage` の Loops 行（重い `/loop` 等スケジュールタスクを合計トークン順に列挙、v2.1.242+） | costs |

---

## 6. 横断チェック

- `grep -rn "recent-0" data/questions/`（recent-features.json 以外）→ **他ファイルからの `recent-*` id 参照ゼロ**。recent-features.json 内の explanation にも `recid 参照` の相互参照なし。→ replace 型領域で問題を削除・改番しても波及リスクなし。
- `nextIdSeq`（recent-features.json = 73）は本レポートでは一切変更していない。

---

## 7. 結論

- **599問中、JSON 本体の即時修正を要する陳腐化（要修正）はゼロ。**
- **検討推奨 4件**（recent-032 / recent-011 / recent-070 / token-034）はいずれも `correctIndex` を変えず explanation・選択肢の精度を上げる範囲。次回の PR で対応を検討。
- 新機能の未カバー領域は多数あり（特に recent-features は replace 型のため優先度高）。次回 `add` モード実行時の入力候補として §5 に整理。
- この問題集は版数・モデル世代を設問に織り込む方針で維持されており、`stale` 照合の観点では極めて高い精度を保っている。
