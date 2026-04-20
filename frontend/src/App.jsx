import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ProtectedRoute, AdminRoute } from './components/common/ProtectedRoute';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import CartDrawer from './components/common/CartDrawer';
import ScrollToTop from './components/common/ScrollToTop';

// Pages
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Profile from './pages/Profile';
import About from './pages/About';
import Contact from './pages/Contact';
import NotFound from './pages/NotFound';
import { Login, Register } from './pages/Auth';
import VerifyEmail from './pages/VerifyEmail';
import CustomOrder from './pages/CustomOrder';
import CustomOrders from './pages/CustomOrders';

// Admin Pages
import AdminLayout from './pages/admin/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminUsers from './pages/admin/AdminUsers';
import AdminPricing from './pages/admin/AdminPricing';
import AdminDelivery from './pages/admin/AdminDelivery';
import AdminCustomOrders from './pages/admin/AdminCustomOrders';

function RootNavbarLayout() {
  return (
    <>
      <Navbar />
      <CartDrawer />
      <Outlet />
    </>
  );
}

function MainFooterLayout() {
  return (
    <>
      <main><Outlet /></main>
      <Footer />
    </>
  );
}

function AuthLayout() {
  return <main><Outlet /></main>;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ScrollToTop />
        <ErrorBoundary>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#141414',
                color: '#fff',
                border: '1px solid rgba(212, 175, 55, 0.2)',
                borderRadius: '12px',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#D4AF37', secondary: '#0D0D0D' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#0D0D0D' } },
            }}
          />

          <Routes>
            <Route element={<RootNavbarLayout />}>
              {/* Public routes with Navbar/Footer */}
              <Route element={<MainFooterLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />

                {/* Protected routes */}
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/custom-order" element={<ProtectedRoute><CustomOrder /></ProtectedRoute>} />
                <Route path="/custom-orders" element={<ProtectedRoute><CustomOrders /></ProtectedRoute>} />
                <Route path="/custom-orders/:id" element={<ProtectedRoute><CustomOrders /></ProtectedRoute>} />
              </Route>

              {/* Auth routes (no footer) */}
              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify/:token" element={<VerifyEmail />} />
              </Route>
            </Route>

            {/* Admin routes */}
            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="products"      element={<AdminProducts />} />
              <Route path="orders"        element={<AdminOrders />} />
              <Route path="custom-orders" element={<AdminCustomOrders />} />
              <Route path="deliveries"    element={<AdminDelivery />} />
              <Route path="users"         element={<AdminUsers />} />
              <Route path="pricing"       element={<AdminPricing />} />
            </Route>

            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  );
}
