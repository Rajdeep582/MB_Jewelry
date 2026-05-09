import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ProtectedRoute, AdminRoute, DeliveryRoute } from './components/common/ProtectedRoute';
import { selectIsDelivery } from './store/authSlice';
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
import DeliveryPartnerPage from './pages/DeliveryPartnerPage';
import { DeliveryLogin, DeliveryRegister } from './pages/DeliveryAuth';

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

function DeliveryRedirect() {
  const isDelivery = useSelector(selectIsDelivery);
  const location   = useLocation();
  const navigate   = useNavigate();

  useEffect(() => {
    if (isDelivery && !location.pathname.startsWith('/delivery')) {
      navigate('/delivery', { replace: true });
    }
    // Redirect unauthenticated delivery auth pages when already logged in as delivery
  }, [isDelivery, location.pathname, navigate]);

  return null;
}

export default function App() {
  return (
    <Provider store={store}>
      <BrowserRouter>
        <ScrollToTop />
        <DeliveryRedirect />
        <ErrorBoundary>
          <Toaster
            position="bottom-center"
            gutter={10}
            containerStyle={{ bottom: 28 }}
            toastOptions={{
              duration: 3000,
              style: {
                background: '#1a1a1a',
                color: '#f5f5f5',
                border: '1px solid rgba(212, 175, 55, 0.25)',
                borderRadius: '14px',
                fontSize: '13.5px',
                padding: '10px 16px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(212,175,55,0.08)',
                backdropFilter: 'blur(8px)',
                maxWidth: '360px',
              },
              success: { iconTheme: { primary: '#D4AF37', secondary: '#0D0D0D' } },
              error: { iconTheme: { primary: '#ef4444', secondary: '#0D0D0D' } },
            }}
          />

          <Routes>
            <Route element={<RootNavbarLayout />}>
              <Route element={<MainFooterLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/about" element={<About />} />
                <Route path="/contact" element={<Contact />} />
                <Route path="/checkout" element={<ProtectedRoute><Checkout /></ProtectedRoute>} />
                <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/orders/:id" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/custom-order" element={<ProtectedRoute><CustomOrder /></ProtectedRoute>} />
                <Route path="/custom-orders" element={<ProtectedRoute><CustomOrders /></ProtectedRoute>} />
                <Route path="/custom-orders/:id" element={<ProtectedRoute><CustomOrders /></ProtectedRoute>} />
              </Route>

              <Route element={<AuthLayout />}>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/verify/:token" element={<VerifyEmail />} />
              </Route>
            </Route>

            <Route path="/delivery/login"    element={<DeliveryLogin />} />
            <Route path="/delivery/register" element={<DeliveryRegister />} />
            <Route path="/delivery" element={<DeliveryRoute><DeliveryPartnerPage /></DeliveryRoute>} />

            <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="products"      element={<AdminProducts />} />
              <Route path="orders"        element={<AdminOrders />} />
              <Route path="custom-orders" element={<AdminCustomOrders />} />
              <Route path="deliveries"    element={<AdminDelivery />} />
              <Route path="users"         element={<AdminUsers />} />
              <Route path="pricing"       element={<AdminPricing />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </Provider>
  );
}
