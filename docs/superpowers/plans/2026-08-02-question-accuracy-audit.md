# 問題データ健全性チェック Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `data/questions/*.json` の全229問を点検し、問題と解答の欠陥を根拠付きでレポートにまとめる。

**Architecture:** 3フェーズでコストの低い順に絞り込む。フェーズ1は使い捨てNodeスクリプトによる機械的検査、フェーズ2は全問の読解と事実照合フラグ付け、フェーズ3はフラグ分のみ公式ドキュメントで裏取り。フェーズ2とフェーズ3の間にユーザー確認ゲートを置く。

**Tech Stack:** Node.js（ESM、`node:test`）、WebFetch（公式ドキュメント参照）、Markdown

**Spec:** `docs/superpowers/specs/2026-08-02-question-accuracy-audit-design.md`

## Global Constraints

- **`data/questions/*.json` を変更しない。** 本作業の成果物はレポートのみ。
- **`js/` 配下のアプリコードを変更しない。**
- **`tests/` に新規テストを追加しない。** 検査スクリプトはscratchpad配下の使い捨てとする。
- スクラッチパッド: `/private/tmp/claude-501/-Users-dtakamiya-work-cc-study/98238deb-0954-41e0-a77d-99993009afee/scratchpad`
- レポート出力先: `docs/2026-08-02-question-audit.md`
- 事実照合の情報源は公式のみ（`code.claude.com/docs` 最優先、次いで `anthropic.com/engineering`、`platform.claude.com/docs`）。日本語ブログ等の二次情報を根拠に採用しない。
- 記憶のみを根拠に「仕様として正しい」と判断しない。Claude Codeは仕様変更が頻繁。
- 対象データ（2026-08-02時点、計229問）:

  | ファイル | domain | beginner | intermediate | advanced | expert | 計 |
  |---|---|---|---|---|---|---|
  | `basic-operations.json` | basic-operations | 13 | 11 | 12 | 11 | 47 |
  | `feature-usage.json` | feature-usage | 10 | 12 | 14 | 11 | 47 |
  | `prompt-design.json` | prompt-design | 10 | 10 | 12 | 13 | 45 |
  | `security-permissions.json` | security-permissions | 10 | 12 | 11 | 12 | 45 |
  | `token-efficiency.json` | token-efficiency | 10 | 11 | 12 | 12 | 45 |

- 問題オブジェクトのキー: `id`, `level`, `question`, `choices`, `correctIndex`, `explanation`
- `id` 規約: `basic-` / `feature-` / `prompt-` / `security-` / `token-` + 3桁ゼロ埋め連番（例 `token-045`）

### 既存テストで検証済みの項目（フェーズ1で再実装しない）

`tests/question-data.test.js` が以下を検査済みで、`node --test` は41件全passしている。
スクリプトではこれらを再実装せず、レポートには「既存テストで検証済み」として記載する。

- `correctIndex` が `choices` の範囲内であること
- 各領域・各レベルの問題数が10問以上であること
- 全ファイルを通して `id` が一意であること

---

## File Structure

**作成（scratchpad・使い捨て、コミットしない）**
- `scratchpad/audit/check-structure.mjs` — 構造とREADME要件の検査
- `scratchpad/audit/check-bias.mjs` — 出題の偏りの検査
- `scratchpad/audit/check-duplicates.mjs` — 重複出題の検出
- `scratchpad/audit/findings-phase1.json` — フェーズ1の検出結果（フェーズ2以降で参照）
- `scratchpad/audit/findings-phase2.json` — フェーズ2の読解所見と事実照合フラグ

**作成（コミットする）**
- `docs/2026-08-02-question-audit.md` — 最終レポート

検査を3スクリプトに分けるのは、検出カテゴリごとに出力を独立して確認したいため。
1本にまとめると出力が混ざり、どの検査が何を出したのか追いにくくなる。

---

### Task 1: 構造とREADME要件の検査スクリプト

