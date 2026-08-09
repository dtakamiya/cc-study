# 新領域「直近の新機能」追加 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Codeの2026年4月〜8月の新機能を扱う第8領域「直近の新機能」を、問題データ・アプリコード・テスト・ドキュメント・更新運用スキルの全面にわたって追加する。

**Architecture:** 既存コードは領域非依存の汎用実装のため、`js/progress.js`の`DOMAINS`/`DOMAIN_LABELS`への1エントリ追加が唯一のコード上のハードコード変更点となる。問題データは`data/questions/recent-features.json`として新規作成し、この領域固有の「入れ替え型」運用を表現するトップレベルフィールド`updatePolicy`（`"replace"`）と採番高水位マーク`nextIdSeq`を持たせる。これらは`tests/question-data.test.js`の新規テストで保護し、`question-bank-update`スキル側にも読み取り・保持の手順を追記する。

**Tech Stack:** バニラJavaScript（ESM）、Node.js組み込みテストランナー（`node --test`）、JSONデータファイル。ビルドツール・パッケージマネージャなし（`package.json`は存在しない）。

## Global Constraints

- ドメイン識別子: `recent-features` / ラベル: `直近の新機能` / IDプレフィックス: `recent-`（3桁ゼロ埋め連番、例 `recent-001`）
- 問題数: 各レベル10問以上、計40〜50問。レベル値は `beginner` / `intermediate` / `advanced` / `expert` の4種
- `tests/question-data.test.js` の `MIN_QUESTIONS_PER_LEVEL = 10` を必ず満たすこと
- 問題IDは全ドメインファイル横断で一意
- 出典は公式Docs（`code.claude.com/docs`）およびAnthropic公式ブログのみ。一次情報で裏が取れない仕様は出題しない
- バージョン番号（`v2.1.xxx`）そのものを問う問題は作らない
- `updatePolicy` の許容値は `"replace"` と `"append"` の2値のみ
- 既存7領域の `data/questions/*.json` は変更しない（`updatePolicy` を追記しない）
- テスト実行コマンドは `node --test`（リポジトリルートで実行）
- 日本語の文言はすべて全角・正書法を守る

---

### Task 1: `updatePolicy` / `nextIdSeq` の検証テストを追加する

先にテストを書くことで、以降のタスクで作る `recent-features.json` の形式が保護される。この時点ではまだ `recent-features.json` が存在しないため、テストは「ファイルがあれば検証する」形ではなく「必ず存在して条件を満たす」形で書き、意図的に失敗させる。

**Files:**
- Modify: `tests/question-data.test.js`（末尾にテストを追加。現在96行）

**Interfaces:**
- Consumes: 既存の `loadAllDomainData()`（`tests/question-data.test.js:13-17`）— `data/questions/*.json` を全件パースして配列で返す。各要素はJSONをそのままパースしたオブジェクト。
- Produces: なし（テストのみ）

- [ ] **Step 1: 失敗するテストを書く**

`tests/question-data.test.js` の末尾に以下を追記する。既存の import 群（`readdirSync`, `readFileSync`, `path`, `fileURLToPath`, `test`, `assert`）と定数 `QUESTIONS_DIR` はファイル冒頭で既に定義済みなので追加importは不要。

```js
const VALID_UPDATE_POLICIES = ['replace', 'append'];

test('updatePolicy is either "replace" or "append" when present', () => {
  const files = readdirSync(QUESTIONS_DIR).filter(name => name.endsWith('.json'));

  for (const name of files) {
    const data = JSON.parse(readFileSync(path.join(QUESTIONS_DIR, name), 'utf8'));
    if (data.updatePolicy === undefined) continue;
    assert.ok(
      VALID_UPDATE_POLICIES.includes(data.updatePolicy),
      `${name}: updatePolicy "${data.updatePolicy}" は "replace" または "append" である必要があります`
    );
  }
});

test('recent-features.json declares replace policy with a valid nextIdSeq high-water mark', () => {
  const filePath = path.join(QUESTIONS_DIR, 'recent-features.json');
  const data = JSON.parse(readFileSync(filePath, 'utf8'));

  assert.equal(
    data.updatePolicy,
    'replace',
    'recent-features は入れ替え型の領域のため updatePolicy は "replace" である必要があります'
  );
  assert.ok(
    Number.isInteger(data.nextIdSeq),
    `nextIdSeq は整数である必要があります（実際: ${data.nextIdSeq}）`
  );

  const maxSeq = data.questions.reduce((max, question) => {
    const seq = Number(question.id.split('-').pop());
    return seq > max ? seq : max;
  }, 0);

  assert.ok(
    data.nextIdSeq > maxSeq,
    `nextIdSeq (${data.nextIdSeq}) はファイル内の最大連番 (${maxSeq}) より大きい必要があります`
  );
});
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/question-data.test.js`
Expected: FAIL。`recent-features.json` が存在しないため、2つ目のテストが `ENOENT: no such file or directory` で失敗する。1つ目のテスト（全ファイル共通の `updatePolicy` 検証）は、既存7ファイルがいずれも `updatePolicy` を持たないため PASS する。

