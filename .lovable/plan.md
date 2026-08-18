# PW-MARCO — Rebrand + Config Update

Uploaded project (`Heeloo-main`) ek Next.js 15 app hai (App Router + Prisma + Mongoose). Ye poori app is repo me daali jayegi, saare requested changes ke saath, taaki GitHub sync + Vercel deploy ho sake.

Note: Lovable ka live preview Next.js app ke liye kaam nahi karega (preview sirf TanStack template chalata hai). Code, GitHub sync aur Vercel deploy poori tarah kaam karega.

## 1. Project files repo me lana

- Zip se `Heeloo-main/` ka poora content repo root pe copy (node_modules, package-lock cache, `bot-temp/node_modules`, aur koi `.git` metadata chhod ke).
- Purane TanStack template files (`src/`, `vite.config.ts`, `bunfig.toml` etc.) hata kar Next.js structure rakha jayega: `app/`, `components/`, `lib/`, `models/`, `pages/`, `prisma/`, `public/`, `hooks/`, `utils/`, `types/`, `styles/`, `scripts/`, `middleware.ts`, `next.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `package.json`.
- Vercel ke liye: `.gitignore` verify, `vercel.json` (Next.js preset + `prisma generate` build step) add, aur `.env.example` saare required env vars ke saath.

## 2. Database URL

- MongoDB URI: `mongodb+srv://official_marco_22:...@cluster0.6qatd2w.mongodb.net/?appName=Cluster0`
- Ye `MONGODB_URI` env var me set hoga (`lib/mongodb.ts`, `seed-config.ts` isi ko padhte hain). Local ke liye `.env.local` (gitignored), aur `.env.example` me placeholder — asli credential GitHub pe commit nahi hoga; Vercel dashboard me add karna hoga (steps README me).
- App me Prisma/Postgres ka `DATABASE_URL` bhi hai — usko as-is chhoda jayega jab tak aap uska naya URL na dein.

## 3. Admin username & password

- Naya username: `pwmarcofounder@gmail.com`, password: `ApexMarco@22`
- `seed_admin.ts` me default credentials update (password bcrypt hash hoke DB me jayega), saath me `webName`/`sidebarTitle` = `PW-MARCO` aur logo URL.
- Seed script chalane ka command README me document hoga (admin panel login DB ke `ServerConfig` se aata hai, isliye seed run zaroori hai).

## 4. Branding: PW-MARCO

- Har jagah `VDK Study` / `Heeloo` / purana app name → `PW-MARCO`:
  `app/layout.tsx` (title, description, authors/creator cleanup), `lib/serverInfo.ts` defaults, `app/contact/page.tsx`, `app/components/HomePageClient.tsx`, `app/components/sidebar.tsx`, `app/components/AdminLayout.tsx`, `app/auth/login.tsx`, `seed_admin.ts`, `README.md`, `package.json` name.
- Logo: `https://i.ibb.co/YBbwNGxz/Logo-pw-removebg-preview.png` — default `sidebarLogoUrl`, favicon/metadata icon, sidebar/header/contact/login logos aur admin layout me set. `next.config.mjs` me `i.ibb.co` remote image host allow.

## 5. Telegram links

- Saare hardcoded `t.me/...` aur `telegram.me/...` links → `https://t.me/official_marco_22`
  (`app/layout.tsx` author link, `app/contact/page.tsx`, `app/check/page.tsx`, `app/auth/login.tsx`, admin settings placeholders).
- Default channel/username/bot values (`lib/serverInfo.ts`, `seed_admin.ts`, `.env.example` ke `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`) bhi `official_marco_22` par set.

## 6. Deploy documentation

`README.md` me: env vars list (`MONGODB_URI`, `DATABASE_URL`, `NEXT_PUBLIC_APP_NAME=PW-MARCO`, `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, JWT/secret keys), local run steps, admin seed command, aur Vercel deploy steps (import repo → env vars paste → deploy).

## Technical notes

- `bot-temp/node_modules` aur koi bhi vendored dependency commit nahi hogi; sirf `bot-temp/bot.js` jaisi source files.
- Secrets code me hardcode nahi honge — env vars ke through; Mongo URI aur admin password Lovable secrets/`.env.local` me store honge.
- Build check: `next build` locally run karke type/import errors fix kiye jayenge.