**Files:**
- Create: `scratchpad/audit/check-structure.mjs`

**Interfaces:**
- Consumes: `data/questions/*.json`
- Produces: 標準出力にJSON配列 `[{id, domain, category, severity, detail}]`。`category` は `missing-field` / `empty-field` / `choice-count` / `choice-duplicate` / `invalid-level` / `id-convention` / `id-gap` のいずれか。後続タスクはこの形式に依存する。

- [ ] **Step 1: スクリプトを書く**

```javascript
// scratchpad/audit/check-structure.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const QUESTIONS_DIR = path.resolve('data/questions');
const REQUIRED_FIELDS = ['id', 'level', 'question', 'choices', 'correctIndex', 'explanation'];
const VALID_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const ID_PREFIX = {
  'basic-operations': 'basic',
  'feature-usage': 'feature',
  'prompt-design': 'prompt',
  'security-permissions': 'security',
  'token-efficiency': 'token',
};

const findings = [];
const add = (id, domain, category, severity, detail) =>
  findings.push({ id, domain, category, severity, detail });

for (const name of readdirSync(QUESTIONS_DIR).filter(n => n.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(path.join(QUESTIONS_DIR, name), 'utf8'));
  const domain = data.domain;
  const prefix = ID_PREFIX[domain];
  const seenNumbers = [];

  for (const q of data.questions) {
    const qid = q.id ?? '(id missing)';

    for (const field of REQUIRED_FIELDS) {
      if (!(field in q)) {
        add(qid, domain, 'missing-field', '要修正', `必須フィールド "${field}" が存在しない`);
        continue;
      }
      const v = q[field];
      if (typeof v === 'string' && v.trim() === '') {
        add(qid, domain, 'empty-field', '要修正', `フィールド "${field}" が空文字`);
      }
    }

    if (Array.isArray(q.choices)) {
      if (q.choices.length !== 4) {
        add(qid, domain, 'choice-count', '要修正', `選択肢が${q.choices.length}個（4個であるべき）`);
      }
      const normalized = q.choices.map(c => String(c).trim());
      const dupes = normalized.filter((c, i) => normalized.indexOf(c) !== i);
      for (const d of new Set(dupes)) {
        add(qid, domain, 'choice-duplicate', '要修正', `選択肢が重複: "${d}"`);
      }
      for (const [i, c] of normalized.entries()) {
        if (c === '') add(qid, domain, 'empty-field', '要修正', `選択肢[${i}]が空文字`);
      }
    }

    if (!VALID_LEVELS.includes(q.level)) {
      add(qid, domain, 'invalid-level', '要修正', `level "${q.level}" は既定の4値以外`);
    }

    const m = /^([a-z]+)-(\d{3})$/.exec(qid);
    if (!m) {
      add(qid, domain, 'id-convention', '検討推奨', `id が "<prefix>-<3桁連番>" 形式でない`);
    } else {
      if (m[1] !== prefix) {
        add(qid, domain, 'id-convention', '要修正', `id のプレフィクスが "${prefix}-" でない`);
      }
      seenNumbers.push(Number(m[2]));
    }
  }

  seenNumbers.sort((a, b) => a - b);
  for (let n = 1; n <= seenNumbers.length; n++) {
    if (!seenNumbers.includes(n)) {
      add(`${prefix}-${String(n).padStart(3, '0')}`, domain, 'id-gap', '参考情報', `連番に欠番がある`);
    }
  }
}

console.log(JSON.stringify(findings, null, 2));
```

- [ ] **Step 2: 実行して結果を確認する**

Run: `node scratchpad/audit/check-structure.mjs`
Expected: JSON配列が出力される。検出ゼロなら `[]`。

出力が `[]` でない場合、各検出が本当に欠陥か目視で確認する。スクリプトの誤検出（例: 意図的な連番の欠番）であれば、レポートには「参考情報」として記載するか、誤検出と判断した理由を添えて除外する。

- [ ] **Step 3: 結果を保存する**

