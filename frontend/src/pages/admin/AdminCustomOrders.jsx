import { useEffect, useState } from 'react';
import { FiX, FiChevronDown, FiImage } from 'react-icons/fi';
import { customOrderService } from '../../services/services';
import { formatPrice, formatDate, getCustomOrderStatusColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Simplified filter tabs for admin
const FILTER_OPTIONS = [
  { value: '',               label: 'All' },
  { value: 'pending',        label: 'Order Placed' },
  { value: 'in_production',  label: 'In Production' },
  { value: 'shipped',        label: 'Shipped' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'cancelled',      label: 'Cancelled' },
];

// Human-readable stage labels
const STAGE_LABELS = {
  pending:                'Order Placed',
  quoted:                 'Quoted',
  advance_paid:           'Confirmed & In Production',
  in_production:          'Confirmed & In Production',
  final_payment_pending:  'Final Payment Pending',
  final_payment_paid:     'Final Payment Paid',
  ready_to_ship:          'Ready to Ship',
  shipped:                'Shipped',
  delivered:              'Delivered',
  cancelled:              'Cancelled',
};

// ─── Quote Modal ──────────────────────────────────────────────────────────────
function QuoteModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    quoteAmount: order.quoteAmount || '',
    quoteNote:   order.quoteNote   || '',
    expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : '',
    adminNotes:  order.adminNotes  || '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.quoteAmount || Number(form.quoteAmount) <= 0) {
      toast.error('Please enter a valid quote amount'); return;
    }
    setSaving(true);
    try {
      await customOrderService.setQuote(order._id, {
        quoteAmount: Number(form.quoteAmount),
        quoteNote:   form.quoteNote,
        expectedDeliveryDate: form.expectedDeliveryDate,
        adminNotes:  form.adminNotes,
      });
      toast.success('Quote set successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set quote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">Set Quote</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>

        <div className="mb-4 text-sm text-dark-300 bg-dark-900 border border-white/10 p-4 rounded-lg space-y-3 max-h-[40vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 pb-3 border-b border-white/10">
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Order ID</p>
              <p className="text-gold-400 font-mono">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Customer</p>
              <p className="text-white truncate" title={`${order.user?.name} (${order.user?.email})`}>{order.user?.name}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Product</p>
              <p className="text-white">{order.type} — {order.material}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Purity</p>
              <p className="text-white">{order.purity !== 'None' ? order.purity : 'N/A'}</p>
            </div>
            {order.budget && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Budget</p>
                <p className="text-gold-400 font-medium">{order.budget}</p>
              </div>
            )}
            {order.weight && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Exp. Weight</p>
                <p className="text-white">{order.weight}</p>
              </div>
            )}
            {order.fingerSize && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Finger Size</p>
                <p className="text-white">{order.fingerSize}</p>
              </div>
            )}
            {order.neckSize && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Neck Size</p>
                <p className="text-white">{order.neckSize}</p>
              </div>
            )}
            {order.wristSize && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Wrist Size</p>
                <p className="text-white">{order.wristSize}</p>
              </div>
            )}
          </div>
          
          <div>
            <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-1">Customer Description</p>
            <p className="text-dark-300 italic text-xs bg-dark-800/50 p-2.5 rounded border border-white/5 whitespace-pre-wrap">{order.description}</p>
          </div>

          {order.referenceImages?.length > 0 && (
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-2">Reference Images</p>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {order.referenceImages.map((img, idx) => (
                  <a key={idx} href={img.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border border-white/10 hover:border-gold-500 transition-colors block">
                    <img src={img.url} alt={`Ref ${idx}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">Quote Amount (₹) <span className="text-red-400">*</span></label>
            <input
              type="number"
              min="1"
              value={form.quoteAmount}
              onChange={(e) => setForm({ ...form, quoteAmount: e.target.value })}
              className="input-dark"
              placeholder="Enter amount in INR (excl. GST)"
              required
            />
            {form.quoteAmount > 0 && (
              <p className="text-dark-500 text-xs mt-1">
                Customer pays: {formatPrice(Math.round(Number(form.quoteAmount) * 1.18))} (incl. 18% GST)
              </p>
            )}
          </div>
          <div>
            <label className="label-dark">Quote Note <span className="text-dark-500 font-normal">(visible to customer)</span></label>
            <textarea
              value={form.quoteNote}
              onChange={(e) => setForm({ ...form, quoteNote: e.target.value })}
              className="input-dark resize-none"
              rows={2}
              placeholder="e.g. Includes hallmark charges."
            />
          </div>
          <div>
            <label className="label-dark">Expected Delivery Date <span className="text-dark-500 font-normal">(visible to customer)</span></label>
            <input
              type="date"
              value={form.expectedDeliveryDate}
              onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
              className="input-dark"
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          <div>
            <label className="label-dark">Admin Notes <span className="text-dark-500 font-normal">(internal only)</span></label>
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
              className="input-dark resize-none"
              rows={2}
              placeholder="Internal notes for tracking / production team"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5">
              {saving ? 'Saving…' : 'Set Quote'}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Status Update Modal ──────────────────────────────────────────────────────
// Admin can only move orders forward through these stages:
// Order Placed → Confirmed & In Production → Shipped → Delivered
const ADMIN_STAGE_OPTIONS = [
  { value: 'shipped',        label: 'Shipped' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'cancelled',      label: 'Cancelled' },
];

function StatusModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status:  order.status,
    comment: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await customOrderService.updateStatus(order._id, form);
      toast.success('Status updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  // Only show forward stages (can't go backward)
  const allStatuses = ['pending', 'quoted', 'advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];
  const currentIdx = allStatuses.indexOf(order.status);
  
  const isFinalPaid = order.finalPayment?.status === 'paid';
  
  const availableStages = ADMIN_STAGE_OPTIONS.filter((opt) => {
    if (opt.value === 'cancelled') return true;
    // Guard: cannot select "delivered" unless final payment is done
    if (opt.value === 'delivered' && !isFinalPaid) return false;
    const optIdx = allStatuses.indexOf(opt.value);
    return optIdx > currentIdx;
  });

  // Payment info
  const advanceStatus = order.advancePayment?.status || 'pending';
  const finalStatus = order.finalPayment?.status || 'pending';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">Update Order</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>

        {/* Order Info */}
        <div className="mb-4 text-sm text-dark-300 bg-dark-900 border border-white/10 p-3 rounded-lg space-y-1">
          <p>Order: <span className="text-gold-400 font-mono">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</span></p>
          <p>Current Stage: <span className={getCustomOrderStatusColor(order.status)}>{STAGE_LABELS[order.status] || order.status.replace(/_/g, ' ')}</span></p>
        </div>

        {/* Payment Status Section */}
        <div className="mb-5 bg-dark-900 border border-white/10 rounded-lg p-3">
          <p className="text-xs text-dark-500 uppercase tracking-wider mb-2 font-semibold">Payment Status</p>
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-2 rounded-lg border text-center ${advanceStatus === 'paid' ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
              <p className="text-xs text-dark-400 mb-0.5">70% Advance</p>
              <p className={`text-sm font-medium ${advanceStatus === 'paid' ? 'text-green-400' : 'text-dark-500'}`}>
                {advanceStatus === 'paid' ? '✓ Paid' : 'Pending'}
              </p>
            </div>
            <div className={`p-2 rounded-lg border text-center ${finalStatus === 'paid' ? 'border-green-500/30 bg-green-500/5' : 'border-white/5'}`}>
              <p className="text-xs text-dark-400 mb-0.5">30% Balance</p>
              <p className={`text-sm font-medium ${finalStatus === 'paid' ? 'text-green-400' : 'text-dark-500'}`}>
                {finalStatus === 'paid' ? '✓ Paid' : 'Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Delivered guard warning */}
        {!isFinalPaid && order.status === 'shipped' && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠ Cannot mark as Delivered until the 30% final payment is received.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">Update Stage</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-dark">
              <option value={order.status} disabled>{STAGE_LABELS[order.status] || order.status.replace(/_/g, ' ')} (current)</option>
              {availableStages.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div>
            <label className="label-dark">Comment <span className="text-dark-500 font-normal">(optional)</span></label>
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="e.g. Confirmed by artisan team" className="input-dark" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || form.status === order.status} className="btn-gold flex-1 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed">{saving ? 'Updating…' : 'Update Stage'}</button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Images Modal ─────────────────────────────────────────────────────────────
function ImagesModal({ images, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Reference Images ({images.length})</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <a key={i} href={img.url} target="_blank" rel="noopener noreferrer">
              <div className="aspect-square rounded-xl overflow-hidden bg-dark-700 hover:ring-2 ring-gold-500 transition-all">
                <img src={img.url} alt={`ref-${i}`} className="w-full h-full object-cover" />
              </div>
            </a>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function AdminCustomOrders() {
  const [orders,      setOrders]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [filter,      setFilter]      = useState('pending'); // Default to Order Placed
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [quoteModal,  setQuoteModal]  = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [imgModal,    setImgModal]    = useState(null);

  useEffect(() => { document.title = 'Custom Orders — Admin'; }, []);

  const loadOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const res = await customOrderService.getAllOrders({ status: filter, page, limit: 15 });
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      if (!isBackground) setError(err.response?.data?.message || 'Failed to load custom orders');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // Load orders when filter/page changes
  useEffect(() => { loadOrders(); }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Pass true to indicate a background refresh (won't show loading spinner)
      loadOrders(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [filter, page]); // re-bind interval if filter/page changes so it uses current state

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-white">Custom Orders</h1>
          <p className="text-dark-400 text-sm">{total} requests total</p>
        </div>
      </div>

      <div className="card p-4">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-5">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value || 'all'}
              onClick={() => { setFilter(value); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs transition-all border ${
                filter === value
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">ID</th>
                <th className="text-left py-2 pr-4">Customer</th>
                <th className="text-left py-2 pr-4">Type / Material</th>
                <th className="text-left py-2 pr-4">Budget</th>
                <th className="text-left py-2 pr-4">Quote</th>
                <th className="text-left py-2 pr-4">Payment</th>
                <th className="text-left py-2 pr-4">Stage</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={8} className="py-3"><div className="skeleton h-8 rounded-lg" /></td></tr>
                ))
              ) : orders.map((order) => (
                <tr key={order._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <span className="text-gold-400 font-mono text-xs">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-dark-300 text-xs">{order.user?.name || 'N/A'}</p>
                    <a href={`mailto:${order.user?.email}`} className="text-dark-500 hover:text-gold-400 text-xs transition-colors">{order.user?.email}</a>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-white text-xs">{order.type}</p>
                    <p className="text-dark-500 text-xs">{order.material} {order.purity !== 'None' ? `· ${order.purity}` : ''}</p>
                  </td>
                  <td className="py-3 pr-4 text-dark-400 text-xs">{order.budget || '—'}</td>
                  <td className="py-3 pr-4">
                    {order.quoteAmount
                      ? <span className="text-gold-500 font-medium">{formatPrice(order.quoteAmount)}</span>
                      : <span className="text-dark-600 text-xs italic">Not set</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {order.finalPayment?.status === 'paid' ? (
                      <span className="text-green-400 text-xs font-medium">Fully Paid</span>
                    ) : order.advancePayment?.status === 'paid' ? (
                      <span className="text-blue-400 text-xs font-medium">Advance Paid</span>
                    ) : (
                      <span className="text-dark-400 text-xs">Pending</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span className={getCustomOrderStatusColor(order.status)}>{STAGE_LABELS[order.status] || order.status.replace(/_/g, ' ')}</span>
                  </td>
                  <td className="py-3 pr-4 text-dark-500 text-xs">{formatDate(order.createdAt)}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {order.referenceImages?.length > 0 && (
                        <button
                          onClick={() => setImgModal(order.referenceImages)}
                          className="p-1.5 text-dark-400 hover:text-gold-400 transition-colors"
                          title="View reference images"
                        >
                          <FiImage size={14} />
                        </button>
                      )}
                      {!['delivered', 'cancelled'].includes(order.status) && (
                        <button onClick={() => setQuoteModal(order)} className="btn-outline-gold px-3 py-1.5 text-xs">
                          {order.quoteAmount ? 'Edit Quote' : 'Set Quote'}
                        </button>
                      )}
                      {!['delivered', 'cancelled'].includes(order.status) && (
                        <button onClick={() => setStatusModal(order)} className="btn-gold px-3 py-1.5 text-xs inline-flex items-center gap-1">
                          Update <FiChevronDown size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-xs ${p === page ? 'bg-gold-500 text-dark-900' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {quoteModal  && <QuoteModal  order={quoteModal}               onClose={() => setQuoteModal(null)}  onSaved={loadOrders} />}
        {statusModal && <StatusModal order={statusModal}              onClose={() => setStatusModal(null)} onSaved={loadOrders} />}
        {imgModal    && <ImagesModal images={imgModal}                onClose={() => setImgModal(null)} />}
      </AnimatePresence>
    </div>
  );
}
