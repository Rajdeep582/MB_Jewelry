import { useEffect, useState } from 'react';
import { FiX, FiChevronDown, FiImage } from 'react-icons/fi';
import { customOrderService } from '../../services/services';
import { formatPrice, formatDate, getCustomOrderStatusColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_OPTIONS = [
  '', 'pending', 'quoted', 'advance_paid', 'in_production',
  'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered', 'cancelled',
];

// ─── Quote Modal ──────────────────────────────────────────────────────────────
function QuoteModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    quoteAmount: order.quoteAmount || '',
    quoteNote:   order.quoteNote   || '',
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

        <div className="mb-4 text-sm text-dark-300 bg-dark-900 border border-white/10 p-3 rounded-lg space-y-1">
          <p>Order: <span className="text-gold-400 font-mono">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</span></p>
          <p>Type: <span className="text-white">{order.type} — {order.material} {order.purity !== 'None' ? `(${order.purity})` : ''}</span></p>
          <p>Customer: <span className="text-white">{order.user?.name} ({order.user?.email})</span></p>
          {order.budget && <p>Customer Budget: <span className="text-gold-400">{order.budget}</span></p>}
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
              placeholder="e.g. Includes hallmark charges. Delivery in 15–20 days."
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

// ─── Status Update Modal (reuses TrackingModal pattern from AdminOrders) ──────
const STATUS_AFTER_PAYMENT = ['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered', 'cancelled'];

function StatusModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status:         order.status,
    trackingNumber: order.trackingNumber || '',
    trackingUrl:    order.trackingUrl    || '',
    courierPartner: order.courierPartner || '',
    comment:        '',
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

  const availableStatuses = STATUS_AFTER_PAYMENT.filter((s) => {
    const allStatuses = STATUS_OPTIONS.slice(1);
    return allStatuses.indexOf(s) >= allStatuses.indexOf(order.status) || s === 'cancelled';
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">Update Status</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>

        <div className="mb-4 text-sm text-dark-300 bg-dark-900 border border-white/10 p-3 rounded-lg">
          <p>Order: <span className="text-gold-400 font-mono">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</span></p>
          <p>Current: <span className={getCustomOrderStatusColor(order.status)}>{order.status.replace(/_/g, ' ')}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">New Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input-dark">
              {availableStatuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
            </select>
          </div>

          {['shipped', 'delivered', 'ready_to_ship'].includes(form.status) && (
            <div className="space-y-3">
              <div>
                <label className="label-dark">Courier Partner</label>
                <input value={form.courierPartner} onChange={(e) => setForm({ ...form, courierPartner: e.target.value })} placeholder="e.g. BlueDart, Delhivery" className="input-dark" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-dark">Tracking Number</label>
                  <input value={form.trackingNumber} onChange={(e) => setForm({ ...form, trackingNumber: e.target.value })} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Tracking URL</label>
                  <input value={form.trackingUrl} onChange={(e) => setForm({ ...form, trackingUrl: e.target.value })} placeholder="https://..." className="input-dark" />
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="label-dark">Comment <span className="text-dark-500 font-normal">(optional)</span></label>
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="e.g. Dispatched from workshop" className="input-dark" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5">{saving ? 'Updating…' : 'Save Update'}</button>
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
  const [filter,      setFilter]      = useState('');
  const [page,        setPage]        = useState(1);
  const [total,       setTotal]       = useState(0);
  const [pages,       setPages]       = useState(1);
  const [quoteModal,  setQuoteModal]  = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [imgModal,    setImgModal]    = useState(null);

  useEffect(() => { document.title = 'Custom Orders — Admin'; }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await customOrderService.getAllOrders({ status: filter, page, limit: 15 });
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load custom orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

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
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs transition-all border capitalize ${
                filter === s
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {s.replace(/_/g, ' ') || 'All'}
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
                <th className="text-left py-2 pr-4">Status</th>
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
                    <span className={getCustomOrderStatusColor(order.status)}>{order.status.replace(/_/g, ' ')}</span>
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
                      {['pending', 'quoted'].includes(order.status) && (
                        <button onClick={() => setQuoteModal(order)} className="btn-outline-gold px-3 py-1.5 text-xs">
                          {order.quoteAmount ? 'Edit Quote' : 'Set Quote'}
                        </button>
                      )}
                      {['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped'].includes(order.status) && (
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