Run: `node scratchpad/audit/check-structure.mjs > scratchpad/audit/findings-structure.json`

---

### Task 2: 出題の偏りの検査スクリプト

**Files:**
- Create: `scratchpad/audit/check-bias.mjs`

**Interfaces:**
- Consumes: `data/questions/*.json`
- Produces: 標準出力にJSON `{ correctIndexDistribution, lengthOutliers, assertiveExpressions }`。
  - `correctIndexDistribution`: `[{domain, level, counts: [n0,n1,n2,n3], total, maxShare}]`
  - `lengthOutliers`: `[{id, domain, correctLength, otherAvgLength, ratio, direction}]`
  - `assertiveExpressions`: `[{id, domain, choiceIndex, isCorrect, expression, text}]`

- [ ] **Step 1: スクリプトを書く**

READMEの「妥当性チェック観点」3項目に対応する。閾値は以下の根拠で設定する。

- 長さ外れ値: 正解の文字数が他の選択肢の平均の1.6倍超、または0.625倍未満。文字数だけで正解を推測できる水準の目安として設定。境界値付近は目視で判断する。
- `correctIndex` 偏り: 領域×レベル単位で、特定のインデックスが50%超を占める場合に報告。均等なら25%。

```javascript
// scratchpad/audit/check-bias.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const QUESTIONS_DIR = path.resolve('data/questions');
const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const LONG_RATIO = 1.6;
const SHORT_RATIO = 0.625;
const SHARE_THRESHOLD = 0.5;
const ASSERTIVE = ['絶対に', '絶対', '一切', '存在しない', '必ず', 'まったく', '全く', 'できない', 'できません', 'すべて', '常に', '決して'];

const domains = readdirSync(QUESTIONS_DIR)
  .filter(n => n.endsWith('.json'))
  .map(n => JSON.parse(readFileSync(path.join(QUESTIONS_DIR, n), 'utf8')));

const correctIndexDistribution = [];
const lengthOutliers = [];
const assertiveExpressions = [];

for (const data of domains) {
  for (const level of LEVELS) {
    const qs = data.questions.filter(q => q.level === level);
    if (qs.length === 0) continue;
    const counts = [0, 0, 0, 0];
    for (const q of qs) counts[q.correctIndex]++;
    const maxShare = Math.max(...counts) / qs.length;
    if (maxShare > SHARE_THRESHOLD) {
      correctIndexDistribution.push({
        domain: data.domain, level, counts, total: qs.length,
        maxShare: Number(maxShare.toFixed(3)),
      });
    }
  }

  for (const q of data.questions) {
    const correct = String(q.choices[q.correctIndex]);
    const others = q.choices.filter((_, i) => i !== q.correctIndex).map(String);
    const otherAvg = others.reduce((s, c) => s + c.length, 0) / others.length;
    const ratio = correct.length / otherAvg;
    if (ratio > LONG_RATIO || ratio < SHORT_RATIO) {
      lengthOutliers.push({
        id: q.id, domain: data.domain,
        correctLength: correct.length,
        otherAvgLength: Number(otherAvg.toFixed(1)),
        ratio: Number(ratio.toFixed(2)),
        direction: ratio > LONG_RATIO ? '正解が長い' : '正解が短い',
      });
    }

    for (const [i, choiceRaw] of q.choices.entries()) {
      const choice = String(choiceRaw);
      for (const expr of ASSERTIVE) {
        if (choice.includes(expr)) {
          assertiveExpressions.push({
            id: q.id, domain: data.domain, choiceIndex: i,
            isCorrect: i === q.correctIndex, expression: expr, text: choice,
          });
        }
      }
    }
  }
}

console.log(JSON.stringify({ correctIndexDistribution, lengthOutliers, assertiveExpressions }, null, 2));
```

- [ ] **Step 2: 実行して結果を確認する**

Run: `node scratchpad/audit/check-bias.mjs`
Expected: 3キーを持つJSONが出力される。

