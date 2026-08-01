# Claude Code理解度診断Webアプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Claude Codeの理解度を4領域×4レベルの問題集で診断し、領域別・総合レベルとPDFレポートを出力できる、ビルド不要の静的Webアプリを作る。

**Architecture:** Vanilla JS (ES Modules) + JSON問題データ + localStorage。3ページ構成（トップ/診断/結果）。ロジック層（出題・採点・判定）はブラウザとNode.js `node:test` の両方から同じモジュールを読み込めるよう、副作用のない純粋関数として実装する。

**Tech Stack:** HTML/CSS/JS（ES Modules, ビルドツール不要）、Node.js標準 `node:test` + `node:assert` によるユニットテスト、GitHub Pagesでの静的配信。

## Global Constraints

- ビルドツール不要（npm installやバンドラを介さず、リポジトリをそのままGitHub Pagesに配置して動作すること）
- 出題形式は単一選択式（4択）のみ
- 診断結果はサーバーに送信せず、`localStorage`にのみ保存する
- 各領域10問、計40問前後を出題する
- 領域別レベルは正答率で判定: 90%以上=エキスパート、70%以上90%未満=上級、50%以上70%未満=中級、50%未満=初級
- 総合レベルは4領域のうち最も低いレベルとする（木桶原理）
- レポートに設問ごとの正誤詳細は含めない（領域別・総合レベル、正答率、弱点領域の改善提案のみ）
- 4領域: `basic-operations`（基本操作・CLI使用法）, `feature-usage`（機能活用）, `prompt-design`（プロンプト設計・協働作法）, `security-permissions`（安全性・権限管理）
- 4レベル: `beginner`（初級）, `intermediate`（中級）, `advanced`（上級）, `expert`（エキスパート）
- 単体テストは `node:test` で実行する（`node --test`）

---

## File Structure

```
/
├── index.html
├── quiz.html
├── result.html
├── css/
│   └── style.css
├── js/
│   ├── quiz-engine.js     # 出題選択ロジック（純粋関数）
│   ├── level-judge.js     # 正答率→レベル判定、総合レベル集約（純粋関数）
│   ├── storage.js         # localStorage 読み書き（副作用あり、DOM非依存）
│   ├── report-content.js  # レベル×領域→改善提案テキストのマッピング（純粋データ）
│   ├── quiz-page.js       # quiz.html用のDOM制御・画面遷移ロジック
│   ├── result-page.js     # result.html用のDOM制御・レポート表示ロジック
│   └── top-page.js        # index.html用の診断開始ボタン制御
├── data/
│   └── questions/
│       ├── basic-operations.json
│       ├── feature-usage.json
│       ├── prompt-design.json
│       └── security-permissions.json
└── tests/
    ├── quiz-engine.test.js
    └── level-judge.test.js
```

**責務分離の方針:**
- `quiz-engine.js` / `level-judge.js` / `report-content.js` はDOMに触れない純粋ロジックとし、Node.jsとブラウザの両方からimportできるようにする。ここがテスト対象の中心。
- `storage.js` はlocalStorageの読み書きのみを担当する薄いラッパー。
- `*-page.js` はDOM操作・イベントハンドリングを担当し、上記のロジック層を呼び出すだけにする（ロジックをここに書かない）。
- HTMLファイルは構造のみを持ち、`<script type="module" src="js/xxx-page.js">` でロジックを読み込む。

---

## Task 1: 問題データ（4領域分のJSON）を作成する

**Files:**
- Create: `data/questions/basic-operations.json`
- Create: `data/questions/feature-usage.json`
- Create: `data/questions/prompt-design.json`
- Create: `data/questions/security-permissions.json`

**Interfaces:**
- Produces: 各ファイルは以下のスキーマを持つJSON。

```json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [
    {
      "id": "basic-001",
      "level": "beginner",
      "question": "質問文",
      "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4"],
      "correctIndex": 0,
      "explanation": "解説文"
    }
  ]
}
```

  `level` は `"beginner" | "intermediate" | "advanced" | "expert"` のいずれか。
  各ファイルは各レベル最低4問、合計16問以上を用意する（10問出題のうち画面側でレベル分散抽出するため、レベルごとに複数プールが必要）。

- [ ] **Step 1: `data/questions/basic-operations.json` を作成する**

以下の内容で作成する（各レベル4問、計16問）。

```json
{
  "domain": "basic-operations",
  "domainLabel": "基本操作・CLI使用法",
  "questions": [
    {
      "id": "basic-001",
      "level": "beginner",
      "question": "Claude Codeを起動する基本的なコマンドはどれですか？",
      "choices": ["claude", "claude-code start", "cc run", "anthropic claude"],
      "correctIndex": 0,
      "explanation": "ターミナルで `claude` と入力するとClaude Codeが起動します。"
    },
    {
      "id": "basic-002",
      "level": "beginner",
      "question": "会話をクリアして新しいセッションを始めるスラッシュコマンドはどれですか？",
      "choices": ["/reset", "/new", "/clear", "/restart"],
      "correctIndex": 2,
      "explanation": "`/clear` で会話履歴をクリアして新しいセッションを開始できます。"
    },
    {
      "id": "basic-003",
      "level": "beginner",
      "question": "直前の操作を中断したいときに押すキー操作はどれですか？",
      "choices": ["Ctrl+Z", "Ctrl+C", "Ctrl+D", "Esc Esc"],
      "correctIndex": 1,
      "explanation": "Ctrl+Cで実行中の処理を中断できます。"
    },
    {
      "id": "basic-004",
      "level": "beginner",
      "question": "Claude Codeが現在の作業ディレクトリ内のファイルを読み書きするために必要な前提はどれですか？",
      "choices": [
        "インターネット接続のみ",
        "対象ディレクトリでClaude Codeを起動していること",
        "GitHubアカウントとの連携",
        "root権限での実行"
      ],
      "correctIndex": 1,
      "explanation": "Claude Codeは起動したディレクトリを作業ディレクトリとしてファイル操作を行います。"
    },
    {
      "id": "basic-005",
      "level": "intermediate",
      "question": "現在のセッションで使えるスラッシュコマンドの一覧を確認する方法はどれですか？",
      "choices": ["/list", "/help", "/commands", "/menu"],
      "correctIndex": 1,
      "explanation": "`/help` でClaude Codeの使い方やコマンド一覧を確認できます。"
    },
    {
      "id": "basic-006",
      "level": "intermediate",
      "question": "特定のファイルをコンテキストに含めて質問したいとき、プロンプト内でファイルを参照する一般的な方法はどれですか？",
      "choices": [
        "ファイルパスを@で始めて記述する",
        "ファイルをドラッグ&ドロップすることしかできない",
        "ファイル名を#で囲む",
        "参照する方法はない"
      ],
      "correctIndex": 0,
      "explanation": "`@path/to/file` の形式でファイルを参照し、コンテキストに含めることができます。"
    },
    {
      "id": "basic-007",
      "level": "intermediate",
      "question": "Claude Codeの応答中に処理を中断し、別の指示を出したい場合の適切な操作はどれですか？",
      "choices": [
        "ターミナルを閉じて再起動する",
        "Escキーで中断してから新しい指示を入力する",
        "新しいターミナルタブを開く",
        "中断はできない"
      ],
      "correctIndex": 1,
      "explanation": "Escキーで現在の処理を中断し、続けて新しい指示を入力できます。"
    },
    {
      "id": "basic-008",
      "level": "intermediate",
      "question": "直前のコミットメッセージを確認する際、Claude Codeにどう依頼するのが自然ですか？",
      "choices": [
        "「git logを実行して」と自然言語で依頼する",
        "専用のGUIを開く必要がある",
        "コミットメッセージはClaude Codeから確認できない",
        "ファイルを直接編集する"
      ],
      "correctIndex": 0,
      "explanation": "Claude Codeは自然言語の指示からgitコマンドなどのツール実行を判断して実行します。"
    },
    {
      "id": "basic-009",
      "level": "advanced",
      "question": "長時間のタスクを実行中に別の作業を並行して進めたい場合、Claude Codeで有効な手段はどれですか？",
      "choices": [
        "バックグラウンド実行を使い、完了時に通知を受け取る",
        "並行作業はサポートされていない",
        "毎回新しいインストールを行う",
        "タスクを手動でファイルに書き出す"
      ],
      "correctIndex": 0,
      "explanation": "長時間実行するコマンドやエージェントはバックグラウンドで実行し、完了時に通知を受け取れます。"
    },
    {
      "id": "basic-010",
      "level": "advanced",
      "question": "プロジェクト固有の設定や指示を永続化するために使うファイルはどれですか？",
      "choices": ["README.md", "CLAUDE.md", "config.json", ".env"],
      "correctIndex": 1,
      "explanation": "CLAUDE.mdにプロジェクト固有の指示やコンテキストを記述することで、セッションをまたいで参照されます。"
    },
    {
      "id": "basic-011",
      "level": "advanced",
      "question": "会話履歴が長くなり文脈上限に近づいたとき、Claude Codeの標準的な挙動はどれですか？",
      "choices": [
        "強制終了する",
        "古いメッセージを自動的に要約して継続する",
        "エラーになり操作不能になる",
        "手動で毎回全履歴を消す必要がある"
      ],
      "correctIndex": 1,
      "explanation": "会話が長くなると自動的に要約が行われ、作業を継続できます。"
    },
    {
      "id": "basic-012",
      "level": "advanced",
      "question": "複数の作業を並行して進めるために、独立した作業ツリーを作る仕組みはどれですか？",
      "choices": ["git worktree", "git stash", "git cherry-pick", "git rebase"],
      "correctIndex": 0,
      "explanation": "git worktreeを使うことで、同じリポジトリの別ブランチを独立したディレクトリで並行して作業できます。"
    },
    {
      "id": "basic-013",
      "level": "expert",
      "question": "Claude Codeをスクリプトやパイプラインから非対話的に呼び出す際に使う仕組みはどれですか？",
      "choices": [
        "対話モードを強制終了して使う",
        "ヘッドレス/非対話モード（例: -pフラグでの実行）を使う",
        "非対話的な利用はサポートされていない",
        "ブラウザ拡張を使う"
      ],
      "correctIndex": 1,
      "explanation": "Claude CodeはCLIの非対話モード（プリントモード）を提供しており、スクリプトやCIから呼び出せます。"
    },
    {
      "id": "basic-014",
      "level": "expert",
      "question": "定期的に自動でタスクを実行させたい場合に使える仕組みはどれですか？",
      "choices": [
        "スケジュールされたcronベースの自動実行",
        "手動実行のみサポート",
        "OSのタスクスケジューラは併用できない",
        "常にフォアグラウンドで待機する必要がある"
      ],
      "correctIndex": 0,
      "explanation": "cronスケジュールに基づいてClaude Codeのタスクを定期実行する仕組みが提供されています。"
    },
    {
      "id": "basic-015",
      "level": "expert",
      "question": "複数セッションを比較・管理し、進行中の作業を横断的に把握する仕組みとして適切なものはどれですか？",
      "choices": [
        "タスク一覧・状態管理の仕組みを使う",
        "毎回ターミナルの履歴を目視で確認する",
        "手動でログファイルを作成する",
        "複数セッションの管理はできない"
      ],
      "correctIndex": 0,
      "explanation": "タスクの一覧・状態確認の仕組みを使うことで、複数の進行中作業を横断的に把握できます。"
    },
    {
      "id": "basic-016",
      "level": "expert",
      "question": "同一プロジェクトで複数のClaude Codeインスタンスを異なる作業ディレクトリで安全に並行稼働させる際、最も適した構成はどれですか？",
      "choices": [
        "同じディレクトリを複数プロセスで共有する",
        "git worktreeなどで作業ディレクトリを分離して並行稼働させる",
        "並行稼働は非推奨であり避けるべき",
        "常に1インスタンスに制限される"
      ],
      "correctIndex": 1,
      "explanation": "worktree等で作業ディレクトリを分離することで、複数インスタンスの競合を避けて並行作業ができます。"
    }
  ]
}
```

