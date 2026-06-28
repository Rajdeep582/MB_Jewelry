import { BrowserRouter, Routes, Route, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, Suspense, lazy } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Provider } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { store } from './store/store';
import ErrorBoundary from './components/common/ErrorBoundary';
import { ProtectedRoute, AdminRoute, DeliveryRoute } from './components/common/ProtectedRoute';
import {
  selectIsDelivery, selectIsAdmin, selectIsAuthenticated,
  selectUser, selectToken, selectInitialized,
  refreshAccessToken, setInitialized,
} from './store/authSlice';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import CartDrawer from './components/common/CartDrawer';
import ScrollToTop from './components/common/ScrollToTop';
import SmoothScroller from './components/common/SmoothScroller';

// Pages
const Home = lazy(() => import('./pages/Home'));
const Shop = lazy(() => import('./pages/Shop'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const Profile = lazy(() => import('./pages/Profile'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const NotFound = lazy(() => import('./pages/NotFound'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const CustomOrder = lazy(() => import('./pages/CustomOrder'));
const CustomOrders = lazy(() => import('./pages/CustomOrders'));
const DeliveryPartnerPage = lazy(() => import('./pages/DeliveryPartnerPage'));

const Login = lazy(() => import('./pages/Auth').then(module => ({ default: module.Login })));
const Register = lazy(() => import('./pages/Auth').then(module => ({ default: module.Register })));
const DeliveryLogin = lazy(() => import('./pages/DeliveryAuth').then(module => ({ default: module.DeliveryLogin })));
const DeliveryRegister = lazy(() => import('./pages/DeliveryAuth').then(module => ({ default: module.DeliveryRegister })));

// Admin Pages
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminRegister = lazy(() => import('./pages/admin/AdminRegister'));
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminProducts = lazy(() => import('./pages/admin/AdminProducts'));
const AdminOrders = lazy(() => import('./pages/admin/AdminOrders'));
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'));
const AdminPricing = lazy(() => import('./pages/admin/AdminPricing'));
const AdminDelivery = lazy(() => import('./pages/admin/AdminDelivery'));
const AdminCustomOrders = lazy(() => import('./pages/admin/AdminCustomOrders'));
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'));

// Module-level flag — prevents React 18 StrictMode double-invoke from firing two
// simultaneous refresh requests. Backend uses token rotation: second request with
// same cookie triggers TOKEN_REPLAY_ATTACK → wipes sessions → logout.
// Flag resets on actual page reload (new JS execution context), not on re-render.
let _authInitStarted = false;

function AppInitializer() {
  const dispatch    = useDispatch();
  const user        = useSelector(selectUser);
  const accessToken = useSelector(selectToken);
  const initialized = useSelector(selectInitialized);

  useEffect(() => {
    if (_authInitStarted || initialized) return;
    _authInitStarted = true;
    if (user && !accessToken) {
      // User metadata in localStorage but no token — restore via httpOnly refresh cookie
      dispatch(refreshAccessToken());
    } else {
      // Not logged in — mark initialized so ProtectedRoute can redirect immediately
      dispatch(setInitialized());
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

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
  const isDelivery      = useSelector(selectIsDelivery);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location        = useLocation();
  const navigate        = useNavigate();

  useEffect(() => {
    if (isDelivery && isAuthenticated && !location.pathname.startsWith('/delivery')) {
      navigate('/delivery', { replace: true });
    }
  }, [isDelivery, isAuthenticated, location.pathname, navigate]);

  return null;
}

function AdminRedirect() {
  const isAdmin         = useSelector(selectIsAdmin);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location        = useLocation();
  const navigate        = useNavigate();

  useEffect(() => {
    // Only redirect if truly authenticated — prevents stale localStorage role from firing
    if (isAdmin && isAuthenticated && !location.pathname.startsWith('/admin')) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, isAuthenticated, location.pathname, navigate]);

  return null;
}

function GatedRoutes({ children }) {
  const initialized = useSelector(selectInitialized);
  if (!initialized) return null;
  return children;
}

export default function App() {
  return (
    <Provider store={store}>
      <SmoothScroller>
        <BrowserRouter>
          <AppInitializer />
        <ScrollToTop />
        <DeliveryRedirect />
        <AdminRedirect />
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

          <GatedRoutes>
            <Suspense fallback={<div className="flex justify-center items-center h-screen"><div className="w-12 h-12 border-4 border-gold border-t-transparent rounded-full animate-spin"></div></div>}>
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

                <Route path="/admin/login"    element={<AdminLogin />} />
                <Route path="/admin/register" element={<AdminRegister />} />

                <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="products"      element={<AdminProducts />} />
                  <Route path="orders"        element={<AdminOrders />} />
                  <Route path="custom-orders" element={<AdminCustomOrders />} />
                  <Route path="deliveries"    element={<AdminDelivery />} />
                  <Route path="users"         element={<AdminUsers />} />
                  <Route path="pricing"       element={<AdminPricing />} />
                  <Route path="profile"       element={<AdminProfile />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </GatedRoutes>
        </ErrorBoundary>
        </BrowserRouter>
      </SmoothScroller>
    </Provider>
  );
}
