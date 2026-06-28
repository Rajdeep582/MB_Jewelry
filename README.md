<div align="center">
  <img src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80" alt="M&B Jewellers Banner" width="100%" />

  <h1>💎 M&B Jewellers | Luxury E-Commerce Platform</h1>
  
  <p>
    A production-ready, full-stack jewelry e-commerce platform crafted with elegance. Built exclusively to provide a high-end UI design, robust backend security, and seamless user experiences for a premium jewelry business.
  </p>

<!-- Badges -->
<p>
  <img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js" />
  <img src="https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
  <img src="https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
</p>
</div>

---

## ✨ Features

* **Premium User Interface:** Responsive, luxury dark theme enriched with gold accents and beautiful micro-animations.
* **Complete Shopping Journey:** Featuring a persistent shopping cart and sophisticated product filtering/sorting for rings, necklaces, earrings, and more.
* **Secure OTP Authentication:** 6-digit email verification flow for secure registration, ensuring valid user emails.
* **Standardized Order Lifecycle:** A rigorous, sequential fulfillment pipeline (`confirmed` → `in_production` → `ready_to_ship` → `shipped` → `delivered`) with audit trails.
* **Seamless Payments:** Integrated Razorpay payment gateway handling with secure backend HMAC signature verification.
* **Media Optimization:** Cloudinary integration for scalable high-quality jewelry image uploads and optimizations.
* **Admin Control Center:** Production-grade management of jewelry catalogs, users, and standardized order tracking.

---

## 🏗️ Architecture & Stack

### Frontend Application (Client)
- **Framework:** React 18, Vite
- **Styling:** Tailwind CSS, Vanilla CSS for intricate layouts
- **State Management:** Redux Toolkit
- **Routing:** React Router DOM
- **Interactions:** Framer Motion, React Hot Toast

### Backend API (Server)
- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ODM)
- **Security:** Helmet, CORS, Express Validator
- **Payment Gateway:** Razorpay API Integration
- **Storage:** Cloudinary

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed before starting:
- **Node.js** (v18+)
- **MongoDB** (Local instance or Atlas cluster URI)
- Credentials for **Razorpay** and **Cloudinary**

### 1. Verification & Installation

Clone the repository and install necessary dependencies for both ends:

```bash
# Clone the repository
git clone https://github.com/MyJewellShop/mbjewellers.git
cd mbjewellers

# Install Backend dependencies
cd backend && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Configuration

Variables are managed securely. Ensure you create `.env` files in both `backend` and `frontend` directories based on the provided examples (these are ignored by git for security).

**Backend `.env`:**
```env
PORT=5000
NODE_ENV=development
MONGO_URI=<Your MongoDB Connection String>
JWT_SECRET=<Random 32 Chars>
JWT_REFRESH_SECRET=<Random 32 Chars>
RAZORPAY_KEY_ID=<Your Razorpay ID>
RAZORPAY_KEY_SECRET=<Your Razorpay Secret>
CLOUDINARY_CLOUD_NAME=<Cloud Name>
CLOUDINARY_API_KEY=<Cloudinary Key>
CLOUDINARY_API_SECRET=<Cloudinary Secret>
```

**Frontend `.env`:**
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=<Your Razorpay ID>
```

### 3. Running the Application

You can start both servers simultaneously for local development.

```bash
# Terminal 1 - Start the backend server
cd backend
npm run dev

# Terminal 2 - Start the frontend app
cd frontend
npm run dev
```

The application client runs on `http://localhost:5173`, and the API server starts on `http://localhost:5000`.

---

## 📦 Order Lifecycle Pipeline

The platform enforces a strict, production-grade fulfillment sequence for all jewelry orders:

1. **Confirmed:** Initial state upon successful online payment via Razorpay.
2. **In Production:** Jewelry item is being handcrafted/curated.
3. **Ready to Ship:** Quality checked and securely packaged.
4. **Shipped:** Handed over to logistics with tracking history initiated.
5. **Delivered:** Final destination reached.

---

## 🛡️ Security Posture

- **Refined JWT Handling:** Short-lived access tokens passed in-memory, paired with long-lived HTTP-only refresh tokens attached to secure sockets.
- **Robust Verification:** Server strictly uses backend item details for payment calculation—nothing relies heavily on frontend payloads.
- **Protection Measures:** Utilization of bcrypt hashing (12 rounds) and brute-force protection using API Rate Limiting.

---

<div align="center">
  <p>Providing pristine luxury e-commerce experiences for the finest jewelry.</p>
</div>
