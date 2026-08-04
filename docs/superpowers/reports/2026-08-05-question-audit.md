# 問題データ監査レポート（question-bank-update スキル `audit` モード）

実施日: 2026-08-05
対象領域: `basic-operations`（動作確認のための領域限定実行）

本レポートは `question-bank-update` スキルの動作確認を兼ねて、`audit` モードを
`basic-operations` 領域限定で試験実行した結果である。データ修正は含まない。

## basic-operations（基本操作・CLI使用法）

### 検査範囲
47問全問に対し、以下の観点で検査した。

- 構造の妥当性: id重複（ドメイン内・全ドメイン間）、id命名規約（`basic-NNN`形式・連番）、必須フィールド欠落・空文字、choices要素数、choices重複、correctIndex範囲、level値の妥当性、レベルごとの問題数
- 出題の偏り: 正解選択肢の長さ偏り（1.6倍超/0.625倍未満）、correctIndexの分布偏り（レベル×4区分で集計）、誤答選択肢の断定表現
- 重複出題: 問題文・解説の文字bigram類似度による類似ペア検出
- 読解チェック: 全47問を通読し、正解の複数成立・正解の誤り・問題文と解説の矛盾・レベル配置の妥当性を確認
- 事実照合: CLIフラグ・スラッシュコマンド・ステータスライン仕様・チェックポイント（rewind）仕様など、検証可能な事実を問う問題について `https://code.claude.com/docs` の該当ページ（statusline、cli-reference、checkpointing、sessions）をWebFetchで裏取り

### 指摘

#### 要修正
なし。

#### 検討推奨

1. **正解選択肢の長さ偏り（複数問、出題の偏り観点）**
   - 何が問題か: 機械的な閾値（正解/他選択肢平均の比が1.6倍超または0.625倍未満）に該当する問題が11問ある。特に顕著なのは以下。
     - `basic-035`（ratio 2.31）、`basic-034`（ratio 1.99）、`basic-038`（ratio 1.98）、`basic-037`（ratio 2.23）、`basic-036`（ratio 1.85）、`basic-039`（ratio 1.76）、`basic-041`（ratio 1.84）、`basic-046`（ratio 1.92）は正解選択肢が他より長い方向に偏る。
     - `basic-001`（ratio 0.46）、`basic-023`（ratio 0.53）は逆に正解が短い方向に偏る。
   - なぜ問題か: 選択肢の文字数だけで正解が推測できてしまう可能性がある（チェックリスト「出題の偏り」の観点）。
   - 根拠: 文字数解析結果。ただし出題時に選択肢がシャッフルされる前提であり、expert/advanced帯の問題（035, 036, 037, 038, 039）は正解選択肢が仕様の例外条件を詳細に説明する内容のため、文章として必然的に長くなっている面もある。実害は限定的だが、件数が多い（47問中11問、約23%）ため、新規追加時は選択肢の長さバランスに留意する余地がある。

2. **誤答選択肢の断定表現がやや多い（出題の偏り観点）**
   - 何が問題か: 「一切」「絶対に」「必ず」「常に」「〜のみ」「できない」等の断定的表現を含む誤答選択肢が25箇所（23問）で検出された。特に`basic-045`、`basic-046`、`basic-047`のような後半のexpert/advanced問題群に集中している。
   - なぜ問題か: 「〜のみ」「常に」「一切」等の極端な表現は、知識がなくても消去法で正解を推測できてしまう可能性がある（チェックリスト該当項目）。
   - 根拠: パターンマッチ結果。ただし多くは「〜という制限があるかのように見せる」誤答選択肢の性質上、ある程度は自然な表現でもある（例: `basic-025`の「常にエラーになる」は明確に誤りとわかる内容であり、断定表現自体が知識のヒントになっているとは言い難い）。個々に見て消去法のヒントになりうるのは、`basic-046`の「常に1つのCLAUDE.mdファイルにすべての指示を集約」等、他の選択肢と対比構造が強いものに限られる。全体として重大ではないが、新規追加時の表現バランスとして留意事項。

3. **correctIndexの分布偏り（advancedレベル、出題の偏り観点）**
   - 何が問題か: advancedレベル（n=12）でcorrectIndex=3（4番目）の正解が1問（8%）のみに対し、correctIndex=2（3番目）が5問（42%）を占める。
   - なぜ問題か: チェックリストの基準は「特定インデックスが50%を超えていないか」であり、42%はこの基準内に収まる。出題時にシャッフルされるため実害は小さいと明記されているが、参考情報として記録。
   - 根拠: 集計結果 `advanced n=12 [4, 2, 5, 1]`（correctIndex 0/1/2/3の順）。