- [ ] **Step 2: `data/questions/feature-usage.json` を作成する**

```json
{
  "domain": "feature-usage",
  "domainLabel": "機能活用（ツール・MCP・フック）",
  "questions": [
    {
      "id": "feature-001",
      "level": "beginner",
      "question": "Claude Codeがファイルを編集する際に使う基本的な機能はどれですか？",
      "choices": ["Editツール", "外部エディタの手動起動のみ", "編集はできない", "音声入力"],
      "correctIndex": 0,
      "explanation": "Claude CodeはEditツールなどの組み込みツールを使ってファイルを直接編集します。"
    },
    {
      "id": "feature-002",
      "level": "beginner",
      "question": "シェルコマンドを実行するためにClaude Codeが使う組み込みツールはどれですか？",
      "choices": ["Bashツール", "Terminalアプリを開く", "SSH接続", "実行できない"],
      "correctIndex": 0,
      "explanation": "Bashツールを使ってシェルコマンドを実行します。"
    },
    {
      "id": "feature-003",
      "level": "beginner",
      "question": "コードベース内のキーワードを検索する際に使われる仕組みはどれですか？",
      "choices": ["Grepツール", "手動でファイルを1つずつ開く", "検索機能はない", "外部検索エンジン"],
      "correctIndex": 0,
      "explanation": "Grepツールでコードベース内を高速に検索できます。"
    },
    {
      "id": "feature-004",
      "level": "beginner",
      "question": "MCPの正式名称として正しいものはどれですか？",
      "choices": [
        "Model Context Protocol",
        "Multi Command Processor",
        "Managed Code Pipeline",
        "Model Configuration Preset"
      ],
      "correctIndex": 0,
      "explanation": "MCPはModel Context Protocolの略で、外部ツールやデータソースと接続する標準規格です。"
    },
    {
      "id": "feature-005",
      "level": "intermediate",
      "question": "MCPサーバーを追加する主な目的として適切なものはどれですか？",
      "choices": [
        "外部サービスやデータソースへのアクセス手段を追加する",
        "会話履歴を暗号化する",
        "ターミナルの色を変更する",
        "モデルを別バージョンに切り替える"
      ],
      "correctIndex": 0,
      "explanation": "MCPサーバーは外部ツールやAPI、データソースへのアクセスをClaude Codeに追加します。"
    },
    {
      "id": "feature-006",
      "level": "intermediate",
      "question": "頻繁に使う定型的な指示をコマンドとして登録する機能はどれですか？",
      "choices": ["カスタムスラッシュコマンド", "エイリアスの手動設定のみ", "登録機能はない", "環境変数"],
      "correctIndex": 0,
      "explanation": "`.claude/commands` 等にMarkdownファイルを置くことでカスタムスラッシュコマンドを定義できます。"
    },
    {
      "id": "feature-007",
      "level": "intermediate",
      "question": "特定のイベント（ツール実行前後など）に合わせて自動でコマンドを実行させる仕組みはどれですか？",
      "choices": ["フック（hooks）", "サブエージェント", "MCP", "スラッシュコマンド"],
      "correctIndex": 0,
      "explanation": "フックはツール実行前後などのイベントに応じて任意のコマンドを自動実行する仕組みです。"
    },
    {
      "id": "feature-008",
      "level": "intermediate",
      "question": "Webページの情報を取得してコンテキストに含めたい場合に使うツールはどれですか？",
      "choices": ["WebFetch", "Bashで直接curlするしかない", "取得する手段はない", "Editツール"],
      "correctIndex": 0,
      "explanation": "WebFetchツールでURLの内容を取得しコンテキストに含めることができます。"
    },
    {
      "id": "feature-009",
      "level": "advanced",
      "question": "特定のタスクに特化した独立したエージェントを呼び出し、メインの会話コンテキストを圧迫せずに作業させる仕組みはどれですか？",
      "choices": ["サブエージェント（Agent/Task機能）", "フック", "スラッシュコマンドのみ", "MCPサーバーの再起動"],
      "correctIndex": 0,
      "explanation": "サブエージェントを使うと、独立したコンテキストでタスクを実行し、メインの会話を圧迫しません。"
    },
    {
      "id": "feature-010",
      "level": "advanced",
      "question": "PreToolUseフックを使う典型的な目的はどれですか？",
      "choices": [
        "ツール実行前に検証やブロックを行う",
        "会話終了後にログを削除する",
        "モデルのバージョンを変更する",
        "UIのテーマを切り替える"
      ],
      "correctIndex": 0,
      "explanation": "PreToolUseフックはツールが実行される前に検証・制御を行うために使われます。"
    },
    {
      "id": "feature-011",
      "level": "advanced",
      "question": "独自のMCPサーバーを開発する際に定義する必要があるものはどれですか？",
      "choices": [
        "提供するツールやリソースのインターフェース",
        "Claude本体のモデル重み",
        "ターミナルのフォント設定",
        "GitHubのブランチ保護ルール"
      ],
      "correctIndex": 0,
      "explanation": "MCPサーバーは提供するツールやリソースのインターフェースを定義し、Claude Codeに公開します。"
    },
    {
      "id": "feature-012",
      "level": "advanced",
      "question": "スキル（Skill）機能の主な目的として適切なものはどれですか？",
      "choices": [
        "特定タスクの手順や知識をパッケージ化し、必要な時に読み込ませる",
        "ネットワーク接続を暗号化する",
        "モデルの推論速度を上げる",
        "OSのパーミッションを変更する"
      ],
      "correctIndex": 0,
      "explanation": "スキルは特定タスクの手順・知識をパッケージ化し、該当するタスクの際に読み込まれる仕組みです。"
    },
    {
      "id": "feature-013",
      "level": "expert",
      "question": "複数のMCPサーバーからのツールが競合・重複する場合の一般的な対処方針として適切なものはどれですか？",
      "choices": [
        "不要なサーバーを無効化するか、ツール名の衝突を避けるよう設定を見直す",
        "常に全て有効化したまま放置する",
        "MCPサーバーは同時に1つしか使えない",
        "競合は自動的に解決されないため機能自体を使わない"
      ],
      "correctIndex": 0,
      "explanation": "必要なMCPサーバーのみを有効化し、ツールの衝突を避ける設定管理が求められます。"
    },
    {
      "id": "feature-014",
      "level": "expert",
      "question": "SessionStartフックとPreCompactフックの主な違いとして正しいものはどれですか？",
      "choices": [
        "SessionStartはセッション開始時、PreCompactは会話圧縮の直前に発火する",
        "両者は完全に同じタイミングで発火する",
        "PreCompactはセッション終了時にのみ発火する",
        "SessionStartはツール実行のたびに発火する"
      ],
      "correctIndex": 0,
      "explanation": "SessionStartはセッション開始時、PreCompactは会話履歴が圧縮される直前に発火するフックです。"
    },
    {
      "id": "feature-015",
      "level": "expert",
      "question": "組織内で複数プロジェクト共通のMCPサーバー設定やフックを配布・共有する仕組みとして適切なものはどれですか？",
      "choices": [
        "プラグイン（plugin）機構でスキル・MCP・フックをまとめて配布する",
        "各メンバーが個別にゼロから設定する",
        "共有する仕組みは存在しない",
        "メールで設定ファイルを送る"
      ],
      "correctIndex": 0,
      "explanation": "プラグイン機構を使うと、スキル・MCPサーバー・フックなどをまとめてチームや組織内で配布・共有できます。"
    },
    {
      "id": "feature-016",
      "level": "expert",
      "question": "自作のMCPサーバーとフックを組み合わせて、特定のツール実行結果を自動検証しブロックする仕組みを作る際、最も適した設計はどれですか？",
      "choices": [
        "PreToolUse/PostToolUseフックで検証ロジックを実行し、必要に応じて非ゼロ終了コードでブロックする",
        "MCPサーバー側では何もせず、手動確認のみに頼る",
        "検証はモデルの推論精度向上でしか実現できない",
        "フックとMCPは同時に併用できない"
      ],
      "correctIndex": 0,
      "explanation": "フックのPreToolUse/PostToolUseで検証を行い、終了コードによって処理をブロック・許可する設計が一般的です。"
    }
  ]
}
```

