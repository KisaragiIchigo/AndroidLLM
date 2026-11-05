# Hisoka

Gemma 4 E2B を端末内で動かし、機密文書の添削や私的な雑談を完全オフラインで行う、ストア非公開の Android チャットアプリです（Vite + React + TypeScript / Capacitor / Kotlin + LiteRT-LM）。

## 機能ハイライト

- 🔒 **通信手段そのものを持たない設計**: APK はインターネット権限を一切持たず、会話・添付ファイル・モデルの通信は OS によって遮断されます。
- 💬 **チャットに集中した画面**: ヘッダーやモード切替を置かず、スレッドと入力欄だけで構成しています。シートやメニューは、下へのスワイプ・Android の戻る操作・外側のタップで閉じられます。
- 💡 **Think モード**: 回答前の思考を有効にでき、思考の内容は折りたたみ式のブロックで確認できます。思考トークンの上限を設定できるほか、添削の依頼や短いメッセージでは上限を自動で抑えて応答を速くします。
- 🎭 **アシスタントの人格設定**: 名前・性格と話し方・思考パターンを自由に書けます。よく使う型はプリセットからワンタップで選べます。
- 🧮 **数式の表示**: 回答中の数式（$…$、$…$、(…)、[…]）を KaTeX で描画します。フォントは同梱しているため、オフラインでも表示できます。
- ✍️ **添削と差分表示**: 「添削して」と依頼すると、原文との差分（削除・追加）を回答の中にハイライト表示します。修正後の全文はワンタップでコピーできます。
- 🖼️ **画像・音声・動画・ファイルの添付**: 写真・カメラ・録音・音声ファイル・動画・PDF・Word・テキストに対応しています。スキャンされた PDF はページ画像として読み取ります。
- 🗂️ **履歴の管理**: 会話は自動で保存され、検索・個別削除・全削除ができます。保存しない「揮発モード」も選べます。直前の回答は、添付ファイルを含めてそのまま再生成できます。
- 📦 **2種類の配布形態**: モデルを同梱した APK（1ファイルで完結）と、モデルを別に置く軽量 APK を用意しています。
- 🛡️ **端末内の保護**: 履歴は AES-256-GCM で暗号化し、その鍵は Android Keystore（StrongBox 搭載端末では専用チップ）の RSA 鍵で包んで保存します。スクリーンショットの防止、キーボードの学習抑止、クラウドバックアップの除外も行います。
- 🔑 **履歴を開くときの認証**: 履歴の表示と全削除の前に、生体認証または画面ロックの解除を求めます。会話の保存には認証は不要で、履歴を閉じると復号用の鍵はメモリから消去されます。
- 👁️ **画面の乗っ取り対策**: 他のアプリが画面に重なっている間のタップを無視し、Android 12 以降では他アプリのオーバーレイを非表示にします。画面を読み取れるアクセシビリティサービスが有効な場合は警告します。

## 導入（APK の直接インストール）

`release/` に2種類の APK があります。署名とアプリ ID は共通のため、どちらからどちらへも上書きインストールで切り替えられます。

| APK | サイズ | 端末の使用容量 | 向いている場合 |
| --- | --- | --- | --- |
| `Hisoka-1.3.0-bundled.apk` | 約 2.5GB | 約 5.1GB（APK と展開後のモデル） | 1ファイルで手軽に導入したい場合 |
| `Hisoka-1.3.0.apk` | 約 50MB | 約 2.6GB | 端末の容量を節約したい場合 |

推論エンジンはモデルをファイルとして読み込むため、同梱版では初回起動時に APK からモデルを展開します。APK 自体は削除できないため、同梱版は容量を約2倍使います。

### 同梱版

1. APK を端末に転送し、ファイルアプリから開いてインストールします。提供元不明のアプリのインストール許可を求められた場合は、許可してください。
2. アプリを起動し、「展開する」を押します（1分ほどかかる場合があります）。

### 軽量版

1. 同梱版と同じ手順で APK をインストールします。
2. モデルファイル `gemma-4-E2B-it.litertlm`（約 2.6GB）を PC などで入手します。入手先は Hugging Face の `litert-community/gemma-4-E2B-it-litert-lm` です。
3. アプリを起動し、次のどちらかの方法でモデルを準備します。
   - **ファイルから取り込む**: 端末に置いた .litertlm ファイルを選ぶと、アプリ内にコピーします。
   - **USB で直接置く**: 画面に表示されるフォルダ（`内部ストレージ/Android/data/app.hisoka.offline/files/models`）へ PC からコピーし、「確認する」を押します。

