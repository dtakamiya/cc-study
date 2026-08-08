# 問題集監査レポート（全領域）

- 実行日: 2026-08-08
- モード: `audit`（既存問題の監査）
- 対象領域: 全7領域（basic-operations / feature-usage / harness-design / prompt-design / security-permissions / slash-commands / token-efficiency）
- 検査観点: 構造の妥当性 / 出題の偏り / 重複出題 / 読解チェック / 事実照合
- 本モードでは `data/questions/*.json` を一切変更していません

## 全体サマリ

| 領域 | 問題数 | beginner | intermediate | advanced | expert | 要修正 | 検討推奨 | 参考情報 |
|---|---|---|---|---|---|---|---|---|
| basic-operations | 64 | 16 | 16 | 19 | 13 | 0 | 2 | 3 |
| feature-usage | 65 | 11 | 18 | 21 | 15 | 1 | 4 | 3 |
| harness-design | 60 | 15 | 15 | 15 | 15 | 0 | 3 | 2 |
| prompt-design | 65 | 11 | 18 | 20 | 16 | 2 | 3 | 2 |
| security-permissions | 68 | 10 | 19 | 19 | 20 | 0 | 1 | 2 |
| slash-commands | 62 | 15 | 15 | 16 | 16 | 0 | 4 | 2 |
| token-efficiency | 64 | 11 | 15 | 22 | 16 | 1 | 4 | 3 |
| **合計** | **448** | 89 | 116 | 132 | 111 | **4** | **21** | **17** |

### 構造の妥当性 — 全領域クリア

- **ドメイン間id重複: 0件**（全448問を `jq` で集約検査、専用サブエージェントが実施）
- ドメイン内id重複・命名規約違反・必須フィールド欠落・`choices`要素数・選択肢内重複・`correctIndex`範囲・`level`値・レベル別10問以上制約 — 全領域で違反ゼロ
- `correctIndex`分布: 全28区分（7領域×4レベル）で50%閾値超えなし。最大は prompt-design の advanced（index=1 が 50%ちょうど）

---

## 要修正（4件）

### 1. `feature-043`（feature-usage / advanced）— 廃止された製品名を正解にしている

- **何が問題か**: 正解選択肢が「Claude Code SDK」。この SDK は **Claude Agent SDK** に改称済みで、現行公式ドキュメントに「Claude Code SDK」という名称は存在しない
- **なぜ問題か**: 公式のブランディングガイドラインは、SDK 利用製品について "Claude Code" / "Claude Code Agent" の呼称を明示的に禁止している。陳腐化した名称を「正しいもの」として学習させてしまう
- **根拠**: [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)。パッケージ名も `claude-agent-sdk-typescript` / `claude-agent-sdk-python`
- **推奨対応**: 正解選択肢と解説を「Claude Agent SDK（旧Claude Code SDK）」に改める

### 2. `token-043`（token-efficiency / expert）— ツール結果の上限に関する記述が公式と不一致

- **何が問題か**: 正解選択肢が「一定の文字数**またはコンテキストウィンドウに対する割合のいずれか小さい方**」としているが、この機構は公式ドキュメントに存在しない。実際の上限は純粋な絶対値
  - Bashツール: 正常終了は約30,000文字（`BASH_MAX_OUTPUT_LENGTH` 既定30,000／上限150,000）、失敗時は約10,000文字
  - MCPツール: 既定25,000トークン（`MAX_MCP_OUTPUT_TOKENS`）、10,000トークン超で警告