- [ ] **Step 3: `data/questions/prompt-design.json` を作成する**

```json
{
  "domain": "prompt-design",
  "domainLabel": "プロンプト設計・協働作法",
  "questions": [
    {
      "id": "prompt-001",
      "level": "beginner",
      "question": "Claude Codeに指示を出す際、最も基本的な方法はどれですか？",
      "choices": ["自然言語でやりたいことを説明する", "専用のプログラミング言語を書く", "設定ファイルのみを編集する", "指示は出せない"],
      "correctIndex": 0,
      "explanation": "Claude Codeは自然言語での指示を理解し、必要なツールを判断して実行します。"
    },
    {
      "id": "prompt-002",
      "level": "beginner",
      "question": "曖昧な指示より具体的な指示の方が良い結果につながりやすい理由として適切なものはどれですか？",
      "choices": [
        "意図が明確になり、誤解による手戻りが減るため",
        "具体的な指示の方が文字数が少ないため",
        "曖昧な指示はエラーになるため",
        "具体的な指示のみが受け付けられる仕様のため"
      ],
      "correctIndex": 0,
      "explanation": "具体的な指示は意図の誤解を減らし、期待通りの結果を得やすくします。"
    },
    {
      "id": "prompt-003",
      "level": "beginner",
      "question": "大きすぎるタスクを依頼した際に起こりやすい問題はどれですか？",
      "choices": [
        "意図しない範囲まで変更されたり、精度が落ちたりしやすい",
        "必ず高速に処理される",
        "常に完璧な結果が返る",
        "問題は起こらない"
      ],
      "correctIndex": 0,
      "explanation": "タスクが大きすぎると意図しない変更や精度低下が起きやすく、適切な粒度への分割が望ましいです。"
    },
    {
      "id": "prompt-004",
      "level": "beginner",
      "question": "Claude Codeからの提案に納得できない場合、適切な対応はどれですか？",
      "choices": [
        "理由を伝えてフィードバックし、修正を依頼する",
        "常にそのまま受け入れる",
        "セッションを毎回作り直す",
        "何も伝えずに手動で直す"
      ],
      "correctIndex": 0,
      "explanation": "納得できない提案には理由を伝えてフィードバックすることで、より適切な修正を引き出せます。"
    },
    {
      "id": "prompt-005",
      "level": "intermediate",
      "question": "実装を依頼する前に設計方針を確認したい場合に有効なアプローチはどれですか？",
      "choices": [
        "先に計画やアプローチを説明させ、合意してから実装させる",
        "常にすぐ実装させ、後で全て作り直す",
        "設計の確認はできない",
        "常に複数の実装を並行して依頼する"
      ],
      "correctIndex": 0,
      "explanation": "先に計画・設計方針を確認することで、手戻りの少ない実装につなげられます。"
    },
    {
      "id": "prompt-006",
      "level": "intermediate",
      "question": "プロジェクト固有の規約やコンテキストを毎回説明せずに済ませるための工夫はどれですか？",
      "choices": [
        "CLAUDE.mdなどのプロジェクトドキュメントに規約を記述しておく",
        "毎回同じ説明を手打ちする",
        "規約を伝える方法はない",
        "画像で規約を送る"
      ],
      "correctIndex": 0,
      "explanation": "CLAUDE.mdなどに規約を記述しておくことで、セッションをまたいで自動的に参照されます。"
    },
    {
      "id": "prompt-007",
      "level": "intermediate",
      "question": "複数のファイルにまたがる大きな変更を依頼する際、良い協働作法はどれですか？",
      "choices": [
        "タスクを段階に分け、都度結果を確認しながら進める",
        "一度に全ての変更を無条件に任せ、確認は一切しない",
        "常に1ファイルずつ完全に独立したセッションで行う",
        "変更内容を一切説明しない"
      ],
      "correctIndex": 0,
      "explanation": "段階的に進めて都度確認することで、意図とのズレを早期に発見できます。"
    },
    {
      "id": "prompt-008",
      "level": "intermediate",
      "question": "曖昧な要求を受けた際にClaude Codeが取りうる望ましい振る舞いはどれですか？",
      "choices": [
        "不明点があればユーザーに確認質問をする",
        "常に黙って推測だけで進める",
        "常にタスクを拒否する",
        "無関係な機能を追加する"
      ],
      "correctIndex": 0,
      "explanation": "不明点がある場合は確認質問を行うことで、誤った前提での作業を避けられます。"
    },
    {
      "id": "prompt-009",
      "level": "advanced",
      "question": "レビュー観点を明確に伝えてコードレビューを依頼したい場合、どのような指示が効果的ですか？",
      "choices": [
        "見てほしい観点（セキュリティ、パフォーマンス等）を具体的に指定する",
        "「レビューして」とだけ伝える",
        "レビュー依頼はサポートされていない",
        "常にコード全体を1行ずつ読ませる"
      ],
      "correctIndex": 0,
      "explanation": "観点を具体的に指定することで、目的に沿った深いレビューを引き出せます。"
    },
    {
      "id": "prompt-010",
      "level": "advanced",
      "question": "大規模な機能追加を任せる前に「設計→計画→実装」のように段階を分ける協働スタイルの利点はどれですか？",
      "choices": [
        "各段階でユーザーが方向性を確認・修正でき、手戻りを最小化できる",
        "作業時間が必ず短縮される",
        "モデルの精度が向上する",
        "実装コードの行数が減る"
      ],
      "correctIndex": 0,
      "explanation": "段階を分けることで各時点での認識合わせができ、大きな手戻りを防げます。"
    },
    {
      "id": "prompt-011",
      "level": "advanced",
      "question": "既存コードベースに変更を加える際、良い協働作法として適切なものはどれですか？",
      "choices": [
        "既存の設計パターンや規約を踏襲するよう指示・確認する",
        "既存パターンは無視して自由に書かせる",
        "常に全面書き換えを依頼する",
        "既存コードは読ませない"
      ],
      "correctIndex": 0,
      "explanation": "既存の設計パターンを踏襲することで、一貫性のあるコードベースを保てます。"
    },
    {
      "id": "prompt-012",
      "level": "advanced",
      "question": "タスクの背景（なぜそれが必要か）を伝えることが有効な理由はどれですか？",
      "choices": [
        "背景を理解することで、明示していない判断も意図に沿って行いやすくなるため",
        "背景説明は結果に一切影響しないため",
        "背景を伝えると処理が遅くなるだけのため",
        "背景説明は禁止されているため"
      ],
      "correctIndex": 0,
      "explanation": "タスクの背景を伝えることで、明示的に指示していない細部の判断も意図に沿ったものになりやすくなります。"
    },
    {
      "id": "prompt-013",
      "level": "expert",
      "question": "複数のサブエージェントに並行してタスクを分担させる際、良い設計方針はどれですか？",
      "choices": [
        "互いに依存しない独立したタスクに分割してから割り当てる",
        "全サブエージェントに同一のタスクを与える",
        "サブエージェント間で共有状態を前提に設計する",
        "並行実行は常に避けるべきである"
      ],
      "correctIndex": 0,
      "explanation": "独立したタスクに分割することで、並行実行時の競合や依存関係の問題を避けられます。"
    },
    {
      "id": "prompt-014",
      "level": "expert",
      "question": "長期的に保守されるプロジェクトで、Claude Codeとの協働ルールをチームに定着させる方法として適切なものはどれですか？",
      "choices": [
        "CLAUDE.mdやプラグインなど再利用可能な形でルールを明文化・配布する",
        "口頭での申し送りのみに頼る",
        "各自が独自ルールで自由に運用する",
        "ルール化は不要である"
      ],
      "correctIndex": 0,
      "explanation": "CLAUDE.mdやプラグインなど再利用可能な形式でルールを明文化することで、チーム全体に一貫した協働作法を定着させられます。"
    },
    {
      "id": "prompt-015",
      "level": "expert",
      "question": "Claude Codeの出力を批判的に検証する文化をチームに根付かせる目的として最も適切なものはどれですか？",
      "choices": [
        "生成された内容を無批判に受け入れるリスクを減らし、品質を担保するため",
        "Claude Codeの利用を制限するため",
        "作業速度を落とすことが目的であるため",
        "検証文化は不要であるため"
      ],
      "correctIndex": 0,
      "explanation": "AIの出力であっても批判的に検証する文化を持つことで、品質と信頼性を担保できます。"
    },
    {
      "id": "prompt-016",
      "level": "expert",
      "question": "複雑な意思決定を伴うタスクで、Claude Codeに「計画立案」と「実行」を分離させる設計上の利点はどれですか？",
      "choices": [
        "計画段階でレビューゲートを設けられ、実行前に誤りを修正できる",
        "分離すると常に処理時間が倍になるだけである",
        "計画と実行は技術的に分離できない",
        "分離しても得られる利点はない"
      ],
      "correctIndex": 0,
      "explanation": "計画と実行を分離することで、実行前にレビューを挟み、誤った方向への進行を防げます。"
    }
  ]
}
```