動作の目安は、RAM 8GB 以上・Android 11 以降・arm64 の端末です。

## アーキテクチャ概要

```text
N:\APK
├─ project_style.json                 … 配色・フォント・質感の単一情報源
├─ index.html                         … CSP（self のみ）とビューポート定義
├─ vite.config.ts                     … ビルド設定（フォントを WOFF2 のみに絞る）
├─ capacitor.config.ts                … Capacitor 設定（HTTP 系プラグイン無効・システムバー）
├─ tailwind.config.ts                 … project_style.json と同期したデザイントークン
├─ src/                               … Renderer（WebView 上の UI）
│  ├─ main.tsx                        … フォント読み込みとルート描画
│  ├─ App.tsx                         … 起動フェーズ（モデル準備 / チャット）の切り替え
│  ├─ styles/globals.css              … ベース背景・スクロールバー・選択色・セーフエリア
│  ├─ components/ui/                  … 汎用 UI 部品（Radix ベース）
│  │  ├─ Sheet/                       … ボトムシート
│  │  ├─ ConfirmDialog/               … 破壊的操作の確認ダイアログ
│  │  ├─ Switch/ Slider/ Segmented/   … 設定用の入力部品
│  │  └─ Notice/                      … 警告・エラー表示
│  ├─ features/
│  │  ├─ boot/useEngine.ts            … モデル有無の確認とエンジン読み込み
│  │  ├─ setup/ModelSetup.tsx         … モデルの取り込み画面
│  │  ├─ chat/
│  │  │  ├─ ChatScreen.tsx            … チャット画面のオーケストレータ
│  │  │  ├─ hooks/useChatSession.ts   … 送信・ストリーミング・再生成・保存・会話切替
│  │  │  ├─ hooks/useAttachments.ts   … 添付の選択と入力欄への仮置き
│  │  │  ├─ hooks/useRecorder.ts      … 録音状態とレベルメーター
│  │  │  ├─ hooks/regenerationText.ts … 再生成時の本文組み立て
│  │  │  └─ components/               … メッセージ・Think・差分カード・入力欄・各シート
│  │  ├─ history/HistorySheet.tsx     … 認証後の履歴表示・検索・個別削除・全削除
│  │  ├─ security/useAccessibilityWarning.ts … 画面を読み取れるアプリの検出と警告
│  │  └─ settings/
│  │     ├─ SettingsSheet.tsx         … バックエンド・コンテキスト長・Think・プライバシー・データ
│  │     ├─ PersonaSection.tsx        … アシスタントの名前・性格・思考パターン
│  │     ├─ SecuritySection.tsx       … 履歴の認証・鍵の保管場所・アクセシビリティ警告
│  │     └─ parts.tsx                 … 設定画面の共通部品（セクション・行）
│  └─ lib/                            … 副作用を持たない計算層とネイティブ境界
│     ├─ native/                      … Capacitor プラグインの型付きインターフェース
│     ├─ back/backStack.ts            … 戻る操作で最前面のシート・ダイアログから閉じる仕組み
│     ├─ chat/                        … 会話の型・reducer・要約・再開用履歴・システムプロンプト・思考量の調整
│     ├─ persona/presets.ts           … 性格と思考パターンのプリセット
│     ├─ diff/textDiff.ts             … 日本語向け Myers 差分（字種単位＋文字単位の精緻化）
│     ├─ markdown/                    … 表示前の補正（日本語の太字・数式記号の正規化、コード部分は対象外）
│     ├─ proofread/                   … 添削の依頼判定・出力形式の指示・回答からの切り出し
│     ├─ settings.ts                  … 設定（人格を含む）の既定値と保存
│     └─ format.ts / clipboard.ts     … 表示整形とコピー
├─ android/app/src/bundled/assets/models/ … 同梱版にだけ入るモデル（ビルド前に配置・非圧縮で格納）
└─ android/app/src/main/              … Native（Kotlin）
   ├─ AndroidManifest.xml             … INTERNET 権限の除去・バックアップ無効・WebView 計測無効
   ├─ res/layout/capacitor_bridge_layout_main.xml … SecureWebView への差し替え
   ├─ res/drawable/ic_launcher_*_hisoka.xml … アプリアイコン（背景・鍵穴とランプの前景・テーマ用単色）
   └─ java/app/hisoka/offline/
      ├─ MainActivity.kt              … プラグイン登録・画面保護（FLAG_SECURE）・他アプリのオーバーレイ非表示
      ├─ SecureWebView.kt             … キーボードの学習抑止・重なった画面越しのタップ無視
      ├─ security/
      │  ├─ Authenticator.kt          … 生体認証または画面ロックによる本人確認
      │  └─ AccessibilityAudit.kt     … 画面を読み取れるアクセシビリティサービスの列挙
      ├─ DevicePrefs.kt               … 起動前に必要な端末設定
      ├─ llm/                         … 推論
      │  ├─ LlmPlugin.kt              … モデル管理・会話・送信・停止の JS 窓口
      │  ├─ LlmEngine.kt              … LiteRT-LM エンジンと会話の専用スレッド管理
      │  └─ ModelStore.kt             … モデルの所在確認・取り込み・同梱モデルの展開
      ├─ media/                       … 添付の前処理
      │  ├─ MediaPlugin.kt            … 選択・撮影・録音の JS 窓口
      │  ├─ AttachmentStore.kt        … 添付のペイロードをメモリ上でのみ保持（直前の発言分まで）
      │  ├─ ImagePrep.kt              … 縮小・JPEG 化・サムネイル
      │  ├─ AudioPcm.kt               … 16kHz モノラル化と 30 秒単位の WAV 分割
      │  ├─ AudioRecorder.kt          … 16kHz PCM での直接録音
      │  ├─ VideoPrep.kt              … 等間隔のコマ抽出
      │  └─ DocumentText.kt           … PDF・Word・テキストの本文抽出
      └─ vault/                       … 履歴の暗号化保存
         ├─ VaultPlugin.kt            … 履歴の認証・操作、画面保護設定、端末状態の JS 窓口
         ├─ ConversationVault.kt      … 会話本体と要約のファイル（認証なしで書き込み、認証後に読み出し）
         ├─ HistoryKeys.kt            … セッション鍵と、それを包む Keystore の RSA 鍵（StrongBox 優先）
         └─ LegacyCipher.kt           … 旧形式の履歴を移行するための読み出し専用処理
```

