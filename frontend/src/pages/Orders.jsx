import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPackage, FiChevronRight, FiTruck, FiCheck } from 'react-icons/fi';
import { orderService } from '../services/services';
import { formatPrice, formatDate, getOrderStatusColor, getPaymentStatusColor } from '../utils/helpers';
import { OrderCardSkeleton } from '../components/common/Skeletons';

const STATUS_STEPS = ['processing', 'confirmed', 'shipped', 'delivered'];

function OrderStatus({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="flex items-center gap-1 sm:gap-2 my-6 overflow-x-auto scrollbar-hide">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center ${i <= idx ? 'text-gold-500' : 'text-dark-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
              i < idx ? 'bg-gold-500 border-gold-500' : i === idx ? 'border-gold-500 bg-gold-500/10' : 'border-dark-600'
            }`}>
              {i < idx ? <FiCheck size={14} className="text-dark-900" /> : 
               i === 0 ? <FiPackage size={12} /> : i === 2 ? <FiTruck size={12} /> : <FiCheck size={12} />}
            </div>
            <p className="text-xs mt-1 capitalize hidden sm:block">{step}</p>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`w-8 sm:w-16 h-0.5 mx-1 ${i < idx ? 'bg-gold-500' : 'bg-dark-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function OrderCard({ order }) {
  return (
    <Link to={`/orders/${order._id}`} className="block card-hover p-4 group">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-xs text-dark-500 mb-1">Order #{order._id.slice(-8).toUpperCase()}</p>
          <p className="text-dark-400 text-xs">{formatDate(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={getOrderStatusColor(order.orderStatus)}>
            {order.orderStatus}
          </span>
          <FiChevronRight size={14} className="text-dark-500 group-hover:text-gold-400 transition-colors" />
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {order.items.slice(0, 3).map((item, i) => (
          <div key={i} className="w-12 h-12 rounded-lg overflow-hidden bg-dark-700 flex-shrink-0">
            <img src={item.image || ''} alt={item.name} className="w-full h-full object-cover" />
          </div>
        ))}
        {order.items.length > 3 && (
          <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center text-dark-400 text-xs">
            +{order.items.length - 3}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-dark-400 text-sm">{order.items.length} item{order.items.length > 1 ? 's' : ''}</p>
        <p className="text-gold-500 font-semibold">{formatPrice(order.totalAmount)}</p>
      </div>
    </Link>
  );
}

function OrderDetailView({ id }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    orderService.getOrder(id).then((res) => setOrder(res.data.order)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <OrderCardSkeleton />;
  if (!order) return <p className="text-dark-400 text-center py-12">Order not found</p>;

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-white font-medium">Order #{order._id.slice(-8).toUpperCase()}</h2>
            <p className="text-dark-400 text-sm">{formatDate(order.createdAt)}</p>
          </div>
          <div className="flex gap-2">
            <span className={getOrderStatusColor(order.orderStatus)}>{order.orderStatus}</span>
            <span className={getPaymentStatusColor(order.payment.status)}>{order.payment.status}</span>
          </div>
        </div>
        {order.orderStatus !== 'cancelled' && <OrderStatus status={order.orderStatus} />}
      </div>

      {/* Items */}
      <div className="card p-5">
        <h3 className="text-white font-medium mb-4">Order Items</h3>
        <div className="space-y-3">
          {order.items.map((item, i) => (
            <div key={i} className="flex gap-3">
              <div className="w-16 h-16 rounded-xl overflow-hidden bg-dark-700 flex-shrink-0">
                <img src={item.image || ''} alt={item.name} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{item.name}</p>
                <p className="text-dark-500 text-xs">Qty: {item.quantity}</p>
              </div>
              <p className="text-gold-500 text-sm font-semibold">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 mt-4 pt-4 space-y-2 text-sm">
          <div className="flex justify-between text-dark-400"><span>Subtotal</span><span className="text-white">{formatPrice(order.itemsPrice)}</span></div>
          <div className="flex justify-between text-dark-400"><span>Shipping</span><span className="text-white">{formatPrice(order.shippingPrice)}</span></div>
          <div className="flex justify-between text-dark-400"><span>Tax</span><span className="text-white">{formatPrice(order.taxPrice)}</span></div>
          <div className="flex justify-between font-semibold border-t border-white/10 pt-2">
            <span className="text-white">Total</span>
            <span className="text-gold-500 text-base">{formatPrice(order.totalAmount)}</span>
          </div>
        </div>
      </div>

      {/* Shipping */}
      <div className="card p-5">
        <h3 className="text-white font-medium mb-3">Shipping Address</h3>
        <p className="text-dark-400 text-sm">{order.shippingAddress.fullName}</p>
        <p className="text-dark-400 text-sm">{order.shippingAddress.addressLine1}</p>
        <p className="text-dark-400 text-sm">{order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}</p>
        <p className="text-dark-400 text-sm">{order.shippingAddress.phone}</p>
      </div>
    </div>
  );
}

export default function Orders() {
  const { id } = useParams();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'My Orders — M&B Jewelry';
    if (!id) {
      orderService.getMyOrders().then((res) => setOrders(res.data.orders)).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          {id && (
            <Link to="/orders" className="text-sm text-dark-400 hover:text-gold-400 transition-colors flex items-center gap-1 mb-4">
              ← Back to Orders
            </Link>
          )}
          <h1 className="section-title">{id ? 'Order Details' : 'My Orders'}</h1>
          <div className="gold-divider mt-3 mx-0" />
        </div>

        {id ? (
          <OrderDetailView id={id} />
        ) : loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => <OrderCardSkeleton key={i} />)}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="font-display text-2xl text-white mb-3">No orders yet</h3>
            <p className="text-dark-400 mb-6">Shop our luxury collection and your orders will appear here</p>
            <Link to="/shop" className="btn-gold">Start Shopping</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => <OrderCard key={order._id} order={order} />)}
          </div>
        )}
      </div>
    </div>
  );
}
