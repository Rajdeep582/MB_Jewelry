import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FiPackage, FiTruck, FiCheckCircle, FiSearch, FiRefreshCw,
  FiMapPin, FiPhone, FiUser, FiClock, FiAlertCircle, FiX, FiDownload,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { deliveryService } from '../services/services';
import { useSelector } from 'react-redux';
import { selectUser } from '../store/authSlice';

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function maskId(uuid) {
  if (!uuid) return null;
  return `MB-${uuid.replace(/-/g, '').slice(-8).toUpperCase()}`;
}

function normalise(raw, type) {
  if (type === 'order') {
    return {
      _id: raw._id, _source: 'order',
      displayId: raw.orderId || maskId(raw.deliveryId) || raw._id,
      customer: raw.user,
      address:  raw.shippingAddress,
      items:    raw.items,
      total:    raw.totalAmount,
      rawStatus: raw.orderStatus,
      dpConfirmedAt: raw.dpConfirmedAt,
      dpNote: raw.dpNote,
      createdAt: raw.createdAt,
    };
  }
  return {
    _id: raw._id, _source: 'custom_order',
    displayId: raw.customOrderId || maskId(raw.deliveryId) || raw._id,
    customer: raw.user,
    address:  raw.shippingAddress,
    items:    [{ name: `Custom ${raw.type} — ${raw.material}${raw.purity && raw.purity !== 'None' ? ` (${raw.purity})` : ''}`, quantity: 1, price: raw.totalAmount }],
    total:    raw.totalAmount,
    rawStatus: raw.status,
    dpConfirmedAt: raw.dpConfirmedAt,
    dpNote: raw.dpNote,
    createdAt: raw.createdAt,
  };
}

const STATUS_DISPLAY = {
  confirmed: 'In Progress', in_production: 'In Progress', ready_to_ship: 'In Progress',
  advance_paid: 'In Progress', final_payment_pending: 'In Progress', final_payment_paid: 'In Progress',
  quoted: 'In Progress',
  shipped: 'Shipped',
  delivered: 'Delivered',
};

