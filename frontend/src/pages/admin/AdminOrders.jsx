import { useEffect, useState } from 'react';
import { FiSearch, FiChevronDown } from 'react-icons/fi';
import { orderService } from '../../services/services';
import { formatPrice, formatDate, getOrderStatusColor, getPaymentStatusColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const STATUS_OPTIONS = ['', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled'];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);

  useEffect(() => { document.title = 'Orders — Admin'; }, []);

  const loadOrders = async () => {
    setLoading(true);
    const res = await orderService.getAllOrders({ status: filter, page, limit: 15 });
    setOrders(res.data.orders);
    setTotal(res.data.total);
    setPages(res.data.pages);
    setLoading(false);
  };

  useEffect(() => { loadOrders(); }, [filter, page]);

  const handleStatusUpdate = async (id, status) => {
    try {
      await orderService.updateOrderStatus(id, { status });
      toast.success(`Order marked as ${status}`);
      loadOrders();
    } catch {
      toast.error('Failed to update status');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-white">Orders</h1>
          <p className="text-dark-400 text-sm">{total} orders total</p>
        </div>
      </div>

      <div className="card p-4">
        {/* Filter */}
        <div className="flex flex-wrap gap-3 mb-5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s || 'all'}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-xs transition-all border ${
                filter === s
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>

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
                    <p className="text-dark-500 text-xs">{order.user?.email}</p>
                  </td>
                  <td className="py-3 pr-4 text-dark-500 text-xs">{formatDate(order.createdAt)}</td>
                  <td className="py-3 pr-4 text-gold-500 font-medium">{formatPrice(order.totalAmount)}</td>
                  <td className="py-3 pr-4"><span className={getPaymentStatusColor(order.payment?.status)}>{order.payment?.status}</span></td>
                  <td className="py-3 pr-4">
                    <span className={getOrderStatusColor(order.orderStatus)}>{order.orderStatus}</span>
                  </td>
                  <td className="py-3 text-right">
                    <select
                      value={order.orderStatus}
                      onChange={(e) => handleStatusUpdate(order._id, e.target.value)}
                      className="text-xs bg-dark-800 border border-white/10 rounded-lg px-2 py-1 text-dark-300 hover:border-gold-500/30 focus:outline-none focus:border-gold-500"
                    >
                      {STATUS_OPTIONS.slice(1).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
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
    </div>
  );
}