- [ ] **Step 3: コミット**

```bash
git add tests/question-data.test.js
git commit -m "test: updatePolicy と nextIdSeq の検証テストを追加"
```

---

### Task 2: `recent-features.json` を作成する（初級・中級）

問題データが最大の作業量なので、レベル単位で2タスクに分ける。本タスクは初級・中級を作り、この時点ではテストは通らない（上級・エキスパートが0問のため `MIN_QUESTIONS_PER_LEVEL` を満たさない）。ファイルの骨格と `updatePolicy` / `nextIdSeq` はこのタスクで確定させる。

**Files:**
- Create: `data/questions/recent-features.json`
- Reference: `data/questions/harness-design.json`（既存フォーマットの見本）

**Interfaces:**
- Consumes: なし
- Produces: `data/questions/recent-features.json`。トップレベルは `domain`（string）/ `domainLabel`（string）/ `updatePolicy`（string）/ `nextIdSeq`（integer）/ `questions`（array）の5キー。`questions` の各要素は `id`（string, `recent-NNN`）/ `level`（string）/ `question`（string）/ `choices`（string配列4件）/ `correctIndex`（integer, 0〜3）/ `explanation`（string）の6キー。Task 3 がこのファイルの `questions` 配列に追記し、`nextIdSeq` を更新する。

- [ ] **Step 1: 出題対象の仕様を公式Docsで裏取りする**

`code.claude.com/docs` および Anthropic 公式ブログを WebFetch / WebSearch で参照し、以下の各項目について「公式に記載があるか」を確認して記録する。裏が取れなかった項目は出題しない。

初級・中級で扱う候補:
- Artifacts とは何か（既定で非公開、claude.ai にホストされるWebページ）
- Claude 5モデル群（Opus 5 / Sonnet 5 / Fable 5 の位置づけ、モデルID `claude-opus-5` / `claude-sonnet-5` / `claude-fable-5`）
- Fast Mode（`/fast` で切替、Opus 5 / 4.8 で利用可、小型モデルへの降格ではない、standard との価格差）
- `/fork` と `/subtask` の違い（fork は親のコンテキストを引き継ぐ、subtask は新規コンテキスト）
- 権限モードの改称（"default" → "Manual"）
- Focus View
- `/loop` と `/schedule` の違い（`/loop` はこのセッションで繰り返す、`/schedule` は cron スケジュールのクラウドエージェント）
- `/dataviz` / `/teleport` / `/cd` の用途
- Claude in Chrome（既存Chromeセッションの新規タブで開く、サイトレベル権限が必要）
- Artifacts で公開できるもの／できないもの（自己完結HTML必須、外部ホストへのリクエストはCSPでブロック）

裏取り結果は箇条書きでメモに残し、Step 2 の根拠とする。`/loop`・`/schedule` は設計書で「公式Docsで裏取りできなければ落とす」と定めた項目のため、特に慎重に確認する。

- [ ] **Step 2: 初級10〜12問・中級10〜13問を含むファイルを作成する**

`data/questions/recent-features.json` を新規作成する。骨格は以下のとおり（`nextIdSeq` は Task 3 完了後に最終値へ更新するため、この時点では作成した問題の最終連番+1を入れる）。

```json
{
  "domain": "recent-features",
  "domainLabel": "直近の新機能",
  "updatePolicy": "replace",
  "nextIdSeq": 23,
  "questions": [
    {
      "id": "recent-001",
      "level": "beginner",
      "question": "Claude Codeの`/fast`コマンドを有効にしたとき、応答を生成するモデルはどうなりますか？",
      "choices": [
        "Claude Opusのまま、出力が高速になる",
        "より小型で安価なモデルに自動的に切り替わる",
        "Haiku 4.5に固定される",
        "モデルは変わらず、ツール呼び出しだけが並列化される"
      ],
      "correctIndex": 0,
      "explanation": "Fast ModeはClaude Opusを使ったまま出力を高速化するモードで、小型モデルへの降格ではありません。Opus 5および4.8で利用でき、`/fast`でオン・オフを切り替えます。"
    }
  ]
}
```

