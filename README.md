# Kayaar ERP (Frontend + Backend)

This repository contains a React (Vite) frontend and a Node/Express + Sequelize backend for an ERP workflow covering:
- Master data (Accounts/Brokers/Products/Tariffs/Transport/Packing/Invoice Types)
- Factory operations (RG1 Production)
- Sales & invoices (Sales with order, Sales without order, invoice approval)
- Despatch entry
- Depot operations (stock inward, depot sales, depot transfer, live inventory)
- Reports (date-range based report endpoints)

---

## Repo structure

- **`frontend/`**: React + Vite UI
- **`backend/`**: Express REST API + Sequelize (MySQL)

---

## Requirements

- Node.js (18+ recommended)
- MySQL Server

---

## Backend setup (MySQL + API)

### 1) Configure environment variables
Backend loads configuration via `dotenv` in `backend/server.js` and creates the Sequelize connection in `backend/config/database.js`.

Create a `.env` file inside **`backend/`** with at least:

```env
DB_HOST=localhost
DB_NAME=YOUR_DATABASE_NAME
DB_USER=YOUR_MYSQL_USER
DB_PASSWORD=YOUR_MYSQL_PASSWORD
PORT=5000
```

### 2) Install dependencies
From `d:/KrExports/backend`:

```bash
npm install
```

### 3) Run backend
```bash
npm run dev
```

Server will start on:
- **`http://localhost:5000`**
- REST base: **`http://localhost:5000/api`**
- Auth base: **`http://localhost:5000/auth`**

---

## Frontend setup (React)

### 1) Install dependencies
From `d:/KrExports/frontend`:

```bash
npm install
```

### 2) Run frontend
```bash
npm run dev
```

Frontend expects the backend at `http://localhost:5000` (see `frontend/src/service/api.js`).

---

## Authentication (Backend)

Auth endpoints (no auth required):
- `POST /auth/signup/request-otp`
- `POST /auth/signup/verify-otp`
- `POST /auth/signup`
- `POST /auth/login`
- `GET  /auth/me`
- `POST /auth/logout`

After login/signup, the frontend sends:
- `Authorization: Bearer <token>`

Protected routes use `requireAuth` in `backend/server.js` and verify `session_token` in `tbl_Users`.

---

## API overview (Modules)

The backend exposes master + transactional routes via `backend/routes/masterRoutes.js` and calls them through `frontend/src/service/api.js`.

### 1) Master data
Routes: `POST/GET/PUT/DELETE` and `POST /*/bulk-delete`
- `/accounts`
- `/brokers`
- `/products`
- `/transports`
- `/tariffs`
- `/packing-types`
- `/invoice-types`

### 2) Factory operations
- `POST/GET/PUT/DELETE /production`
- `POST /production/bulk-delete`

### 3) Sales & invoices
Sales with order:
- `POST/GET/PUT/DELETE /invoices`
- `PUT /invoices/approve/:id`
- `PUT /invoices/reject/:id`

Sales without order (direct invoices):
- `POST/GET/PUT/DELETE /direct-invoices`

### 4) Despatch entry
- `GET /despatch`
- `POST /despatch`
- `PUT /despatch/:id`
- `DELETE /despatch/:id`
- `POST /despatch/bulk-delete`

### 5) Depot operations
- `POST /depot-inward`
- `GET  /depot-received` / `GET /depot-received/:id`
- `POST /depot-received`
- `PUT  /depot-received/:id`
- `DELETE /depot-received/:id`
- `POST /depot-received/bulk-delete`
- `GET  /depot-inventory/:depotId` (live inventory calculation)
- `POST /depot-sales` / `GET /depot-sales` / `GET /depot-sales/:id`
- `PUT /depot-sales/:id` / `DELETE /depot-sales/:id`
- `POST /depot-sales/bulk-delete`

### 6) Reporting & printing
- `GET /reports/:reportId?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /reports/invoice-print/:invoiceNo`

Report IDs implemented in `backend/controllers/masterController.js` include:
- `orders`
- `direct-invoices`
- `production`
- `despatch`
- `invoices`
- `depot-sales`
- `depot-received`

---

## How invoice creation works (high level)

For standard invoices (sales with order), `backend/controllers/masterController.js`:
- Creates invoice header + invoice details in a DB transaction
- Calculates tax components using `InvoiceType` configuration
- Decrements `Product.mill_stock` for the sold quantity

For depot sales, it validates available depot stock using inward/outward aggregation before inserting details.

---

## Run locally (quick start)

1) Start MySQL
2) Backend:
   - `cd backend`
   - create `.env`
   - `npm install`
   - `npm run dev`
3) Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4) Open the frontend URL and login.

