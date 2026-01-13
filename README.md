This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Vercel環境での設定

このアプリケーションは`youtubei.js`を使用しており、**APIキーは不要**です。ただし、Vercel環境で正常に動作するために、以下の設定が自動的に適用されています：

1. **タイムアウト設定**: `vercel.json`でServerless Functionsのタイムアウトを60秒に設定
2. **ログ出力**: デバッグ用のログが出力されます（Vercelのダッシュボードで確認可能）

#### トラブルシューティング

本番環境で字幕が取得できない場合：

1. **Vercelのログを確認**: Vercelダッシュボードの「Functions」タブから実行ログを確認
2. **エラーメッセージを確認**: エラーメッセージにタイムアウトやネットワークエラーが含まれていないか確認
3. **タイムアウトの延長**: Hobbyプランでは最大60秒まで。それ以上必要な場合はProプランへのアップグレードを検討

**注意**: 環境変数の設定は不要です。`youtubei.js`はAPIキーなしで動作します。
