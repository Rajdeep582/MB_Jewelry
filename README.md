# 💎 M&B Jewelry — Luxury E-Commerce Platform

A production-ready, full-stack jewelry e-commerce platform built with the MERN stack (MongoDB, Express.js, React.js, Node.js).

![M&B Jewelry](https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80)

## ✨ Features

- **User Authentication** — JWT with refresh tokens (httpOnly cookies)
- **Product Catalog** — Filters, search, sorting, and pagination
- **Shopping Cart** — Persistent localStorage + Redux state
- **Checkout** — Full Razorpay payment gateway integration with HMAC verification
- **Admin Panel** — Product/Order/User management with analytics
- **Cloudinary** — Image upload and optimization
- **Responsive UI** — Luxury dark theme with gold accents (Tailwind CSS v3)
- **Animations** — Framer Motion throughout
- **SEO-ready** — Meta tags, Open Graph, semantic HTML

---

## 🗂 Project Structure

```
M_B_Jewelry/
├── backend/        # Node.js + Express REST API
│   ├── config/        # DB, Cloudinary, Razorpay config
│   ├── controllers/   # Route handlers (MVC)
│   ├── middleware/    # Auth, error handler, upload
│   ├── models/        # Mongoose schemas
│   ├── routes/        # Express routers
│   ├── utils/         # JWT, logger, helpers
│   └── server.js      # Entry point
│
└── frontend/       # React + Vite SPA
    ├── src/
    │   ├── components/  # Navbar, Footer, ProductCard, etc.
    │   ├── pages/       # Route-level pages
    │   ├── store/       # Redux slices
    │   ├── services/    # Axios API layer
    │   └── utils/       # Helpers
    └── index.html
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Razorpay account (for payments)
- Cloudinary account (for images)

### 1. Clone and Setup

```bash
git clone <repo-url>
cd M_B_Jewelry
```

### 2. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

### 3. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Fill in your credentials in .env
npm install
npm run dev
```

The app will be running at:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api

---

## 🔑 Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | JWT refresh token secret |
| `RAZORPAY_KEY_ID` | Razorpay Key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `CLIENT_URL` | Frontend URL for CORS |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_RAZORPAY_KEY_ID` | Razorpay Key ID (public) |

---

## 💳 Razorpay Integration

Payment flow:
1. Frontend sends order items to `POST /api/orders/create-payment`
2. Backend calculates price from DB (security), creates Razorpay order
3. Frontend opens Razorpay checkout popup
4. On success, frontend sends payment details to `POST /api/orders/verify-payment`
5. Backend verifies HMAC signature, reduces stock, creates DB order
6. User is redirected to order confirmation

---

## 🛡 API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register user |
| POST | `/api/auth/login` | Login + set refresh token cookie |
| POST | `/api/auth/logout` | Logout + clear cookie |
| POST | `/api/auth/refresh` | Refresh access token |
| GET  | `/api/auth/me` | Get current user |

### Products
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/products` | List with filters/pagination |
| GET | `/api/products/:id` | Single product |
| POST | `/api/products` | Create (Admin) |
| PUT | `/api/products/:id` | Update (Admin) |
| DELETE | `/api/products/:id` | Delete (Admin) |
| POST | `/api/products/:id/review` | Add review |

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/orders/create-payment` | Create Razorpay order |
| POST | `/api/orders/verify-payment` | Verify & save order |
| GET | `/api/orders/my-orders` | User order history |
| GET | `/api/orders` | All orders (Admin) |
| PUT | `/api/orders/:id/status` | Update status (Admin) |

---

## 🚢 Deployment

### Frontend → Vercel

1. Import from GitHub on [vercel.com](https://vercel.com)
2. Set build command: `npm run build`
3. Set output directory: `dist`
4. Add environment variables from `.env.example`
5. Deploy!

### Backend → Render

1. Create a Web Service on [render.com](https://render.com)
2. Connect GitHub repo, set root directory to `backend/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables
6. Deploy!

---

## 🔒 Security Features

- JWT with short-lived access tokens (15min) + long-lived refresh tokens (7d)
- httpOnly cookies for refresh tokens
- bcrypt password hashing (12 rounds)
- Helmet.js security headers
- CORS with whitelist
- Rate limiting (200 req/15min global, 20 req/15min auth)
- Razorpay HMAC signature verification
- Input validation (express-validator)

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| State | Redux Toolkit |
| Animation | Framer Motion |
| Backend | Node.js + Express.js |
| Database | MongoDB + Mongoose |
| Auth | JWT (access + refresh) |
| Payments | Razorpay |
| Images | Cloudinary |
| Logging | Winston + Morgan |

---

## 📄 License

MIT © M&B Jewelry 2024
