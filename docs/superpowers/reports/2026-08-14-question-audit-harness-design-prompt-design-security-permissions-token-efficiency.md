# 問題集監査レポート（4領域）

- **実行日**: 2026-08-14
- **モード**: `audit`（既存問題の監査。監査の実行時点では `data/questions/*.json` を変更していない）
- **対象領域**: harness-design / prompt-design / security-permissions / token-efficiency
- **検査問題数**: 計315問（harness-design 74 / prompt-design 79 / security-permissions 82 / token-efficiency 80）

> **本レポートは監査実行時点のスナップショットです。** 以下の所見は修正前の状態を記録したもので、
> レポート本文は当時のまま保存しています。この監査の後、別コミットで要修正7件の再検証と修正を行いました。
> 各指摘の現在の対応状況は次表のとおりです。修正後の問題文・選択肢・解説、および `token-039` の選択肢順序変更に
> 伴う `correctIndex` 分布は、本文中の記載とは異なります。
>
> | 指摘 | 再検証の結果 | 対応状況 |
> |---|---|---|
> | `harness-041` | 妥当 | **修正済み**（設問を作り直し、正解を index 3 へ） |
> | `harness-034` | 妥当 | **修正済み**（選択肢[1]・解説を修正。レビュー指摘を受け問題文も「強制」→「配布」へ） |
> | `security-071` | 妥当 | **修正済み**（解説にホームディレクトリ起動時の但し書きを追記） |
> | `security-025` | 妥当（正解肢は変更不要） | **修正済み**（解説のみ） |
> | `security-033` | **一部誤り** — 「コマンドのモデルフロントマター」は公式（model-config）に明記されており、監査は settings ページの1行要約のみを参照していた | **選択肢は変更せず**、解説に advisor・Default 例外を補足 |
> | `token-035` | **誤り** — 誤答肢の主語は `max` が `low`/`high` と「同じ挙動になる」点にあり、公式は真逆の対比を示している | 誤答肢の文言を明確化したのみ（正解肢・解説は変更なし） |
> | `token-039` | 妥当 | **修正済み**（到達範囲を許可リスト方式へ。正解を index 3 へ移動） |
> | `token-021` | **過剰** — 解説は全文正確。追記すると `token-078` の正解を先出しするネタバレになる | **修正せず** |
>
> 検討推奨事項（選択肢の文字数偏り・重複出題・断定表現・`correctIndex` の偏り）と未照合5件は未対応のままです。

## 検査範囲と前提

各領域について、構造の妥当性・出題の偏り・重複出題・読解チェック・事実照合の5観点で検査した。
事実照合は公式ドキュメント（code.claude.com、anthropic.com/engineering）を実取得して原文と突き合わせている。

**ドメイン間ID重複チェックは未検査。** 今回は対象を4領域に絞ったため、他4領域
（basic-operations / feature-usage / recent-features / slash-commands）のファイルを読んでおらず、
ドメイン間の重複は原理的に検出できない。各領域内でのID一意性は4領域すべてで確認済み。
ドメイン間の一意性は `tests/question-data.test.js` が検証する範囲。

### レベル別内訳

| 領域 | beginner | intermediate | advanced | expert | 計 |
|---|---|---|---|---|---|
| harness-design | 19 | 19 | 19 | 17 | 74 |
| prompt-design | 15 | 22 | 24 | 18 | 79 |
| security-permissions | 14 | 23 | 22 | 23 | 82 |
| token-efficiency | 15 | 19 | 27 | 19 | 80 |

全領域・全レベルで「各レベル10問以上」の制約を満たしている。

### 参照した公式URL

