<div align="center">
  <img src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80" alt="M&B Jewellers Banner" style="border-radius: 12px; margin-bottom: 20px;" width="100%" />

  <h1 align="center">💎 M&B Jewellers</h1>
  <h3 align="center">The Premier Luxury E-Commerce Experience</h3>
  
  <p align="center">
    A production-ready, full-stack jewelry e-commerce platform crafted with elegance. Built exclusively to provide a high-end UI design, robust backend security, and seamless user experiences for a premium jewelry business.
  </p>

  <p align="center">
    <a href="#about-us">About Us</a> •
    <a href="#features">Features</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a>
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
    <img src="https://img.shields.io/badge/Express.js-%23404d59.svg?style=for-the-badge&logo=express&logoColor=%2361DAFB" alt="Express.js" />
    <img src="https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB" alt="React" />
    <img src="https://img.shields.io/badge/Node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js" />
    <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
  </p>
</div>

---

## 📖 About Us

**M&B Jewellers** represents the pinnacle of fine craftsmanship and luxury. This digital storefront was designed to mirror the elegance of our physical boutiques, providing clients with an immersive, secure, and personalized shopping experience from the comfort of their homes. 

From exquisite engagement rings to timeless necklaces, our platform ensures that every piece of jewelry is showcased with the highest fidelity, offering a seamless journey from discovery to delivery.

---

## ✨ Features

| Feature | Description |
| :--- | :--- |
| 🎨 **Premium User Interface** | Responsive, luxury dark theme enriched with gold accents and beautiful Framer Motion micro-animations. |
| 🛍️ **Complete Shopping Journey** | Featuring a persistent shopping cart (Redux) and sophisticated product filtering/sorting for rings, necklaces, and earrings. |
| 🔐 **Secure OTP Authentication** | 6-digit email verification flow for secure registration, preventing bot signups and ensuring valid user emails. |
| 📦 **Standardized Order Lifecycle**| A rigorous, sequential fulfillment pipeline (`confirmed` → `in_production` → `ready_to_ship` → `shipped` → `delivered`) with detailed audit trails. |
| 💳 **Seamless Payments** | Integrated Razorpay payment gateway handling with secure backend HMAC signature verification. |
| 🖼️ **Media Optimization** | Cloudinary integration for scalable, high-quality jewelry image uploads, auto-cropping, and CDN delivery. |
| 🛡️ **Admin Control Center** | Production-grade management of jewelry catalogs, users, and standardized order tracking. |

---

## 🏗️ Architecture & Stack

The application follows a standard Client-Server Architecture using the MERN stack.

### 🌐 Frontend (Client-Side)
- **Framework:** React 18 powered by Vite for lightning-fast HMR.
- **Styling:** Tailwind CSS v3 combined with Vanilla CSS for intricate, custom luxury layouts.
- **State Management:** Redux Toolkit for global cart and user state, synced with LocalStorage.
- **Routing:** React Router DOM v6.
- **Interactions:** Framer Motion for smooth page transitions and React Hot Toast for elegant notifications.

### ⚙️ Backend (Server-Side)
- **Runtime:** Node.js environment.
- **Framework:** Express.js REST API.
- **Database:** MongoDB hosted on Atlas, accessed via Mongoose ODM.
- **Security:** Helmet.js for HTTP headers, CORS for origin protection, and Express Validator for sanitization.
- **Storage:** Cloudinary API for image processing.

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed before starting:
- **Node.js** (v18 or higher)
- **MongoDB** (Local instance or Atlas cluster URI)
- Credentials for **Razorpay** and **Cloudinary**

### 1. Installation

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

Variables are managed securely and must be injected into the environment. 

**Backend (`backend/.env`):**
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

**Frontend (`frontend/.env`):**
```env
VITE_API_URL=http://localhost:5000/api
VITE_RAZORPAY_KEY_ID=<Your Razorpay ID>
```

### 3. Running the Application

Start both servers simultaneously for local development.

```bash
# Terminal 1 - Start the backend server
cd backend
npm run dev

# Terminal 2 - Start the frontend app
cd frontend
npm run dev
```

The client will be available on `http://localhost:5173`, and the API on `http://localhost:5000`.

---

## 🔒 Security Posture

- **Refined JWT Handling:** Short-lived access tokens passed in-memory, paired with long-lived HTTP-only refresh tokens attached to secure sockets.
- **Robust Verification:** The server strictly uses backend item details for payment calculation—nothing relies heavily on frontend payloads to prevent price tampering.
- **Protection Measures:** Utilization of bcrypt hashing (12 rounds) for passwords and brute-force protection using API Rate Limiting.

---

<div align="center">
  <i>Providing pristine luxury e-commerce experiences for the finest jewelry.</i>
</div>