- **なぜ問題か**: 検証可能な事実の誤りが正解として提示されているため、正しい知識を持つ受験者が誤答する
- **根拠**: [Tools reference](https://code.claude.com/docs/en/tools-reference) / [MCP](https://code.claude.com/docs/en/mcp)
- **推奨対応**: 「ツールごとに絶対値の出力上限（Bashは約30,000文字、MCPは既定25,000トークン）が設けられている」等に置き換える

### 3. `prompt-043` / `prompt-044`（prompt-design / expert）— 公式に存在しない用語を「原則」として断定

- **何が問題か**: 解説が「タスク分解の原則の一つに『goals over steps』があります」「タスク分解の原則の一つ『partition without overlap』は〜」と、公式に定義された名前付き原則であるかのように断定している。公式ドキュメント（best-practices / sub-agents / agent-teams / agents / workflows）および Engineering Blog を確認した範囲で、この2語がそうした名前付き原則として登場する記述は見つからなかった
- **なぜ問題か**: 概念自体に近い記述は公式にもある（agent-teams「Avoid file conflicts: Break the work so each teammate owns a different set of files」）が、引用符付きの固有名詞として提示すると出典不明の造語を公式用語と誤認させる
- **根拠**: [Best practices](https://code.claude.com/docs/en/best-practices) / [Agent teams](https://code.claude.com/docs/en/agent-teams) — いずれにも該当語なし
- **推奨対応**: 解説を「〜という考え方」等に緩めるか、出典を特定して明記する

### 4. `prompt-064` が欠番（prompt-design）

- **何が問題か**: `prompt-063` の次が `prompt-065` で、id連番に穴がある
- **なぜ問題か**: `json-schema.md` は「既存最大連番の次の番号を3桁ゼロ埋めで採番」と規定しており、欠番は削除事故または採番ミスの痕跡。次回追加時に `prompt-064` を誤って再利用すると混同リスクがある。既存テストは一意性しか見ないため機械検出されない
- **根拠**: `.claude/skills/question-bank-update/references/json-schema.md`
- **関連**: `feature-usage` にも `feature-065` の欠番あり（下記「参考情報」参照）

---

## 検討推奨（21件）

### A. 正解選択肢の文字数偏り — 全領域横断・最大の系統的課題

`quality-checklist.md` の閾値（正解／他選択肢平均が1.6倍超 または 0.625倍未満）に該当する問題が **全領域で計約90問**。文字数だけで正解が推測できる状態です。

| 領域 | 該当数 | 特に顕著な例 |
|---|---|---|
| harness-design | **28問（47%）** | `harness-021` 3.33倍 / `harness-024` 3.31 / `harness-040` 3.25。**advanced では15問中13問** |
| slash-commands | 13問 | `slash-042` 3.08倍 / `slash-032` 2.95。**13件中8件が advanced** |
| basic-operations | 15問 | `basic-035` 2.31倍 / `basic-054` 2.28 / `basic-060` 2.24 |
| feature-usage | 11問 | `feature-063` 2.12倍 / `feature-040` 1.98 / `feature-038` 1.97 |
| token-efficiency | 11問 | `token-055` **4.56倍** / `token-039` **3.79** |
| security-permissions | 8問 | `security-057` 2.32倍 / `security-054` 2.22 |
| prompt-design | 6問 | `prompt-017` 0.41倍（正解が極端に短い）/ `prompt-057` 1.81 |

**共通パターン**: 正解が「正確な定義を全部書いた長い選択肢」、誤答が「短い断定」という書式が固定化しており、内容を理解していなくても最長選択肢を選べば正答できてしまう。

**具体的な改善方向**:
- harness-design の **expert帯（046〜060）は偏りゼロ**であり、誤答も同程度に長く書かれている。この書き方を advanced 以下に適用するのが最も明快な指針
- token-efficiency は `token-054`〜`token-064` の後半11問のうち6問が基準外。既存の `token-001`〜`token-053` は誤答を長めに揃える設計になっているのに対し、後半帯にこの観点が適用されていない
- `prompt-017` は正解0.41倍かつ誤答3つがすべて「自動では読み込まれず〜のみ」型の否定＋限定表現で、**文字数と文型の両面から消去法で特定できる**。優先度が高い
- コマンド名を答える形式（`basic-001` の `claude`、`token-001` の `/clear`、`slash-012` の `/permissions`）は構造的に不可避で実害は小さい

### B. 実質的な知識重複（4件）

| 対象 | 領域 | 内容 |
|---|---|---|
| `feature-027`(int) × `feature-063`(exp) | feature-usage | 両者の正解の核（「ユーザーは `/スキル名` で呼べるが Claude の自動呼び出しは不可」）が完全同一。`feature-063` は `user-invocable: false` の知識を必要とせず `disable-model-invocation` だけで正答できる。`feature-063` を `user-invocable` 側に判別の重心が寄る出題へ振り直すのが望ましい |
| `harness-008` × `harness-015`（ともにbeginner） | harness-design | ともに「CLAUDE.mdの指示は強制力がない／パーミッション設定はクライアント側で強制される」という同一知識に帰着。beginner 15問の知識カバレッジが実質14問分に目減り |
| `slash-050` × `slash-051`（ともにexpert） | slash-commands | 問題文の構造も正解の内容（「非対話モードでも利用でき、v2.1.205以降が必要」）もほぼ同一。片方を `/rename` 固有（名前200文字上限・制御文字置換、v2.1.221以降）や `/color` 固有（Remote Control 時に claude.ai/code へ同期）の知識へ振り替えると差別化できる |
| `slash-018` × `slash-029`（ともにintermediate） | slash-commands | `slash-018` の**解説**と `slash-029` の**正解**がともに「既定30日・`cleanupPeriodDays`」を扱う。`slash-018` の解説から保持期間の記述を削るのが簡潔 |

### C. 解説が他問題の正解を先出し／解説の精度（6件）

| 対象 | 領域 | 内容 |
|---|---|---|
| `harness-013`(beginner) | harness-design | 解説末尾の「`paths`を指定しないルールは`.claude/CLAUDE.md`と同じ優先度で起動時に読み込まれます」が `harness-022`(intermediate) の正解と完全一致。013 の正解根拠としては不要な一文なので削除で解消 |
| `slash-014`(beginner) | slash-commands | 解説に「v2.1.144以降、バックグラウンドセッションはピッカー内で`bg`と表示され…`claude agents`からアタッチするか停止してください」という expert 級の詳細が含まれる。正解判定に不要なため削るか `slash-040` 側へ移す |
| `basic-003`(beginner) | basic-operations | 問題文は「入力欄に書きかけのテキストがあるとき」を設定しているのに、解説は「`Esc`2回は**入力欄が空のとき**リワインドメニューを開く」と逆の状況を説明。実際その状況下では `Esc Esc` も下書きをクリアするため、区別できるのは「2回目でも終了しない」点のみ。解説をその差分の説明に補正すべき。根拠: [Interactive mode](https://code.claude.com/docs/en/interactive-mode) |
| `feature-052`(expert) | feature-usage | 「サブエージェントは通常継承しない」の hedge は誤りではないが、公式には **fork は例外**（親のシステムプロンプト全体を継承）という明示的な除外規定がある。expert級としては一文追加が望ましい。根拠: [Output styles](https://code.claude.com/docs/en/output-styles) |
| `feature-030`(advanced) | feature-usage | agent teams を既定で使える機能のように扱っているが、実際は `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` を設定しない限り既定で無効。正解内容自体は正しいが、実験的機能は仕様変更リスクが高く `stale` 監査での再検証頻度を上げる必要がある（`feature-035`・`feature-037` も同カテゴリ）。根拠: [Agent teams](https://code.claude.com/docs/en/agent-teams) |
| `token-045`(advanced) | token-efficiency | 問題文の「目安として60%程度」というコンテキスト使用率の閾値が公式に確認できない。公式が示すのは auto-compact ウィンドウ（トークン数指定）であり割合ベースの推奨閾値ではない。定性表現に置き換えるか出典を特定すべき。根拠: [Context window](https://code.claude.com/docs/en/context-window) |

### D. `correctIndex` 分布の境界値（1件）

- `prompt-design` の advanced が20問中10問（**50.0%ちょうど**）で `correctIndex: 1`。閾値ちょうどに到達しており、次回 advanced 追加時は index=1 以外を優先すべき

---

## 参考情報（17件・修正不要または優先度低）

### id欠番（2件）

- `feature-065` が欠番（`feature-001`〜`064` と `feature-066`）。次の新規問題は `feature-067` を使うのが安全
- `prompt-064` の欠番は上記「要修正4」を参照

### 誤答選択肢の断定表現

「〜できない」「〜は存在しない」型の極端な断定を含む誤答が各領域に散見（basic-operations 7問、harness-design 6問、prompt-design 8問、slash-commands 数問）。ただしいずれも4択中1つに留まるか、技術的に明確な誤りを表現した意図的な設計であり、消去法が成立する密度には達していません。優先度は低いものの、中級以上（`basic-015`・`basic-055` 等）はより具体的な誤答への差し替え余地があります。

### 事実面の軽微な補足（3件）

| 対象 | 内容 |
|---|---|
| `basic-052`(advanced) | 問題文・解説が `/doctor` の診断項目として「重複したサブエージェント名」を挙げるが、公式には「duplicate or leftover installs（重複・残存インストール）」しかない。正解選択肢の内容自体は公式と完全一致しており**正誤判定には影響しない**が、「重複または残存したインストール」に置き換えるのが安全 |
| `basic-014`(expert) | 解説の「`/loop` は新しい会話を始めると停止します」は正しいが、公式は同時に「`--resume`/`--continue` で再開すると未期限のタスクは復元される」とも明記（7日で自動失効）。expert級としてはこの復元挙動に触れると精度が上がる |
| `security-024`(intermediate) | acceptEdits の自動承認コマンド列挙が `mkdir`・`touch`・`mv`・`cp` で、公式の完全リスト（`mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp`, `sed`）から `rm`・`rmdir`・`sed` が漏れている。「など」で締めているため誤りではないが、**`rm` が acceptEdits で自動承認対象である点は安全性上の重要事実**であり明示する価値がある |

### 重複ではないと判定したペア（多数）

各領域で類似度の高いペアを検出しましたが、以下はいずれも `quality-checklist.md` が明示的に許容する「意図的な対構成」に該当し、**実質的な重複出題は全領域でゼロ**でした。

- `security-018`(allow) / `security-019`(ask) — チェックリストが例示する対比構成そのもの
- `security-034`(`allowManagedDomainsOnly`) / `security-040`(`allowManagedReadPathsOnly`) — 同じくチェックリストの例示そのもの
- `basic-029` / `basic-057`（`/branch` vs `/btw`）、`basic-029` / `basic-054`（`/branch` 単体 vs `/fork` との対比）
- `harness-039` / `harness-040`（`context: fork` 単体 vs `skills` フィールドとの対比） — 公式ドキュメントも同じ2方向の表で説明
- `feature-059`(UserPromptSubmit) / `feature-066`(Notification) — 異なるフックイベント
- `token-016` / `token-026`（MCP接続時のコンテキスト影響 vs tool search 有効時のツール定義扱い）
- `token-041` / `token-042`（Routines の同定 vs ヘッドレスモードとの使い分け）
- `slash-commands` は類似度0.5超のペアを52組検出したが、すべて「〜として正しいものはどれですか」等の定型文一致

多くの高類似度は問題文の定型表現に起因するもので、問う対象は明確に異なります。

### `correctIndex` の細部

- `token-efficiency` の expert 16問で `correctIndex=3` が0件（分布 0/4/5/7）。出題時にシャッフルされるため実害なし

---

## 事実照合の結果 — 極めて健全

**448問中、事実誤認として検出されたのは3件のみ**（`feature-043`、`token-043`、`prompt-043`/`044`）でした。各領域のサブエージェントが公式ドキュメントを直接フェッチして突き合わせた結果、以下が確認されています。

- **バージョン番号の追従精度が高い**: v2.1.73 / 91 / 144 / 161 / 169 / 172 / 181 / 191 / 198 / 205 / 206 / 211 / 212 / 216 / 217 / 218 / 219 / 221 など細かなバージョン境界が正確に反映されている
- **直近の仕様変更に追従できている**: v2.1.219 でのサブエージェントネスト深さ変更（5→1→3）、v2.1.218 での forked skill のバックグラウンド化、v2.1.218 での `/status` からの API usage 分離、v2.1.211 での `/clear` リセット挙動変更
- **間違えやすい仕様も正確**: `slash-062` の `$N` が**0始まり**、`basic-034` の `used_percentage` が output_tokens を含まない、`security-064` のシンボリックリンクで allow は両方一致・deny は片方一致、`harness-032` の Windows managed settings パス（`C:\ProgramData\` は v2.1.75 で廃止済みで、正しい `C:\Program Files\ClaudeCode\` を採用）
- **Engineering Blog 由来の記述も原文レベルで一致**: `prompt-066` のツール設計指針、`token-046`〜`050` の attention budget / context rot / progressive disclosure、`security-046`〜`051` の auto mode 2層防御・3連続/通算20回エスカレーション

**主に照合した情報源**:
- https://code.claude.com/docs/en/commands
- https://code.claude.com/docs/en/settings
- https://code.claude.com/docs/en/memory
- https://code.claude.com/docs/en/permissions / permission-modes
- https://code.claude.com/docs/en/sandboxing / sandbox-environments / security
- https://code.claude.com/docs/en/skills / sub-agents / agent-teams
- https://code.claude.com/docs/en/hooks / mcp / managed-mcp
- https://code.claude.com/docs/en/checkpointing / sessions / context-window
- https://code.claude.com/docs/en/costs / prompt-caching / model-config
- https://code.claude.com/docs/en/statusline / interactive-mode / cli-reference / headless / output-styles / tools-reference
- https://platform.claude.com/docs/en/build-with-claude/prompt-caching
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.anthropic.com/engineering/claude-code-auto-mode

---

## 検査範囲と限界

- **全7領域・全448問**を対象に、構造・偏り・重複・読解・事実照合の5観点で検査しました
- ドメイン間id重複は専用サブエージェントが全448問を集約して検査し、**0件**を確認しています
- `harness-design` の expert帯（046〜057）にある Engineering Blog 由来の問題群については、公式ドキュメント側からの間接的な整合性確認にとどまり、ブログ本文の逐語照合は行っていません
- 実験的機能（agent teams 等）を扱う問題は仕様変更リスクが高く、次回以降の `stale` モードでの重点確認対象です

## 推奨アクション（優先度順）

1. **要修正4件の対応** — `feature-043`（Claude Agent SDK への改称）、`token-043`（ツール出力上限の記述訂正）、`prompt-043`/`044`（出典不明の「原則」名の緩和）、`prompt-064` 欠番の扱い決定
2. **選択肢の文字数偏りの是正** — まず harness-design の advanced（15問中13問）と token-efficiency の後半帯（`token-054`〜`064`）から着手。harness-design の expert帯の書き方が手本になる
3. **解説の先出し・過剰記述の整理** — `harness-013`、`slash-014`、`slash-018` の該当箇所削除（各1文で完結）
4. **知識重複の解消** — `feature-063`、`harness-008`/`015`、`slash-050`/`051` の出題軸の振り直し
5. **解説の精度向上** — `basic-003`、`basic-052`、`basic-014`、`feature-052`、`feature-030`、`security-024`、`token-045`

いずれも `audit` モードの指摘であり、対応要否の判断はユーザーに委ねられます。
