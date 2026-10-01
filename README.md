# みんなでTier表

React・TypeScript・ViteとFirebase Realtime Databaseを使ったオンラインTier予想ゲームです。

## 起動

Node.js 22.12以上（または20.19以上）が必要です。

1. npm install
2. .env.exampleを.env.localにコピーし、FirebaseコンソールのWebアプリ設定を入力します。
3. Firebase Realtime Databaseを作成し、databaseURLとデータベースの読み書き権限を確認します。トランザクションは対象の部屋全体への読み書き権限が必要です。
4. npm run dev

## 遊び方

2人以上で参加します。作成者が開始し、全員がお題の項目をS〜Dに配置して確定します。各ラウンドで出題者以外が予想を確定し、出題者が正解を公開します。作成者が次へ進め、全員の出題終了後に合計得点を表示します。

修正前に作られた部屋ではなく、新しい部屋を作成してください。再読み込みすると入室状態はリセットされます。

## 検証

- npm run build: 型検査と本番ビルド
- npm run lint: 静的検査

認証と本番用データベースルールは、このリポジトリには含まれていません。実際のオンライン利用にはFirebase側の設定が必要です。

## 部屋作成が進まない場合

Firebaseコンソールの「構築 → Realtime Database → データ」に表示されるURLを、.env.localのVITE_FIREBASE_DATABASE_URLへそのまま設定してください。プロジェクトIDからURLを推測せず、地域とデータベース名を含む実際のURLを使います。Firestoreとは別のサービスです。

Webアプリの設定値は「プロジェクトの設定 → 全般 → マイアプリ」で確認できます。環境変数変更後は開発サーバーを停止してnpm run devを再実行します。

接続できない場合は約10秒でエラーを表示します。Permission deniedの場合はRealtime Databaseのルールと認証条件を確認してください。このアプリは現在Firebase Authenticationでログインしていません。

最終結果画面でも次のゲームの参加者を受け入れます。ホストが「もう一度あそぶ」を押すと、部屋コードと参加者を維持したまま全員で待機室に戻ります。相性のよいペアは互いの予想得点の平均で選び、同点なら全ペアを表示します。
