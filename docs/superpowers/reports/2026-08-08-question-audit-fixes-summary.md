# 問題集監査指摘への対応 サマリ

- 実施日: 2026-08-08
- 入力: `docs/superpowers/reports/2026-08-08-question-audit-all.md`
- 設計: `docs/superpowers/specs/2026-08-08-question-audit-fixes-design.md`
- 計画: `docs/superpowers/plans/2026-08-08-question-audit-fixes.md`

## 対応した内容

### A. 事実誤り修正（4件・4問）

| id | 修正内容 | 根拠URL |
|---|---|---|
| `feature-043` | 「Claude Code SDK」→「Claude Agent SDK（旧Claude Code SDK）」 | https://code.claude.com/docs/en/agent-sdk/overview |
| `token-043` | ツール結果の上限を「文字数と割合のいずれか小さい方」から「ツール別の絶対値（Bash 約30,000文字 / MCP 既定25,000トークン、`MAX_MCP_OUTPUT_TOKENS` で変更可、10,000トークン超で警告）」に修正 | https://code.claude.com/docs/en/tools-reference , https://code.claude.com/docs/en/mcp |
| `prompt-043` | 解説の「原則の一つに『goals over steps』がある」という公式性の断定を削除 | 公式ドキュメント・Engineering Blog に該当語なし（2026-08-08 監査で確認） |
| `prompt-044` | 解説の「原則の一つ『partition without overlap』」を緩和。**加えて設問文からも同造語を削除**（下記「特記事項」参照） | 同上 |

### B. 文字数偏り是正（23問）

| 領域 | 修正前 | 修正後 | 差分 |
|---|---|---|---|
| harness-design | 28件 | 15件 | advanced 13件が消滅。残る15件の内訳は beginner 7 + intermediate 8（いずれも本計画の対象外） |
| token-efficiency | 11件 | 2件 | 対象9件が消滅。残るは `token-001`（比率0.60）と `token-025`（比率0.58）のみ |
| prompt-design | 6件 | 5件 | `prompt-017` が消滅 |
| basic-operations | 15件 | 15件 | 対象外・変化なし |
| feature-usage | 11件 | 11件 | 対象外・変化なし（`feature-043` は元から一覧外） |
| security-permissions | 8件 | 8件 | 対象外・変化なし |
| slash-commands | 13件 | 13件 | 対象外・変化なし |
| **合計** | **92件** | **69件** | 全448問中 15.4% |

各問題の修正前後の詳細な比率は本文書「B. 文字数偏り是正」節の表を参照。個別の比率計算は Subagent-Driven Development の各タスクレビューで実装者と独立に再計算・検証済み（作業ワークスペースはマージ時に削除済みのため、レビューの生記録はこのブランチの履歴には残らない）。

### C. id 欠番の規則明文化

`.claude/skills/question-bank-update/references/json-schema.md` に「欠番の扱い」節を追加。既知の欠番は `prompt-064`・`feature-065`。

## 特記事項

### `prompt-044` の設問文変更は計画の Global Constraints に対する意図的な例外

計画書は「`question`（設問文）を変更しない」という制約を定めていたが、`prompt-044` の設問文自体が「『partition without overlap（重複なく分割する）』という原則が」と、公式には存在しない造語を名前付き原則として提示していた。解説だけを修正すると事実誤りが設問文に半分残ってしまうため、**ユーザーの判断で設問文も修正した**。

- 修正前の設問文（造語を含む）: 「『partition without overlap（重複なく分割する）』という原則が」を含む文
- 修正後の設問文: 「複数のサブエージェントにタスクを分割する際、担当範囲を重複させずに分割するという考え方が重視される理由はどれですか？」

### 計画書の見積もりの誤りが1件判明

計画書 Task 4 Step 3 は「`feature-043` は誤答を触らなくても比率1.44で範囲内」としていたが、**実測は比率1.82で上限超過**しており、誤答の調整が別途必要だった。

教訓: `question-bank-update` スキルに `fix` モードを追加する際は、比率の事前計算を人手の目算に頼らず、コマンドで検証する手順をワークフローに組み込む必要がある。

### 是正の方向性が計画の目標値と異なった点

