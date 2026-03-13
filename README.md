# BrushPro

Field Operations, Business Management & Email Marketing Platform for small painting companies.

## Stack

| Layer | Tech |
|-------|------|
| Mobile | React Native + Expo (Expo Router) |
| Web | React + Vite |
| Backend | Node.js + Express |
| Database | PostgreSQL + Prisma ORM |
| Auth | Supabase Auth + JWT |
| File Storage | Supabase Storage |
| Email | Resend (ALL email — transactional + campaigns) |
| Payments | Stripe |
| PDF | Puppeteer |
| State | Zustand |
| Data | TanStack Query |

## Project Structure

```
brushpro/
├── api/            Express backend + Prisma schema
│   ├── prisma/     schema.prisma (20 tables)
│   └── src/
│       ├── routes/ All API endpoints
│       ├── services/ PDF generation
│       ├── middleware/ Auth, upload, error
│       └── lib/    Prisma, Supabase, Resend clients
├── mobile/         Expo React Native app
│   ├── app/        Expo Router (tabs: Dashboard, Jobs, Contacts, Marketing, Reports, Settings)
│   ├── components/ GlassCard, StatusPill, CurrencyText
│   ├── constants/  Design tokens (colors, glass, typography)
│   └── stores/     Zustand auth store
├── web/            React + Vite web app
│   └── src/
│       ├── pages/  Dashboard, Jobs, Contacts, Marketing, Reports, Settings, Approve
│       ├── components/ AppLayout (sidebar), GlassCard, StatusPill
│       └── lib/    Typed API client
└── shared/         Shared TypeScript types
```

## Setup

### 1. Environment variables

```bash
cp .env.example api/.env
# Fill in all values in api/.env
```

Required:
- `DATABASE_URL` — PostgreSQL connection string (Railway or Supabase)
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID`, `EMAIL_FROM`
- `JWT_SECRET` (min 32 chars)
- `APP_URL` (public URL for approval links)

### 2. Database

```bash
cd api
npm install
npx prisma migrate dev --name init
```

### 3. API

```bash
cd api
npm run dev
# Runs on http://localhost:3001
```

### 4. Web

```bash
cd web
npm install
npm run dev
# Runs on http://localhost:3000 (proxies /api to port 3001)
```

### 5. Mobile

```bash
cd mobile
npm install
npx expo start
```

## Build Phases

### Phase 1 — Foundation (complete)
- Prisma schema (20 tables)
- Supabase Auth + JWT + role middleware
- Company settings + logo upload
- Contacts CRUD + contact lists + tagging
- CSV import for contacts and customers
- Customers + Jobs CRUD
- Labor + Expense entry with photo upload
- Material price book CRUD + CSV import/export
- Dashboard profitability cards
- Tax profiles

### Phase 2 — Billing & Approvals
- Estimate builder with price book picker
- Proposal PDF (branded, total price only)
- Bid approval token link + customer approval page
- Contract template engine + canvas signature + signed PDF
- Invoice builder with tax exemption support
- Estimate-to-invoice conversion
- Stripe payment integration + webhook
- Invoice PDF + email send via Resend

### Phase 3 — Email Marketing
- HTML email builder (block-based drag-and-drop)
- Email template save + thumbnail generation (Puppeteer)
- Campaign creation flow
- Resend Broadcasts API integration
- Resend webhook handler
- Campaign analytics screen

### Phase 4 — Reports & Polish
- Tax collected by jurisdiction report + CSV
- Profit per job report + CSV
- Materials and hours report + CSV
- Overdue invoice reminder cron
- Web 1024px+ sidebar nav (done)
- Push notifications

## Design System

Apple-style glassmorphism throughout:
- Background: `#0A0A0F`
- Glass surface: `rgba(255,255,255,0.07)`
- Border: `rgba(255,255,255,0.12)`
- Backdrop blur: `blur(24px) saturate(180%)`
- Primary: `#007AFF`
- Success: `#34C759` | Warning: `#FF9500` | Danger: `#FF3B30`
- Icons: Lucide (strokeWidth 1.5) — **no emojis anywhere**
- Font: SF Pro / system-ui

## API

Base: `http://localhost:3001/api/v1`

Public endpoints (no auth):
- `POST /auth/login`
- `GET /approve/:token`
- `POST /approve/:token/approve|reject|sign`
- `POST /stripe/webhook`
- `POST /resend/webhook`

All other endpoints require `Authorization: Bearer <token>`.

## Security Notes

- `our_cost` is NEVER returned in customer-facing endpoints (approve, proposal PDF)
- Proposal PDFs show total price only, no line item breakdown
- Stripe webhook signatures are always verified with `stripe.webhooks.constructEvent()`
- All signed URLs from Supabase Storage expire in 24 hours
- Soft delete on customers, jobs, invoices, estimates, contacts
