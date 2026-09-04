<div align="center">
  <img src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80" alt="M&B Jewellers Banner" width="100%" />

  <h1>💎 M&B Jewellers</h1>
  <h3><i>The Premier Luxury E-Commerce & Bespoke Jewelry Platform</i></h3>
  
  <p>
    A production-grade, full-stack jewelry e-commerce ecosystem crafted with elegance and precision. Featuring an ultra-luxury client storefront, an executive admin management suite, a dedicated delivery partner portal, real-time dynamic bullion pricing, and tamper-proof payment processing.
  </p>

  <p>
    <a href="#about-us">About Us</a> •
    <a href="#portals">System Portals</a> •
    <a href="#features">Key Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#environment-variables">Environment Setup</a> •
    <a href="#security">Security & Resilience</a> •
    <a href="#api-reference">API Overview</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js" />
    <img src="https://img.shields.io/badge/React_19-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React 19" />
    <img src="https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Vite_8-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
    <img src="https://img.shields.io/badge/Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=3395FF" alt="Razorpay" />
  </p>
</div>

---

<div id="about-us"></div>

<table>
  <tr>
    <td valign="top" width="60%">
      <h2>📖 About Us</h2>
      <p><b>M&B Jewellers</b> represents the highest standard of fine craftsmanship, heirloom authenticity, and bespoke luxury. This platform translates the prestige of an elite atelier into a digital experience designed for modern connoisseurs.</p>
      <p>From one-of-a-kind diamond engagement rings to custom bespoke heirloom commissions, M&B Jewellers blends traditional master-goldsmith techniques with cutting-edge digital commerce. Every piece is presented with fine-jewelry fidelity, complete transparent breakdowns of metal purity, karatage, making charges, and real-time precious metal spot valuations.</p>
    </td>
    <td valign="center" width="40%">
      <img src="https://images.unsplash.com/photo-1515562141207-7a88fb7ce338?w=500&q=80" alt="Jewelry Display" width="100%" />
    </td>
  </tr>
</table>

---

<div id="portals"></div>

## 🌐 Three Integrated Portals

M&B Jewellers operates three synchronized role-based applications within a unified codebase:

