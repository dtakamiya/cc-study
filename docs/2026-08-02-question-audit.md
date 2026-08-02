# 問題データ健全性チェック レポート

実施日: 2026-08-02
対象: `data/questions/*.json` 全229問

本レポートはデータ修正を含まない。指摘への対応可否は別途判断する。

## サマリ

| 検査 | 対象 | 検出 |
|---|---|---|
| 構造の妥当性 | 229問 | 0件 |
| 出題の偏り（`correctIndex`） | 20区分（5領域×4レベル） | 1件 |
| 出題の偏り（正解の長さ） | 229問 | 27件（うち実害ありと判断: 0件） |
| 出題の偏り（断定表現） | 229問 | 12問（うち実害ありと判断: 4問） |
| 重複出題 | 26,106ペア | 4ペア検出、**全て誤検出** |
| 読解チェック | 229問 | 2件（要修正1・検討推奨1） |
| 事実照合 | 95件のフラグ | 誤り1件・正しい71件・未照合23件 |

**要修正は1件（basic-003）のみ。** 全体として問題データの品質は高い。

既存テスト `tests/question-data.test.js` が `correctIndex` の範囲・レベルごとの問題数・`id` の一意性を検証済みで、これらは再検査していない（`node --test` は41件全pass）。

## 1. 事実誤り

### basic-003 — 基本操作・CLI使用法 / beginner

**深刻度: 要修正**

問題文: 直前の操作を中断したいときに押すキー操作はどれですか？

| | 選択肢 |
|---|---|
| **正解** | Ctrl+C |
| | Ctrl+Z |
| | Ctrl+D |
| | Esc Esc |

**何が問題か**

公式ドキュメントは Ctrl+C と Esc の両方を「中断」操作として記載している。

- `Ctrl+C`: "Interrupt, or clear input — Interrupts a running operation. If nothing is running, the first press clears the prompt input and a second press exits Claude Code"
- `Esc`: "Interrupt Claude, or close a dialog — Stop the current response or tool call mid-turn so you can redirect. Claude keeps the work done so far."

問題文「直前の操作を中断したいとき」は目的を限定していないため、Ctrl+C も Esc も正解として成立する。選択肢に単独の `Esc` は含まれていないため即座に複数正解にはならないが、**同じ問題集の basic-007 が「応答中に処理を中断し、別の指示を出したい場合」の正解を Esc としている**ため、学習者から見ると2問の間で「中断」の扱いが矛盾する。

なお誤答の `Esc Esc` は、入力欄が空のときリワインドメニューを開く操作であり中断そのものではないため、誤答としては妥当。

**根拠**: https://code.claude.com/docs/en/interactive-mode （General controls 表）

**参考: 対応の方向性**

問題文を「Claude Codeを終了せずに実行中の処理を止め、入力欄もクリアしたい場合」のように Ctrl+C に固有の効果へ限定するか、basic-007 との役割分担（Esc=応答の中断、Ctrl+C=中断と入力クリア/終了）が伝わる形に整理すると矛盾が解消する。

## 2. 出題欠陥

### basic-013 — 基本操作・CLI使用法 / expert

**深刻度: 検討推奨**

`-p` によるヘッドレス/非対話モードを expert レベルで出題しているが、**feature-044 がほぼ同じ知識を intermediate で出題している**。

- basic-013 (expert): 「スクリプトやパイプラインから非対話的に呼び出す際に使う仕組み」→ ヘッドレス/非対話モード（-pフラグ）
- feature-044 (intermediate): 「自前のスクリプトから制御したい場合に適した実行方式」→ ヘッドレスモード

同一知識が2レベルにまたがっており、どちらかのレベル設定が実態と合っていない。feature-044 は Routines との対比を含むぶん情報量が多く、basic-013 のほうがむしろ易しい。basic-013 を advanced 以下へ下げるか、expert に留めるなら「`--no-session-persistence` との組み合わせ」等より深い論点に差し替えることが考えられる。