#### 参考情報

1. **`basic-039`（`--agent`再開時のエージェント解決順序）の事実照合**
   - 内容: 「セッションの元のディレクトリ（ワークスペース信頼済みの場合）、次に再開元のディレクトリの順でエージェントを探し、見つからない場合はデフォルトのツール・システムプロンプトで再開され警告が表示される」という記述。
   - 検証結果: `https://code.claude.com/docs/en/sessions` に「Claude Code looks for the agent in two places: the session's original directory, provided you have trusted that workspace, and then the directory you resume from...If Claude Code doesn't find the agent in either place, the session resumes with the default tools and system prompt and shows a warning naming the agent」と明記されており、問題文・正解・解説とも公式記述に完全一致。指摘なし（検証済みとして記録）。

2. **その他の事実照合対象（検証済み・一致確認）**
   - `basic-019`（`--continue`/`-c`）、`basic-020`（`-n`/`--name`）、`basic-025`（`--resume`引数なしでピッカー）、`basic-031`（`--no-session-persistence`はprint mode専用）: `cli-reference`と一致。
   - `basic-023`〜`basic-024`、`basic-035`〜`basic-037`（`/rewind`の選択肢・bashコマンド変更の非追跡・シンボリックリンクのスキップ挙動・「Restored the code, but skipped N files」警告）: `checkpointing`ページと逐語レベルで一致。
   - `basic-027`〜`basic-028`（ステータスラインのJSON stdin形式・更新トリガー5種・300msデバウンス）、`basic-033`（`COLUMNS`/`LINES`環境変数）、`basic-034`（`used_percentage`が入力系トークンのみで算出され`output_tokens`を含まない）、`basic-038`（`subagentStatusLine`のJSON行形式）、`basic-040`（キャッシュファイル名に`session_id`を使うべき理由）: `statusline`ページと逐語レベルで一致。特に`basic-034`は「The `used_percentage` field is calculated from input tokens only: `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`. It does not include `output_tokens`.」という文言とほぼ同一の内容。
   - `basic-029`（`/branch`の動作）、`basic-030`（`--mcp-config`等の非復元）: `sessions`ページと一致。
   - 全体として、本ファイルの事実照合対象問題は精度が高く、深刻な事実誤認は検出されなかった。

3. **構造の妥当性**: 指摘なし。id重複（ドメイン内・全ドメイン間）なし、id命名規約（`basic-001`〜`basic-047`の連番）違反なし、必須フィールド欠落・空文字なし、choices要素数は全問4、choices内重複なし、correctIndexは全問0〜3の範囲内、level値は全問4値のいずれかに該当、レベルごとの問題数は beginner 13 / intermediate 11 / advanced 12 / expert 11 で全て10問以上（`tests/question-data.test.js`の制約を満たす）。

4. **重複出題**: 指摘なし。問題文・解説について文字bigram類似度による類似ペアは検出されなかった。`basic-023`と`basic-035`〜`basic-037`のように同じ`/rewind`機能を扱う問題群が複数あるが、いずれも問う対象（メニュー選択肢の意味／bashコマンドの非追跡／シンボリックリンクの扱い）が異なり、意図的な対構成として妥当と判断した。

5. **読解チェック**: 指摘なし。47問を通読した限り、正解が複数成立してしまう問題、正解とされる選択肢が実は誤りである問題、問題文と解説の矛盾は見当たらなかった。レベル配置についても、beginner帯（basic-001〜004, 017-018, 021-022, 041-043）は基本操作の初歩、intermediate帯はスラッシュコマンドや設定ファイルの詳細、advanced/expert帯はrewind・ステータスラインの内部仕様やマルチエージェント運用など、レベル間で知識の難度が概ね一貫して段階付けられており、逆転や重複配置は確認されなかった。

## 動作確認としての所見

`question-bank-update` スキルの `audit` モード手順（サブエージェントへの委譲、
`references/quality-checklist.md` の観点適用、公式情報源との事実照合、深刻度別レポート）が
`basic-operations` 領域に対して問題なく機能することを確認した。`data/questions/*.json` は
本実行を通じて変更していない。
