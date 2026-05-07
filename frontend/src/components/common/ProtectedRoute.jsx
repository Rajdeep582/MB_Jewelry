import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsAdmin, selectIsDelivery } from '../../store/authSlice';
import PropTypes from 'prop-types';

export function ProtectedRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const location        = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export function AdminRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAdmin         = useSelector(selectIsAdmin);
  const location        = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}

export function DeliveryRoute({ children }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isDelivery      = useSelector(selectIsDelivery);
  const location        = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!isDelivery) return <Navigate to="/" replace />;
  return children;
}

ProtectedRoute.propTypes = { children: PropTypes.node.isRequired };
AdminRoute.propTypes     = { children: PropTypes.node.isRequired };
DeliveryRoute.propTypes  = { children: PropTypes.node.isRequired };