以降 `recent-002` から連番で、初級を10〜12問、中級を10〜13問作成する。`questions` 配列は初級 → 中級の順に並べる。

作成時の制約:
- `choices` は必ず4要素
- 正解の選択肢だけが極端に長い／短いことがないようにする（`tests/question-data.test.js` の文字数比チェックは 0.625〜1.6 の範囲外で警告する。fail はしないが警告は出さない方が望ましい）
- `explanation` は「なぜその選択肢が正解か」を、公式Docsに記載のある事実で説明する
- 初級は「新機能の名前と役割が言えるか」、中級は「使い分けの判断ができるか」に焦点を置く
- 既存領域と題材が重なる場合も、本領域では「何がどう変わったか」を問う切り口にする

作業量が大きいため、レベルごとにサブエージェントへ分割して作成してもよい。その場合、ID の重複を避けるために採番レンジ（初級 `recent-001`〜、中級はその続き）を明示して渡すこと。

- [ ] **Step 3: JSONとして妥当であることを確認する**

Run: `node -e "const d=require('fs').readFileSync('data/questions/recent-features.json','utf8'); const j=JSON.parse(d); console.log('questions:', j.questions.length); const c={}; for(const q of j.questions){c[q.level]=(c[q.level]||0)+1;} console.log(c); console.log('nextIdSeq:', j.nextIdSeq);"`

Expected: パースエラーなし。`beginner` が10〜12、`intermediate` が10〜13と表示される。`nextIdSeq` が最終連番+1になっている。

- [ ] **Step 4: テストを実行して、残る失敗が「上級・エキスパートの問題数不足」だけであることを確認する**

Run: `node --test tests/question-data.test.js`
Expected: FAIL。`every domain has at least the minimum required questions per level` が `advanced` / `expert` の不足で失敗する。`updatePolicy` / `nextIdSeq` の2テストと ID一意性テストは PASS する。

- [ ] **Step 5: コミット**

```bash
git add data/questions/recent-features.json
git commit -m "feat: 直近の新機能領域の初級・中級問題を追加"
```

---

### Task 3: `recent-features.json` に上級・エキスパートを追加する

**Files:**
- Modify: `data/questions/recent-features.json`

**Interfaces:**
- Consumes: Task 2 が作成した `data/questions/recent-features.json`。`questions` 配列の末尾の `id` の連番が、本タスクの開始番号を決める。
- Produces: 同ファイル。`questions` が計40〜50問になり、`nextIdSeq` が最終連番+1に更新されている。Task 6 のテスト実行、Task 7 の README 記述がこの完成形を前提とする。

- [ ] **Step 1: 出題対象の仕様を公式Docsで裏取りする**

Task 2 Step 1 と同じ手順で、上級・エキスパートの候補について確認する。

上級で扱う候補:
- Artifactsの制約（ページサイズ上限16MB、外部ホストへのfetch/XHR/WebSocketはCSPでブロック、CDNスクリプト・外部フォント・リモート画像も不可、HTML/Markdown対応）
- サブエージェント上限の環境変数（`CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` ほか）と既定値
- クロスセッション連携（`SendMessage`、`crossSessionInbound`、`dialogExpiry`）
- `settings.json` の新キー（`sandbox.filesystem.disabled`、`sandbox.network.strictAllowlist`、`emojiCompletionEnabled`、`vimInsertModeRemaps`）
- `DirectoryAdded` フック

エキスパートで扱う候補:
- `--forward-subagent-text` の用途
- サブエージェントのネスト禁止の既定と例外
- Artifactsの抑制設定（`disableArtifact`、`CLAUDE_CODE_ARTIFACT_AUTO_OPEN`）
- 旧モデルの廃止スケジュールとデフォルトモデルの変遷
- `--ax-screen-reader`
- `EndConversation` の適用条件
- `/plugin validate`、`claude auto-mode reset`

環境変数の既定値や設定キーの厳密な綴りは、公式Docsの記載を正とする。記載が確認できないものは出題対象から外し、他の題材で問数を補う。

- [ ] **Step 2: 上級10〜13問・エキスパート10〜12問を追記する**

`questions` 配列の末尾に、Task 2 の最終連番の次から連番で追記する。形式は Task 2 Step 2 と同一。例:

```json
    {
      "id": "recent-023",
      "level": "advanced",
      "question": "Artifactとして公開したHTMLページから、外部のCDNでホストされているJavaScriptライブラリを`<script src>`で読み込もうとするとどうなりますか？",
      "choices": [
        "Content Security Policyによってブロックされ、読み込まれない",
        "初回のみ読み込まれ、以降はキャッシュから配信される",
        "ページサイズが16MBを超えない限り読み込まれる",
        "公開時に自動でインライン化され、そのまま動作する"
      ],
      "correctIndex": 0,
      "explanation": "Artifactには厳格なCSPが適用され、CDNスクリプト・外部スタイルシート・フォント・リモート画像・fetch/XHR/WebSocketなど、外部ホストへのリクエストはすべてブロックされます。CSSやJavaScriptはインライン化し、アセットはdata: URIとして埋め込む必要があります。"
    }
```

追記後、トップレベルの `nextIdSeq` を「最終連番 + 1」に更新する。たとえば最終問題が `recent-048` なら `"nextIdSeq": 49` とする。

- [ ] **Step 3: 問数と採番を確認する**

Run: `node -e "const j=JSON.parse(require('fs').readFileSync('data/questions/recent-features.json','utf8')); const c={}; for(const q of j.questions){c[q.level]=(c[q.level]||0)+1;} console.log(c, 'total:', j.questions.length, 'nextIdSeq:', j.nextIdSeq); const ids=j.questions.map(q=>q.id); console.log('unique:', new Set(ids).size===ids.length);"`

Expected: 4レベルすべてが10以上、`total` が40〜50、`unique: true`、`nextIdSeq` が最終連番+1。

- [ ] **Step 4: テストを実行して全件PASSを確認する**

Run: `node --test tests/question-data.test.js`
Expected: PASS（4テスト + 新規2テスト、計6テストすべて成功）。選択肢文字数比の警告が出た場合は、該当問題の選択肢の長さを調整する。

- [ ] **Step 5: コミット**

```bash
git add data/questions/recent-features.json
git commit -m "feat: 直近の新機能領域の上級・エキスパート問題を追加"
```

---

### Task 4: `js/progress.js` に新領域を登録する

**Files:**
- Modify: `js/progress.js:3-21`
- Modify: `tests/progress.test.js:17-33`, `tests/progress.test.js:143-148`

**Interfaces:**
- Consumes: なし
- Produces: `DOMAINS` が8要素の配列（末尾 `'recent-features'`）、`DOMAIN_LABELS['recent-features'] === '直近の新機能'`。`createEmptyProgress` / `normalizeProgress` / `getStageStatus` / `buildDashboard` はいずれも `DOMAINS` を走査するため実装変更は不要。

- [ ] **Step 1: 失敗するテストに更新する**

`tests/progress.test.js:20` を変更する。

変更前:
```js
  assert.equal(DOMAINS.length, 7);
```
変更後:
```js
  assert.equal(DOMAINS.length, 8);
```

同ファイル21〜29行目の期待値配列に `'recent-features'` を追加する。

変更前:
```js
  assert.deepEqual(DOMAINS, [
    'basic-operations',
    'feature-usage',
    'prompt-design',
    'security-permissions',
    'token-efficiency',
    'slash-commands',
    'harness-design',
  ]);
```
変更後:
```js
  assert.deepEqual(DOMAINS, [
    'basic-operations',
    'feature-usage',
    'prompt-design',
    'security-permissions',
    'token-efficiency',
    'slash-commands',
    'harness-design',
    'recent-features',
  ]);
```

同ファイル143行目のテスト名と148行目の期待値を変更する。

変更前:
```js
test('buildDashboard は7領域それぞれに4ステージを返す', () => {
```
変更後:
```js
test('buildDashboard は8領域それぞれに4ステージを返す', () => {
```

変更前:
```js
  assert.equal(dashboard.length, 7);
```
変更後:
```js
  assert.equal(dashboard.length, 8);
```

- [ ] **Step 2: テストを実行して失敗を確認する**

Run: `node --test tests/progress.test.js`
Expected: FAIL。`定数が設計どおりの値である` が `DOMAINS.length` の 7 !== 8 で失敗し、`buildDashboard は8領域それぞれに4ステージを返す` が `dashboard.length` の 7 !== 8 で失敗する。

- [ ] **Step 3: `DOMAINS` と `DOMAIN_LABELS` に追加する**

`js/progress.js:3-11` の `DOMAINS` 配列末尾に追加する。

変更前:
```js
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
  'harness-design',
];
```
変更後:
```js
export const DOMAINS = [
  'basic-operations',
  'feature-usage',
  'prompt-design',
  'security-permissions',
  'token-efficiency',
  'slash-commands',
  'harness-design',
  'recent-features',
];
```