なお両問とも事実としては正しい。

### 重複出題の検出結果（誤検出のみ）

問題文の文字bigram類似度0.5以上で4ペアが検出されたが、**いずれも重複ではない**と判断した。参考として記録する。

| 類似度 | ペア | 判断 |
|---|---|---|
| 0.818 | security-018 / security-019 | `allow` と `ask` の対比が主眼。意図的な対構成 |
| 0.588 | security-034 / security-040 | `allowManagedDomainsOnly` と `allowManagedReadPathsOnly` の別設定 |
| 0.521 | feature-005 / security-009 | MCPの「目的」と「セキュリティ観点」で問う軸が異なる |
| 0.513 | basic-029 / token-003 | `/branch` と `/usage` の別コマンド。「〜の動作/説明として正しいものは」という定型文が一致しただけ |

## 3. 偏り・スタイル

### 3-1. `correctIndex` の偏り

**深刻度: 参考情報**

20区分（5領域×4レベル）のうち、特定インデックスが50%を超えたのは1区分のみ。

| 領域 | レベル | 分布 [0,1,2,3] | 最大比率 |
|---|---|---|---|
| feature-usage | expert | [3, 6, 1, 1] | 54.5% |

出題時に選択肢はシャッフルされるため実害は小さい。他19区分は均等に近く、READMEの方針は概ね守られている。

### 3-2. 正解選択肢の長さ

**深刻度: 参考情報（実害ありと判断したものは0件）**

正解が他選択肢の平均の1.6倍超または0.625倍未満だった問題が27件（basic-001, basic-023, basic-030, basic-034〜039, basic-041, basic-046, feature-006, feature-012, feature-040, feature-041, feature-044, prompt-008, prompt-017, security-007, security-020, security-034, security-043, security-045, token-001, token-025, token-042, token-043）。

内容を確認したところ、いずれも誤答側も相応に長く、**文字数だけで正解を推測できる状態ではない**。expert級の問題は正解の説明が本質的に長くなるため、この検出は閾値による機械的なものにとどまる。対応不要と判断する。

### 3-3. 誤答の断定表現

**深刻度: 参考情報**

誤答のみに断定表現（「絶対」「一切」「常に」「すべて」「存在しない」「できない」）が2つ以上出現し、正解には無い問題が12問。うち特に消去法が効きやすいのは以下の4問。

| ID | 誤答に含まれる表現 |
|---|---|
| feature-047 | すべて / 常に / 常に / 一切（4個） |
| basic-047 | 一切 / 一切 / 常に（3個） |
| feature-016 | できない / できない |
| token-033 | 存在しない / 存在しない |

内容を知らなくても「言い切っている選択肢を消す」戦略で正解に到達しやすい。誤答を「多くの場合〜」「原則として〜」のような穏当な表現に書き換えると、推測での正解を減らせる。

残り8問（basic-007, basic-046, feature-023, prompt-026, security-008, security-043, security-044, token-042）は表現が2個以下かつ文脈上自然な用法で、影響は小さい。

## 4. 確認できなかった項目

### 4-1. 事実照合の対象外としたトピック（23件）

フェーズ3では主要12トピックに絞って照合したため、以下のトピックに属する23件は**未照合**である。誤りが無いことを確認したわけではない。

| トピック | 該当問題 |
|---|---|
| slash-commands | basic-014, basic-017, basic-029 |
| cli-flags | basic-019, basic-020, basic-031 |
| session-resume | basic-030, basic-039 |
| session-picker | basic-026 |
| resume-from-summary | basic-032 |
| platforms | basic-043 |
| skills | feature-027, feature-031, prompt-019 |
| github-action | feature-042 |
| mcp | feature-005 |
| auto-mode | security-041 |
| models | token-024 |
| effort | token-034, token-035, token-039 |
| routines | token-041 |
| context-budget | token-043 |

