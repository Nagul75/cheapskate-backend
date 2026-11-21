# Cheapskate Backend

Backend service powering **Cheapskate**, a production-ready personal finance platform for managing accounts, transactions, and budgets, with real time analytics and high-performance dashboards.

- Live Link: https://cheapskate.in
- Frontend: https://github.com/Nagul75/cheapskate-frontend

  ![MacBook_Pro_Cheapskate](https://github.com/user-attachments/assets/f64113ab-874c-47b7-a5c2-4aaf75819266)

## Overview

A scalable REST API built with Node.js and PostgreSQL, designed with a focus on security, data integrity, and performance.

## Tech Stack

- Node.js + Express
- PostgreSQL (AWS RDS)
- Prisma ORM
- JWT Authentication (Access + Refresh Tokens)
- Zod (Validation)
- Docker (Deployment)

## Core Features

- **Authentication & Security**
  - JWT-based auth with refresh token rotation
  - Tiered rate limiting (stricter for auth routes)
  - User-scoped authorization (strict data isolation)

- **Financial Domain Modeling**
  - Accounts, transactions, categories, budgets
  - Transaction-safe balance reconciliation
  - Multi-currency support

- **Analytics APIs**
  - Monthly summaries (income, expenses, net)
  - Category-wise aggregation
  - Time-series financial trends

## System Design Highlights

- Designed modular architecture (routes, controllers, middleware)
- Optimized query performance using **composite indexing aligned with access patterns**
- Structured APIs to support **data-heavy aggregation workloads**

## Performance

- Optimized for low-latency API responses
- Efficient handling of user-scoped financial data queries
- Rate limiting to maintain stability under load

## Deployment

- AWS EC2 (Dockerized backend)
- AWS RDS (PostgreSQL)

## Notes

- All endpoints are secured and scoped per user
- Designed with scalability and extensibility in mind

## Local development

```bash
docker compose up -d
cp .env.example .env
mkdir -p src/keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out src/keys/private.pem
openssl rsa -pubout -in src/keys/private.pem -out src/keys/public.pem
npm install
npx prisma generate
npx prisma migrate deploy
npm run dev
```

All environment-specific values come from env vars, validated at startup in `src/config/env.ts`. See `.env.example`.