const STAGE_META = {
  'In Progress': { color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20',   dot: 'bg-amber-400',   border: 'border-l-amber-500' },
  'Shipped':     { color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20',     dot: 'bg-blue-400',    border: 'border-l-blue-500'  },
  'Delivered':   { color: 'text-emerald-400',bg: 'bg-emerald-500/10 border-emerald-500/20',dot: 'bg-emerald-400', border: 'border-l-emerald-500'},
};

/* ── PDF Invoice ─────────────────────────────────────────────────────────────── */

function printDpInvoice(item) {
  const addr     = item.address || {};
  const customer = item.customer?.name || addr.fullName || '—';
  const isCustom = item._source === 'custom_order';
  const status   = STATUS_DISPLAY[item.rawStatus] || 'In Progress';

  const itemRows = (item.items || []).map(it => `
    <tr>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;">${it.name || '—'}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:center;">${it.quantity ?? 1}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">₹${Number(it.price || 0).toLocaleString('en-IN')}</td>
      <td style="padding:8px 6px;border-bottom:1px solid #eee;text-align:right;">₹${Number((it.price || 0) * (it.quantity || 1)).toLocaleString('en-IN')}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
  <title>Invoice ${item.displayId}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Arial,sans-serif;font-size:13px;color:#222;padding:32px;max-width:720px;margin:0 auto}
    .logo{font-size:22px;font-weight:700;letter-spacing:2px;color:#b8860b}
    .divider{border:none;border-top:2px solid #b8860b;margin:12px 0}
    .thin{border:none;border-top:1px solid #eee;margin:10px 0}
    .badge{display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;border:1px solid}
    .badge-custom{color:#7c3aed;border-color:#7c3aed;background:#f5f0ff}
    .badge-regular{color:#b8860b;border-color:#b8860b;background:#fffbeb}
    .badge-status{color:#0369a1;border-color:#0369a1;background:#eff6ff}
    table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;padding:8px 6px;text-align:left;font-size:12px;color:#555;border-bottom:2px solid #ddd}
    th:nth-child(2){text-align:center}th:nth-child(3),th:nth-child(4){text-align:right}
    .total-row td{font-weight:700;font-size:14px;padding:10px 6px;border-top:2px solid #b8860b;color:#b8860b}
    .total-row td:last-child{text-align:right}
    .section-label{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
    .footer{margin-top:32px;text-align:center;font-size:11px;color:#999}
    @media print{body{padding:20px}.no-print{display:none}}
  </style></head><body>

  <div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div>
      <div class="logo">MB JEWELRY</div>
      <div style="font-size:11px;color:#888;margin-top:4px">Delivery Invoice · Partner Copy</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:18px;font-weight:700;color:#333">${item.displayId}</div>
      <div style="font-size:11px;color:#888;margin-top:2px">
        Date: ${new Date(item.createdAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}
      </div>
    </div>
  </div>
  <hr class="divider">

  <div style="margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
    <span class="badge ${isCustom ? 'badge-custom' : 'badge-regular'}">${isCustom ? 'Custom Order' : 'Regular Order'}</span>
    <span class="badge badge-status">${status}</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:16px 0">
    <div>
      <div class="section-label">Customer</div>
      <div style="font-weight:600">${customer}</div>
      ${item.customer?.email ? `<div style="color:#555;font-size:12px">${item.customer.email}</div>` : ''}
      ${item.customer?.phone || addr.phone ? `<div style="color:#555;font-size:12px">${item.customer?.phone || addr.phone}</div>` : ''}
    </div>
    <div>
      <div class="section-label">Delivery Address</div>
      <div>${addr.addressLine1 || '—'}</div>
      ${addr.addressLine2 ? `<div style="color:#555">${addr.addressLine2}</div>` : ''}
      <div style="color:#555">${[addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}</div>
    </div>
  </div>

  <table style="margin-top:12px">
    <thead><tr>
      <th>Item</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Total</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
    <tfoot><tr class="total-row">
      <td colspan="3">Grand Total</td>
      <td>₹${Number(item.total || 0).toLocaleString('en-IN')}</td>
    </tr></tfoot>
  </table>

  ${item.dpConfirmedAt ? `
  <hr class="thin">
  <div style="font-size:12px;color:#16a34a;font-weight:600">
    ✓ Delivery confirmed by partner on ${new Date(item.dpConfirmedAt).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
  </div>
  ${item.dpNote ? `<div style="font-size:12px;color:#555;margin-top:4px">Note: ${item.dpNote}</div>` : ''}` : ''}

  <div class="footer">
    <hr class="thin">
    <p>MB Jewelry · Delivery Partner Invoice · Generated ${new Date().toLocaleString('en-IN')}</p>
  </div>

  <div class="no-print" style="margin-top:24px;text-align:center">
    <button onclick="window.print()" style="background:#b8860b;color:#fff;border:none;padding:10px 28px;border-radius:6px;font-size:14px;cursor:pointer">
      Print / Save as PDF
    </button>
  </div>
  </body></html>`;

  const w = window.open('', '_blank', 'width=800,height=900');
  if (w) { w.document.write(html); w.document.close(); }
}

/* ── Confirm Modal ───────────────────────────────────────────────────────────── */

function ConfirmModal({ onConfirm, onClose, title, message }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
          className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-white font-semibold text-lg mb-2">{title}</h3>
          <p className="text-dark-400 text-sm mb-6">{message}</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors">Cancel</button>
            <button onClick={onConfirm} className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors">Confirm</button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ── Delivery Card ───────────────────────────────────────────────────────────── */

function DeliveryCard({ item, onStatusUpdate, onConfirm }) {
  const status = STATUS_DISPLAY[item.rawStatus] || 'In Progress';
  const meta   = STAGE_META[status];
  const [confirmInput, setConfirmInput] = useState('');
  const [showModal, setShowModal]       = useState(false);
  const [noteInput, setNoteInput]       = useState('');
  const [busy, setBusy]                 = useState(false);

  const handleStatusBtn = async (newStatus) => {
    setBusy(true);
    await onStatusUpdate(item._id, item._source, newStatus, '');
    setBusy(false);
  };

  const handleConfirmClick = () => {
    if (confirmInput.trim() !== 'DELIVERED') return;
    setShowModal(true);
  };

  const handleFinalConfirm = async () => {
    setShowModal(false);
    setBusy(true);
    await onConfirm(item._id, item._source, noteInput);
    setBusy(false);
    setConfirmInput('');
    setNoteInput('');
  };

  return (
    <>
      {showModal && (
        <ConfirmModal
          title="Confirm Delivery"
          message="This will notify the admin that you have delivered this order. Admin must do a final confirmation."
          onConfirm={handleFinalConfirm}
          onClose={() => setShowModal(false)}
        />
      )}
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-dark-800 border ${meta.bg} border-l-4 ${meta.border} rounded-xl p-4 space-y-3`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-dark-500 font-mono">{item.displayId}</p>
            <p className="text-white font-semibold text-sm mt-0.5">{item.customer?.name || '—'}</p>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${meta.bg} ${meta.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dot} mr-1.5`} />
            {status}
          </span>
        </div>

        {/* Customer details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-dark-400">
          <div className="flex items-start gap-1.5">
            <FiMapPin size={12} className="mt-0.5 shrink-0 text-dark-500" />
            <span>
              {[item.address?.addressLine1, item.address?.city, item.address?.state, item.address?.pincode]
                .filter(Boolean).join(', ')}
            </span>
          </div>
          {item.customer?.phone && (
            <div className="flex items-center gap-1.5">
              <FiPhone size={12} className="text-dark-500" />
              <span>{item.customer.phone}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="bg-dark-900/60 rounded-lg p-2.5 space-y-1">
          {item.items?.map((it, i) => (
            <div key={i} className="flex justify-between text-xs">
              <span className="text-dark-300 truncate">{it.name} {it.quantity > 1 ? `×${it.quantity}` : ''}</span>
              <span className="text-dark-500 ml-2 shrink-0">₹{Number(it.price || 0).toLocaleString('en-IN')}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs pt-1 border-t border-white/5 mt-1">
            <span className="text-dark-400">Total</span>
            <span className="text-gold-400 font-semibold">₹{Number(item.total).toLocaleString('en-IN')}</span>
          </div>
        </div>

        <p className="text-xs text-dark-600">{fmt(item.createdAt)}</p>

        {/* DP confirmed indicator */}
        {item.dpConfirmedAt && status !== 'Delivered' && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 text-xs text-emerald-400">
            <FiCheckCircle size={12} />
            <span>You marked delivered · awaiting admin confirmation</span>
          </div>
        )}

        {/* Actions */}
        {status === 'Shipped' && !item.dpConfirmedAt && (
          <div className="space-y-2 pt-1 border-t border-white/5">
            {/* Delivery confirmation */}
            <div className="space-y-1.5">
              <p className="text-xs text-dark-500">Type <span className="text-white font-mono">DELIVERED</span> to confirm delivery:</p>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="DELIVERED"
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-emerald-500/50"
              />
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Delivery note (optional)"
                rows={2}
                className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-dark-600 focus:outline-none focus:border-white/20 resize-none"
              />
              <button
                onClick={handleConfirmClick}
                disabled={busy || confirmInput.trim() !== 'DELIVERED'}
                className="w-full py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-600/30 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <FiCheckCircle size={13} /> Confirm Delivery
              </button>
            </div>
          </div>
        )}

        {/* PDF Invoice */}
        <div className="pt-1 border-t border-white/5 flex justify-end">
          <button
            onClick={() => printDpInvoice(item)}
            className="flex items-center gap-1.5 text-xs text-gold-400 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 rounded-lg px-3 py-2 transition-colors"
          >
            <FiDownload size={11} /> Invoice PDF
          </button>
        </div>
      </motion.div>
    </>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────────── */

export default function DeliveryPartnerPage() {
  const user = useSelector(selectUser);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilter]   = useState('all');
  const intervalRef                 = useRef(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await deliveryService.getMyDeliveries();
      const orders  = (res.data.orders || []).map((o) => normalise(o, 'order'));
      const customs = (res.data.customOrders || []).map((o) => normalise(o, 'custom_order'));
      const merged  = [...orders, ...customs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setItems(merged);
      setError('');
    } catch {
      setError('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(() => load(true), 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  const handleStatusUpdate = async (id, source, status, note) => {
    try {
      await deliveryService.updateStatus(id, { source, status, note });
      await load(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleConfirm = async (id, source, note) => {
    try {
      await deliveryService.confirmDelivery(id, { source, note });
      await load(true);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = items.filter((item) => {
    const display = STATUS_DISPLAY[item.rawStatus] || 'In Progress';
    const matchStatus = filterStatus === 'all' || display === filterStatus;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      item.displayId?.toLowerCase().includes(q) ||
      item.customer?.name?.toLowerCase().includes(q) ||
      item.address?.city?.toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const counts = {
    'In Progress': items.filter((i) => (STATUS_DISPLAY[i.rawStatus] || 'In Progress') === 'In Progress').length,
    'Shipped':     items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Shipped').length,
    'Delivered':   items.filter((i) => STATUS_DISPLAY[i.rawStatus] === 'Delivered').length,
  };

  return (
    <div className="min-h-screen bg-dark-950 text-white">
      {/* Header */}
      <div className="bg-dark-900 border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
              <FiTruck size={18} className="text-gold-400" />
            </div>
            <div>
              <h1 className="text-white font-semibold text-base">My Deliveries</h1>
              <p className="text-dark-500 text-xs">{user?.name} · Delivery Partner</p>
            </div>
          </div>
          <button onClick={() => load()} className="p-2 rounded-lg hover:bg-white/5 text-dark-400 hover:text-white transition-colors">
            <FiRefreshCw size={16} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[['In Progress', counts['In Progress'], 'text-amber-400', 'bg-amber-500/10 border-amber-500/20'],
            ['Shipped',     counts['Shipped'],     'text-blue-400',  'bg-blue-500/10 border-blue-500/20'],
            ['Delivered',   counts['Delivered'],   'text-emerald-400','bg-emerald-500/10 border-emerald-500/20']
          ].map(([label, count, textCls, bgCls]) => (
            <button
              key={label}
              onClick={() => setFilter(filterStatus === label ? 'all' : label)}
              className={`border rounded-xl p-3 text-center w-full transition-all ${bgCls} ${filterStatus === label ? 'ring-2 ring-white/20 scale-[1.03]' : 'hover:scale-[1.02]'}`}
            >
              <p className={`text-xl font-bold font-jakarta ${textCls}`}>{count}</p>
              <p className="text-xs text-dark-500 mt-0.5">{label}</p>
            </button>
          ))}
        </div>

        {/* Search + Filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, city…"
              className="w-full bg-dark-800 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-gold-500/30"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-dark-800 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none"
          >
            <option value="all">All</option>
            <option value="In Progress">In Progress</option>
            <option value="Shipped">Shipped</option>
            <option value="Delivered">Delivered</option>
          </select>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-center py-16 text-dark-500 text-sm">Loading deliveries…</div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400 text-sm py-8 justify-center">
            <FiAlertCircle size={16} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-dark-500 text-sm">
            {items.length === 0 ? 'No deliveries assigned yet.' : 'No results match your filter.'}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <DeliveryCard
                key={`${item._source}-${item._id}`}
                item={item}
                onStatusUpdate={handleStatusUpdate}
                onConfirm={handleConfirm}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
