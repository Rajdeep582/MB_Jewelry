import { useCallback, useEffect, useState } from 'react';
import { FiMapPin, FiPhone, FiUser, FiPackage, FiSearch, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { orderService } from '../../services/services';
import { formatDate, formatPrice, getOrderStatusColor, resolveImageUrl } from '../../utils/helpers';

const ACTIVE_STATUSES = ['processing', 'confirmed', 'shipped'];

export default function AdminDelivery() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    document.title = 'Delivery Management — Admin';
    loadOrders();
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch active deliveries (exclude delivered/cancelled/returned)
      const results = await Promise.all(
        ACTIVE_STATUSES.map((s) => orderService.getAllOrders({ status: s, limit: 50 }))
      );
      const combined = results.flatMap((r) => r.data.orders);
      // Sort by most recent first
      combined.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(combined);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load delivery data');
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredOrders = orders.filter((o) => {
    const matchStatus = !statusFilter || o.orderStatus === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      o._id.toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.city || '').toLowerCase().includes(q) ||
      (o.trackingNumber || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Delivery Management</h1>
          <p className="text-dark-400 text-sm">
            {loading ? 'Loading...' : `${filteredOrders.length} active shipment${filteredOrders.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={loadOrders} disabled={loading}
          className="btn-dark text-sm gap-2 flex items-center disabled:opacity-50">
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Order ID, customer name, city, tracking..."
            className="input-dark pl-9 text-sm w-full"
          />
        </div>
        {/* Status filter */}
        <div className="flex gap-2 flex-wrap">
          {[{ value: '', label: 'All Active' }, ...ACTIVE_STATUSES.map((s) => ({ value: s, label: s }))].map(({ value, label }) => (
            <button
              key={value || 'all'}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-all border capitalize ${
                statusFilter === value
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
          <FiAlertCircle size={16} /> {error}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-5 rounded w-1/3" />
              <div className="skeleton h-4 rounded w-2/3" />
              <div className="skeleton h-4 rounded w-1/2" />
            </div>
          ))
        ) : filteredOrders.length === 0 ? (
          <div className="text-center p-12 text-dark-400 bg-dark-900/60 rounded-xl border border-white/5">
            <FiPackage size={32} className="mx-auto mb-3 opacity-30" />
            <p>No active deliveries{search ? ` matching "${search}"` : ''}.</p>
          </div>
        ) : filteredOrders.map((order) => (
          <div key={order._id} className="card p-5 border-l-4 border-l-gold-500">
            <div className="flex flex-col md:flex-row gap-6">

              {/* Left: Order Info */}
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-gold-400 font-semibold text-base">
                      #{order._id.slice(-8).toUpperCase()}
                    </span>
                    <span className={`badge ${getOrderStatusColor(order.orderStatus)} capitalize`}>
                      {order.orderStatus}
                    </span>
                  </div>
                  <p className="text-dark-500 text-xs">{formatDate(order.createdAt)}</p>
                </div>

                {/* Order value */}
                <p className="text-gold-500 font-medium">{formatPrice(order.totalAmount)}</p>

                {/* Items list */}
                <div className="bg-dark-900 p-3 rounded-lg border border-white/5 space-y-2">
                  <h4 className="text-xs text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FiPackage size={10} /> Items ({order.items.length})
                  </h4>
                  {order.items.map((item) => (
                    <div key={item._id || item.product} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-dark-800 flex-shrink-0 overflow-hidden">
                        {item.image && (
                          <img src={resolveImageUrl(item.image)} alt="" className="w-full h-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{item.name}</p>
                        <p className="text-xs text-dark-400">Qty: {item.quantity} · {formatPrice(item.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tracking info if available */}
                {order.trackingNumber && (
                  <div className="flex items-center gap-2 text-xs text-dark-300 bg-dark-800 border border-white/5 rounded-lg px-3 py-2">
                    <span className="text-dark-500">Tracking:</span>
                    {order.trackingUrl ? (
                      <a href={order.trackingUrl} target="_blank" rel="noreferrer" className="text-gold-400 hover:underline font-mono">
                        {order.trackingNumber}
                      </a>
                    ) : (
                      <span className="font-mono text-gold-400">{order.trackingNumber}</span>
                    )}
                    {order.courierPartner && <span className="text-dark-500">· {order.courierPartner}</span>}
                  </div>
                )}
              </div>

              {/* Right: Customer & Address */}
              <div className="flex-1 space-y-4 md:border-l md:border-white/10 md:pl-6">
                <div>
                  <h4 className="text-xs text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FiUser size={10} /> Customer
                  </h4>
                  <p className="text-sm text-white font-medium">{order.user?.name || order.shippingAddress?.fullName || 'N/A'}</p>
                  {order.user?.email && <p className="text-xs text-dark-400">{order.user.email}</p>}
                  {order.shippingAddress?.phone && (
                    <p className="text-xs text-dark-400 flex items-center gap-1 mt-1">
                      <FiPhone size={10} /> {order.shippingAddress.phone}
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="text-xs text-dark-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <FiMapPin size={10} /> Delivery Address
                  </h4>
                  <p className="text-sm text-white">{order.shippingAddress?.addressLine1}</p>
                  {order.shippingAddress?.addressLine2 && (
                    <p className="text-sm text-white">{order.shippingAddress.addressLine2}</p>
                  )}
                  <p className="text-sm text-dark-300">
                    {order.shippingAddress?.city}, {order.shippingAddress?.state} — {order.shippingAddress?.pincode}
                  </p>
                </div>
              </div>

            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