`js/progress.js:13-21` の `DOMAIN_LABELS` 末尾に追加する。

変更前:
```js
export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
  'slash-commands': 'スラッシュコマンド',
  'harness-design': 'ハーネス設計',
};
```
変更後:
```js
export const DOMAIN_LABELS = {
  'basic-operations': '基本操作・CLI使用法',
  'feature-usage': '機能活用',
  'prompt-design': 'プロンプト設計・協働作法',
  'security-permissions': '安全性・権限管理',
  'token-efficiency': 'トークン効率・コスト管理',
  'slash-commands': 'スラッシュコマンド',
  'harness-design': 'ハーネス設計',
  'recent-features': '直近の新機能',
};
```

- [ ] **Step 4: テストを実行して成功を確認する**

Run: `node --test tests/progress.test.js`
Expected: PASS（全テスト成功）。

- [ ] **Step 5: コミット**

```bash
git add js/progress.js tests/progress.test.js
git commit -m "feat: recent-features を DOMAINS に登録"
```

---

### Task 5: `js/report-content.js` に学習アドバイスを追加する

**Files:**
- Modify: `js/report-content.js`（`SUGGESTIONS` オブジェクトの末尾、harness-design の直後）

**Interfaces:**
- Consumes: Task 4 で登録した `'recent-features'` というドメイン識別子
- Produces: `getStudyAdvice('recent-features', level)` が4レベルすべてで `FALLBACK_SUGGESTION` 以外の文字列を返す

- [ ] **Step 1: `SUGGESTIONS` に `recent-features` を追加する**

`js/report-content.js` の `SUGGESTIONS` 内、`'harness-design'` エントリ（38-43行目）の直後に追加する。既存エントリの末尾は `},` で閉じられているので、その後ろに以下を挿入する。

```js
  'recent-features': {
    beginner: 'Artifacts、Claude 5モデル群、Fast Modeなど直近に追加された機能について、公式ドキュメントで名前と役割を一通り確認してみましょう。',
    intermediate: '`/fast`と標準モード、`/loop`と`/schedule`、`/fork`と`/subtask`のように、似た機能をどう使い分けるかを整理してみましょう。',
    advanced: 'Artifactsの制約やサブエージェント上限の環境変数、`sandbox.*`などの新しい設定キーを、実際に自分の環境で試して挙動を確認しましょう。',
    expert: '公式ドキュメントとAnthropicのリリース情報を定期的に追い、モデルの廃止スケジュールや非対話実行向けのフラグなど、見落としやすい仕様変更を把握し続けましょう。',
  },
```

- [ ] **Step 2: 4レベルすべてでフォールバックしないことを確認する**

Run: `node -e "import('./js/report-content.js').then(m => { for (const l of ['beginner','intermediate','advanced','expert']) { const a = m.getStudyAdvice('recent-features', l); console.log(l, ':', a.slice(0, 30)); } });"`

Expected: 4行とも「基礎から着実に復習し…」（`FALLBACK_SUGGESTION`）ではなく、上で追加した文言の冒頭が表示される。

- [ ] **Step 3: コミット**

```bash
git add js/report-content.js
git commit -m "feat: recent-features の学習アドバイスを追加"
```

---

### Task 6: `index.html` の領域数表記を修正する

`index.html:14` は現時点で既に「6領域 × 4レベルの全24ステージ」と古く（実際は7領域28ステージ）、本変更でダッシュボードが8領域になるため食い違いが拡大する。利用者に見える文字列のため修正する。

**Files:**
- Modify: `index.html:14`

**Interfaces:**
- Consumes: なし
- Produces: なし（表示文言のみ）

- [ ] **Step 1: 文言を修正する**

`index.html:14` を変更する。

変更前:
```html
        6領域 × 4レベルの全24ステージ。各ステージは10問で、8問以上正解すると合格し、
```
変更後:
```html
        8領域 × 4レベルの全32ステージ。各ステージは10問で、8問以上正解すると合格し、
```

- [ ] **Step 2: 他に古い領域数の記述が残っていないか確認する**

Run: `grep -rn "6領域\|7領域\|24ステージ\|28ステージ" index.html quiz.html result.html js/ css/`
Expected: 出力なし（該当行がすべて解消されている）。

- [ ] **Step 3: 全テストを実行する**

Run: `node --test`
Expected: PASS。ここまでの Task 1〜5 の変更がすべて揃い、`tests/progress.test.js` と `tests/question-data.test.js` の全テストが成功する。

- [ ] **Step 4: コミット**

