import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiShoppingBag, FiPackage, FiUsers, FiDollarSign, FiTrendingUp, FiArrowRight } from 'react-icons/fi';
import { orderService, userService, productService } from '../../services/services';
import { formatPrice, formatDate, getOrderStatusColor } from '../../utils/helpers';

function StatCard({ icon: Icon, title, value, subtitle, color = 'gold' }) {
  const colors = {
    gold:  'bg-gold-500/10 text-gold-500 border-gold-500/20',
    blue:  'bg-blue-500/10 text-blue-400 border-blue-500/20',
    green: 'bg-green-500/10 text-green-400 border-green-500/20',
    purple:'bg-purple-500/10 text-purple-400 border-purple-500/20',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className="text-2xl font-display font-medium text-white">{value}</p>
      <p className="text-dark-400 text-sm">{title}</p>
      {subtitle && <p className="text-xs text-dark-500 mt-1">{subtitle}</p>}
    </motion.div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalProducts, setTotalProducts] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Admin Dashboard — M&B Jewelry';
    Promise.all([
      orderService.getStats(),
      orderService.getAllOrders({ page: 1, limit: 5 }),
      userService.getAllUsers({ page: 1, limit: 1 }),
      productService.getProducts({ limit: 1 }),
    ]).then(([statsRes, ordersRes, usersRes, productsRes]) => {
      setStats(statsRes.data.stats);
      setRecentOrders(ordersRes.data.orders);
      setTotalUsers(usersRes.data.total);
      setTotalProducts(productsRes.data.pagination.total);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton w-10 h-10 rounded-xl" />
              <div className="skeleton h-6 rounded w-1/2" />
              <div className="skeleton h-4 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const statusCounts = stats?.statusCounts || {};

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl text-white">Dashboard</h1>
        <p className="text-dark-400 text-sm">Welcome back, Admin 👋</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FiDollarSign} title="Total Revenue" value={formatPrice(stats?.totalRevenue || 0)} color="gold" />
        <StatCard icon={FiPackage} title="Total Orders" value={stats?.totalOrders || 0} color="blue" />
        <StatCard icon={FiUsers} title="Total Users" value={totalUsers} color="green" />
        <StatCard icon={FiShoppingBag} title="Products" value={totalProducts} color="purple" />
      </div>

      {/* Order Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-display text-lg text-white mb-4">Order Status</h2>
          <div className="space-y-3">
            {Object.entries(statusCounts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className={getOrderStatusColor(status)}>{status}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-dark-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gold-500 rounded-full"
                      style={{ width: `${Math.min(100, (count / (stats?.totalOrders || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-white text-sm w-6 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="card p-5">
          <h2 className="font-display text-lg text-white mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'Add New Product', to: '/admin/products', icon: FiShoppingBag },
              { label: 'View All Orders', to: '/admin/orders', icon: FiPackage },
              { label: 'Manage Users', to: '/admin/users', icon: FiUsers },
            ].map(({ label, to, icon: Icon }) => (
              <Link key={to} to={to}
                className="flex items-center gap-3 p-3 rounded-xl bg-dark-800 hover:bg-dark-700 border border-white/5 hover:border-white/10 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg glass-gold flex items-center justify-center">
                  <Icon size={14} className="text-gold-500" />
                </div>
                <span className="text-dark-300 group-hover:text-white text-sm transition-colors">{label}</span>
                <FiArrowRight size={14} className="ml-auto text-dark-600 group-hover:text-gold-400 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Recent Orders</h2>
          <Link to="/admin/orders" className="text-gold-500 hover:text-gold-400 text-sm transition-colors flex items-center gap-1">
            View all <FiArrowRight size={12} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-dark-500 text-xs uppercase tracking-wider border-b border-white/10">
                <th className="text-left py-2 pr-4">Order</th>
                <th className="text-left py-2 pr-4">Customer</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-left py-2 pr-4">Status</th>
                <th className="text-right py-2">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {recentOrders.map((order) => (
                <tr key={order._id} className="hover:bg-white/2 transition-colors">
                  <td className="py-3 pr-4">
                    <Link to={`/admin/orders/${order._id}`} className="text-gold-400 hover:text-gold-300 font-mono text-xs">
                      #{order._id.slice(-8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-dark-300">{order.user?.name || 'N/A'}</td>
                  <td className="py-3 pr-4 text-dark-500">{formatDate(order.createdAt)}</td>
                  <td className="py-3 pr-4"><span className={getOrderStatusColor(order.orderStatus)}>{order.orderStatus}</span></td>
                  <td className="py-3 text-right text-gold-500 font-medium">{formatPrice(order.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
