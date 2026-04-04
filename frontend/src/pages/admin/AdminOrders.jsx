import { useEffect, useState } from 'react';
import { FiSearch, FiChevronDown, FiX, FiCheckCircle } from 'react-icons/fi';
import { orderService } from '../../services/services';
import { formatPrice, formatDate, getOrderStatusColor, getPaymentStatusColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_OPTIONS = ['', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned'];

function TrackingModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    status: order.orderStatus,
    trackingNumber: order.trackingNumber || '',
    trackingUrl: order.trackingUrl || '',
    courierPartner: order.courierPartner || '',
    comment: ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await orderService.updateOrderStatus(order._id, form);
      toast.success('Order tracking updated');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update order');
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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-xl text-white">Update Tracking</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>
        
        <div className="mb-4 text-sm text-dark-300 bg-dark-900 border border-white/10 p-3 rounded-lg">
          <p>Order ID: <span className="text-gold-400 font-mono">#{order._id.slice(-8).toUpperCase()}</span></p>
          <p>Current Status: <span className={getOrderStatusColor(order.orderStatus)}>{order.orderStatus}</span></p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">New Status</label>
            <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="input-dark">
              {STATUS_OPTIONS.slice(1).map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          
          {(form.status === 'shipped' || form.status === 'delivered') && (
            <div className="space-y-4">
              <div>
                <label className="label-dark">Courier Partner</label>
                <input value={form.courierPartner} onChange={e => setForm({...form, courierPartner: e.target.value})} placeholder="e.g. BlueDart, Delhivery" className="input-dark" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-dark">Tracking Number</label>
                  <input value={form.trackingNumber} onChange={e => setForm({...form, trackingNumber: e.target.value})} className="input-dark" />
                </div>
                <div>
                  <label className="label-dark">Tracking URL</label>
                  <input value={form.trackingUrl} onChange={e => setForm({...form, trackingUrl: e.target.value})} placeholder="https://..." className="input-dark" />
                </div>
              </div>
            </div>
          )}

          {(form.status === 'cancelled' || form.status === 'return_requested' || form.status === 'returned') && (
            <div>
              <label className="label-dark">Reason / Notes</label>
              <textarea value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} placeholder="Reason for cancellation/return" className="input-dark resize-none" rows={2} required />
            </div>
          )}
          
          {!(form.status === 'cancelled' || form.status === 'return_requested' || form.status === 'returned') && (
            <div>
              <label className="label-dark">Log Comment (optional)</label>
              <input value={form.comment} onChange={e => setForm({...form, comment: e.target.value})} placeholder="e.g. Dispatched from warehouse" className="input-dark" />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-gold flex-1 py-2.5">
              {saving ? 'Updating...' : 'Save Update'}
            </button>
            <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">Cancel</button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [activeModal, setActiveModal] = useState(null);

  useEffect(() => { document.title = 'Orders — Admin'; }, []);

  const loadOrders = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await orderService.getAllOrders({ status: filter, page, limit: 15 });
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setPages(res.data.pages);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [filter, page]);


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-white">Orders</h1>
          <p className="text-dark-400 text-sm">{total} orders total</p>
        </div>
      </div>

      <div className="card p-4">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-3 mb-5">
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
              {s || 'All'}
            </button>
          ))}
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">Order ID</th>
                <th className="text-left py-2 pr-4">Customer</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-left py-2 pr-4">Amount</th>
                <th className="text-left py-2 pr-4">Payment</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}><td colSpan={7} className="py-3"><div className="skeleton h-8 rounded-lg" /></td></tr>
                ))
              ) : orders.map((order) => (
                <tr key={order._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <Link to={`/orders/${order._id}`} className="text-gold-400 hover:text-gold-300 font-mono text-xs" target="_blank">
                      #{order._id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="py-3 pr-4">
                    <p className="text-dark-300 text-xs">{order.user?.name || 'N/A'}</p>
                    <a href={`mailto:${order.user?.email}`} className="text-dark-500 hover:text-gold-400 transition-colors text-xs inline-flex items-center gap-1" title="Contact Customer">
                      {order.user?.email}
                    </a>
                  </td>
                  <td className="py-3 pr-4 text-dark-500 text-xs">{formatDate(order.createdAt)}</td>
                  <td className="py-3 pr-4 text-gold-500 font-medium">{formatPrice(order.totalAmount)}</td>
                  <td className="py-3 pr-4"><span className={getPaymentStatusColor(order.payment?.status)}>{order.payment?.status}</span></td>
                  <td className="py-3 pr-4">
                    <span className={getOrderStatusColor(order.orderStatus)}>{order.orderStatus}</span>
                  </td>
                  <td className="py-3 text-right">
                    <button onClick={() => setActiveModal(order)} className="btn-gold px-3 py-1.5 text-xs inline-flex items-center gap-1">
                      Update <FiChevronDown size={12}/>
                    </button>
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
        {activeModal && (
          <TrackingModal 
            order={activeModal} 
            onClose={() => setActiveModal(null)} 
            onSaved={loadOrders} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