`assertiveExpressions` は誤検出が多く出る想定。「すべて」「常に」等は正当な文脈でも使われるため、**件数をそのまま指摘にしない**。誤答選択肢に断定表現が集中していて消去法が成立する問題だけをレポートに載せる。判断はフェーズ2の読解時に行う。

- [ ] **Step 3: 結果を保存する**

Run: `node scratchpad/audit/check-bias.mjs > scratchpad/audit/findings-bias.json`

---

### Task 3: 重複出題の検出スクリプト

**Files:**
- Create: `scratchpad/audit/check-duplicates.mjs`

**Interfaces:**
- Consumes: `data/questions/*.json`
- Produces: 標準出力にJSON配列 `[{idA, idB, domainA, domainB, similarity, questionA, questionB}]`（`similarity` 降順）

- [ ] **Step 1: スクリプトを書く**

問題文の文字bigram Jaccard係数で類似度を測る。日本語は空白で単語分割できないためbigramを使う。
閾値0.5以上を候補として出力し、実際に重複かはフェーズ2の読解で判断する。
領域をまたいだ比較も行う（同じトピックが別領域に重複している可能性があるため）。

```javascript
// scratchpad/audit/check-duplicates.mjs
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const QUESTIONS_DIR = path.resolve('data/questions');
const THRESHOLD = 0.5;

const bigrams = (s) => {
  const t = String(s).replace(/\s+/g, '');
  const set = new Set();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};

const jaccard = (a, b) => {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
};

const all = [];
for (const name of readdirSync(QUESTIONS_DIR).filter(n => n.endsWith('.json'))) {
  const data = JSON.parse(readFileSync(path.join(QUESTIONS_DIR, name), 'utf8'));
  for (const q of data.questions) {
    all.push({ id: q.id, domain: data.domain, question: q.question, grams: bigrams(q.question) });
  }
}

const pairs = [];
for (let i = 0; i < all.length; i++) {
  for (let j = i + 1; j < all.length; j++) {
    const sim = jaccard(all[i].grams, all[j].grams);
    if (sim >= THRESHOLD) {
      pairs.push({
        idA: all[i].id, idB: all[j].id,
        domainA: all[i].domain, domainB: all[j].domain,
        similarity: Number(sim.toFixed(3)),
        questionA: all[i].question, questionB: all[j].question,
      });
    }
  }
}

pairs.sort((a, b) => b.similarity - a.similarity);
console.log(JSON.stringify(pairs, null, 2));
```

- [ ] **Step 2: 実行して結果を確認する**

Run: `node scratchpad/audit/check-duplicates.mjs`
Expected: JSON配列が出力される。229問の全ペア（約26,000組）を比較するため数秒かかる。

類似度が高くても、問い方が違えば重複ではない（例: 同じコマンドについて「何をするか」と「どう書くか」を問う2問）。フェーズ2で判断する。

- [ ] **Step 3: 結果を保存する**

Run: `node scratchpad/audit/check-duplicates.mjs > scratchpad/audit/findings-duplicates.json`

- [ ] **Step 4: フェーズ1の結果を統合する**

3つの結果ファイルを `scratchpad/audit/findings-phase1.json` にまとめる。

```bash
node -e "
const fs = require('fs');
const d = 'scratchpad/audit/';
const merged = {
  structure: JSON.parse(fs.readFileSync(d + 'findings-structure.json', 'utf8')),
  bias: JSON.parse(fs.readFileSync(d + 'findings-bias.json', 'utf8')),
  duplicates: JSON.parse(fs.readFileSync(d + 'findings-duplicates.json', 'utf8')),
};
fs.writeFileSync(d + 'findings-phase1.json', JSON.stringify(merged, null, 2));
console.log('structure:', merged.structure.length);
console.log('bias.correctIndexDistribution:', merged.bias.correctIndexDistribution.length);
console.log('bias.lengthOutliers:', merged.bias.lengthOutliers.length);
console.log('bias.assertiveExpressions:', merged.bias.assertiveExpressions.length);
console.log('duplicates:', merged.duplicates.length);
"
```

