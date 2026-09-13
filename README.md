# Arsenal Fan Data Hub

Next.js application for Arsenal fixtures, results, standings, news and match analysis.

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

Never expose API keys to browser code or commit `.env` files.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Database and Sync

Generate the Prisma Client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Start the app, then trigger the protected football-data.org sync endpoint with `CRON_SECRET`:

```bash
curl -X POST http://localhost:3000/api/sync/football-data \
  -H "Authorization: Bearer <CRON_SECRET>"
```

The sync stores football-data.org teams, Premier League fixtures and standings using idempotent upserts. See [docs/sprint-1-data-sync.md](docs/sprint-1-data-sync.md) for the model and operational details.

## Official Arsenal content

Official Arsenal news, fixtures and public player profiles are stored separately from the football-data.org dataset. Run the protected sync endpoint with `CRON_SECRET`:

```bash
curl -X POST http://localhost:3000/api/sync/arsenal \
  -H "Authorization: Bearer <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"scope":"all"}'
```

Read them from `/api/arsenal/news`, `/api/arsenal/fixtures` and `/api/arsenal/players`. A finished-match score can be entered through the protected score endpoint; report-based scores require a public report URL. See [docs/official-content-ingestion.md](docs/official-content-ingestion.md) for source, timestamp, rate-limit and fallback rules.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
