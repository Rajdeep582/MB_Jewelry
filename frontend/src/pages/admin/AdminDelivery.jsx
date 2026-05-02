import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPackage, FiSearch, FiRefreshCw, FiAlertCircle, FiTruck,
  FiCheck, FiCheckCircle, FiShield, FiTag, FiRadio,
  FiMapPin, FiPhone, FiUser, FiClock,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { orderService, customOrderService } from '../../services/services';
import { formatDate, formatPrice, resolveImageUrl } from '../../utils/helpers';

/* ── Pipeline stage mapping ─────────────────────────────────────────────────── */

const IN_PROGRESS_REGULAR = ['confirmed', 'in_production', 'ready_to_ship'];
const IN_PROGRESS_CUSTOM  = ['in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship'];

function getStage(displayStatus) {
  if (['confirmed', 'in_production', 'ready_to_ship'].includes(displayStatus)) return 'progress';
  if (displayStatus === 'shipped') return 'shipped';
  if (displayStatus === 'delivered') return 'delivered';
  return 'progress';
}

const STAGE_META = {
  progress:  { label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-400', border: 'border-l-amber-500/60' },
  shipped:   { label: 'Shipped',     color: 'text-blue-400',  bg: 'bg-blue-500/10 border-blue-500/20',   dot: 'bg-blue-400',  border: 'border-l-blue-500' },
  delivered: { label: 'Delivered',   color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400', border: 'border-l-emerald-500' },
};

/* ── Normalise order into unified shape ─────────────────────────────────────── */

function normaliseOrder(raw, sourceType) {
  if (sourceType === 'order') {
    return { ...raw, _sourceType: 'order', _displayStatus: raw.orderStatus };
  }
  let displayStatus = raw.status;
  if (['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid'].includes(raw.status)) {
    displayStatus = 'in_production';
  }
  const syntheticItem = {
    _id: raw._id, product: raw._id,
    name: `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`,
    image: raw.referenceImages?.[0]?.url || '', price: raw.totalAmount || 0, quantity: 1,
  };
  return {
    _id: raw._id, _sourceType: 'custom_order', _displayStatus: displayStatus,
    user: raw.user, shippingAddress: raw.shippingAddress, totalAmount: raw.totalAmount || 0,
    items: [syntheticItem], deliveryId: raw.deliveryId, dispatchedAt: raw.dispatchedAt,
    estimatedDelivery: raw.estimatedDelivery, deliveredAt: raw.deliveredAt,
    trackingHistory: raw.trackingHistory || [], createdAt: raw.createdAt,
    customOrderId: raw.customOrderId, orderId: raw.orderId,
  };
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function maskDeliveryId(uuid) {
  if (!uuid) return null;
  return `MB-${uuid.replace(/-/g, '').slice(-8).toUpperCase()}`;
}
function resolveOrderId(item) {
  if (!item) return '—';
  if (item._sourceType === 'order') return item.orderId || `ORD-${String(item._id).slice(-8).toUpperCase()}`;
  return item.customOrderId || `CUS-${String(item._id).slice(-8).toUpperCase()}`;
}

/* ── Stat Pill ──────────────────────────────────────────────────────────────── */

function StatPill({ label, value, color, icon: Icon, active, onClick }) {
  const colors = {
    amber:   'bg-amber-500/10 border-amber-500/20 text-amber-400',
    blue:    'bg-blue-500/10 border-blue-500/20 text-blue-400',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  };
  return (
    <button onClick={onClick}
      className={`rounded-xl border px-5 py-4 flex flex-col gap-1 transition-all text-left ${colors[color]} ${active ? 'ring-2 ring-offset-1 ring-offset-dark-950 ring-gold-500/50 scale-[1.02]' : 'hover:scale-[1.01]'}`}>
      <div className="flex items-center justify-between w-full">
        <p className="text-2xl font-display font-semibold">{value}</p>
        {Icon && <Icon size={18} className="opacity-50" />}
      </div>
      <p className="text-xs opacity-75">{label}</p>
    </button>
  );
}

/* ── Delivery Card (read-only) ─────────────────────────────────────────────── */

function DeliveryCard({ item }) {
  const stage    = getStage(item._displayStatus);
  const meta     = STAGE_META[stage];
  const isCustom = item._sourceType === 'custom_order';
  const delivID  = maskDeliveryId(item.deliveryId);
  const mainItem = item.items?.[0];
  const isExpanded = stage === 'shipped' || stage === 'delivered';

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`card p-5 border-l-4 ${meta.border} transition-shadow hover:shadow-lg hover:shadow-black/20`}>

      {/* Row 1: IDs / Status / Amount */}
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-gold-400 font-semibold text-sm">{resolveOrderId(item)}</span>
          <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${isCustom ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' : 'bg-gold-500/10 border-gold-500/20 text-gold-400'}`}>
            <FiTag size={8} /> {isCustom ? 'Custom' : 'Regular'}
          </span>
          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${meta.bg} ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot} ${stage === 'shipped' ? 'animate-pulse' : ''}`} /> {meta.label}
          </span>
          {delivID && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono bg-gold-500/10 border border-gold-500/30 text-gold-300 px-1.5 py-0.5 rounded-full">
              <FiShield size={8} /> {delivID}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <p className="text-gold-500 font-semibold text-sm">{formatPrice(item.totalAmount)}</p>
          <p className="text-dark-600 text-xs">{formatDate(item.createdAt)}</p>
        </div>
      </div>

      {/* Compact layout for In Progress */}
      {!isExpanded && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
            {mainItem?.image && <img src={resolveImageUrl(mainItem.image)} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white truncate">{mainItem?.name}{item.items?.length > 1 ? ` +${item.items.length - 1} more` : ''}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-dark-400 mt-0.5">
              <span>{item.user?.name || item.shippingAddress?.fullName}</span>
              <span>{item.shippingAddress?.city}, {item.shippingAddress?.state}</span>
            </div>
          </div>
        </div>
      )}

      {/* Expanded layout for Shipped / Delivered */}
      {isExpanded && (
        <>
          {/* Items + Customer grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-4">
            {/* Items */}
            <div className="space-y-2">
              <p className="text-xs text-dark-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <FiPackage size={10} /> {isCustom ? 'Custom Design' : `Items (${item.items?.length})`}
              </p>
              <div className="space-y-2 max-h-40 overflow-y-auto scrollbar-hide pr-1">
                {item.items?.map((it) => (
                  <div key={it._id || it.product} className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-dark-800 flex-shrink-0 overflow-hidden border border-white/5">
                      {it.image && <img src={resolveImageUrl(it.image)} alt={it.name} className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{it.name}</p>
                      <p className="text-xs text-dark-400">Qty {it.quantity} · {formatPrice(it.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Customer + Address */}
            <div className="space-y-3 md:border-l md:border-white/5 md:pl-5">
              <div>
                <p className="text-xs text-dark-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FiUser size={10} /> Customer</p>
                <p className="text-sm text-white font-medium">{item.user?.name || item.shippingAddress?.fullName || '—'}</p>
                {item.user?.email && <p className="text-xs text-dark-500">{item.user.email}</p>}
                {item.shippingAddress?.phone && (
                  <p className="text-xs text-dark-400 flex items-center gap-1 mt-0.5"><FiPhone size={10} /> {item.shippingAddress.phone}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-dark-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5"><FiMapPin size={10} /> Ship to</p>
                <p className="text-sm text-white leading-snug">{item.shippingAddress?.addressLine1}</p>
                {item.shippingAddress?.addressLine2 && <p className="text-sm text-dark-400">{item.shippingAddress.addressLine2}</p>}
                <p className="text-xs text-dark-400 mt-0.5">{item.shippingAddress?.city}, {item.shippingAddress?.state} — {item.shippingAddress?.pincode}</p>
              </div>

              {/* Delivery Reference */}
              {item.deliveryId && (
                <div className="bg-dark-800 border border-white/5 rounded-xl px-3 py-2 flex items-center gap-2">
                  <FiTruck size={12} className="text-gold-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-dark-500 mb-0.5">Delivery Reference</p>
                    <span className="font-mono text-gold-400 text-sm font-semibold">{delivID}</span>
                  </div>
                  {item.estimatedDelivery && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-dark-500">ETA</p>
                      <p className="text-xs font-medium text-dark-300">{formatDate(item.estimatedDelivery)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Dispatched / Delivered info */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {item.dispatchedAt && (
              <span className="text-dark-500 flex items-center gap-1"><FiClock size={10} /> Dispatched: <span className="text-dark-300">{formatDate(item.dispatchedAt)}</span></span>
            )}
            {item.estimatedDelivery && <span className="text-dark-500">ETA: <span className="text-dark-300">{formatDate(item.estimatedDelivery)}</span></span>}
            {item.deliveredAt && (
              <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <FiCheck size={10} /> Delivered on {formatDate(item.deliveredAt)}
              </span>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────────── */

export default function AdminDelivery() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState('progress');

  const pollingRef  = useRef(null);
  const lastRefresh = useRef(null);

  useEffect(() => { document.title = 'Delivery Management — Admin'; }, []);

  /* ── Load all pipeline items ──────────────────────────────────────────────── */
  const loadItems = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const orderFetches = [
        ...IN_PROGRESS_REGULAR.map(s => orderService.getAllOrders({ status: s, paymentStatus: 'all', limit: 100 })),
        orderService.getAllOrders({ status: 'shipped', paymentStatus: 'all', limit: 100 }),
        orderService.getAllOrders({ status: 'delivered', paymentStatus: 'all', limit: 25 }),
      ];
      const customFetches = [
        ...IN_PROGRESS_CUSTOM.map(s => customOrderService.getAllOrders({ status: s, limit: 100 })),
        customOrderService.getAllOrders({ status: 'shipped', limit: 100 }),
        customOrderService.getAllOrders({ status: 'delivered', limit: 25 }),
      ];

      const [orderResults, customResults] = await Promise.all([
        Promise.all(orderFetches), Promise.all(customFetches),
      ]);

      const normOrders  = orderResults.flatMap(r => r.data.orders || []).map(o => normaliseOrder(o, 'order'));
      const normCustoms = customResults.flatMap(r => r.data.orders || []).map(o => normaliseOrder(o, 'custom_order'));

      const combined = [...normOrders, ...normCustoms];
      const unique = Array.from(new Map(combined.map(i => [i._id, i])).values());
      unique.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setItems(unique);
      lastRefresh.current = new Date();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load delivery data');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  /* ── 30s auto-polling ─────────────────────────────────────────────────────── */
  useEffect(() => {
    pollingRef.current = setInterval(() => loadItems(true), 30_000);
    return () => clearInterval(pollingRef.current);
  }, [loadItems]);

  /* ── Counts ───────────────────────────────────────────────────────────────── */
  const counts = {
    progress:  items.filter(o => getStage(o._displayStatus) === 'progress').length,
    shipped:   items.filter(o => getStage(o._displayStatus) === 'shipped').length,
    delivered: items.filter(o => getStage(o._displayStatus) === 'delivered').length,
  };

  /* ── Filter ───────────────────────────────────────────────────────────────── */
  const filtered = items.filter(o => {
    if (getStage(o._displayStatus) !== tab) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      o._id.toLowerCase().includes(q) ||
      (o.user?.name || '').toLowerCase().includes(q) ||
      (o.user?.email || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.city || '').toLowerCase().includes(q) ||
      (o.shippingAddress?.pincode || '').toLowerCase().includes(q) ||
      (o.items?.[0]?.name || '').toLowerCase().includes(q) ||
      (o.deliveryId ? maskDeliveryId(o.deliveryId).toLowerCase().includes(q) : false) ||
      resolveOrderId(o).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-white">Delivery Management</h1>
          <p className="text-dark-400 text-sm mt-0.5 flex items-center gap-2">
            {loading ? 'Loading…' : `${counts.progress + counts.shipped} active · ${counts.delivered} delivered`}
            {lastRefresh.current && !loading && (
              <span className="text-dark-600 text-xs flex items-center gap-1"><FiRadio size={10} className="text-green-500" /> Auto-sync 30s</span>
            )}
          </p>
        </div>
        <button onClick={() => loadItems()} disabled={loading} className="btn-dark text-sm flex items-center gap-2 disabled:opacity-50">
          <FiRefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatPill label="In Progress" value={loading ? '…' : counts.progress} color="amber"   icon={FiPackage}     active={tab === 'progress'}  onClick={() => setTab('progress')} />
        <StatPill label="Shipped"     value={loading ? '…' : counts.shipped}  color="blue"    icon={FiTruck}       active={tab === 'shipped'}   onClick={() => setTab('shipped')} />
        <StatPill label="Delivered"   value={loading ? '…' : counts.delivered} color="emerald" icon={FiCheckCircle} active={tab === 'delivered'} onClick={() => setTab('delivered')} />
      </div>

      {/* Search */}
      <div className="relative">
        <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dark-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by order ID, customer, city…"
          className="input-dark pl-9 text-sm w-full" />
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm">
          <FiAlertCircle size={16} /> {error}
        </div>
      )}

      {/* Cards */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 space-y-2">
              <div className="skeleton h-4 rounded w-1/3" />
              <div className="skeleton h-3 rounded w-2/3" />
            </div>
          ))
        ) : filtered.length === 0 ? (
          <div className="text-center p-16 bg-dark-900/60 rounded-2xl border border-white/5">
            <FiTruck size={36} className="mx-auto mb-4 text-dark-700" />
            <p className="text-dark-400 text-sm">{search ? `No results for "${search}"` : `No ${tab === 'progress' ? 'in-progress' : tab} orders`}</p>
          </div>
        ) : (
          filtered.map(item => (
            <DeliveryCard key={`${item._sourceType}-${item._id}`} item={item} />
          ))
        )}
      </div>
    </div>
  );
}
