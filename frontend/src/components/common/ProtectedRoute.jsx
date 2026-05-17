import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsAdmin, selectIsDelivery, selectUser, selectInitialized } from '../../store/authSlice';
import PropTypes from 'prop-types';

export function ProtectedRoute({ children }) {
  const initialized     = useSelector(selectInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const user            = useSelector(selectUser);
  const location        = useLocation();
  if (!initialized) return null; // wait for silent refresh on page load
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  // Block admin/delivery from accessing user-only routes via URL manipulation
  if (user?.role && user.role !== 'user') return <Navigate to="/login" replace />;
  return children;
}

export function AdminRoute({ children }) {
  const initialized     = useSelector(selectInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin         = useSelector(selectIsAdmin);
  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />;
  if (!isAdmin) return <Navigate to="/admin/login" replace />;
  return children;
}

export function DeliveryRoute({ children }) {
  const initialized     = useSelector(selectInitialized);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isDelivery      = useSelector(selectIsDelivery);
  if (!initialized) return null;
  if (!isAuthenticated) return <Navigate to="/delivery/login" replace />;
  if (!isDelivery) return <Navigate to="/delivery/login" replace />;
  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node.isRequired };
AdminRoute.propTypes     = { children: PropTypes.node.isRequired };
DeliveryRoute.propTypes  = { children: PropTypes.node.isRequired };