- [ ] **Step 4: `data/questions/security-permissions.json` を作成する**

```json
{
  "domain": "security-permissions",
  "domainLabel": "安全性・権限管理",
  "questions": [
    {
      "id": "security-001",
      "level": "beginner",
      "question": "Claude Codeがファイル変更やコマンド実行を行う前に、デフォルトでユーザーに求めるものはどれですか？",
      "choices": ["許可（パーミッション）の確認", "何も確認せず即実行", "課金情報の入力", "外部認証サーバーへのログイン"],
      "correctIndex": 0,
      "explanation": "デフォルトでは、ファイル変更や特定のコマンド実行の前にユーザーの許可確認が行われます。"
    },
    {
      "id": "security-002",
      "level": "beginner",
      "question": "許可を求められた操作を拒否した場合、一般的にどうなりますか？",
      "choices": [
        "その操作は実行されず、Claude Codeは代替案を検討する",
        "強制的に実行される",
        "セッションが即座に終了する",
        "アプリがクラッシュする"
      ],
      "correctIndex": 0,
      "explanation": "拒否された操作は実行されず、Claude Codeはユーザーの意図を踏まえて別の方法を検討します。"
    },
    {
      "id": "security-003",
      "level": "beginner",
      "question": "破壊的な可能性のある操作（例: ファイル削除）に対する適切な向き合い方はどれですか？",
      "choices": [
        "内容をよく確認してから許可するか判断する",
        "内容を確認せず常に許可する",
        "常に拒否して何もさせない",
        "確認する必要はない"
      ],
      "correctIndex": 0,
      "explanation": "破壊的な可能性のある操作は内容をよく確認してから許可を判断することが重要です。"
    },
    {
      "id": "security-004",
      "level": "beginner",
      "question": "APIキーやパスワードなどの秘密情報の扱いとして適切なものはどれですか？",
      "choices": [
        "コードやリポジトリに直接書き込まないようにする",
        "READMEに平文で書いておく",
        "コミットメッセージに含める",
        "特に気にする必要はない"
      ],
      "correctIndex": 0,
      "explanation": "秘密情報はコードやリポジトリに直接書き込まず、環境変数などで安全に管理すべきです。"
    },
    {
      "id": "security-005",
      "level": "intermediate",
      "question": "特定のコマンドを毎回確認せずに自動許可したい場合に使う仕組みはどれですか？",
      "choices": [
        "permissions設定でのallowリスト登録",
        "常に手動確認するしかない",
        "全操作を無条件許可するモードのみ存在する",
        "自動許可の仕組みはない"
      ],
      "correctIndex": 0,
      "explanation": "settings.json等のpermissions設定でallowリストに登録することで、特定操作を自動許可できます。"
    },
    {
      "id": "security-006",
      "level": "intermediate",
      "question": "`git push --force`のような破壊的なコマンドに対して推奨される姿勢はどれですか？",
      "choices": [
        "明示的な指示がない限り実行を避け、実行時は特に慎重に確認する",
        "常に自動許可リストに入れておく",
        "破壊的コマンドは存在しない",
        "確認不要で自動実行する"
      ],
      "correctIndex": 0,
      "explanation": "強制pushなど破壊的なコマンドは明示的な指示がない限り避け、実行時は慎重な確認が必要です。"
    },
    {
      "id": "security-007",
      "level": "intermediate",
      "question": "hooksを使ってセキュリティ的な制御を行う目的として適切なものはどれですか？",
      "choices": [
        "特定の危険な操作を自動的にブロックまたは検証する",
        "全ての確認を省略して高速化するためだけに使う",
        "hooksはセキュリティと無関係である",
        "hooksはUIの見た目だけを変更する"
      ],
      "correctIndex": 0,
      "explanation": "hooksを使うことで、特定の危険な操作を自動的に検知しブロックするなどの制御が可能です。"
    },
    {
      "id": "security-008",
      "level": "intermediate",
      "question": "個人利用とチーム利用で権限設定の粒度を分けたい場合、適切な設定の置き場所の考え方はどれですか？",
      "choices": [
        "プロジェクト共有設定とユーザー個人設定を使い分ける",
        "常に1つの設定ファイルに全て書く",
        "権限設定は分離できない",
        "チーム設定は存在しない"
      ],
      "correctIndex": 0,
      "explanation": "プロジェクト共有の設定とユーザー個人の設定を使い分けることで、チームと個人の権限を柔軟に管理できます。"
    },
    {
      "id": "security-009",
      "level": "advanced",
      "question": "MCPサーバーを追加する際に検討すべきセキュリティ上の観点として適切なものはどれですか？",
      "choices": [
        "提供元の信頼性やアクセス範囲を確認してから導入する",
        "提供元を確認せず全て導入して問題ない",
        "MCPサーバーにはセキュリティリスクは存在しない",
        "導入後の確認は不要である"
      ],
      "correctIndex": 0,
      "explanation": "MCPサーバーは外部コードやアクセス権を伴うため、提供元の信頼性やアクセス範囲の確認が重要です。"
    },
    {
      "id": "security-010",
      "level": "advanced",
      "question": "サンドボックス化されていない環境でBashツールを広く自動許可することのリスクとして適切なものはどれですか？",
      "choices": [
        "意図しないコマンドが誤って実行され、システムに影響を与える可能性がある",
        "リスクは一切存在しない",
        "処理速度が低下するだけである",
        "常にモデルが自動的に安全な範囲に制限する"
      ],
      "correctIndex": 0,
      "explanation": "広範なBashコマンドの自動許可は、意図しない実行によるシステムへの影響リスクを高めます。"
    },
    {
      "id": "security-011",
      "level": "advanced",
      "question": "危険な操作を自動ブロックするhookを設計する際、確認すべき重要な点はどれですか？",
      "choices": [
        "誤検知や正当な操作まで過剰にブロックしないバランスを取る",
        "とにかく全ての操作をブロックすればよい",
        "hookの設計にバランスは不要である",
        "ブロック条件は曖昧なままでよい"
      ],
      "correctIndex": 0,
      "explanation": "過剰ブロックは生産性を落とすため、正当な操作を妨げないバランスの取れた設計が重要です。"
    },
    {
      "id": "security-012",
      "level": "advanced",
      "question": "共有リポジトリで作業する際、force pushや履歴の書き換えを避けるべき理由はどれですか？",
      "choices": [
        "他のメンバーの作業履歴を破壊し、共同作業に悪影響を与えるため",
        "force pushは技術的に不可能であるため",
        "履歴の書き換えは常に安全であるため",
        "理由は特にない"
      ],
      "correctIndex": 0,
      "explanation": "共有ブランチでのforce pushや履歴書き換えは、他メンバーの作業を破壊するリスクがあるため避けるべきです。"
    },
    {
      "id": "security-013",
      "level": "expert",
      "question": "組織全体でClaude Codeの権限ポリシーを一貫させたい場合に有効な方法はどれですか？",
      "choices": [
        "共有設定やプラグインを通じて許可・拒否ルールを組織的に配布・強制する",
        "各メンバーが個別に自由な設定を行う",
        "ポリシーの一貫性は実現不可能である",
        "権限設定は個人のみが持てる"
      ],
      "correctIndex": 0,
      "explanation": "共有設定やプラグインを通じてルールを配布することで、組織的に一貫した権限ポリシーを実現できます。"
    },
    {
      "id": "security-014",
      "level": "expert",
      "question": "CI/CDパイプラインでClaude Codeを非対話的に実行する際、権限管理上特に注意すべき点はどれですか？",
      "choices": [
        "対話的な確認ができないため、事前に許可範囲を明示的かつ最小限に設定する",
        "CI環境では権限確認の概念自体が不要である",
        "常に全操作を無条件許可すればよい",
        "非対話実行では権限設定は無視される"
      ],
      "correctIndex": 0,
      "explanation": "非対話実行では都度の確認ができないため、事前に許可範囲を明示的かつ最小限に設定することが重要です。"
    },
    {
      "id": "security-015",
      "level": "expert",
      "question": "MCPサーバー経由で外部システムへの書き込み権限を与える設計をする際、最もリスクを抑える考え方はどれですか？",
      "choices": [
        "必要最小限のスコープ・権限のみを付与する最小権限の原則に従う",
        "常に管理者権限を付与しておく",
        "権限スコープの概念はMCPには存在しない",
        "最小権限の原則は関係ない"
      ],
      "correctIndex": 0,
      "explanation": "外部システムへの書き込み権限は、最小権限の原則に従い必要最小限のスコープに絞ることでリスクを抑えられます。"
    },
    {
      "id": "security-016",
      "level": "expert",
      "question": "危険な操作の自動ブロックをhookで実装しつつ、正当な緊急対応を妨げないための設計として適切なものはどれですか？",
      "choices": [
        "ブロック条件を明確化しつつ、明示的な承認フローを通じた例外経路を用意する",
        "例外を一切認めず常に全面ブロックする",
        "hookによるブロックには例外を設けられない",
        "緊急時は権限設定自体を無視してよい"
      ],
      "correctIndex": 0,
      "explanation": "ブロック条件を明確にしつつ、明示的な承認を伴う例外経路を用意することで、安全性と柔軟性を両立できます。"
    }
  ]
}
```