Expected: 各カテゴリの件数が表示される。この件数がフェーズ2の読解時の着目点になる。

---

### Task 4: 全229問の読解チェック（フェーズ2）

**Files:**
- Read: `data/questions/*.json`（全5ファイル）
- Read: `scratchpad/audit/findings-phase1.json`
- Create: `scratchpad/audit/findings-phase2.json`

**Interfaces:**
- Consumes: Task 1〜3が出力した `findings-phase1.json`
- Produces: `findings-phase2.json` — `{ defects: [{id, domain, level, category, severity, detail}], factCheckFlags: [{id, domain, level, topic, claim, priority}] }`
  - `defects[].category`: `multiple-correct` / `no-correct` / `explanation-mismatch` / `explanation-incomplete` / `level-misplacement` / `elimination-possible`
  - `factCheckFlags[].claim`: 公式ドキュメントで検証すべき具体的な主張を1文で
  - `factCheckFlags[].priority`: `高`（コマンド名・フラグ名・JSON構造など変更されやすい検証可能な事実） / `中`（機能の有無・挙動） / `低`（概念・設計思想で仕様変更の影響を受けにくい）

- [ ] **Step 1: 領域ごとに全問を読む**

5ファイルを順に読む。1ファイルあたり45〜47問。各問について以下を判断する。

1. `correctIndex` が指す選択肢は本当に正しいか
2. 他の選択肢に、正解として成立しうるものがないか
3. `explanation` は正解の根拠を説明しているか。問題文や正解と矛盾していないか
4. `level` は妥当か（beginnerにexpert級、expertにbeginner級が置かれていないか）
5. 誤答選択肢が不自然に排除しやすく、消去法で正解できないか

フェーズ1の結果を突き合わせながら読む。`lengthOutliers` や `assertiveExpressions` に挙がった問題は、実際に推測可能かをこの段階で判断する。`duplicates` のペアは、本当に重複出題かを判断する。

- [ ] **Step 2: 事実照合フラグを立てる**

同じ読解の中で、公式ドキュメントで裏取りすべき問題にフラグを立てる。対象:

- コマンド名・CLIフラグ名（例: `--dangerously-skip-permissions`、`--append-system-prompt`）
- スラッシュコマンド名（例: `/compact`、`/context`、`/rewind`）
- 設定ファイルのJSON構造・キー名（`settings.json` の `permissions`、`hooks` 等）
- 数値上限（コンテキストウィンドウサイズ、`MAX_THINKING_TOKENS` 等）
- 機能の有無・廃止状況（sandbox、plugins、routines、subagents、skills、MCP）

「記憶では正しいはず」でもフラグを立てる。記憶の正しさ自体が検証対象。
逆に、概念や設計思想を問う問題（例: 「なぜCLAUDE.mdに書くべきか」）は仕様変更の影響を受けにくいため `低` とする。

- [ ] **Step 3: 結果を `findings-phase2.json` に書き出す**

Task 5の入力になるため、上記 Interfaces の形式を厳密に守る。

- [ ] **Step 4: 件数を集計してユーザーに報告する**

```bash
node -e "
const f = require('./scratchpad/audit/findings-phase2.json');
const by = (arr, key) => arr.reduce((a, x) => (a[x[key]] = (a[x[key]] || 0) + 1, a), {});
console.log('defects:', f.defects.length, JSON.stringify(by(f.defects, 'category')));
console.log('severity:', JSON.stringify(by(f.defects, 'severity')));
console.log('factCheckFlags:', f.factCheckFlags.length, JSON.stringify(by(f.factCheckFlags, 'priority')));
"
```

**これはユーザー確認ゲートである。** 集計結果を提示し、フェーズ3でどこまで照合するかを確認する。
確認を得るまでTask 5に進まない。提示する内容:

