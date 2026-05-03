# Splitwise MVP — Backend API

Backend for a small Splitwise-style product: shared expenses, running balances per pair of users, and activity history. Built as a focused REST API you can run locally, exercise with Postman, and walk through in a technical discussion.

## What’s implemented

**Users**

- Sign up with email and password (password stored hashed; never returned in responses).
- Default currency on signup (`USD`, `EUR`, or `INR`).
- Read profile, update email and/or currency, soft-delete account (`accountStatus` → deleted).

**Expenses**

- Create expense: name, amount, currency, member user IDs, date.
- Equal split across all members; the caller (`x-user-id`) is the payer and must be listed in `memberIds`.
- View, update, and delete expenses (update/delete restricted to the payer).
- Activity log: expenses the user appears on, filtered by **current month**, **previous month**, or **custom** date range (filtered by expense date).

**Balances**

- Net balance per counterparty from the `balances` table: positive means they owe you, negative means you owe them (matches `GET /balance`).

**Monthly balance email (optional)**

- Scheduled job (cron) sends each **active** user one HTML summary per calendar month (deduped in the database). Configure SMTP in `.env`, or leave unset to skip sending without blocking the API.

**Auth**

- No JWT/session layer: protected routes rely on header **`x-user-id`** carrying the user UUID, as agreed for this MVP.

---

## Stack

| Layer | Choice |
|--------|--------|
| Runtime | Node.js |
| HTTP | Express 5 |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM / migrations | Drizzle |

---

## Getting started

### 1. Install

```bash
npm install
```

### 2. Environment

Create `.env` at the repo root:

```env
# Required
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE
PORT=3000

# Optional — monthly balance emails (omit to disable sending)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM="Splitwise <no-reply@example.com>"
MONTHLY_BALANCE_EMAIL_ENABLED=true
# MONTHLY_BALANCE_EMAIL_CRON=0 9 1 * *
```

If `SMTP_HOST` or `SMTP_FROM` is missing, the API still runs; the email job logs that sending was skipped.

### 3. Database schema

Apply migrations or push schema (pick what fits your workflow):

```bash
npm run db:migrate
# or
npm run db:push
```

### 4. Run

```bash
npm run dev
```

API base URL: `http://localhost:<PORT>` (e.g. `http://localhost:3000`).

---

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server (tsx + nodemon) |
| `npm run build` | Compile TypeScript |
| `npm run start` | Run compiled output (`dist/`) |
| `npm run db:generate` | Generate Drizzle migrations from schema |
| `npm run db:migrate` | Run migrations |
| `npm run db:push` | Push schema to DB |
| `npm run db:studio` | Drizzle Studio |
| `npm run email:monthly` | Run the monthly balance email job once (good for local SMTP checks) |

---

## API overview

Unless noted, send **`Content-Type: application/json`**.

**Header (where required)**

```http
x-user-id: <user-uuid>
```

| Method | Path | Body / query | Notes |
|--------|------|----------------|------|
| GET | `/` | — | Health |
| POST | `/user/signup` | `name`, `email`, `password`, optional `defaultCurrency` | Returns user without password fields |
| GET | `/user/me` | — | Requires `x-user-id` |
| PATCH | `/user/me` | `email` and/or `currency` | At least one field; maps `currency` → default currency |
| DELETE | `/user/me` | — | Soft delete |
| POST | `/expense` | `name`, `amount`, `currency`, `memberIds[]`, `date` | Payer = `x-user-id`; ≥2 members; equal split |
| GET | `/expense/activity` | `range=current\|last\|custom`; for `custom`: `from`, `to` | Must be registered before `/:id` in routing |
| GET | `/expense/:id` | — | Only if user is a member |
| PATCH | `/expense/:id` | Partial fields | Payer only |
| DELETE | `/expense/:id` | — | Payer only |
| GET | `/balance` | — | Requires `x-user-id` |

**Responses**

- Success: typically `{ "success": true, "data": ... }` or `{ "success": true, "message": ... }`.
- Errors: `{ "success": false, "message": "..." }` with an appropriate HTTP status (400, 403, 404, 409, 500, …).
- Health check `GET /` uses `{ "success": true, "message": "..." }`.

Expense writes that touch expenses, members, and balances run in a **transaction** so partial updates are avoided.

---

## Monthly emails

- Default schedule: **09:00 on the 1st** of each month (server local time), cron expression overridable via `MONTHLY_BALANCE_EMAIL_CRON`.
- Label on the email uses the **previous calendar month**; amounts reflect **current** rows in `balances` at send time (same semantics as `GET /balance`).
- Table `monthly_balance_report_sent` enforces **one send per user per `YYYY-MM`** period.

Disable the worker entirely: `MONTHLY_BALANCE_EMAIL_ENABLED=false`.

---

## Testing

Use Postman or any HTTP client: sign up two users, note both UUIDs, create an expense with both in `memberIds` and the payer in `x-user-id`, then call `/balance` and `/expense/activity` for each user.