```bash
git add index.html
git commit -m "fix: トップページの領域数表記を8領域32ステージに更新"
```

---

### Task 7: `README.md` を8領域構成に更新する

**Files:**
- Modify: `README.md:5-6`, `README.md:16`, `README.md:80-83`, `README.md:129`
- Modify: `README.md`（末尾に更新運用の節を追加）

**Interfaces:**
- Consumes: Task 3 で確定した `recent-features` の問題構成、Task 4 で登録したドメイン識別子
- Produces: なし（ドキュメントのみ）

- [ ] **Step 1: 冒頭の説明文（5-6行目）を更新する**

変更前:
```
Claude Codeの理解を、7領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド／ハーネス設計）×4レベル（初級／中級／上級／エキスパート）の全28ステージで段階的に高めるWebアプリです。
```
変更後:
```
Claude Codeの理解を、8領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理／
トークン効率・コスト管理／スラッシュコマンド／ハーネス設計／直近の新機能）×4レベル（初級／中級／上級／エキスパート）の全32ステージで段階的に高めるWebアプリです。
```

- [ ] **Step 2: 進め方の項目（16行目）を更新する**

変更前:
```
1. トップページのダッシュボードで、7領域 × 4レベルの進捗を確認する
```
変更後:
```
1. トップページのダッシュボードで、8領域 × 4レベルの進捗を確認する
```

- [ ] **Step 3: 対象領域の列挙（80-83行目）を更新する**

変更前:
```
対象領域は7つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）、
ハーネス設計（`harness-`）。
```
変更後:
```
対象領域は8つです: 基本操作・CLI使用法（`basic-`）、機能活用（`feature-`）、
プロンプト設計・協働作法（`prompt-`）、安全性・権限管理（`security-`）、
トークン効率・コスト管理（`token-`）、スラッシュコマンド（`slash-`）、
ハーネス設計（`harness-`）、直近の新機能（`recent-`）。
```

- [ ] **Step 4: 追加・更新の進め方（129行目）を更新する**

変更前:
```
1. 上記の公式情報源で、既存7領域（基本操作／機能活用／プロンプト設計／安全性・権限管理／トークン効率／スラッシュコマンド／ハーネス設計）に対応する新機能・仕様変更がないか確認する
```
変更後:
```
1. 上記の公式情報源で、既存8領域（基本操作／機能活用／プロンプト設計／安全性・権限管理／トークン効率／スラッシュコマンド／ハーネス設計／直近の新機能）に対応する新機能・仕様変更がないか確認する
```

- [ ] **Step 5: 更新運用の節を末尾に追加する**

`README.md` の末尾（現在132行目が終端）に以下を追記する。