- 読解で見つかった欠陥の件数と内訳
- 事実照合フラグの件数と優先度別内訳
- フラグをトピック単位にまとめた場合、参照が必要な公式ドキュメントのページ数の見積もり
- 推奨する照合範囲（例:「優先度『高』の N 件のみ、ドキュメント M ページで足りる」）

---

### Task 5: 事実照合（フェーズ3）

**Files:**
- Read: `scratchpad/audit/findings-phase2.json`
- Modify: `scratchpad/audit/findings-phase2.json`（照合結果を `factCheckFlags[].verdict` と `.source` に追記）

**Interfaces:**
- Consumes: Task 4の `factCheckFlags`（ユーザーが承認した範囲）
- Produces: 各フラグに `verdict`（`正しい` / `誤り` / `古い` / `判断不能`）、`source`（参照した公式ドキュメントURL）、`evidence`（該当箇所の要約）を追記

- [ ] **Step 1: フラグをトピック単位にまとめる**

同じドキュメントページで検証できるフラグをグループ化する。
問題ごとに個別にWebFetchすると同じページを何度も取得することになるため、
「このページを1回取得すれば、このN問を検証できる」という単位に整理する。

- [ ] **Step 2: 公式ドキュメントを取得して照合する**

WebFetchで以下の優先順位で参照する。

1. `https://code.claude.com/docs` — CLIオプション、スラッシュコマンド、hooks、permission-modes、sandbox、MCP、subagents、skills
2. `https://www.anthropic.com/engineering` — 設計思想・安全機構の背景
3. `https://platform.claude.com/docs` — コンテキストウィンドウ、プロンプトキャッシング

各フラグについて `verdict` を判定する。判定は以下の基準で行う。

- `正しい`: ドキュメントの記述が問題の正解と一致する
- `誤り`: ドキュメントの記述と正解が矛盾する
- `古い`: かつては正しかったが現在の仕様では変わっている
- `判断不能`: ドキュメントに該当記述が見つからない

**`判断不能` を `正しい` に丸めない。** 記憶で補完せず、判断不能として記録する。

- [ ] **Step 3: 照合結果を `findings-phase2.json` に追記する**

`verdict` が `誤り` または `古い` のものは、Task 6のレポートで「事実誤り」セクションに載せる。
`判断不能` は「検討推奨」として、確認できなかった旨を明記して載せる。

---

### Task 6: レポートの作成とコミット

**Files:**
- Create: `docs/2026-08-02-question-audit.md`
- Read: `scratchpad/audit/findings-phase1.json`, `scratchpad/audit/findings-phase2.json`

**Interfaces:**
- Consumes: Task 1〜5の全結果
- Produces: レポート（最終成果物）

- [ ] **Step 1: レポートを書く**

以下の構成で書く。深刻度順に並べる。

