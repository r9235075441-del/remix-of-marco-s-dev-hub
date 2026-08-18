# PW-MARCO

Next.js 15 app (App Router + Pages API) with Prisma/PostgreSQL, JWT auth, an admin panel and an optional Telegram bot.

## 1. Local setup

```bash
npm install
cp .env.example .env
# fill in the values in .env
npx prisma generate
npx prisma db push        # create the tables
npm run seed              # create the admin config / login
npm run dev
```

Optional Telegram bot: `npm run bot` (or `npm run both` for bot + web together).

## 2. Admin credentials

The seed reads them from the environment, so nothing is hard-coded:

```
ADMIN_USERNAME=your-admin
ADMIN_PASSWORD=your-strong-password
```

Re-run `npm run seed` any time to update them (password is bcrypt-hashed).

## 3. Push to GitHub

```bash
git init            # only if not initialised yet
git add .
git commit -m "PW-MARCO"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

`.env` is git-ignored — only `.env.example` is committed.

## 4. Deploy on Vercel

1. vercel.com -> Add New -> Project -> import the GitHub repo.
2. Framework preset: Next.js (build command `npm run build`, nothing to change).
3. Settings -> Environment Variables: add everything from `.env.example`
   (at minimum `DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_NAME`).
   Use hosted Postgres (Neon, Supabase, Vercel Postgres) for `DATABASE_URL`.
4. Deploy. `prisma generate` runs automatically through the `postinstall` script.
5. After the first deploy, seed the production database once:
   `DATABASE_URL="<prod url>" npm run seed`.

The Telegram bot uses long polling and is not run by Vercel — host it separately
(Railway, Render, VPS) with `npm run bot` if you need it.