```markdown

### 領域の更新方針（`updatePolicy`）

`data/questions/*.json`のトップレベルには、その領域を更新するときの方針を表す`updatePolicy`を
持たせられる。

- `"append"` — 追記型。フィールド未指定時の既定値。既存問題に新しい問題を追記していく
- `"replace"` — 入れ替え型。古くなった問題を削除してから新しい問題を追加する

既存7領域は`updatePolicy`を持たず、追記型として扱われる。

**直近の新機能（`recent-features`）は入れ替え型である。** 領域名が相対的であるため、時間が経って
「直近」でなくなった機能の問題は保存せず差し替える。更新は目安3〜6ヶ月ごとに、公式ドキュメントと
CHANGELOGを再調査したうえで行い、各レベル10問以上・計40〜50問を維持する。削除した機能のうち
定着したものは、`feature-usage`・`harness-design`・`security-permissions`などの恒久領域へ問題を
移すことを検討する。

入れ替え型の領域は、トップレベルに採番の高水位マーク`nextIdSeq`（次に採番する連番）を持つ。
問題を追加するたびに追加件数分を加算し、問題を削除しても減らさない。削除したIDを再利用すると、
`localStorage`に保存済みの進捗・復習データが無関係な新問題に結びついてしまうためである。
追記型の領域は`nextIdSeq`を持たず、従来どおりファイル内の最大連番から採番する。
```

- [ ] **Step 6: 古い領域数の記述が残っていないことを確認する**

Run: `grep -n "7領域\|6領域\|28ステージ\|24ステージ\|領域は7つ" README.md`
Expected: `既存7領域`という語が残っていないこと。上記の「既存7領域は`updatePolicy`を持たず」の一文は意図的な記述だが、`grep`に引っかかるため、この1件のみが出力されることを確認する。それ以外の出力があれば修正漏れ。

- [ ] **Step 7: コミット**

```bash
git add README.md
git commit -m "docs: README を8領域構成に更新し更新運用を追記"
```

---

### Task 8: `question-bank-update` スキルを `updatePolicy` / `nextIdSeq` 対応にする

このスキルの参照ファイル `json-schema.md` はトップレベルを3キーのみと定義しており、書き込み用サブエージェントはこの定義に従うよう指示されている。追記しないと、ファイルの再生成・整形時に `updatePolicy` と `nextIdSeq` が黙って脱落し、入れ替え型の領域が追記型に戻ってしまう。

**Files:**
- Modify: `.claude/skills/question-bank-update/references/json-schema.md:5-17`, `:58-68`
- Modify: `.claude/skills/question-bank-update/SKILL.md`（`add`モードの手順、72-74行目付近）

**Interfaces:**
- Consumes: Task 3 で確定した `recent-features.json` のトップレベル構造
- Produces: なし（スキル定義のみ）

- [ ] **Step 1: `json-schema.md` のトップレベル定義を更新する**

`.claude/skills/question-bank-update/references/json-schema.md:5-17` を変更する。

変更前:
````markdown
## ファイルトップレベル

```json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [ ... ]
}
```

- `domain`: ファイル名から`.json`を除いた文字列と一致させる（例: `basic-operations.json` → `"basic-operations"`）
- `domainLabel`: 日本語の領域名。既存ファイルから変更しない
- `questions`: 問題オブジェクトの配列
````
変更後:
````markdown
## ファイルトップレベル

```json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [ ... ]
}
```

入れ替え型の領域は、さらに`updatePolicy`と`nextIdSeq`を持つ。

```json
{
  "domain": "recent-features",
  "domainLabel": "直近の新機能",
  "updatePolicy": "replace",
  "nextIdSeq": 51,
  "questions": [ ... ]
}
```

- `domain`: ファイル名から`.json`を除いた文字列と一致させる（例: `basic-operations.json` → `"basic-operations"`）
- `domainLabel`: 日本語の領域名。既存ファイルから変更しない
- `updatePolicy`（任意）: `"replace"`（入れ替え型）または`"append"`（追記型）。未指定時は`"append"`
  として扱う。**既に存在する場合は必ず保持すること。** 脱落すると入れ替え型の領域が黙って追記型に
  戻る
- `nextIdSeq`（任意）: 次に採番する連番（整数）。`updatePolicy`が`"replace"`の領域が持つ。
  **既に存在する場合は必ず保持し、問題を追加したら追加件数分を加算すること。**
  問題を削除しても減らさない
- `questions`: 問題オブジェクトの配列

ファイルを書き出すときは、読み込んだトップレベルのキーを1つも落とさないこと。ここに挙げていない
キーが存在する場合も、そのまま保持する。
````

- [ ] **Step 2: `json-schema.md` の採番規則を分岐させる**

同ファイルの採番規則（67-68行目付近、「対象ファイル内の既存最大連番の次の番号を3桁ゼロ埋め」と書かれている箇所）を、以下のように書き換える。

変更後:
```markdown
採番は対象ファイルの`nextIdSeq`の有無で分岐する。

- `nextIdSeq`を持つファイル: その値を開始番号とし、3桁ゼロ埋めで採番する。追加が終わったら
  `nextIdSeq`を「追加件数分を加算した値」に更新する。削除済みIDの再利用を防ぐための高水位マークで
  あり、ファイル内の最大連番より小さくしてはならない
- `nextIdSeq`を持たないファイル: 対象ファイル内の既存最大連番の次の番号を開始番号とし、3桁
  ゼロ埋めで採番する
```

あわせて58-65行目のprefix参考表に `recent-features` / `recent-` の行を追加する（同表には `harness-design` も欠落しているため、これも追加する）。表は非権威的な参考例である旨の断り書きは残す。

- [ ] **Step 3: `SKILL.md` の `add` モードに `updatePolicy` 分岐を追記する**

`.claude/skills/question-bank-update/SKILL.md` の `add` モード手順のうち、対象領域を確定する箇所（49-52行目付近）の直後に、以下の趣旨の手順を追記する。

```markdown
対象領域を確定したら、そのJSONのトップレベルから`updatePolicy`を読み取り、以降の挙動を分岐させる。

- `"replace"`（入れ替え型）の場合: 新しい問題を追加する前に、「直近」でなくなった機能を扱う既存問題を
  洗い出してユーザーに提示し、承認を得たうえで削除する。そのうえで新機能の問題を追加する。
  削除と追加を通じて、各レベル10問以上を維持すること
- `"append"`または未指定の場合: 従来どおり、既存問題を残したまま追記する

領域名からこの判断をしてはならない。判断材料はデータ側の`updatePolicy`のみである。
```

- [ ] **Step 4: `SKILL.md` のID採番規則を分岐させる**

`.claude/skills/question-bank-update/SKILL.md:72-74` を変更する。

変更前:
```
   このサブエージェントは、対象ファイル内の既存最大連番を開始番号として、
   同一領域内で承認順に1件ずつ増分した`id`を確定させる（同一領域の複数承認
   問題に同じ`id`を割り当てない）。確定した`id`とともに`questions`配列へ追記する
```
変更後:
```
   このサブエージェントは、開始番号を次の規則で決める。対象ファイルが`nextIdSeq`を
   持つ場合はその値を開始番号とし、追記完了後に`nextIdSeq`を「追加件数分を加算した値」へ
   更新する（削除済みIDの再利用を防ぐ高水位マークであり、問題を削除しても減らさない）。
   `nextIdSeq`を持たない場合は、対象ファイル内の既存最大連番の次を開始番号とする。
   いずれの場合も、同一領域内で承認順に1件ずつ増分した`id`を確定させる（同一領域の複数承認
   問題に同じ`id`を割り当てない）。確定した`id`とともに`questions`配列へ追記する。
   このとき、`updatePolicy`・`nextIdSeq`を含むトップレベルのキーを1つも落とさないこと
```

- [ ] **Step 5: スキル内に領域名がハードコードされていないことを確認する**

Run: `grep -rn "recent-features\|直近の新機能" .claude/skills/question-bank-update/`
Expected: `references/json-schema.md` の例示（トップレベル構造の JSON サンプル、prefix参考表）にのみ現れること。`SKILL.md` には現れないこと。SKILL.md は「領域一覧をハードコードしない」設計方針のため、分岐の判断は `updatePolicy` の値のみで行う。

- [ ] **Step 6: コミット**

```bash
git add .claude/skills/question-bank-update/
git commit -m "feat: question-bank-update スキルを updatePolicy / nextIdSeq 対応に改修"
```

---

### Task 9: 全体の回帰確認とブラウザでの手動確認

**Files:**
- 変更なし（確認のみ。問題が見つかった場合は該当ファイルを修正する）

**Interfaces:**
- Consumes: Task 1〜8 のすべての成果物
- Produces: なし

- [ ] **Step 1: 全テストを実行する**

Run: `node --test`
Expected: PASS。`tests/progress.test.js`・`tests/question-data.test.js`・その他のテストファイルすべてが成功する。選択肢文字数比の `console.warn` が出る場合は、該当問題の選択肢の長さを調整して再実行する。

- [ ] **Step 2: ローカルサーバーを起動する**

Run: `python3 -m http.server 8765`（バックグラウンド実行）
Expected: `Serving HTTP on :: port 8765` が出力される。ESMの`import`はfile://では動作しないため、HTTPサーバー経由で確認する必要がある。

- [ ] **Step 3: ダッシュボードに8領域が表示されることを確認する**

`http://localhost:8765/index.html` を開く。

確認項目:
- ダッシュボードに8行あり、8行目のラベルが「直近の新機能」であること
- 直近の新機能の初級が ▶（挑戦可能）で、中級以降がロック状態であること
- 画面上部の説明文が「8領域 × 4レベルの全32ステージ」になっていること

- [ ] **Step 4: 新領域のステージに挑戦して合格・開放を確認する**

直近の新機能の初級ステージに挑戦し、10問出題されることを確認する。8問以上正解して合格し、中級が開放されることを確認する。

確認項目:
- 10問が出題され、選択肢がシャッフルされていること
- 合格後、ダッシュボードで中級が ▶ になること
- 結果画面に「直近の新機能」の学習アドバイスが表示され、フォールバック文（「基礎から着実に復習し…」）でないこと

- [ ] **Step 5: 復習モードで新領域の誤答が対象になることを確認する**

Step 4 で誤答した問題がある状態で復習モードを開き、直近の新機能の誤答問題が出題対象に含まれることを確認する。誤答がなかった場合は、わざと誤答するステージを1回実施してから確認する。

- [ ] **Step 6: サーバーを停止する**

Step 2 で起動したバックグラウンドプロセスを停止する。

- [ ] **Step 7: 確認結果を報告する**

Step 3〜5 の各確認項目について、実際に確認した結果を報告する。不具合が見つかった場合は修正し、Step 1 から再度確認する。すべて問題なければ、追加のコミットは不要（Task 1〜8 でコミット済み）。
