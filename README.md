# Chowdhury Duo Professional Website & CMS

This project is a Next.js application equipped with a highly secure custom Content Management System (CMS), built on Neon PostgreSQL and Prisma, integrated with Cloudinary for image hosting.

## Quick Start

### 1. Setup Environment
Copy `.env.example` to `.env` (Windows users may simply create `.env`).
```bash
cp .env.example .env
```

### 2. Configure Environment
Fill in **only** the following in your new `.env` file:
* `DATABASE_URL` (Neon PostgreSQL connection string)
* `CLOUDINARY_CLOUD_NAME`
* `CLOUDINARY_API_KEY`
* `CLOUDINARY_API_SECRET`
* `SESSION_SECRET`
* `ADMIN_EMAIL`
* `ADMIN_PASSWORD`

Nothing else is required.

> **Note on `SESSION_SECRET`**:
> Generate a secure 64-byte random hex string using Node.js:
> ```bash
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
> ```

### 3. Install Dependencies
```bash
npm install
```

### 4. Generate Prisma Client
```bash
npx prisma generate
```

### 5. Run Migrations
```bash
npx prisma migrate dev
```

### 6. Seed the Administrator
```bash
node scripts/seed-admin.ts
# OR
npm run prisma db seed
```

### 7. Run the Project
```bash
npm run dev
```

Your web application will now be running on [http://localhost:3000](http://localhost:3000). To access the CMS, navigate to `/admin/login`.
