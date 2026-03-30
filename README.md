<div align="center">
  <img src="https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=1200&q=80" alt="M&B Jewelry Banner" width="100%" />

  <h1>💎 M&B Jewelry | Luxury E-Commerce Platform</h1>
  
  <p>
    A production-ready, full-stack jewelry e-commerce platform crafted with elegance. Built exclusively with the MERN stack emphasizing high-end UI design, robust backend security, and seamless user experiences.
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

## 🌟 Key Features

* **Secure Authentication:** JWT implementation with HTTP-only refresh cookies for optimal security.
* **Premium User Interface:** Responsive, luxury dark theme enriched with gold accents and Framer Motion micro-animations.
* **Complete Shopping Journey:** Featuring a persistent shopping cart (Redux + LocalStorage) and sophisticated product filtering/sorting.
* **Seamless Payments:** Integrated Razorpay payment gateway handling with backend HMAC signature verification.
* **Media Optimization:** Cloudinary integration for scalable product image uploads and optimizations.
* **Admin Dashboard:** Full-fledged control panel for product catalogs, user management, and order tracking.

---

## 🏗️ Architecture & Stack

### Frontend Application (Client)
- **Framework:** React 18, Vite
- **Styling:** Tailwind CSS v3, Vanilla CSS for intricate layouts
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

## 📁 Repository Structure

```text
MB_Jewelry/
├── backend/                  # Server-side logic & APIs
│   ├── config/               # Database & service configurations
│   ├── controllers/          # Request handlers
│   ├── models/               # MongoDB schema definitions
│   ├── routes/               # API endpoint definitions
│   └── seed.js               # Database population script
│
└── frontend/                 # Client UI application
    ├── public/               # Static assets
    ├── src/                  # React source code
    │   ├── components/       # Reusable UI components
    │   ├── pages/            # Application views/routes
    │   └── store/            # Redux global state configuration
```

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
git clone https://github.com/Rajdeep582/MB_Jewelry.git
cd MB_Jewelry

# Install Backend dependencies
cd backend && npm install

# Install Frontend dependencies
cd ../frontend && npm install
```

### 2. Environment Configuration

Variables are managed securely. Example files (`.env.example`) are provided.

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

## 💳 Payment Flow Architecture

1. Client finalizes cart and triggers **Checkout**.
2. Frontend requests payment initialization from `POST /api/orders/create-payment`.
3. Server calculates absolute DB-based pricing to prevent client-side tampering, resolving a dynamic Razorpay order ID.
4. Razorpay's overlay initializes natively on the UI.
5. On successful capture, the client shoots raw transaction details to `POST /api/orders/verify-payment`.
6. Node.js backend mathematically verifies the **HMAC payload signature** against `RAZORPAY_KEY_SECRET`. Upon total match, an Order DB record is formed.

---

## 🛡️ Security Posture

- **Refined JWT Handling:** Short-lived access tokens passed in-memory, paired with long-lived HTTP-only refresh tokens attached to secure sockets.
- **Robust Verification:** Server strictly uses backend item details for payment calculation—nothing relies heavily on frontend payloads.
- **Protection Measures:** Utilization of bcrypt hashing (12 rounds) and brute-force protection using API Rate Limiting.

---

<div align="center">
  <p>Designed and Built by <b>Rajdeep</b></p>
  <p>Providing pristine luxury e-commerce experiences.</p>
</div>
