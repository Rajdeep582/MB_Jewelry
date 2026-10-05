<div align="center">

# 💎 M&B Jewellers
### **Luxury E-Commerce • Bespoke Jewelry • Dynamic Pricing • Secure Fulfillment**

<img src="https://img.shields.io/badge/React_19-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" />
<img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
<img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" />
<img src="https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF" />
<img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" />

**Production-grade jewelry commerce platform with three synchronized role-based portals, live bullion pricing, bespoke workflows, secure payments, and delivery operations.**

[Portals](#-three-portals) · [Features](#-capability-matrix) · [Architecture](#-architecture) · [Setup](#-quick-start) · [Security](#-security) · [API](#-api-map)

</div>

---

## 🌐 Three Portals

```text
                         ┌─────────────────────────┐
                         │   M&B COMMERCE ENGINE   │
                         │   Node.js • Express     │
                         └────────────┬────────────┘
                  ┌──────────────────┼──────────────────┐
                  ▼                  ▼                  ▼
           🛍 CUSTOMER          👑 ADMIN            🚚 DELIVERY
              `/`               `/admin`            `/delivery`
           ┌──────────┐       ┌──────────┐        ┌──────────┐
           │ Catalog  │       │ Products │        │ Assigned │
           │ Pricing  │       │ Pricing  │        │ Orders   │
           │ Checkout│       │ Orders   │        │ Dispatch │
           │ Bespoke │       │ Quotes   │        │ OTP/POD  │
           │ Tracking│       │ Fleet    │        │ Status   │
           └──────────┘       └──────────┘        └──────────┘
                  └──────────────────┼──────────────────┘
                                     ▼
                 MongoDB • Razorpay • Cloudinary • Email • Sentry
```

| Portal | Core capabilities |
|---|---|
| 🛍️ **Customer** | Catalog · live metal pricing · filters · cart · checkout · invoices · custom orders · tracking |
| 👑 **Admin** | Dashboard · catalog CRUD · bullion engine · order lifecycle · custom quotes · fleet management |
| 🚚 **Delivery** | Assigned jobs · pickup/recipient details · transit status · dispatch · OTP + delivery proof |

---

## ✨ Capability Matrix

| Domain | Capability |
|:--|:--|
| 💎 Pricing | Bullion rate + karat + weight + gemstones + making charges |
| 🎨 Bespoke | Inquiry → estimate → acceptance → advance → crafting → final payment → dispatch |
| 💳 Payments | Server-side totals · Razorpay checkout · HMAC-SHA256 verification · webhooks |
| 🔐 Identity | JWT access + HTTP-only refresh rotation + replay detection · bcrypt cost 12 |
| 📧 OTP | 6-digit cryptographic hash · expiry · rate limiting |
| 📦 Fulfillment | `pending → confirmed → processing → dispatched → out_for_delivery → delivered` |
| 🧾 Accounting | Invoices · immutable order events · cryptographic tracking codes |
| ⚡ UX | React 19 · Vite 8 · lazy routes · Framer Motion · Lenis |
| 🛡️ Observability | Sentry · Winston · Morgan |
| 🖼️ Media | Cloudinary multi-image processing/CDN |

---

## 💰 Dynamic Pricing Engine

```text
Bullion Rate ─┐
Karat ────────┤
Weight ───────┼──► SERVER PRICE ENGINE ──► FINAL PRICE
Gemstones ────┤
Making Charge ┘
```

**Admin controls:** gold/silver spot rates · 24K/22K/18K/14K multipliers · making charges · global recalculation.

### Bespoke Pipeline

```text
Inquiry → Estimate → Approval → Advance → Crafting → Final Payment → Dispatch → Delivery
```

Customers can upload reference sketches, define metal/gem requirements, receive quotes, make milestone payments, and track crafting progress.

---

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ FRONTEND                                                   │
│ React 19 • Vite 8 • Tailwind v3 • Redux Toolkit • Router 7 │
│ Framer Motion • Lenis • Headless UI • Sentry              │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ BACKEND                                                     │
│ Node ≥18 • Express • JWT • Helmet • CORS • Rate Limit      │
│ Mongo Sanitize • XSS Clean • Cookie Parser • CSRF          │
└───────────────┬───────────────────────────┬─────────────────┘
                ▼                           ▼
       ┌────────────────┐          ┌────────────────────────┐
       │ MongoDB Atlas  │          │ External Services      │
       │ Mongoose       │          │ Razorpay • Cloudinary  │
       │ Transactions   │          │ Nodemailer • Sentry    │
       └────────────────┘          └────────────────────────┘
```

| Layer | Stack |
|:--|:--|
| **Frontend** | React 19 · Vite 8 · Tailwind CSS v3 · Headless UI · React Router DOM v7 |
| **State / UI** | Redux Toolkit · Redux Persist/LocalStorage · Framer Motion · Lenis · Toast · Icons |
| **Backend** | Node.js ≥18 · Express.js |
| **Data** | MongoDB Atlas · Mongoose · Transactions |
| **Security** | Helmet · CORS · Mongo Sanitize · XSS Clean · Rate Limit · Cookie Parser |
| **Services** | Razorpay · Cloudinary · Nodemailer |
| **Monitoring** | Sentry · Winston · Morgan |
| **Jobs** | Stale-order cleanup daemon: startup + every 15 min |

---

## 🔒 Security

```text
Client ──► Auth ──► Validation ──► Server Pricing ──► Payment ──► Webhook ──► Order
             │           │                │                │          │
          JWT/RT       CSRF          No client trust     HMAC       Raw body
             │
      Replay detection
             │
      Session revocation
```

- **Zero client price trust:** totals, discounts, karat multipliers and shipping are server-calculated.
- **Atomic inventory:** MongoDB transactions + stock guards prevent overselling.
- **CSRF:** timing-safe token comparison on state-changing requests.
- **Refresh rotation:** single-use HTTP-only cookies; replay invalidates active sessions.
- **Razorpay:** raw-body HMAC-SHA256 verification before JSON transformation.
- **Order cleanup:** abandoned pending orders released every 15 minutes.

---

## 📡 API Map

| Module | Prefix | Purpose |
|:--|:--|:--|
| 🔐 Auth | `/api/auth` | Registration · login · logout · refresh · OTP · password reset |
| 💎 Products | `/api/products` | Catalog · categories · dynamic pricing · details |
| 🛒 Orders | `/api/orders` | Checkout · Razorpay order · payment verification · history |
| 🎨 Custom | `/api/custom-orders` | Bespoke requests · uploads · quotes · milestone payments |
| 👑 Admin | `/api/admin` | Products · orders · quotes · pricing · users |
| 🔑 Admin Auth | `/api/admin-auth` | Admin auth · registration · profile |
| 🚚 Delivery | `/api/delivery` | Assigned orders · transit · delivery verification |
| 🔑 DP Auth | `/api/dp-auth` | Delivery partner onboarding/auth |
| 💳 Webhooks | `/api/webhook` | Razorpay asynchronous payment events |
| ❤️ System | `/api/ready` | DB + server readiness |

---

## 🚀 Quick Start

### Requirements

`Node.js ≥18` · `npm ≥9` · `MongoDB/Atlas` · `Razorpay` · `Cloudinary`

### 1. Clone & Install

```bash
git clone https://github.com/Rajdeep582/MB_Jewelry.git
cd MB_Jewelry
cd backend && npm install
cd ../frontend && npm install
cd ..
```

### 2. Environment

**`backend/.env`**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/mb_jewelry

JWT_SECRET=your_secure_access_secret_min_32_chars
JWT_REFRESH_SECRET=your_secure_refresh_secret_min_32_chars
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d
ADMIN_REGISTER_SECRET=your_secure_admin_registration_secret

RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretHere
RAZORPAY_WEBHOOK_SECRET=YourRazorpayWebhookSecretHere

BACKEND_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

SENTRY_DSN=
TRUST_PROXY=1
```

**`frontend/.env`**
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
VITE_SENTRY_DSN=
```

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

| Service | URL |
|:--|:--|
| 🖥️ Frontend | `http://localhost:5173` |
| ⚙️ Backend | `http://localhost:5000` |
| ❤️ Readiness | `http://localhost:5000/api/ready` |

### 4. Production Verification

```bash
cd frontend && npm run build
cd ../backend && npm run lint
```

---

## 🔄 Order & Fulfillment Flow

```text
Customer
   │
   ▼
Browse → Cart → Checkout → Razorpay
                              │
                              ▼
                       Payment Verified
                              │
                              ▼
                           Admin
                    ┌─────────┴─────────┐
                    ▼                   ▼
                Processing           Dispatch
                                        │
                                        ▼
                                  Delivery Partner
                                        │
                              OTP + Proof of Delivery
                                        │
                                        ▼
                                    Delivered
```

---

## 📁 Repository

```text
MB_Jewelry/
├── backend/      # Express REST API
├── frontend/     # React storefront + portals
└── README.md
```

**GitHub:** https://github.com/Rajdeep582/MB_Jewelry

---

<div align="center">

### 💎 Exquisite Craftsmanship · Uncompromising Digital Elegance

**M&B Jewellers © 2026**

</div>