特に `cli-flags`（`--no-session-persistence` 等）と `slash-commands`（`/loop`、`/branch` 等）は、フラグ名・コマンド名という変更されやすい事実を問うており、優先度が高い。追加照合を行う場合はここから着手するのが有効。

### 4-2. 照合済みトピックの内訳（72件）

| トピック | 件数 | 参照した公式ドキュメント | 結果 |
|---|---|---|---|
| sandbox | 9 | code.claude.com/docs/en/sandboxing | 全件一致 |
| statusline | 7 | code.claude.com/docs/en/statusline | 全件一致 |
| hooks | 5 | code.claude.com/docs/en/hooks | 全件一致 |
| managed-settings | 5 | code.claude.com/docs/en/sandboxing | 全件一致 |
| agent-teams | 5 | code.claude.com/docs/en/agent-teams | 全件一致 |
| caching | 5 | code.claude.com/docs/en/prompt-caching | 全件一致 |
| claude-md | 5 | code.claude.com/docs/en/memory | 全件一致 |
| subagents | 5 | code.claude.com/docs/en/sub-agents | 全件一致 |
| permissions | 4 | code.claude.com/docs/en/permissions | 全件一致 |
| permission-modes | 4 | code.claude.com/docs/en/permissions | 全件一致 |
| checkpoints | 4 | code.claude.com/docs/en/checkpointing | 全件一致 |
| usage | 4 | code.claude.com/docs/en/costs | 全件一致 |
| mcp-scope | 2 | code.claude.com/docs/en/mcp | 全件一致 |
| mcp-tool-search | 2 | code.claude.com/docs/en/costs | 全件一致 |
| enterprise-spend | 2 | code.claude.com/docs/en/costs | 全件一致 |
| rules | 1 | code.claude.com/docs/en/memory | 一致 |
| background-cost | 1 | code.claude.com/docs/en/costs | 一致 |
| extended-thinking | 1 | code.claude.com/docs/en/costs | 一致 |
| interrupt-keys | 1 | code.claude.com/docs/en/interactive-mode | **誤り**（basic-003） |

数値を含む主張はいずれも公式記述と一致した。

- token-040: 「1アクティブ日あたり約13ドル、月150〜250ドル、90%が30ドル未満」→ "around $13 per developer per active day and $150-250 per developer per month, with costs remaining below $30 per active day for 90% of users"
- token-036 / prompt-039: 「plan mode時は約7倍」→ "approximately 7x more tokens than standard sessions when teammates run in plan mode"
- token-014 / prompt-034: 「CLAUDE.mdは200行以内」→ "target under 200 lines per CLAUDE.md file"
- prompt-030: 「インポートの再帰は最大4階層」→ "with a maximum depth of four hops"
- basic-037: 「Restored the code, but skipped N files」→ 同一文字列を確認
- token-008: 「1セッションあたり$0.04未満」→ "typically under $0.04 per session"

### 4-3. 検査中に取り下げた指摘

**token-001**（token-efficiency / beginner）: フェーズ2の読解時、問題文「次のセッションのコストを$0から始める」を `/clear` の効果として不正確ではないかと判断したが、公式ドキュメントに "These totals reset when `/clear` starts a new session, so the next session's total cost starts at $0" と明記されており、**記述は正確だった**。指摘を取り下げる。

## 検査範囲と限界

- フェーズ1（構造・偏り・重複）は全229問を機械的に検査した
- フェーズ2（読解）は全229問を1問ずつ読み、正解の成否・解説との整合・レベル妥当性・消去法の成立を確認した
- フェーズ3（事実照合）は全229問ではなく、フェーズ2でフラグを立てた95件のうち主要12トピック72件に限定した。公式ドキュメントの取得日は2026-08-02
- 二次情報（日本語ブログ等）は根拠として使用していない
- 本レポートは `data/questions/*.json` を変更していない