- [ ] **Step 5: 4ファイルとも有効なJSONであることを確認する**

Run:
```bash
node -e "
const fs = require('fs');
['basic-operations','feature-usage','prompt-design','security-permissions'].forEach(f => {
  const d = JSON.parse(fs.readFileSync('./data/questions/' + f + '.json', 'utf8'));
  console.log(f, d.questions.length, 'questions');
  const byLevel = {};
  d.questions.forEach(q => byLevel[q.level] = (byLevel[q.level] || 0) + 1);
  console.log(byLevel);
});
"
```

Expected: 各ファイルとも `questions.length` が16、`byLevel` が `{beginner: 4, intermediate: 4, advanced: 4, expert: 4}` のように各レベル4問ずつ表示される。エラーが出ないこと。

- [ ] **Step 6: Commit**

```bash
git add data/questions/
git commit -m "feat: add question data for 4 domains"
```

---

## Task 2: 出題選択ロジック（quiz-engine.js）をTDDで実装する

**Files:**
- Create: `js/quiz-engine.js`
- Test: `tests/quiz-engine.test.js`

**Interfaces:**
- Consumes: Task 1で作成したJSONファイルと同じ構造のデータ（`{ domain, domainLabel, questions: [{id, level, question, choices, correctIndex, explanation}] }`）
- Produces:
  - `selectQuestions(domainData, countPerLevel = { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, rng = Math.random)` → 選ばれた問題の配列（`questions`と同じ要素形状、`correctIndex`は含むがシャッフルなし）を返す。合計10問。
  - `buildQuiz(allDomainData, countPerLevel, rng)` → `allDomainData`は`domainData`の配列。各領域について`selectQuestions`を呼び、`{ domain, domainLabel, questions }`の配列（4領域分）を返す。
  - `gradeAnswers(quiz, answers)` → `quiz`は`buildQuiz`の戻り値、`answers`は`{ [questionId]: selectedIndex }`の形のオブジェクト。戻り値は `{ [domain]: { correct: number, total: number } }`。

- [ ] **Step 1: Write the failing tests**

`tests/quiz-engine.test.js` を作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectQuestions, buildQuiz, gradeAnswers } from '../js/quiz-engine.js';

function makeDomainData(domain, countPerLevel = 4) {
  const levels = ['beginner', 'intermediate', 'advanced', 'expert'];
  const questions = [];
  for (const level of levels) {
    for (let i = 0; i < countPerLevel; i++) {
      questions.push({
        id: `${domain}-${level}-${i}`,
        level,
        question: `${domain} ${level} question ${i}`,
        choices: ['a', 'b', 'c', 'd'],
        correctIndex: 0,
        explanation: 'because'
      });
    }
  }
  return { domain, domainLabel: domain, questions };
}

test('selectQuestions returns exactly the requested count per level, totaling 10', () => {
  const data = makeDomainData('basic-operations');
  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, () => 0);

  assert.equal(result.length, 10);
  const byLevel = {};
  for (const q of result) byLevel[q.level] = (byLevel[q.level] || 0) + 1;
  assert.deepEqual(byLevel, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 });
});

test('selectQuestions picks unique question ids (no duplicates)', () => {
  const data = makeDomainData('basic-operations');
  const result = selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, Math.random);
  const ids = result.map(q => q.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('selectQuestions throws when a level does not have enough questions', () => {
  const data = makeDomainData('basic-operations', 1);
  assert.throws(() => {
    selectQuestions(data, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, Math.random);
  }, /beginner/);
});

test('buildQuiz builds one entry per domain with domain metadata preserved', () => {
  const domains = ['basic-operations', 'feature-usage', 'prompt-design', 'security-permissions'].map(d => makeDomainData(d));
  const quiz = buildQuiz(domains, { beginner: 3, intermediate: 3, advanced: 2, expert: 2 }, () => 0);

  assert.equal(quiz.length, 4);
  for (const entry of quiz) {
    assert.equal(entry.questions.length, 10);
    assert.ok(domains.some(d => d.domain === entry.domain));
    assert.equal(entry.domainLabel, entry.domain);
  }
});

test('gradeAnswers counts correct and total per domain', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: 'basic-operations',
      questions: [
        { id: 'q1', correctIndex: 0 },
        { id: 'q2', correctIndex: 1 },
      ]
    },
    {
      domain: 'feature-usage',
      domainLabel: 'feature-usage',
      questions: [
        { id: 'q3', correctIndex: 2 },
      ]
    }
  ];
  const answers = { q1: 0, q2: 0, q3: 2 };

  const result = gradeAnswers(quiz, answers);

  assert.deepEqual(result, {
    'basic-operations': { correct: 1, total: 2 },
    'feature-usage': { correct: 1, total: 1 },
  });
});