**code.claude.com/docs/en/**: memory / best-practices / sub-agents / skills / interactive-mode / goal /
common-workflows / context-window / output-styles / checkpointing / agent-teams / costs / permissions /
permission-modes / sandboxing / hooks / security / server-managed-settings / settings / plugins-reference /
features-overview / model-config / prompt-caching / statusline / sessions / mcp / tools-reference / env-vars

**anthropic.com/engineering/**: effective-context-engineering-for-ai-agents / building-effective-agents /
claude-code-auto-mode / claude-code-sandboxing

**platform.claude.com/docs/en/**: build-with-claude/prompt-caching

## 要修正（7件）

### 1. `harness-041`（harness-design / advanced）— 正解が公式記述と正面から矛盾

**最重要。** 問題は「プロジェクトの `.claude/skills/` 配下のスキルの `allowed-tools` が有効化される前提条件」を問い、
正解を「ワークスペーストラストダイアログを承認するまで有効化されない」（`correctIndex: 2`）としている。
公式ドキュメントはこれを明示的に否定している。

公式（skills「Pre-approve tools for a skill」節）は、ワークスペーストラストがこのフィールドをゲートしないこと、
信頼したことのないフォルダでの `-p` 実行でも project skill の `allowed-tools` が適用されること、
だからこそリポジトリにチェックインされたスキルの `allowed-tools` は実行前にレビューすべきことを述べている。

選択肢4の「呼び出されるたびに個別の承認ダイアログを出す仕様」も誤りのままでよいが、
結果として**4択すべてが誤り**という状態になっている。
セキュリティ上の挙動を逆に教えるため、この問題を解いた学習者は
「トラストダイアログが守ってくれる」という誤った安心を得る。

なお、`.claude-plugin/plugin.json` を置いたスキルフォルダについては
「In a project's `.claude/skills/`, this requires accepting the workspace trust dialog first.」
という別の記述が公式にあり、これが混線した可能性がある。ただしそれはプラグインとしてロードされる場合の話で、
`allowed-tools` フィールド一般の話ではない。

**対応案**: 設問ごと差し替えるか、公式の実際の記述（トラストはゲートしない／グラントは次のメッセージ送信でクリアされる／
レビューが唯一の防御）を正解にした形へ作り直す。

**根拠**: https://code.claude.com/docs/en/skills

### 2. `security-071`（security-permissions / advanced）— 解説が同ファイル内の別問と食い違う

正解肢[3]「読み込まれるが適用されず、`deny` と `ask` のルールはトラストの有無にかかわらず適用される」は正しい。
問題は解説の最終文「トラストは git リポジトリのルート（リポジトリ外なら起動ディレクトリ）単位で保存されます」が、
公式の但し書き（ホームディレクトリ起動時はセッション限りでディスク非保存）を落としている点。

`security-055` の正解解説では「ホームディレクトリ直起動時はセッション限りの信頼でディスク非保存」と
正しく書かれており、**同一ファイル内の2問で説明が食い違っている**。

**対応案**: 解説末尾に「ただしホームディレクトリ起動時はセッション限り」を補うか、当該文を削る。

**根拠**: https://code.claude.com/docs/en/permissions

### 3. `security-025`（security-permissions / beginner）— `availableModels` を管理者専用と誤説明

正解肢[2]「組織の管理者がユーザーの選択できるモデルを制限する」、解説は
「管理設定やポリシー設定で使うことで、エンタープライズ管理者が…制限できる設定」としている。
しかし公式では `availableModels` は **managed / user / project / local の全スコープで設定可能**であり、
管理者専用ではない。公式には「managed が定義したときは user/project/local の追加分を無視する」という記述があり、
これは非managedスコープでも設定できることが前提になっている。

「主な目的」という限定はあるものの、解説が「管理設定やポリシー設定で使うことで」と断定しており、
個人ユーザーが `~/.claude/settings.json` に書く用法を排除する読みを与える。

**対応案**: 解説を「モデルの選択肢を許可リストで制限する設定。管理設定に置くと組織全体へ強制できる」程度に緩める。

**根拠**: https://code.claude.com/docs/en/settings

### 4. `security-033`（security-permissions / advanced）— `availableModels` の適用先列挙が公式とずれる

正解肢[2]は「メインセッションのモデル選択だけでなく、サブエージェントのモデルやスキル・コマンドのモデルフロントマターなど」
としている。公式の列挙は **main session / subagents / skills / advisor** の4つで、
「コマンドのモデルフロントマター」は挙げられておらず、代わりに **advisor** が抜けている。

加えて公式には「Does not affect the Default option unless `enforceAvailableModels` is also set」という
重要な例外があり、問題文の「ユーザーがモデルを指定できるあらゆる箇所」という表現とも整合しない。

**対応案**: 正解肢・解説を「メインセッション・サブエージェント・スキル・advisor」に揃える。

**根拠**: https://code.claude.com/docs/en/settings

### 5. `token-035`（token-efficiency / expert）— 誤答選択肢が事実として成立してしまう

選択肢B「`max` は環境変数で設定した場合にセッションをまたいで永続化される点が `low` や `high` と同じ挙動になる」を
誤答としているが、公式は `low` / `medium` / `high` / `xhigh` が対話セッションでの設定で永続化される一方、
`max` は `CLAUDE_CODE_EFFORT_LEVEL` 環境変数で設定した場合を除き現在のセッションのみに適用される、と記す。

つまり**環境変数で設定すれば `max` も永続化される**ので、Bの主張内容そのものは事実として成立してしまう。
`low`/`high` は対話設定でも永続化される点だけが違いだが、その差は選択肢の文面からは読み取りにくい。
解説末尾でも同じ事実を認めている。正解Cは明確に正しいので複数正解ではないが、Bは曖昧なので差し替えが望ましい。

**根拠**: https://code.claude.com/docs/en/model-config

### 6. `token-039`（token-efficiency / expert）— organization effort limits の除外プラットフォーム列挙が不正確

正解Cは「organization model restrictions と一緒に提供されるが、Amazon Bedrock・Google Cloud・Microsoft Foundry 等の
一部プラットフォームでは提供されない」とする。公式は effort limits が model restrictions と同梱で
「同じセッションに届く」とし、その model restrictions の到達範囲は
「Anthropic API と LLM gateway デプロイメントのみ。他のプロバイダでは `availableModels` を使え」である。

つまり**LLMゲートウェイ経由のセッションには届く**。選択肢Cが挙げる除外リストに「Claude Platform on AWS」が
含まれている点も、公式の model restrictions の記述には現れない。
正解の骨子（custom role単位・model restrictions と同梱・一部プロバイダで非提供）は保たれるが、
列挙の正確性が公式記述から外れている。

**根拠**: https://code.claude.com/docs/en/model-config

### 7. `token-021`（token-efficiency / advanced）— 解説が回避策に触れず、回避不能と誤読されうる

正解Cおよび解説の主要部分は公式と一致（サブスクリプションは1時間TTLを自動リクエスト、
利用クレジット消費時に5分へ自動降格、APIキー／サードパーティは5分が既定）。
ただし解説は `ENABLE_PROMPT_CACHING_1H=1` による回避に触れていない一方、
同ファイルの `token-078` はその回避策を正解として問うている。

矛盾ではないが、`token-021` の解説だけを読むと「自動的に低下する（回避不能）」と誤読されうる。
TTL は本領域の中核事実なので要修正側に置く。

**対応案**: `token-078` の存在を前提に一文補う。

**根拠**: https://code.claude.com/docs/en/prompt-caching

## 検討推奨

### 重複出題

| ペア | 領域 | 内容 |
|---|---|---|
| `prompt-049` / `prompt-075` | prompt-design | 両方 advanced、両方「ギャップを探すよう指示されたレビュアーは健全な実装にも指摘を返すため、正確性・要件に関わる指摘に限る」を正解とする。同レベル・同一知識・同一結論 |
| `prompt-047` / `prompt-073` | prompt-design | 両方 intermediate、両方「2回訂正しても直らなければ `/clear` して具体的なプロンプトで始め直す」を正解とする |
| `token-041` / `token-042` | token-efficiency | 前者（Routines の単問）を後者（Routines とヘッドレスの使い分け）が完全に包含している |
| `token-066` / `token-071` | token-efficiency | `token-066`（`/autocompact 500k`）の解説がすでに `token-071` の正解（`--autocompact` フラグによる一時適用）を明示的に述べており、解説の先出しになっている |
| `token-016` / `token-026` | token-efficiency | 類似度は閾値未満だが「MCPツールの遅延ロードが既定」という結論が重なる。片方を別観点へ振り替える余地あり |

**重複ではないと判断したもの**: harness-design 6組・prompt-design 7組・security-permissions 6組・
token-efficiency 1組（`token-029`/`token-068`）を精査したが、いずれも意図的な対構成（allow と ask、
`allowManagedDomainsOnly` と `allowManagedReadPathsOnly`、`context: fork` 単体と `skills` フィールドとの対比など）
であり、`quality-checklist.md` が明示的に「重複ではない」とする型に該当する。

### 選択肢の文字数偏り

正解の文字数が他選択肢平均の1.6倍超（または0.625倍未満）に該当するもの。
「最も長い選択肢を選べば当たる」パターンを避けるため、誤答を厚くするか正解を刈り込むのが望ましい。

| 領域 | 該当数 | 特記 |
|---|---|---|
| harness-design | 16問 | **うち2.0倍超が10問。16問すべてが beginner/intermediate に集中**し、この2レベルの38問中16問（42%）が該当。advanced/expert は該当ゼロで、レベル間で作りの質に差が出ている。最大は `harness-021`(3.33)・`harness-024`(3.31)・`harness-006`(2.91)。逆方向に `harness-007`(0.33) は正解「スキル（Skill）」だけが極端に短い |
| security-permissions | 8問 | 長い側は `security-072`(3.34)・`security-057`(2.32)・`security-054`(2.22)・`security-070`(2.17)。短い側は `security-055`(0.51)・`security-020`(0.61) |
| prompt-design | 6問 | 長い側は `prompt-057`(1.81)・`prompt-062`(1.72)・`prompt-053`(1.63)。短い側の `prompt-077`(0.58)・`prompt-008`(0.58) は正解が本質的に短く（「Escキーを1回押す」等）、消去法で有利になりにくいため優先度低 |
| token-efficiency | 4問 | `token-066`(1.61)・`token-068`(1.73) が正解最長で要対処。`token-001`(0.60) はコマンド名（`/clear`）で不可避、`token-025`(0.58) は逆パターンで実害小 |

### 誤答選択肢の極端な断定表現

内容を知らなくても消去法で正解が浮くパターン。一律の書き換えではなく、以下を優先して見直すのが現実的。

- `harness-028`（intermediate）— 誤答3つすべてが断定語入り（「常に…完全に同一」「一切参照できない」「必ず…手動で」）。
  正解だけが断定語なしの長文
- `harness-011`（beginner）— 誤答3つが「常にUserスコープが最優先」「常に上書き…概念は存在しない」「Projectスコープが常に最優先」
- `harness-023`（intermediate）— 誤答に「常に…だけが有効」「概念自体が存在しない」
- `prompt-021`（beginner）選択肢3「二度と広い質問ができなくなる」、`prompt-031` 選択肢1「以降二度と課金されなくなる」

harness-design では27箇所、security-permissions では48件の断定語を機械検出したが、
大半は「全てのツールを自動承認する」のようにモードや設定の挙動を述べる上で自然かつ必要な表現、
あるいは記事の主張を否定する形で断定語が必然的に入るケース（`harness-050` 等）であり、問題ない。

### `correctIndex` の分布偏り

出題時に選択肢はシャッフルされるため実害は小さいが、今後の問題追加時の指針として記録する。

| 領域 | 全体分布 | 特記 |
|---|---|---|
| prompt-design | `[21, 27, 19, 12]` | **advanced で index 1 が12/24（50.0%）**、閾値にちょうど接する。expert の index 3 が1問のみ（5.6%） |
| token-efficiency | `[24, 23, 20, 13]` | **expert が `[6, 6, 7, 0]` で index 3 がゼロ** |
| security-permissions | `[23, 22, 23, 14]` | intermediate の index 0 が8/23（35%）、expert の index 3 が2/23（9%）。閾値未達 |
| harness-design | `[17, 23, 20, 14]` | 偏りなし。レベル×インデックスの20区分でも最大37%で閾値超えなし |

### 陳腐化リスクの監視対象

**`harness-038`（advanced）** — 現行仕様（サブエージェントのネスト既定3階層、
`CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` で変更可）とは一致しており修正不要。
ただし公式が同じ節で「v2.1.172〜216 は既定5階層で変更不可、v2.1.217〜218 は既定1、v2.1.219 で3に引き上げ」と
記録するほど変動が激しい。誤答選択肢3が「最大5階層」を含んでおり、これは直前のバージョンでは正解だった。
**次回の `stale` 監査で最優先の再確認対象**とすべき。

### その他

- **`harness-034`（advanced）** — `claudeMd` を「管理者が一元的に配布する**強制的な**指示」と説明しているが、
  公式は `claudeMd` を behavioral guidance 側に位置づけ、`permissions.deny` 等の technical enforcement と
  明確に対比している（「CLAUDE.md instructions shape Claude's behavior but are not a hard enforcement layer」）。
  `claudeMd` は「プロジェクトCLAUDE.mdより先に読み込まれる／個人設定では上書きできない」だけであって、
  内容の遵守が強制されるわけではない。同領域の `harness-015`・`harness-033`・`harness-045` はいずれも
  「CLAUDE.mdの指示に強制力はない」を正しく教えており、034 だけが領域内で不整合。
  「組織が配布し、ユーザー・プロジェクト設定では無効化できないメモリ」程度に緩めるのが妥当
- **`security-052` / `053` / `054`** — 解説が常体（「〜明記されている。」）で、他81問の敬体と不統一
- **`security-059` / `068`（ともに intermediate）** — 「安全性チェックは allow ルール評価より先に走る」
  「保護対象には `.claude/worktrees` を除く」という実装順序まで踏み込んでおり、intermediate としては要求知識が高め。
  片方を advanced へ移すことを検討する余地あり（内容は公式と完全一致で事実誤りはない）
- **`prompt-019`（beginner）** — 誤答選択肢の「nameフィールド（スキルの表示名）」という説明が、
  プラグインスキルの場合は不正確（公式では plugin skill の `name` はコマンド名の最終セグメントを決める）。
  正解（`description`）は明確に正しく選択の妥当性には影響しないため優先度は低い
- **`token-043`（expert）** — Bash 出力上限の解説に `BASH_MAX_OUTPUT_LENGTH` の
  既定30000／最大150000 という上限値の記載がない。誤りではないため現状維持でも可

## 未照合（5件）

以下は今回の照合範囲（主に docs.claude.com）で一次情報を確認できなかったもの。

| ID | 領域 | 内容 | 状況 |
|---|---|---|---|
| `prompt-045` | prompt-design | lost in the middle 現象 | Engineering Blog および Pearson VUE 資格制度の出題ドメイン由来。今回は docs.claude.com のみを照合対象としたため未裏取り |
| `prompt-053` | prompt-design | right altitude / attention budget | 同上 |
| `prompt-057` | prompt-design | progressive disclosure | 同上 |
| `prompt-066` | prompt-design | ツール設計指針 | **選択肢1の解説内に英語原文の直接引用**（"If a human engineer can't definitively say which tool should be used in a given situation, an AI agent can't be expected to do better"）を含む。引用は Effective context engineering 記事に帰属させるべきだが、記事本文を今回取得しておらず文言の正確性を確認できていない |
| `token-045` | token-efficiency | 「コンテキスト使用率60%程度で early に介入」 | **60%という具体的な数値の一次情報源が公式ドキュメント（costs / context-window / prompt-caching）に見つからない**。「lost in the middle」概念と早期整理の推奨自体は context engineering ブログの趣旨と整合し、他の選択肢が明白に誤りなので出題として破綻はしていない。数値の出典を確認するか、問題文から「60%程度」を外すことを推奨 |

**次回への申し送り**: prompt-design の未照合4件はいずれも
https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents を
照合対象に加えれば解消する見込み。特に `prompt-066` は英語原文の引用を含むため優先度が高い。

## 検出ゼロの観点

以下は4領域すべてで検査したうえで**違反ゼロ**を確認した。

- 必須6フィールド（`id` / `level` / `question` / `choices` / `correctIndex` / `explanation`）の欠落・空文字
- `choices` の要素数が4でないもの
- `choices` 内の選択肢重複
- `correctIndex` が非整数または 0〜3 の範囲外
- `level` が既定4値以外
- ID 命名規約（`<prefix>-\d{3}`、3桁ゼロ埋め）違反
- **対象ドメイン内での** ID 重複
- 各レベル10問以上
- 解説と正解の不整合（`harness-041`・`security-071` として上記に計上したものを除く）
- 複数正解が成立する問題

4領域とも `updatePolicy` はトップレベルに存在せず（キーは `domain` / `domainLabel` / `questions` のみ）、
CLAUDE.md の規定どおり `append` 型として扱われる正しい状態。`nextIdSeq` は不要。

### ID の欠番について

**`prompt-064` が欠番**（prompt-design は `prompt-001`〜`prompt-080` で79問）。
`append` 型なので不変条件違反ではなく `tests/question-data.test.js` も検証していない。
ただし ID の再利用は localStorage に残った進捗・復習データを無関係な新問題に結びつけるため、
**将来の追加で `prompt-064` を再利用してはならない**。次の採番は `prompt-081` から。

他3領域は欠番なしの連番（harness-001〜074、security-001〜082、token-001〜080）。

## まとめ

| 領域 | 要修正 | 検討推奨の主な内容 | 未照合 |
|---|---|---|---|
| harness-design | 1件（`harness-041`） | 文字数偏り16問（beginner/intermediate に集中）、断定表現3問、`harness-034` の表現、`harness-038` の陳腐化監視 | 0件 |
| prompt-design | 0件 | 重複2組、文字数偏り6問、断定表現2問、advanced の index 1 偏り | 4件 |
| security-permissions | 3件（`071` / `025` / `033`） | 文字数偏り8問、解説文体の不統一3問、レベル配置2問 | 0件 |
| token-efficiency | 3件（`035` / `039` / `021`） | 重複3組、文字数偏り4問、expert の index 3 がゼロ | 1件 |

事実照合の一致率は高く、特に security-permissions は76問中74問、harness-design は46問中45問が
公式原文と一字一句レベルで一致していた。要修正7件のうち `harness-041` のみが
「公式が明示的に否定している内容を正解にしている」という質的に重い誤りで、
残る6件は説明の不足・列挙のずれ・誤答肢の曖昧さといった精度の問題である。

構造面（必須フィールド・選択肢数・ID規約・レベル別問題数）は4領域すべてで健全。
改善余地が最も大きいのは選択肢の文字数バランスで、特に harness-design の
beginner/intermediate は42%の問題で「最長＝正解」が成立しており、優先的な対処に値する。