## データフロー

```text
[入力欄・添付シート] ──(Capacitor)──▶ MediaPlugin ── 前処理 ──▶ AttachmentStore（メモリのみ）
        │                                                     │
        ▼                                                     ▼
useChatSession ──send──▶ LlmPlugin ── Contents 組み立て ──▶ LlmEngine（専用スレッド）
        ▲                                                     │ LiteRT-LM / Gemma 4 E2B
        └──── llmEvent（本文・思考を 40ms ごとにまとめて通知）◀─┘
        │
        ▼ 生成完了
VaultPlugin ── セッション鍵で AES-256-GCM ──▶ filesDir/vault（揮発モードでは保存しない）
                 └ セッション鍵は Keystore の RSA 公開鍵で包んで保存（読み出しは認証後の秘密鍵でのみ）
```

## 主要技術

| カテゴリ | 採用技術 |
| --- | --- |
| UI | Vite / React 19 / TypeScript / Tailwind CSS v3 / Radix UI / Framer Motion |
| フォント | Bricolage Grotesque / IBM Plex Sans JP / IBM Plex Mono（すべて同梱） |
| 表示 | react-markdown / remark-gfm / remark-cjk-friendly / remark-math + rehype-katex（KaTeX 0.16） |
| ネイティブ連携 | Capacitor 8（Android）/ @capacitor/app（戻る操作） |
| 推論 | LiteRT-LM 0.18（Kotlin API）/ Gemma 4 E2B（.litertlm） |
| 添付処理 | MediaCodec / MediaMetadataRetriever / AudioRecord / PdfRenderer / pdfbox-android |
| 保存 | Android Keystore（StrongBox 優先）の RSA-OAEP + AES-256-GCM / androidx.biometric |

## 開発

前提として Node.js 22 以上、JDK 21、Android SDK（platform 36）が必要です。`android/local.properties` の `sdk.dir` に SDK の場所を指定してください。

```bash
npm install            # 依存関係のインストール
npm run typecheck      # 型チェック
npm run build          # Web 資産のビルド（dist/）
npm run sync           # ビルドして android/ へ反映
npm run apk            # 軽量版の署名済みリリース APK を作成
npm run apk:bundled    # 同梱版の署名済みリリース APK を作成
```

同梱版のビルドには、`android/app/src/bundled/assets/models/gemma-4-E2B-it.litertlm` にモデルを置いておく必要があります（Git の管理対象外です）。

リリース署名には `android/keystore.properties`（`storeFile` / `storePassword` / `keyAlias` / `keyPassword`）が必要です。同じ鍵で署名しないと既存のインストールを上書き更新できないため、鍵ファイルは失くさないように保管してください。

ブラウザ上の `npm run dev` では UI の確認のみ可能です。推論・添付・履歴はネイティブプラグインに依存するため、実機で確認してください。