test('gradeAnswers treats unanswered questions as incorrect', () => {
  const quiz = [
    {
      domain: 'basic-operations',
      domainLabel: 'basic-operations',
      questions: [
        { id: 'q1', correctIndex: 0 },
      ]
    }
  ];
  const result = gradeAnswers(quiz, {});
  assert.deepEqual(result, { 'basic-operations': { correct: 0, total: 1 } });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/quiz-engine.test.js`
Expected: FAIL — `js/quiz-engine.js` が存在しないため `Cannot find module '../js/quiz-engine.js'` のようなエラーになる。

- [ ] **Step 3: Write the implementation**

`js/quiz-engine.js` を作成する。

```javascript
function shuffle(array, rng) {
  const result = array.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectQuestions(domainData, countPerLevel, rng = Math.random) {
  const selected = [];
  for (const [level, count] of Object.entries(countPerLevel)) {
    const pool = domainData.questions.filter(q => q.level === level);
    if (pool.length < count) {
      throw new Error(
        `Domain "${domainData.domain}" does not have enough "${level}" questions: needs ${count}, has ${pool.length}`
      );
    }
    const chosen = shuffle(pool, rng).slice(0, count);
    selected.push(...chosen);
  }
  return selected;
}

export function buildQuiz(allDomainData, countPerLevel, rng = Math.random) {
  return allDomainData.map(domainData => ({
    domain: domainData.domain,
    domainLabel: domainData.domainLabel,
    questions: selectQuestions(domainData, countPerLevel, rng),
  }));
}

export function gradeAnswers(quiz, answers) {
  const result = {};
  for (const entry of quiz) {
    let correct = 0;
    for (const question of entry.questions) {
      if (answers[question.id] === question.correctIndex) {
        correct += 1;
      }
    }
    result[entry.domain] = { correct, total: entry.questions.length };
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/quiz-engine.test.js`
Expected: PASS（6テスト全て成功）

- [ ] **Step 5: Commit**

```bash
git add js/quiz-engine.js tests/quiz-engine.test.js
git commit -m "feat: add quiz-engine question selection and grading logic"
```

---

## Task 3: レベル判定ロジック（level-judge.js）をTDDで実装する

**Files:**
- Create: `js/level-judge.js`
- Test: `tests/level-judge.test.js`

**Interfaces:**
- Consumes: Task 2の`gradeAnswers`が返す `{ [domain]: { correct: number, total: number } }` 形式のオブジェクト
- Produces:
  - `LEVELS = ['beginner', 'intermediate', 'advanced', 'expert']`（この順で低い→高い）
  - `LEVEL_LABELS = { beginner: '初級', intermediate: '中級', advanced: '上級', expert: 'エキスパート' }`
  - `judgeDomainLevel(correct, total)` → 正答率から`'beginner' | 'intermediate' | 'advanced' | 'expert'`を返す（90%以上=expert, 70%以上90%未満=advanced, 50%以上70%未満=intermediate, 50%未満=beginner）
  - `judgeAllLevels(gradeResult)` → `gradeResult`は`gradeAnswers`の戻り値。戻り値は `{ domains: { [domain]: { level, correct, total, accuracy } }, overall: level }`。`overall`は全領域のうち最も低いレベル。

- [ ] **Step 1: Write the failing tests**

`tests/level-judge.test.js` を作成する。

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeDomainLevel, judgeAllLevels, LEVELS, LEVEL_LABELS } from '../js/level-judge.js';

test('judgeDomainLevel returns expert for 90% or higher', () => {
  assert.equal(judgeDomainLevel(9, 10), 'expert');
  assert.equal(judgeDomainLevel(10, 10), 'expert');
});

test('judgeDomainLevel returns advanced for 70% up to but excluding 90%', () => {
  assert.equal(judgeDomainLevel(7, 10), 'advanced');
  assert.equal(judgeDomainLevel(8, 10), 'advanced');
});

test('judgeDomainLevel returns intermediate for 50% up to but excluding 70%', () => {
  assert.equal(judgeDomainLevel(5, 10), 'intermediate');
  assert.equal(judgeDomainLevel(6, 10), 'intermediate');
});

test('judgeDomainLevel returns beginner below 50%', () => {
  assert.equal(judgeDomainLevel(4, 10), 'beginner');
  assert.equal(judgeDomainLevel(0, 10), 'beginner');
});

test('LEVELS is ordered from lowest to highest', () => {
  assert.deepEqual(LEVELS, ['beginner', 'intermediate', 'advanced', 'expert']);
});

test('LEVEL_LABELS provides Japanese labels for all levels', () => {
  for (const level of LEVELS) {
    assert.ok(LEVEL_LABELS[level], `missing label for ${level}`);
  }
});

test('judgeAllLevels computes per-domain level and accuracy', () => {
  const gradeResult = {
    'basic-operations': { correct: 9, total: 10 },
    'feature-usage': { correct: 5, total: 10 },
  };
  const result = judgeAllLevels(gradeResult);

  assert.equal(result.domains['basic-operations'].level, 'expert');
  assert.equal(result.domains['basic-operations'].accuracy, 0.9);
  assert.equal(result.domains['feature-usage'].level, 'intermediate');
  assert.equal(result.domains['feature-usage'].accuracy, 0.5);
});

test('judgeAllLevels sets overall to the lowest domain level (bucket principle)', () => {
  const gradeResult = {
    'basic-operations': { correct: 10, total: 10 }, // expert
    'feature-usage': { correct: 5, total: 10 },      // intermediate
    'prompt-design': { correct: 8, total: 10 },       // advanced
    'security-permissions': { correct: 2, total: 10 }, // beginner
  };
  const result = judgeAllLevels(gradeResult);
  assert.equal(result.overall, 'beginner');
});

test('judgeAllLevels overall equals the common level when all domains match', () => {
  const gradeResult = {
    'basic-operations': { correct: 8, total: 10 },
    'feature-usage': { correct: 7, total: 10 },
  };
  const result = judgeAllLevels(gradeResult);
  assert.equal(result.overall, 'advanced');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test tests/level-judge.test.js`
Expected: FAIL — `js/level-judge.js` が存在しないためモジュール読み込みエラー。

- [ ] **Step 3: Write the implementation**

`js/level-judge.js` を作成する。

```javascript
export const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];

export const LEVEL_LABELS = {
  beginner: '初級',
  intermediate: '中級',
  advanced: '上級',
  expert: 'エキスパート',
};

export function judgeDomainLevel(correct, total) {
  const accuracy = total === 0 ? 0 : correct / total;
  if (accuracy >= 0.9) return 'expert';
  if (accuracy >= 0.7) return 'advanced';
  if (accuracy >= 0.5) return 'intermediate';
  return 'beginner';
}

export function judgeAllLevels(gradeResult) {
  const domains = {};
  let lowestIndex = LEVELS.length - 1;

  for (const [domain, { correct, total }] of Object.entries(gradeResult)) {
    const level = judgeDomainLevel(correct, total);
    const accuracy = total === 0 ? 0 : correct / total;
    domains[domain] = { level, correct, total, accuracy };
    const levelIndex = LEVELS.indexOf(level);
    if (levelIndex < lowestIndex) {
      lowestIndex = levelIndex;
    }
  }

  return { domains, overall: LEVELS[lowestIndex] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/level-judge.test.js`
Expected: PASS（9テスト全て成功）

- [ ] **Step 5: Commit**

```bash
git add js/level-judge.js tests/level-judge.test.js
git commit -m "feat: add level-judge domain and overall level judgement logic"
```

---

## Task 4: 改善提案データ（report-content.js）とlocalStorageラッパー（storage.js）を実装する

**Files:**
- Create: `js/report-content.js`
- Create: `js/storage.js`

**Interfaces:**
- Consumes: Task 3の `LEVELS`, `LEVEL_LABELS`（`report-content.js`から参照）
- Produces:
  - `report-content.js`: `getImprovementSuggestion(domain, level)` → 領域とレベルの組み合わせに対応する改善提案文字列を返す。該当データがない場合は汎用のフォールバック文を返す。
  - `storage.js`: `saveResult(resultObject)` / `loadResult()` / `clearResult()`。`saveResult`は`localStorage.setItem('cc-diagnosis-result', JSON.stringify(resultObject))`相当、`loadResult`はパースして返す（存在しない・パース失敗時は`null`）、`clearResult`は`removeItem`。localStorageが使えない環境（例外が飛ぶ場合）は`saveResult`が例外を投げずに`false`を返し、`loadResult`は`null`を返す。

- [ ] **Step 1: `js/report-content.js` を作成する**

各領域×各レベル（次に上げるべきレベル基準）の改善提案を用意する。レベルは「現在のレベル」を指定し、次のレベルに向けた提案を返す。

```javascript
import { LEVEL_LABELS } from './level-judge.js';

const SUGGESTIONS = {
  'basic-operations': {
    beginner: '基本コマンド（起動、/clear、Ctrl+Cでの中断など）を実際に手を動かして繰り返し使い、CLI操作に慣れましょう。',
    intermediate: 'CLAUDE.mdの活用やファイル参照（@記法）など、日常操作を効率化する機能を積極的に使ってみましょう。',
    advanced: 'git worktreeやバックグラウンド実行など、複数タスクを並行して進めるための機能を活用してみましょう。',
    expert: '非対話モードやcronスケジュール実行など、CI/CDや自動化パイプラインへの組み込みに挑戦してみましょう。',
  },
  'feature-usage': {
    beginner: 'Edit・Bash・Grepなど基本的な組み込みツールがどう使われているかを意識しながら、日々の操作で観察してみましょう。',
    intermediate: 'カスタムスラッシュコマンドやMCPサーバーを1つ導入し、定型作業の自動化を体験してみましょう。',
    advanced: 'サブエージェントやフック（hooks）を使い、タスクの分離や自動検証の仕組みを設計してみましょう。',
    expert: '複数MCPサーバーやフックを組み合わせた高度な自動化・検証パイプラインの設計に挑戦しましょう。',
  },
  'prompt-design': {
    beginner: 'まずは具体的で明確な指示を出す練習をし、曖昧な依頼を避けることを意識しましょう。',
    intermediate: '実装前に設計方針を確認してもらう「計画→実装」の2段階の依頼スタイルを試してみましょう。',
    advanced: 'タスクの背景や意図を伝えることで、細部の判断も期待通りになるよう協働作法を磨きましょう。',
    expert: '複数タスクの並行分担や、チーム全体への協働ルールの明文化・展開に取り組んでみましょう。',
  },
  'security-permissions': {
    beginner: '許可確認の意味を理解し、内容をよく確認してから許可・拒否を判断する習慣をつけましょう。',
    intermediate: 'permissions設定でのallow/denyリストを使い、日常的な操作の許可管理を整理してみましょう。',
    advanced: 'hooksを使った危険操作の自動検知・ブロックの仕組みや、MCPサーバー導入時のリスク評価を実践しましょう。',
    expert: '組織全体への権限ポリシーの展開や、CI/CDでの最小権限設計など、チーム・組織レベルの安全設計に取り組みましょう。',
  },
};

const FALLBACK_SUGGESTION = '基礎から着実に復習し、公式ドキュメントで該当領域の機能を確認してみましょう。';

export function getImprovementSuggestion(domain, level) {
  const domainSuggestions = SUGGESTIONS[domain];
  if (!domainSuggestions) return FALLBACK_SUGGESTION;
  return domainSuggestions[level] || FALLBACK_SUGGESTION;
}

export function getLevelLabel(level) {
  return LEVEL_LABELS[level] || level;
}
```

- [ ] **Step 2: `js/storage.js` を作成する**

```javascript
const STORAGE_KEY = 'cc-diagnosis-result';

export function saveResult(resultObject) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resultObject));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadResult() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

export function clearResult() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (err) {
    return false;
  }
}
```

- [ ] **Step 3: Node.jsから構文・動作エラーがないことを確認する**

Run:
```bash
node -e "
global.localStorage = (() => { let store = {}; return {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
}; })();
import('./js/storage.js').then(async ({ saveResult, loadResult, clearResult }) => {
  console.log('save:', saveResult({ overall: 'advanced' }));
  console.log('load:', loadResult());
  console.log('clear:', clearResult());
  console.log('load after clear:', loadResult());
});
"
```

Expected: `save: true`、`load: { overall: 'advanced' }`、`clear: true`、`load after clear: null` の順に出力される。

```bash
node -e "
import('./js/report-content.js').then(({ getImprovementSuggestion, getLevelLabel }) => {
  console.log(getImprovementSuggestion('basic-operations', 'beginner'));
  console.log(getImprovementSuggestion('unknown-domain', 'beginner'));
  console.log(getLevelLabel('expert'));
});
"
```

Expected: 1行目は基本操作beginner向けの提案文、2行目はフォールバック文、3行目は `エキスパート` が出力される。エラーが出ないこと。

- [ ] **Step 4: Commit**

```bash
git add js/report-content.js js/storage.js
git commit -m "feat: add improvement suggestions and localStorage wrapper"
```

---

## Task 5: トップページ（index.html）を実装する

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/top-page.js`

**Interfaces:**
- Consumes: Task 4の`js/storage.js`の`loadResult()`
- Produces: `css/style.css`は以降のTask 6, 7でも共通利用するグローバルスタイル。`index.html`から`quiz.html`への遷移リンク/ボタンを提供する。

- [ ] **Step 1: `css/style.css` を作成する**

```css
:root {
  --color-bg: #f7f7f9;
  --color-text: #1f2328;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-border: #d0d7de;
  --color-card-bg: #ffffff;
  --color-beginner: #6b7280;
  --color-intermediate: #2563eb;
  --color-advanced: #7c3aed;
  --color-expert: #d97706;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Kaku Gothic ProN", sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

.container {
  max-width: 720px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.card {
  background: var(--color-card-bg);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
}

h1 {
  font-size: 1.75rem;
  margin-bottom: 0.5rem;
}

h2 {
  font-size: 1.25rem;
  margin-top: 0;
}

.button {
  display: inline-block;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
  text-decoration: none;
}

.button:hover {
  background: var(--color-primary-hover);
}

.button.secondary {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.progress {
  font-size: 0.9rem;
  color: #57606a;
  margin-bottom: 1rem;
}

.choice-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}

.choice-item {
  margin-bottom: 0.75rem;
}

.choice-button {
  width: 100%;
  text-align: left;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-card-bg);
  cursor: pointer;
  font-size: 1rem;
}

.choice-button:hover {
  border-color: var(--color-primary);
}

.choice-button.selected {
  border-color: var(--color-primary);
  background: #eff6ff;
}

.level-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 999px;
  color: #fff;
  font-size: 0.85rem;
  font-weight: bold;
}

.level-badge.beginner { background: var(--color-beginner); }
.level-badge.intermediate { background: var(--color-intermediate); }
.level-badge.advanced { background: var(--color-advanced); }
.level-badge.expert { background: var(--color-expert); }

.domain-result {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-border);
}

.suggestion {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 1rem;
  margin-top: 0.5rem;
}

.actions {
  display: flex;
  gap: 1rem;
  margin-top: 1.5rem;
}

@media print {
  .no-print {
    display: none !important;
  }
  body {
    background: #fff;
  }
  .card {
    border: none;
    box-shadow: none;
  }
}
```

- [ ] **Step 2: `index.html` を作成する**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code 理解度診断</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Claude Code 理解度診断</h1>
      <p>
        基本操作・機能活用・プロンプト設計・安全性の4領域について、
        各10問（計40問前後）の設問に回答すると、領域別・総合の理解度レベルを診断します。
        診断結果はブラウザ内にのみ保存され、外部には送信されません。
      </p>
      <p id="previous-result-note" class="progress" style="display: none;"></p>
      <div class="actions">
        <a class="button" href="quiz.html" id="start-button">診断を始める</a>
        <a class="button secondary" href="result.html" id="view-last-result-button" style="display: none;">前回の結果を見る</a>
      </div>
    </div>
  </div>
  <script type="module" src="js/top-page.js"></script>
</body>
</html>
```

- [ ] **Step 3: `js/top-page.js` を作成する**

```javascript
import { loadResult } from './storage.js';

const previousResult = loadResult();
const note = document.getElementById('previous-result-note');
const viewLastResultButton = document.getElementById('view-last-result-button');

if (previousResult) {
  note.textContent = '前回の診断結果が保存されています。';
  note.style.display = 'block';
  viewLastResultButton.style.display = 'inline-block';
}
```

- [ ] **Step 4: ブラウザで動作確認する**

Run: `python3 -m http.server 8000`（プロジェクトルートで実行）してから `http://localhost:8000/index.html` をブラウザで開く。

Expected: 「Claude Code 理解度診断」の見出しと説明文、「診断を始める」ボタンが表示される。初回はローカルストレージが空なので「前回の結果を見る」ボタンは表示されない。ブラウザのコンソールにエラーが出ていないこと。

- [ ] **Step 5: Commit**

```bash
git add index.html css/style.css js/top-page.js
git commit -m "feat: add top page with diagnosis entry point"
```

---

## Task 6: 診断ページ（quiz.html）を実装する

**Files:**
- Create: `quiz.html`
- Create: `js/quiz-page.js`

**Interfaces:**
- Consumes:
  - `js/quiz-engine.js` の `buildQuiz(allDomainData, countPerLevel, rng)`
  - `js/quiz-engine.js` の `gradeAnswers(quiz, answers)`
  - `js/level-judge.js` の `judgeAllLevels(gradeResult)`
  - `js/storage.js` の `saveResult(resultObject)`
  - `data/questions/*.json` の4ファイルを`fetch`で読み込む
- Produces: `saveResult`に渡す`resultObject`の形状を確定させる: `{ domains: { [domain]: { domainLabel, level, correct, total, accuracy } }, overall, completedAt: ISO8601文字列 }`。これは Task 7 の `result-page.js` が読み込む契約。

- [ ] **Step 1: `quiz.html` を作成する**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>診断中 - Claude Code 理解度診断</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div class="card">
      <p class="progress" id="progress-label"></p>
      <p id="domain-label" class="progress"></p>
      <h2 id="question-text"></h2>
      <ul class="choice-list" id="choice-list"></ul>
    </div>
  </div>
  <script type="module" src="js/quiz-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/quiz-page.js` を作成する**

```javascript
import { buildQuiz, gradeAnswers } from './quiz-engine.js';
import { judgeAllLevels, LEVELS } from './level-judge.js';
import { saveResult } from './storage.js';

const DOMAIN_FILES = [
  'data/questions/basic-operations.json',
  'data/questions/feature-usage.json',
  'data/questions/prompt-design.json',
  'data/questions/security-permissions.json',
];

const COUNT_PER_LEVEL = { beginner: 3, intermediate: 3, advanced: 2, expert: 2 };

const progressLabel = document.getElementById('progress-label');
const domainLabelEl = document.getElementById('domain-label');
const questionTextEl = document.getElementById('question-text');
const choiceListEl = document.getElementById('choice-list');

async function loadAllDomainData() {
  const responses = await Promise.all(DOMAIN_FILES.map(path => fetch(path)));
  return Promise.all(responses.map(res => {
    if (!res.ok) throw new Error(`Failed to load ${res.url}`);
    return res.json();
  }));
}

function flattenQuiz(quiz) {
  const flat = [];
  for (const entry of quiz) {
    for (const question of entry.questions) {
      flat.push({ domain: entry.domain, domainLabel: entry.domainLabel, ...question });
    }
  }
  return flat;
}

function renderQuestion(flatQuestions, index, answers, onAnswer) {
  const item = flatQuestions[index];
  progressLabel.textContent = `質問 ${index + 1} / ${flatQuestions.length}`;
  domainLabelEl.textContent = item.domainLabel;
  questionTextEl.textContent = item.question;
  choiceListEl.innerHTML = '';

  item.choices.forEach((choiceText, choiceIndex) => {
    const li = document.createElement('li');
    li.className = 'choice-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'choice-button';
    button.textContent = choiceText;
    if (answers[item.id] === choiceIndex) {
      button.classList.add('selected');
    }
    button.addEventListener('click', () => onAnswer(item.id, choiceIndex));
    li.appendChild(button);
    choiceListEl.appendChild(li);
  });
}

async function main() {
  let quiz;
  try {
    const allDomainData = await loadAllDomainData();
    quiz = buildQuiz(allDomainData, COUNT_PER_LEVEL, Math.random);
  } catch (err) {
    questionTextEl.textContent = '問題データの読み込みに失敗しました。ページを再読み込みしてください。';
    return;
  }

  const flatQuestions = flattenQuiz(quiz);
  const answers = {};
  let currentIndex = 0;

  function goToNext() {
    if (currentIndex < flatQuestions.length - 1) {
      currentIndex += 1;
      renderQuestion(flatQuestions, currentIndex, answers, handleAnswer);
    } else {
      finishQuiz();
    }
  }

  function handleAnswer(questionId, choiceIndex) {
    answers[questionId] = choiceIndex;
    setTimeout(goToNext, 200);
  }

  function finishQuiz() {
    const gradeResult = gradeAnswers(quiz, answers);
    const judged = judgeAllLevels(gradeResult);

    const domains = {};
    for (const entry of quiz) {
      const domainJudged = judged.domains[entry.domain];
      domains[entry.domain] = {
        domainLabel: entry.domainLabel,
        level: domainJudged.level,
        correct: domainJudged.correct,
        total: domainJudged.total,
        accuracy: domainJudged.accuracy,
      };
    }

    saveResult({
      domains,
      overall: judged.overall,
      completedAt: new Date().toISOString(),
    });

    window.location.href = 'result.html';
  }

  renderQuestion(flatQuestions, currentIndex, answers, handleAnswer);
}

main();
```

- [ ] **Step 3: ブラウザで動作確認する**

Run: `python3 -m http.server 8000`（既に起動していれば再利用）してから `http://localhost:8000/quiz.html` を開く。

Expected: 1問目が表示され、進捗が「質問 1 / 40」と表示される。選択肢をクリックすると自動的に次の質問へ進む。40問すべて回答すると`result.html`へ遷移する（Task 7完了前は404になるのは想定通り）。ブラウザコンソールにエラーが出ていないこと。

- [ ] **Step 4: Commit**

```bash
git add quiz.html js/quiz-page.js
git commit -m "feat: add quiz page with question flow and grading"
```

---

## Task 7: 結果ページ（result.html）を実装する

**Files:**
- Create: `result.html`
- Create: `js/result-page.js`

**Interfaces:**
- Consumes:
  - `js/storage.js` の `loadResult()` — Task 6で保存した `{ domains: { [domain]: { domainLabel, level, correct, total, accuracy } }, overall, completedAt } ` 形状のオブジェクト
  - `js/level-judge.js` の `LEVEL_LABELS`
  - `js/report-content.js` の `getImprovementSuggestion(domain, level)`

- [ ] **Step 1: `result.html` を作成する**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>診断結果 - Claude Code 理解度診断</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div class="container">
    <div id="no-result" class="card" style="display: none;">
      <h1>診断結果がありません</h1>
      <p>まだ診断が完了していないか、結果の保存に失敗しました。</p>
      <a class="button" href="index.html">トップに戻る</a>
    </div>

    <div id="result-content" style="display: none;">
      <div class="card">
        <h1>診断結果</h1>
        <p id="completed-at" class="progress"></p>
        <h2>総合レベル</h2>
        <span id="overall-level-badge" class="level-badge"></span>
      </div>

      <div class="card">
        <h2>領域別レベル</h2>
        <div id="domain-results"></div>
      </div>

      <div class="card">
        <h2>改善提案</h2>
        <div id="suggestions"></div>
      </div>

      <div class="actions no-print">
        <button class="button" id="print-button">PDFとして印刷 / 保存</button>
        <a class="button secondary" href="index.html">トップに戻る</a>
      </div>
    </div>
  </div>
  <script type="module" src="js/result-page.js"></script>
</body>
</html>
```

- [ ] **Step 2: `js/result-page.js` を作成する**

```javascript
import { loadResult } from './storage.js';
import { LEVEL_LABELS, LEVELS } from './level-judge.js';
import { getImprovementSuggestion } from './report-content.js';

const result = loadResult();

const noResultEl = document.getElementById('no-result');
const resultContentEl = document.getElementById('result-content');

if (!result) {
  noResultEl.style.display = 'block';
} else {
  resultContentEl.style.display = 'block';

  document.getElementById('completed-at').textContent =
    `診断日時: ${new Date(result.completedAt).toLocaleString('ja-JP')}`;

  const overallBadge = document.getElementById('overall-level-badge');
  overallBadge.textContent = LEVEL_LABELS[result.overall];
  overallBadge.classList.add(result.overall);

  const domainResultsEl = document.getElementById('domain-results');
  const suggestionsEl = document.getElementById('suggestions');

  // 弱点領域（レベルが最も低い領域、複数あれば正答率が低い順）を特定する
  const domainEntries = Object.entries(result.domains);
  const lowestLevelIndex = Math.min(
    ...domainEntries.map(([, d]) => LEVELS.indexOf(d.level))
  );
  const weakestDomains = domainEntries
    .filter(([, d]) => LEVELS.indexOf(d.level) === lowestLevelIndex)
    .sort((a, b) => a[1].accuracy - b[1].accuracy);

  for (const [domain, data] of domainEntries) {
    const row = document.createElement('div');
    row.className = 'domain-result';
    const percent = Math.round(data.accuracy * 100);
    row.innerHTML = `
      <span>${data.domainLabel}</span>
      <span>
        <span class="level-badge ${data.level}">${LEVEL_LABELS[data.level]}</span>
        <span> ${data.correct}/${data.total}問 (${percent}%)</span>
      </span>
    `;
    domainResultsEl.appendChild(row);
  }

  for (const [domain, data] of weakestDomains) {
    const suggestion = document.createElement('div');
    suggestion.className = 'suggestion';
    suggestion.innerHTML = `
      <strong>${data.domainLabel}（${LEVEL_LABELS[data.level]}）</strong>
      <p>${getImprovementSuggestion(domain, data.level)}</p>
    `;
    suggestionsEl.appendChild(suggestion);
  }

  document.getElementById('print-button').addEventListener('click', () => {
    window.print();
  });
}
```

- [ ] **Step 3: ブラウザで動作確認する（診断フロー全体の通し確認）**

Run: `python3 -m http.server 8000`（起動済みなら再利用）してから `http://localhost:8000/index.html` を開き、「診断を始める」→40問すべてクリックで回答→結果ページへの遷移、を通しで確認する。

Expected:
- 40問回答後、`result.html`に自動遷移する
- 総合レベルバッジと領域別レベル・正答率が表示される
- 「改善提案」に、最もレベルの低い領域（複数あればすべて）の提案文が表示される
- 「PDFとして印刷 / 保存」ボタンを押すと印刷プレビューが開き、`no-print`クラスの要素（ボタン群）が印刷プレビューに表示されない
- トップページに戻ると「前回の結果を見る」ボタンが表示されるようになっている
- ブラウザコンソールにエラーが出ていないこと

- [ ] **Step 4: Commit**

```bash
git add result.html js/result-page.js
git commit -m "feat: add result page with level summary and improvement suggestions"
```

---

## Task 8: READMEを追加し、GitHub Pages公開手順を明記する

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: なし（ドキュメントのみ）
- Produces: なし

- [ ] **Step 1: `README.md` を作成する**

```markdown
# Claude Code 理解度診断

Claude Codeの理解度を4領域（基本操作・CLI使用法／機能活用／プロンプト設計・協働作法／安全性・権限管理）
×4レベル（初級／中級／上級／エキスパート）の観点で診断するWebアプリです。

チーム内の育成・研修を目的とした個人向け診断ツールで、サーバーは使わずブラウザだけで完結します。
診断結果はブラウザの`localStorage`にのみ保存され、外部には送信されません。

## ローカルでの動作確認

ビルド不要です。プロジェクトルートで簡易HTTPサーバーを起動してください。

```bash
python3 -m http.server 8000
```

`http://localhost:8000/index.html` を開いて診断を開始できます。

`file://`で直接HTMLを開くと`fetch`によるJSON読み込みがブラウザのセキュリティ制限で失敗するため、
必ず簡易サーバー経由でアクセスしてください。

## テストの実行

```bash
node --test tests/
```

## GitHub Pagesでの公開

1. GitHubリポジトリの Settings → Pages を開く
2. "Build and deployment" の Source を "Deploy from a branch" に設定
3. Branch を `main`（またはデフォルトブランチ）、フォルダを `/ (root)` に設定して保存
4. 数分後、`https://<ユーザー名>.github.io/<リポジトリ名>/` で公開される

## 問題の追加・修正

`data/questions/*.json` を直接編集してください。各領域のファイルには
`beginner`/`intermediate`/`advanced`/`expert` の4レベルがそれぞれ最低4問ずつ必要です
（1回の診断で各レベルから抽出する問題数: 初級3問・中級3問・上級2問・エキスパート2問）。
```

- [ ] **Step 2: リンクとテストコマンドが正しいことを確認する**

Run: `node --test tests/`
Expected: これまでの全テスト（quiz-engine, level-judge）がPASSする。

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and GitHub Pages deployment instructions"
```

---

## Self-Review Notes

- **Spec coverage:** 4領域×4レベルの問題データ（Task 1）、出題・採点ロジック（Task 2）、領域別/総合レベル判定（Task 3、木桶原理を含む）、改善提案とlocalStorage（Task 4）、3画面（Task 5-7）、PDF出力（`@media print` + `window.print()`、Task 7）、GitHub Pages公開手順（Task 8）を全てカバーしている。
- **Placeholder scan:** 全タスクに実コードを記載済み。「後で実装」「TODO」等のプレースホルダーなし。
- **Type consistency:** `gradeAnswers`の戻り値形状（`{ [domain]: { correct, total } }`）は`judgeAllLevels`の入力形状と一致。`judgeAllLevels`の戻り値（`{ domains: { [domain]: { level, correct, total, accuracy } }, overall }`）はTask 6で`saveResult`に渡す`resultObject`の組み立てに使われ、Task 7の`result-page.js`はその形状（`domains[domain].domainLabel/level/correct/total/accuracy`, `overall`, `completedAt`）を前提に読み込んでおり一致している。