```markdown
# 問題データ健全性チェック レポート

実施日: 2026-08-02
対象: `data/questions/*.json` 全229問

## サマリ

| 検査 | 対象 | 検出 |
|---|---|---|
| 構造の妥当性 | 229問 | N件 |
| 出題の偏り | 229問 | N件 |
| 重複出題 | 26,106ペア | N件 |
| 読解チェック | 229問 | N件 |
| 事実照合 | N問（フラグ分） | N件 |

（既存テスト `tests/question-data.test.js` で検証済みの項目 —
`correctIndex` の範囲、レベルごとの問題数、`id` の一意性 — は再検査せず、
`node --test` が41件全passすることを確認した。）

## 1. 事実誤り

（現在の仕様に照らして解答が誤っている問題。深刻度: 要修正）

### <問題ID> — <領域> / <レベル>

- **問題文:** ...
- **現在の正解:** ...
- **何が問題か:** ...
- **根拠:** <公式ドキュメントURL> — 「<該当記述の引用>」
- **深刻度:** 要修正

## 2. 出題欠陥

（事実は正しいが問題として成立していないもの）

## 3. 偏り・スタイル

（`correctIndex` の偏り、正解選択肢の長さ、断定表現、重複出題）

## 4. 確認できなかった項目

（事実照合で `判断不能` だったもの、および今回スコープ外とした範囲）

## 検査範囲と限界

- フェーズ3の事実照合は全229問ではなく、フラグを立てたN問に限定した
- 照合に使用した公式ドキュメントとその取得日
- 本レポートはデータ修正を含まない
```

**検出ゼロのセクションは「該当なし」と明記する。** 空欄にしない。
全体で検出ゼロだった場合も、検査範囲を明記したレポートを出す（スペックの成功基準）。

- [ ] **Step 2: レポートの自己レビュー**

- 各指摘に根拠（URLまたはREADMEの方針への参照）が付いているか
- 「たぶん」「おそらく」で断定していないか。確認できていないものは「確認できなかった項目」に置く
- 問題IDが実在するか（`grep` で照合する）

```bash
node -e "
const fs=require('fs');
const ids=new Set();
for(const n of fs.readdirSync('data/questions')){
  if(!n.endsWith('.json')) continue;
  JSON.parse(fs.readFileSync('data/questions/'+n,'utf8')).questions.forEach(q=>ids.add(q.id));
}
const report=fs.readFileSync('docs/2026-08-02-question-audit.md','utf8');
const cited=[...report.matchAll(/\b((?:basic|feature|prompt|security|token)-\d{3})\b/g)].map(m=>m[1]);
const bad=[...new Set(cited)].filter(id=>!ids.has(id));
console.log(bad.length===0 ? 'OK: 引用された問題IDはすべて実在する' : '存在しないID: '+bad.join(', '));
"
```

Expected: `OK: 引用された問題IDはすべて実在する`

- [ ] **Step 3: データファイルが変更されていないことを確認する**

Global Constraints の遵守確認。

Run: `git status --porcelain data/ js/ tests/`
Expected: 出力が空（変更なし）

- [ ] **Step 4: コミット**

scratchpadの中間ファイルはコミットしない。レポートのみをコミットする。

```bash
git add docs/2026-08-02-question-audit.md
git commit -m "$(cat <<'EOF'
docs: 問題データ健全性チェックのレポートを追加

全229問を対象に、構造・偏り・重複の機械的検査、全問の読解チェック、
フラグ分の公式ドキュメント照合を実施した結果をまとめた。
データファイルの修正は含まない。

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: 結果をユーザーに報告する**

検出件数の内訳と、特に対応を検討すべき指摘を要約して伝える。
修正を行うかはユーザーが別途判断する（本計画のスコープ外）。

---

## Self-Review

**スペック網羅性**

| スペックの要求 | 対応タスク |
|---|---|
| フェーズ1: 構造の妥当性 | Task 1 |
| フェーズ1: README要件の充足 | 既存テストで検証済み（Task 1 冒頭に明記） |
| フェーズ1: 出題の偏り | Task 2 |
| フェーズ1: 重複出題 | Task 3 |
| フェーズ2: 読解チェック | Task 4 Step 1 |
| フェーズ2: 事実照合フラグ | Task 4 Step 2 |
| ユーザー確認ゲート | Task 4 Step 4 |
| フェーズ3: 事実照合 | Task 5 |
| レポート出力 | Task 6 |
| 検出ゼロでもレポートを出す | Task 6 Step 1 に明記 |
| データ修正を行わない | Global Constraints、Task 6 Step 3 で検証 |

**型の一貫性**

- Task 1〜3 の出力ファイル名（`findings-structure.json` / `findings-bias.json` / `findings-duplicates.json`）は Task 3 Step 4 の統合スクリプトの参照名と一致
- Task 4 の `findings-phase2.json` のキー（`defects` / `factCheckFlags`）は Task 4 Step 4 の集計スクリプトおよび Task 5 の参照と一致
- `severity` の値（`要修正` / `検討推奨` / `参考情報`）は Task 1、Task 4、Task 6 で統一