```
                                  ┌───────────────────────────────┐
                                  │      M&B Jewelry Engine       │
                                  │    Node.js / Express REST     │
                                  └──────────────┬────────────────┘
                                                 │
                   ┌─────────────────────────────┼─────────────────────────────┐
                   │                             │                             │
                   ▼                             ▼                             ▼
        ┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
        │  🛍️ Client Store     │       │  👑 Admin Console   │       │ 🚚 Delivery Portal  │
        │                     │       │                     │       │                     │
        │ • Luxury Catalog    │       │ • Executive Metrics │       │ • Assigned Orders   │
        │ • Live Gold Pricing │       │ • Product Catalog   │       │ • Status Tracking   │
        │ • Custom Order Flow │       │ • Spot Price Engine │       │ • Dispatch Handoff  │
        │ • Razorpay Checkout │       │ • Custom Quotes     │       │ • Delivery Proof &  │
        │ • Tracking & Invoices│      │ • Fleet Assignment  │       │   OTP Validation    │
        └─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

1. **🛍️ Luxury Customer Storefront (`/`)**
   - High-performance, dark-and-gold visual aesthetic powered by Tailwind CSS, Framer Motion, and Lenis smooth scrolling.
   - Dynamic catalog with live precious metal pricing, multi-attribute filtering (karat, metal, price, category), and high-resolution galleries.
   - Comprehensive shopping cart synced with Redux Toolkit and LocalStorage.
   - Multi-step checkout with address management, Razorpay payment gateway integration, and printable invoice generation.
   - **Bespoke Custom Order Pipeline**: Customers can upload reference sketches, specify metal/gem requirements, receive custom quotes, make milestone advance/final payments, and track artisan crafting phases.

2. **👑 Executive Admin Console (`/admin`)**
   - Protected management cockpit guarded by IP whitelist and administrative tokens.
   - **Dynamic Bullion Engine**: Configure baseline gold and silver spot rates, karat multipliers (24K, 22K, 18K, 14K), and making charges that update catalog prices globally in real time.
   - **Product Lifecycle Management**: CRUD catalog management with Cloudinary multi-image asset processing.
   - **Order Fulfillment Matrix**: State-machine order lifecycle (`pending` → `confirmed` → `processing` → `dispatched` → `out_for_delivery` → `delivered`).
   - **Bespoke Review Desk**: Review custom order inquiries, calculate estimates, approve/reject designs, generate advance & final payment links, and publish crafting milestones.
   - **Fleet Management**: Delivery partner registration, order dispatch assignment, and operational oversight.

3. **🚚 Delivery Partner Portal (`/delivery`)**
   - Role-segregated courier interface for assigned delivery personnel.
   - Real-time task feeds displaying pickup locations, recipient details, and transit directions.
   - Two-phase delivery confirmation requiring delivery partner confirmation and paid status verification before final delivery completion.

---

<div id="features"></div>

## ✨ Key Capabilities & Highlights

| Category | Capability | Details |
| :--- | :--- | :--- |
| 💎 **Bullion Pricing** | Dynamic Spot Valuation | Recomputes jewelry pricing based on live bullion rates, weight (grams), karatage, gemstone costs, and making charges. |
| 🎨 **Artisan Bespoke** | Custom Order Workflow | Full multi-phase lifecycle: inquiry submission → estimate calculation → client acceptance → advance deposit → artisan crafting → final payment → dispatch. |
| 💳 **Payment Security** | Server-Side Integrity | Client never specifies final price. Prices are strictly computed on the server. Payments verified via Razorpay HMAC-SHA256 with timing-safe comparison. |
| 🛡️ **Defensive Auth** | Multi-Layer Identity | Short-lived JWTs + HTTP-only rotation refresh tokens with replay detection (nukes compromised sessions on replay). Bcrypt cost 12. |
| 📬 **Secure Verification** | Email OTP Service | 6-digit cryptographic SHA-256 hashed OTPs with expiry and rate-limiting for signups and password resets. |
| ⚡ **Performance & UX** | Instant HMR & Motion | Vite 8 engine, React 19, code-split lazy routes, Sentry error observability, and Lenis smooth scrolling. |
| 📑 **Order Accounting** | Invoices & Audit Trails | Automatic invoice compilation, immutable order event logging, and crypto-random tracking codes. |

---

<div id="architecture"></div>

## 🏗️ Architecture & Tech Stack

### Client-Side (Frontend)
- **Core:** React 19, Vite 8
- **Styling:** Tailwind CSS v3, Vanilla CSS custom luxury tokens, Headless UI
- **State:** Redux Toolkit, Redux Persist / LocalStorage synchronization
- **Routing:** React Router DOM v7
- **Motion & Interactions:** Framer Motion, Lenis Smooth Scroll, React Hot Toast, React Icons
- **Monitoring:** `@sentry/react`

### Server-Side (Backend)
- **Runtime & Framework:** Node.js (>= 18.0.0), Express.js
- **Database:** MongoDB Atlas with Mongoose ODM (utilizes transactions for stock decrements)
- **Security & Middleware:** Helmet, CORS, Express-Mongo-Sanitize, XSS-Clean, Express Rate Limit, Cookie Parser
- **Background Jobs:** Stale-order cleanup daemon (startup + 15 min intervals)
- **External Services:** Razorpay (Payments & Webhooks), Cloudinary (Image processing CDN), Nodemailer (Email OTPs)
- **Monitoring & Logging:** Sentry (`@sentry/node`, `@sentry/profiling-node`), Winston logger, Morgan

---

<div id="getting-started"></div>

## 🚀 Getting Started

### Prerequisites
- **Node.js** `>= 18.0.0`
- **npm** `>= 9.0.0`
- **MongoDB** instance (Local or MongoDB Atlas cluster)
- **Razorpay** merchant test/live credentials
- **Cloudinary** media storage account

---

### 1. Clone the Repository

```bash
git clone https://github.com/Rajdeep582/MB_Jewelry.git
cd MB_Jewelry
```

---

### 2. Install Dependencies

Install dependencies for both backend and frontend:

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
cd ..
```

---

<div id="environment-variables"></div>

### 3. Environment Configuration

#### Backend Configuration (`backend/.env`)
Create `backend/.env` based on `backend/.env.example`:

```env
PORT=5000
NODE_ENV=development

# MongoDB Connection
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/mb_jewelry?retryWrites=true&w=majority

# JWT Secrets (Minimum 32 random characters each)
JWT_SECRET=your_super_secret_jwt_access_key_min_32_chars
JWT_REFRESH_SECRET=your_super_secret_jwt_refresh_key_min_32_chars
JWT_EXPIRE=15m
JWT_REFRESH_EXPIRE=7d

# Admin Registration Secret (Required - Server fails fast if missing)
ADMIN_REGISTER_SECRET=your_secure_admin_registration_passphrase

# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere
RAZORPAY_KEY_SECRET=YourRazorpaySecretHere
RAZORPAY_WEBHOOK_SECRET=YourRazorpayWebhookSecretHere

# URL References
BACKEND_URL=http://localhost:5000
CLIENT_URL=http://localhost:5173

# Cloudinary Media Storage
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Optional: Sentry Error Monitoring & Proxy Settings
SENTRY_DSN=
TRUST_PROXY=1
```

#### Frontend Configuration (`frontend/.env`)
Create `frontend/.env` based on `frontend/.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=rzp_test_YourKeyIdHere

# Optional: Sentry Error Monitoring
VITE_SENTRY_DSN=
```

---

### 4. Running the Development Servers

Run the backend and frontend simultaneously in separate terminals:

```bash
# Terminal 1: Start Backend API
cd backend
npm run dev

# Terminal 2: Start Frontend Application
cd frontend
npm run dev
```

- **Frontend Application:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **API Health Check Probe:** [http://localhost:5000/api/ready](http://localhost:5000/api/ready)

---

### 5. Building & Verifying for Production

```bash
# Validate frontend production build
cd frontend
npm run build

# Validate backend code quality
cd ../backend
npm run lint
```

---

<div id="security"></div>

## 🔒 Security & Resilience Posture

- **Zero Client Price Trust:** All totals, discounts, karat multipliers, and shipping fees are computed strictly server-side before creating Razorpay orders.
- **Atomic Stock Protection:** Inventory decrements execute inside MongoDB transactions with `{ stock: { $gte: qty } }` to eliminate race conditions and overselling.
- **Double-Submit CSRF Defense:** Enforces matching CSRF tokens using `crypto.timingSafeEqual` across state-mutating requests.
- **Refresh Token Rotation & Invalidation:** Single-use refresh tokens stored in HTTP-only secure cookies; reuse attempts trigger instant revocation of all active user sessions.
- **Cryptographic Webhook Verification:** Razorpay payment webhooks use raw request buffer streams for HMAC-SHA256 signature verification prior to JSON body transformation.
- **Automated Order Garbage Collection:** A built-in scheduler cleans up abandoned pending orders every 15 minutes to release held inventory and system resources.

---

<div id="api-reference"></div>

## 📡 API Endpoint Summary

| Module | Route Prefix | Primary Purpose |
| :--- | :--- | :--- |
| **Auth** | `/api/auth` | User registration, login, logout, refresh tokens, OTP email verification, password reset |
| **Products** | `/api/products` | Browse catalog, categories, dynamic pricing recalculation, product details |
| **Orders** | `/api/orders` | Checkout validation, Razorpay order generation, payment verification, order history |
| **Custom Orders** | `/api/custom-orders` | Bespoke request submission, design uploads, quote acceptance, milestone payments |
| **Admin** | `/api/admin` | Product management, orders matrix, custom order quotes, pricing updates, user controls |
| **Admin Auth** | `/api/admin-auth` | Admin login, registration (protected by `ADMIN_REGISTER_SECRET`), profile management |
| **Delivery** | `/api/delivery` | Delivery partner order feeds, transit updates, proof of delivery verification |
| **DP Auth** | `/api/dp-auth` | Delivery partner onboarding and authentication |
| **Webhooks** | `/api/webhook` | Raw-body Razorpay HMAC event listener for automated asynchronous payment capture |
| **System** | `/api/ready` | Health check probe assessing DB connectivity and server status |

---

## 🔗 Repository

- **GitHub Repository:** [https://github.com/Rajdeep582/MB_Jewelry.git](https://github.com/Rajdeep582/MB_Jewelry.git)
- **Issues & Contributions:** Pull requests and issues are welcome.

---

<div align="center">
  <i>Exquisite Craftsmanship • Uncompromising Digital Elegance</i><br/>
  <br/>
  <b>M&B Jewellers © 2026. All rights reserved.</b>
</div>