計画は「比率1.4以下を目標」としていたが、実績は以下の通り、誤答が正解と同等かやや長くなる方向に着地した。

- harness-design: 比率 0.745〜1.09
- token-efficiency: 比率 0.90〜1.38
- prompt-017: 比率 1.17

一部（`harness-034`/`harness-041`/`harness-043` が比率 0.745〜0.768）は下限0.625に寄っており、**将来これらの正解を短縮すると下限警告（誤答が正解より長すぎる）に触れるリスク**がある。

## 検証結果

- `node --test`: tests 101 / pass 101 / fail 0（4テストスイート合計）
- 文字数偏りの警告: 92件 → **69件**（全448問中 15.4%）
- 総問題数: **448問**（変化なし。basic-operations 64 / feature-usage 65 / harness-design 60 / prompt-design 65 / security-permissions 68 / slash-commands 62 / token-efficiency 64）
- 造語 `goals over steps` / `partition without overlap` の残存: **0件**（`data/questions/` 全体）
- 追加行に含まれる極端な断定（「一切」「絶対に」「存在しない」「必ず」）: **0件**
- `Claude Code SDK` の単独表記: `feature-usage.json` に2件だが、いずれも「旧Claude Code SDK」「かつてClaude Code SDKと呼ばれていたもの」という意図した旧称への言及であり問題なし
- 問題データ・スキーマの差分: `.claude/skills/question-bank-update/references/json-schema.md`（+16）/ `data/questions/feature-usage.json`（±10）/ `data/questions/harness-design.json`（±78）/ `data/questions/prompt-design.json`（±16）/ `data/questions/token-efficiency.json`（±34）の5ファイル、計 +85/-69。このサマリ文書自体を含むPR全体の差分は `git diff main...worktree-question-audit-fixes --stat` を参照

## 残した課題

- 他4領域の文字数偏り: basic-operations 15件 / feature-usage 11件 / security-permissions 8件 / slash-commands 13件
- harness-design の beginner/intermediate 15件（特に `harness-021` 比率3.33、`harness-024` 比率3.31、`harness-007` 比率0.33）
- prompt-design の対象外5件（`prompt-057`/`prompt-062`/`prompt-053`/`prompt-065`/`prompt-008`）
- `token-001`（比率0.60、`/clear` を答える形式で構造的に不可避）・`token-025`（比率0.58）
- 知識重複4件: `feature-027`/`063`、`harness-008`/`015`、`slash-050`/`051`、`slash-018`/`029`
- 解説の先出し・精度に関する指摘9件: `harness-013`、`slash-014`、`basic-003`、`basic-052`、`basic-014`、`feature-052`、`feature-030`、`security-024`、`token-045`
- `question-bank-update` スキルへの `fix` モード追加
- `quality-checklist.md` の「ドメイン×レベル単位（20区分）」が6領域時代の記述で、現在の7領域28区分に未追従
- 各タスクレビューが挙げた Minor 指摘（下記）

### 各タスクレビューの Minor 指摘

- `harness-041[1]` が「allowed-tools フィールド自体が存在せず」という不在の断定に依存
- `harness-034[0]` だけ「settings.jsonの」で始まり、managed 専用性を問う設問で文型がずれる
- `harness-036` の誤答3つが同型の肯定形の結び、正解だけ否定形
- `token-056[1]`（MCP 遅延ロード）は単体では真で、設問文脈でのみ誤り
- `token-055` の架空ダイアログラベルは将来 UI 追加で真になるリスク
- `token-039` は4択すべて99〜153字で読み負荷が高い
- `prompt-017[3]` だけ括弧書き補足を持ち、括弧の有無が表層的な手がかり
- `prompt-044[2]` の「原則であるため」が設問文から「原則」が消えて照応がやや浮く
- `feature-043[1]`「カスタムスラッシュコマンド（Skills機能）」は公式の統合方針（"custom commands have been merged into skills"）と整合するが紛らわしい
- `feature-043[2]`「カスタムステータスライン（Status Line機能）」は日英同語反復で情報量がない
- `json-schema.md` の追記「採番は常に既存最大連番+1」が直前の既存記述と重複
