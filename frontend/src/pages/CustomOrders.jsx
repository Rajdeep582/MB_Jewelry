import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import {
  FiChevronRight, FiTruck, FiCheck, FiAlertCircle, FiCreditCard, FiMessageSquare,
  FiCalendar, FiFilter, FiPenTool, FiClock, FiPlus, FiImage, FiDownload,
} from 'react-icons/fi';
import { useSelector } from 'react-redux';
import { customOrderService } from '../services/services';
import api from '../services/api';
import { formatPrice, formatDate, formatDateTime, formatCalendarDate, formatTrackingNumber, getCustomOrderStatusColor, resolveImageUrl } from '../utils/helpers';
import { downloadCustomOrderInvoice } from '../utils/invoice';
import { selectUser } from '../store/authSlice';
import { OrderCardSkeleton } from '../components/common/Skeletons';
import toast from 'react-hot-toast';

/**
 * quoteTotals — GST + grand total for a quoted custom order. The amounts the customer is
 * CHARGED are stored on the order (taxAmount / totalAmount / advance / final), so those are
 * always shown when present; the rate lookup is only a fallback for legacy orders.
 */
function quoteTotals(order, gstRates) {
  const quoteAmt = order.quoteAmount || 0;
  const shipAmt  = order.shippingAmount || 0; // PIN-code shipping, set with the quote
  if (order.totalAmount > 0) {
    return { taxAmt: order.taxAmount ?? Math.max(0, order.totalAmount - quoteAmt - shipAmt), shipAmt, totalAmt: order.totalAmount };
  }
  const purity = order.purity === 'Hallmark' ? 'Hallmarked' : order.purity;
  const entry = gstRates.find(r => r.material === order.material && r.purity === purity)
    || gstRates.find(r => r.material === order.material);
  const rate = entry ? entry.gst / 100 : 0.18;
  const taxAmt = Math.round(quoteAmt * rate);
  return { taxAmt, shipAmt, totalAmt: quoteAmt + taxAmt + shipAmt };
}

// ─── Razorpay loader ──────────────────────────────────────────────────────────
let razorpayScriptPromise = null;
function loadRazorpaySdk() {
  if (globalThis.Razorpay) return Promise.resolve(true);
  if (razorpayScriptPromise) return razorpayScriptPromise;
  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => { razorpayScriptPromise = null; resolve(false); };
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

// ─── Decorative ornament (gold hairline · diamond · hairline) ──────────────────
function GoldOrnament({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`} aria-hidden="true">
      <span className="h-px w-12 bg-gradient-to-r from-transparent to-gold-500/70" />
      <span className="w-1.5 h-1.5 rotate-45 bg-gold-400 shadow-[0_0_10px_rgba(212,175,55,0.7)]" />
      <span className="h-px w-12 bg-gradient-to-l from-transparent to-gold-500/70" />
    </div>
  );
}

GoldOrnament.propTypes = {
  className: PropTypes.string,
};

// ─── Status Steps ─────────────────────────────────────────────────────────────
const STATUS_STEPS = ['advance_paid', 'shipped', 'delivered'];
const STATUS_LABELS = {
  advance_paid:             'In Production',
  in_production:            'In Production',
  final_payment_pending:    'Review Pending',
  final_payment_paid:       'Balance Paid',
  ready_to_ship:            'Ready to Ship',
  shipped:                  'Shipped',
  delivered:                'Delivered',
};

const HISTORY_LABELS = {
  pending: 'Request received', quoted: 'Quote ready', advance_paid: 'Advance paid — in production',
  in_production: 'In production', confirmed: 'Confirmed', ready_to_ship: 'Ready to ship',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
/** historyLabel — a balance payment is logged while the order is still "shipped"; name it for what it is. */
function historyLabel(entry) {
  if (/^Final balance/i.test(entry.comment || '')) return 'Balance paid';
  return HISTORY_LABELS[entry.status] || (entry.status || '').replaceAll('_', ' ');
}

function getTimelineStepClass(i, idx) {
  if (i < idx) return 'bg-gold-500 border-gold-500';
  if (i === idx) return 'border-gold-500 bg-gold-500/10';
  return 'border-dark-600';
}

function getTimelineStepIcon(i, idx) {
  if (i < idx) return <FiCheck size={14} className="text-dark-900" />;
  if (i === 0) return <FiCreditCard size={12} />;
  if (i === 1) return <FiTruck size={12} />;
  return <FiCheck size={12} />;
}

function OrderTimeline({ status }) {
  const idx = STATUS_STEPS.indexOf(status);
  if (idx === -1) return null;
  return (
    <div className="flex items-center gap-1 sm:gap-2 my-6 overflow-x-auto scrollbar-hide">
      {STATUS_STEPS.map((step, i) => (
        <div key={step} className="flex items-center">
          <div className={`flex flex-col items-center ${i <= idx ? 'text-gold-500' : 'text-dark-600'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${getTimelineStepClass(i, idx)}`}>
              {getTimelineStepIcon(i, idx)}
            </div>
            <p className="font-jakarta text-[10px] mt-1.5 capitalize hidden sm:block whitespace-nowrap font-medium">
              {STATUS_LABELS[step]}
            </p>
          </div>
          {i < STATUS_STEPS.length - 1 && (
            <div className={`w-8 sm:w-14 h-px mx-1 ${i < idx ? 'bg-gold-500' : 'bg-dark-700'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

OrderTimeline.propTypes = {
  status: PropTypes.string.isRequired,
};

// ─── List: status presentation (mirrors the My Orders cards) ──────────────────
const TONES = {
  amber:   { bg: 'bg-amber-500/12',   text: 'text-amber-400',   border: 'border-amber-500/30',   dot: 'bg-amber-400' },
  gold:    { bg: 'bg-gold-500/12',    text: 'text-gold-300',    border: 'border-gold-500/40',    dot: 'bg-gold-400' },
  purple:  { bg: 'bg-purple-500/12',  text: 'text-purple-400',  border: 'border-purple-500/30',  dot: 'bg-purple-400' },
  sky:     { bg: 'bg-sky-500/12',     text: 'text-sky-400',     border: 'border-sky-500/30',     dot: 'bg-sky-400' },
  emerald: { bg: 'bg-emerald-500/12', text: 'text-emerald-400', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
  red:     { bg: 'bg-red-500/12',     text: 'text-red-400',     border: 'border-red-500/30',     dot: 'bg-red-400' },
};

const CARD_STATUS = {
  pending:       { label: 'Awaiting Quote', tone: 'amber' },
  quoted:        { label: 'Quote Ready',    tone: 'gold' },
  advance_paid:  { label: 'In Production',  tone: 'purple' },
  confirmed:     { label: 'In Production',  tone: 'purple' },
  ready_to_ship: { label: 'Ready to Ship',  tone: 'purple' },
  shipped:       { label: 'Shipped',        tone: 'sky' },
  delivered:     { label: 'Delivered',      tone: 'emerald' },
  cancelled:     { label: 'Cancelled',      tone: 'red' },
};

const IN_PRODUCTION = new Set(['advance_paid', 'confirmed', 'ready_to_ship']);

const LIST_FILTERS = [
  { value: 'all',       label: 'Any Status',     match: () => true },
  { value: 'pending',   label: 'Awaiting Quote', match: (s) => s === 'pending' },
  { value: 'quoted',    label: 'Quote Ready',    match: (s) => s === 'quoted' },
  { value: 'crafting',  label: 'In Production',  match: (s) => IN_PRODUCTION.has(s) },
  { value: 'shipped',   label: 'Shipped',        match: (s) => s === 'shipped' },
  { value: 'delivered', label: 'Delivered',      match: (s) => s === 'delivered' },
  { value: 'cancelled', label: 'Cancelled',      match: (s) => s === 'cancelled' },
];

// The bespoke journey — unique to custom orders
const JOURNEY = ['Requested', 'Quoted', 'Crafting', 'Shipped', 'Delivered'];
const JOURNEY_INDEX = {
  pending: 0, quoted: 1, advance_paid: 2, confirmed: 2, ready_to_ship: 2, shipped: 3, delivered: 4,
};

function Tag({ label, tone }) {
  const c = TONES[tone] || TONES.gold;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold tracking-wide ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  );
}

Tag.propTypes = { label: PropTypes.string.isRequired, tone: PropTypes.string.isRequired };

/** Diamond-marker progress track: Requested → Quoted → Crafting → Shipped → Delivered */
function BespokeJourney({ status }) {
  const idx = JOURNEY_INDEX[status];
  if (idx === undefined) return null;
  const markerClass = (i) => {
    if (i < idx) return 'bg-gold-500';
    if (i === idx) return 'bg-gold-300 shadow-[0_0_10px_rgba(242,201,76,0.85)] ring-2 ring-gold-400/25';
    return 'bg-dark-600';
  };
  const labelClass = (i) => {
    if (i === idx) return 'text-gold-300 font-semibold';
    if (i < idx) return 'text-dark-300';
    return 'text-dark-600';
  };
  return (
    <div>
      <p className="sm:hidden font-jakarta text-[10px] uppercase tracking-[0.18em] text-dark-500 mb-1.5">
        Step {idx + 1} of {JOURNEY.length} · <span className="text-gold-300 font-semibold">{JOURNEY[idx]}</span>
      </p>
      <ol className="grid grid-cols-5" aria-label={`Progress: ${JOURNEY[idx]}`}>
        {JOURNEY.map((label, i) => (
          <li key={label} className="relative flex flex-col items-center">
            {i > 0 && (
              <span className={`absolute top-[3px] right-1/2 w-full h-px ${i <= idx ? 'bg-gold-500/70' : 'bg-white/10'}`} aria-hidden="true" />
            )}
            <span className={`relative z-10 w-[7px] h-[7px] rotate-45 transition-colors ${markerClass(i)}`} aria-hidden="true" />
            <span className={`hidden sm:block mt-1.5 font-jakarta text-[10px] tracking-wide ${labelClass(i)}`}>{label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

BespokeJourney.propTypes = { status: PropTypes.string.isRequired };

/** Line-art "design sketch" shown when the customer did not upload a reference photo */
function JewelSketch({ type }) {
  const t = String(type || '').toLowerCase();
  let art;
  if (t === 'necklace') {
    art = (
      <>
        <path d="M18 22 Q50 78 82 22" />
        <path d="M26 24 Q50 66 74 24" strokeOpacity="0.45" />
        <path d="M50 64 L44 72 L50 84 L56 72 Z" />
      </>
    );
  } else if (t === 'pendant') {
    art = (
      <>
        <path d="M30 14 L50 40 L70 14" strokeOpacity="0.55" />
        <circle cx="50" cy="44" r="3" />
        <path d="M50 48 C38 58 38 74 50 84 C62 74 62 58 50 48 Z" />
        <path d="M50 48 L50 84" strokeOpacity="0.45" />
      </>
    );
  } else if (t === 'earrings') {
    art = (
      <>
        <path d="M33 20 a5 5 0 1 1 0 8 L33 40" />
        <path d="M33 40 L26 52 L33 66 L40 52 Z" />
        <path d="M67 20 a5 5 0 1 1 0 8 L67 40" />
        <path d="M67 40 L60 52 L67 66 L74 52 Z" />
      </>
    );
  } else if (t === 'ring') {
    art = (
      <>
        <circle cx="50" cy="60" r="22" />
        <circle cx="50" cy="60" r="17" strokeOpacity="0.45" />
        <path d="M40 30 L60 30 L66 37 L50 50 L34 37 Z" />
        <path d="M34 37 L66 37 M44 30 L50 50 L56 30" strokeOpacity="0.45" />
      </>
    );
  } else {
    // Bangle / Bala / Bracelet / Anklet
    art = (
      <>
        <ellipse cx="50" cy="52" rx="32" ry="24" />
        <ellipse cx="50" cy="52" rx="25" ry="18" strokeOpacity="0.45" />
        <path d="M50 26 L54 30 L50 34 L46 30 Z" />
      </>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(rgba(212,175,55,0.13)_1px,transparent_1px)] [background-size:12px_12px]">
      <svg viewBox="0 0 100 100" className="w-16 h-16 sm:w-20 sm:h-20 text-gold-400/80" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
        {art}
      </svg>
    </div>
  );
}

JewelSketch.propTypes = { type: PropTypes.string };

// ─── List Card ────────────────────────────────────────────────────────────────
function CustomOrderCard({ order }) {
  const orderRef   = order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`;
  const photos     = order.referenceImages || [];
  const refImg     = photos[0]?.url;
  const status     = CARD_STATUS[order.status] || { label: order.status.replaceAll('_', ' '), tone: 'gold' };
  const price      = order.totalAmount > 0 ? order.totalAmount : order.quoteAmount;
  const spec       = [order.material, order.purity && order.purity !== 'None' ? order.purity : null, order.weight || null]
    .filter(Boolean).join(' · ');
  let paidLabel = null;
  if (order.finalPayment?.status === 'paid') paidLabel = 'Paid in full';
  else if (order.advancePayment?.status === 'paid') paidLabel = 'Advance paid';

  return (
    <Link
      to={`/custom-orders/${order._id}`}
      className="group relative block overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 via-dark-800 to-dark-900 shadow-card transition-all duration-500 hover:-translate-y-0.5 hover:border-gold-500/30 hover:shadow-card-hover"
    >
      {/* top gold sheen on hover */}
      <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      {/* soft corner glow */}
      <span className="pointer-events-none absolute -right-24 -top-24 w-56 h-56 rounded-full bg-gold-500/[0.06] blur-3xl opacity-60 group-hover:opacity-100 transition-opacity duration-500" />

      <div className="relative flex items-stretch">
        {/* Left: reference photo, or a design sketch of the piece */}
        <div className="relative w-24 sm:w-36 flex-shrink-0 overflow-hidden bg-dark-900 min-h-[150px] sm:min-h-[164px]">
          {refImg ? (
            <img
              src={resolveImageUrl(refImg)}
              alt={`${order.type} reference`}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          ) : (
            <JewelSketch type={order.type} />
          )}
          {/* fade into card */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-dark-800/90" />
          <div className="absolute inset-0 ring-1 ring-inset ring-white/5" />
          {/* bespoke seal */}
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-dark-950/80 backdrop-blur-md border border-gold-500/40 px-2 py-0.5 font-jakarta text-[9px] font-semibold uppercase tracking-[0.18em] text-gold-300">
            <span aria-hidden="true">✦</span> Bespoke
          </span>
          {photos.length > 1 && (
            <span className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 bg-dark-950/80 backdrop-blur-md text-[11px] text-gold-300 font-semibold px-2 py-0.5 rounded-full border border-gold-500/30">
              <FiImage size={10} /> {photos.length}
            </span>
          )}
        </div>

        {/* Right: content */}
        <div className="flex-1 min-w-0 px-4 sm:px-6 py-4 flex flex-col justify-between gap-2.5">
          {/* Ref + title + chevron */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-jakarta text-[10px] sm:text-[11px] font-semibold tracking-[0.2em] text-gold-500/90 uppercase mb-1">
                {orderRef}
              </p>
              <h3 className="font-serif text-white text-base sm:text-xl font-semibold leading-snug truncate">
                Custom {order.type}
              </h3>
            </div>
            <span className="flex-shrink-0 w-8 h-8 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-dark-400 transition-all duration-300 group-hover:border-gold-500/50 group-hover:bg-gold-500/10 group-hover:text-gold-400">
              <FiChevronRight size={16} className="transition-transform duration-300 group-hover:translate-x-0.5" />
            </span>
          </div>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-jakarta text-dark-400 text-xs">
            <span className="flex items-center gap-1.5">
              <FiCalendar size={12} className="text-gold-600" />
              {formatDate(order.createdAt)}
            </span>
            {spec && (
              <>
                <span className="hidden sm:inline-block w-1 h-1 rounded-full bg-dark-600" />
                <span className="flex items-center gap-1.5">
                  <FiPenTool size={12} className="text-gold-600" />
                  {spec}
                </span>
              </>
            )}
          </div>

          {/* Bespoke journey */}
          {order.status === 'cancelled' ? (
            <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
          ) : (
            <BespokeJourney status={order.status} />
          )}

          {/* Bottom: tags + price */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Tag label={status.label} tone={status.tone} />
              {paidLabel && <Tag label={paidLabel} tone="emerald" />}
            </div>
            <div className="ml-auto text-right flex-shrink-0">
              <p className="font-jakarta text-dark-500 text-[10px] uppercase tracking-[0.18em]">Quote</p>
              {price ? (
                <p className="font-jakarta text-base font-bold text-gold-400">{formatPrice(price)}</p>
              ) : (
                <p className="font-jakarta text-sm italic text-dark-400">{order.status === 'cancelled' ? '—' : 'Awaiting quote'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action required */}
      {order.status === 'quoted' && (
        <div className="relative flex items-center justify-between gap-3 border-t border-gold-500/15 bg-gold-500/[0.05] px-4 sm:px-6 py-2.5">
          <p className="font-jakarta text-gold-300 text-xs font-medium flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-gold-400 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-gold-400" />
            </span>
            Your quote is ready — pay the advance to start crafting
          </p>
          <span className="flex-shrink-0 font-jakarta text-[11px] font-semibold text-gold-400 group-hover:text-gold-300">Review →</span>
        </div>
      )}
    </Link>
  );
}

CustomOrderCard.propTypes = {
  order: PropTypes.shape({
    _id:            PropTypes.string.isRequired,
    customOrderId:  PropTypes.string,
    createdAt:      PropTypes.string.isRequired,
    status:         PropTypes.string.isRequired,
    type:           PropTypes.string.isRequired,
    material:       PropTypes.string.isRequired,
    purity:         PropTypes.string,
    weight:         PropTypes.string,
    quoteAmount:    PropTypes.number,
    totalAmount:    PropTypes.number,
    referenceImages: PropTypes.arrayOf(PropTypes.shape({ url: PropTypes.string })),
    advancePayment: PropTypes.shape({ status: PropTypes.string }),
    finalPayment:   PropTypes.shape({ status: PropTypes.string }),
  }).isRequired,
};

// ─── List View (same layout as My Orders) ─────────────────────────────────────
function CustomOrdersListView({ orders, loading }) {
  const [filter, setFilter] = useState('all');

  const counts = useMemo(() => {
    const c = {};
    LIST_FILTERS.forEach(({ value, match }) => { c[value] = orders.filter((o) => match(o.status)).length; });
    return c;
  }, [orders]);

  const filtered = useMemo(() => {
    const f = LIST_FILTERS.find((x) => x.value === filter) || LIST_FILTERS[0];
    return orders.filter((o) => f.match(o.status));
  }, [orders, filter]);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, n) => n).map((n) => <OrderCardSkeleton key={n} />)}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-b from-dark-800 to-dark-900 text-center px-6 py-20">
        <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 w-72 h-72 rounded-full bg-gold-500/[0.07] blur-3xl" />
        <div className="relative mx-auto mb-6 w-20 h-20 rounded-full border border-gold-500/30 bg-gold-500/[0.06] flex items-center justify-center shadow-gold">
          <FiPenTool size={28} className="text-gold-400" />
        </div>
        <h3 className="relative font-serif text-2xl sm:text-3xl font-semibold text-white mb-3">No custom orders yet</h3>
        <GoldOrnament className="relative justify-center mb-4" />
        <p className="relative font-jakarta text-dark-400 mb-8 max-w-sm mx-auto">
          Design something unique — crafted exclusively for you by our master artisans.
        </p>
        <Link to="/custom-order" className="relative btn-gold">Start a Custom Order</Link>
      </div>
    );
  }

  const tiles = [
    { label: 'Requests',    value: orders.length, icon: <FiPenTool size={14} /> },
    { label: 'In Progress', value: orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length, icon: <FiClock size={14} /> },
    { label: 'Delivered',   value: counts.delivered || 0, icon: <FiCheck size={14} /> },
  ];

  return (
    <>
      {/* Summary tiles */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {tiles.map(({ label, value, icon }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-dark-800 to-dark-900 px-3 sm:px-5 py-3.5 sm:py-4">
            <span className="pointer-events-none absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-gold-500/[0.07] blur-2xl" />
            <div className="flex items-center justify-between mb-2">
              <p className="font-jakarta text-dark-400 text-[9px] sm:text-[11px] uppercase tracking-[0.1em] sm:tracking-[0.18em] font-semibold whitespace-nowrap">{label}</p>
              <span className="text-gold-500/80 hidden sm:block">{icon}</span>
            </div>
            <p className="font-jakarta text-white text-2xl sm:text-[1.75rem] font-bold leading-none tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-2.5">
          <FiFilter size={12} className="text-gold-600" />
          <span className="font-jakarta text-dark-400 text-[11px] uppercase tracking-[0.2em] font-semibold">Filter by status</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {LIST_FILTERS.map(({ value, label }) => {
            const count = counts[value] || 0;
            if (value !== 'all' && count === 0) return null;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`font-jakarta px-3.5 py-1.5 rounded-full text-[13px] font-medium border transition-all duration-300 flex items-center gap-2 ${
                  filter === value
                    ? 'bg-gradient-to-r from-gold-500/20 to-gold-600/10 border-gold-500/60 text-gold-300 shadow-[0_0_18px_rgba(212,175,55,0.15)]'
                    : 'bg-white/[0.02] border-white/10 text-dark-300 hover:border-gold-500/30 hover:text-white'
                }`}
              >
                {label}
                <span className={`text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 flex items-center justify-center ${
                  filter === value ? 'bg-gold-500 text-dark-900' : 'bg-white/5 text-dark-400'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <p className="font-jakarta text-dark-400 text-sm">No custom orders with this status.</p>
          <button type="button" onClick={() => setFilter('all')} className="text-gold-400 text-sm mt-2 hover:text-gold-300">
            Clear filter →
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {filtered.map((order) => <CustomOrderCard key={order._id} order={order} />)}
        </div>
      )}
    </>
  );
}

CustomOrdersListView.propTypes = {
  orders: PropTypes.array.isRequired,
  loading: PropTypes.bool.isRequired,
};

// ─── Detail View ──────────────────────────────────────────────────────────────
function CustomOrderDetail({ id }) {
  const [order,      setOrder]      = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [processing, setProcessing] = useState(false);
  const [gstRates,   setGstRates]   = useState([]);
  const user = useSelector(selectUser);

  const pendingPayRef = useRef(null);

  useEffect(() => {
    api.get('/products/public/gst-rates').then(r => setGstRates(r.data.rates || [])).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setFetchError('');
    customOrderService.getOrder(id)
      .then((res) => {
        if (res.data.order) setOrder(res.data.order);
        else setFetchError('Order not found');
      })
      .catch((err) => {
        const msg = err?.response?.data?.message || err?.message || 'Failed to load order';
        setFetchError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const reportFailure = useCallback(async (phase, reason = 'Payment cancelled by user') => {
    const cid = pendingPayRef.current;
    if (!cid) return;
    try { await customOrderService.failPayment({ customOrderId: cid, reason, phase }); }
    catch { /* best effort */ }
    finally { pendingPayRef.current = null; }
  }, []);

  const handlePay = async (phase) => {
    if (!order) return;
    setProcessing(true);
    pendingPayRef.current = null;

    try {
      const loaded = await loadRazorpaySdk();
      if (!loaded) { toast.error('Payment gateway failed to load.', { duration: 5000 }); setProcessing(false); return; }

      const { totalAmt } = quoteTotals(order, gstRates);
      const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.70);
      const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;
      const amtForPhase = phase === 'advance' ? advanceAmt : finalAmt;

      const RAZORPAY_MAX_INR = 5_00_00_000;
      if (amtForPhase > RAZORPAY_MAX_INR) {
        toast.error(
          `This payment (₹${amtForPhase.toLocaleString('en-IN')}) exceeds Razorpay's per-transaction limit of ₹5 crore. Please contact us to arrange an alternate payment method.`,
          { duration: 8000 }
        );
        setProcessing(false);
        return;
      }

      const { data } = await customOrderService.createPayment({ customOrderId: order._id, phase });
      pendingPayRef.current = order._id;

      const options = {
        key:         data.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID,
        amount:      data.amount,
        currency:    data.currency,
        name:        'M.B. JEWELLERS',
        description: `Custom ${order.type} — ${phase === 'advance' ? '70% Advance' : '30% Balance'}`,
        order_id:    data.razorpayOrderId,
        prefill: {
          name:    user?.name  || '',
          email:   user?.email || '',
          contact: order.shippingAddress?.phone || '',
        },
        theme: { color: '#D4AF37' },

        handler: async (response) => {
          try {
            const verifyRes = await customOrderService.verifyPayment({
              razorpayOrderId:   response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              customOrderId:     order._id,
              phase,
            });
            pendingPayRef.current = null;
            if (verifyRes.data?.order) setOrder(verifyRes.data.order);
            setProcessing(false);
            toast.success(
              phase === 'advance'
                ? 'Advance paid! Your order is now in production. 🎉'
                : 'Final payment complete! We will confirm delivery shortly. 🎉',
              { duration: 6000 }
            );
            customOrderService.getOrder(order._id)
              .then((res) => { if (res.data?.order) setOrder(res.data.order); })
              .catch(() => {});
          } catch (err) {
            toast.error(err.response?.data?.message || 'Payment verification failed', { duration: 6000 });
            setProcessing(false);
          }
        },

        modal: {
          ondismiss: async () => {
            toast.error('Payment cancelled');
            await reportFailure(phase, 'Payment cancelled by user');
            setProcessing(false);
          },
          escape: true,
          animation: true,
        },
      };

      const rzp = new globalThis.Razorpay(options);
      rzp.on('payment.failed', async (response) => {
        const reason = response.error?.description || 'Payment failed';
        toast.error(`Payment failed: ${reason}`, { duration: 6000 });
        await reportFailure(phase, reason);
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong. Please try again.', { duration: 5000 });
      setProcessing(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this custom order? This action cannot be undone.')) return;
    setProcessing(true);
    try {
      const res = await customOrderService.cancelOrder(order._id);
      setOrder(res.data.order);
      toast.success('Order cancelled successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel order');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <OrderCardSkeleton />;
  if (fetchError) return (
    <div className="text-center py-12 space-y-3">
      <FiAlertCircle className="mx-auto text-red-400" size={32} />
      <p className="font-jakarta text-red-400 text-sm">{fetchError}</p>
    </div>
  );
  if (!order) return (
    <p className="font-jakarta text-dark-400 text-center py-12">Order not found</p>
  );

  const typeInitial = order.type?.[0]?.toUpperCase() || '✦';

  // Delivery / tracking display values (display only — no business logic)
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let trackingRef = '';
  if (order.deliveryId) trackingRef = formatTrackingNumber(order.deliveryId);
  else if (order.trackingNumber) trackingRef = UUID_RE.test(order.trackingNumber) ? formatTrackingNumber(order.trackingNumber) : order.trackingNumber;
  const deliveryMeta = [
    trackingRef           && { label: 'Tracking Number', value: trackingRef, mono: true },
    order.dispatchedAt    && { label: 'Dispatched On',   value: formatDateTime(order.dispatchedAt) },
    order.courierPartner  && { label: 'Courier',         value: order.courierPartner },
  ].filter(Boolean);
  const showDeliveryCard = order.status !== 'delivered' && (order.estimatedDelivery || deliveryMeta.length > 0);

  return (
    <div className="space-y-4 font-jakarta">

      {/* Header Card */}
      <div className="relative overflow-hidden rounded-2xl border border-white/5 bg-dark-800">
        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-transparent via-gold-500 to-transparent opacity-60" />
        <div className="p-5 pl-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-700/5 border border-gold-500/25 flex items-center justify-center flex-shrink-0 shadow-[inset_0_1px_0_rgba(212,175,55,0.15)]">
                <span className="font-jakarta text-xl font-bold text-gold-400">{typeInitial}</span>
              </div>
              <div>
                <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">
                  Custom Order
                </p>
                <h2 className="font-jakarta text-white font-bold text-xl leading-tight pt-0 tracking-wide">
                  {order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}
                </h2>
                <p className="font-jakarta text-dark-500 text-xs mt-0.5">Placed {formatDateTime(order.createdAt)}</p>
              </div>
            </div>
            <span className={`${getCustomOrderStatusColor(order.status)} font-jakarta mt-1 capitalize`}>
              {order.status.replaceAll('_', ' ')}
            </span>
          </div>

          {['advance_paid', 'in_production', 'final_payment_pending', 'final_payment_paid', 'ready_to_ship', 'shipped', 'delivered'].includes(order.status) && (
            <OrderTimeline status={order.status} />
          )}
        </div>
      </div>

      {/* Quote & Payment */}
      {order.quoteAmount && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gold-500/20 bg-gradient-to-br from-gold-500/[0.08] via-dark-800 to-dark-800 p-5 font-jakarta"
        >
          {(() => {
            const quoteAmt   = order.quoteAmount;
            const { taxAmt, shipAmt, totalAmt } = quoteTotals(order, gstRates);
            const advanceAmt = order.advanceAmount > 0 ? order.advanceAmount : Math.round(totalAmt * 0.70);
            const finalAmt   = order.finalAmount  > 0 ? order.finalAmount  : totalAmt - advanceAmt;

            return (
              <>
                <div className="flex justify-between flex-wrap items-start mb-5">
                  <div>
                    <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">
                      Quote Breakdown
                    </p>
                    <h3 className="font-serif text-white font-semibold text-xl">Your Item Quote</h3>
                    {order.quoteNote && (
                      <p className="font-jakarta text-dark-400 text-sm mt-1">{order.quoteNote}</p>
                    )}
                    {order.expectedDeliveryDate && !order.estimatedDelivery && !['delivered', 'cancelled'].includes(order.status) && (
                      <p className="font-jakarta text-gold-400 text-sm font-medium mt-3 flex items-center gap-1.5">
                        <FiTruck size={14} />
                        Expected Delivery: {formatCalendarDate(order.expectedDeliveryDate)}
                      </p>
                    )}
                  </div>
                  {order.quotedAt && (
                    <p className="font-jakarta text-dark-600 text-[11px] mt-1">
                      Quoted {formatDateTime(order.quotedAt)}
                    </p>
                  )}
                </div>

                {/* Pricing breakdown */}
                <div className="bg-dark-900/60 border border-white/5 rounded-xl p-4 mb-5">
                  <div className="flex justify-between items-center text-sm mb-2.5">
                    <p className="font-jakarta text-dark-400 font-medium">Base Quote</p>
                    <p className="font-jakarta text-white font-medium">{formatPrice(quoteAmt)}</p>
                  </div>
                  <div className={`flex justify-between items-center text-sm ${shipAmt > 0 ? 'mb-2.5' : 'pb-3 mb-3 border-b border-white/5'}`}>
                    <p className="font-jakarta text-dark-500">{Math.round((taxAmt / quoteAmt) * 100)}% GST</p>
                    <p className="font-jakarta text-dark-400">{formatPrice(taxAmt)}</p>
                  </div>
                  {shipAmt > 0 && (
                    <div className="flex justify-between items-center text-sm pb-3 mb-3 border-b border-white/5">
                      <p className="font-jakarta text-dark-500">Shipping{order.shippingAddress?.pincode ? ` (PIN ${order.shippingAddress.pincode})` : ''}</p>
                      <p className="font-jakarta text-dark-400">{formatPrice(shipAmt)}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <p className="font-jakarta text-white font-semibold">Grand Total</p>
                    <p className="font-jakarta text-gold-400 font-bold text-lg">{formatPrice(totalAmt)}</p>
                  </div>
                </div>

                {/* Payment split */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className={`p-4 rounded-xl border ${order.advancePayment?.status === 'paid' ? 'border-green-500/25 bg-green-500/5' : 'border-gold-500/25 bg-gold-500/5'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-jakarta text-dark-400 text-xs font-medium">70% Advance</p>
                      {order.advancePayment?.status === 'paid' && (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                          <FiCheck size={10} className="text-green-400" />
                        </div>
                      )}
                    </div>
                    <p className="font-jakarta text-white font-bold text-lg">{formatPrice(advanceAmt)}</p>
                    {order.advancePayment?.status === 'paid' ? (
                      <p className="font-jakarta text-green-500 text-[10px] font-medium mt-1">Paid{order.advancePayment?.paidAt ? ` · ${formatDateTime(order.advancePayment.paidAt)}` : ''}</p>
                    ) : (
                      <p className="font-jakarta text-dark-500 text-[10px] mt-1">Pay now to start making</p>
                    )}
                  </div>
                  <div className={`p-4 rounded-xl border ${order.finalPayment?.status === 'paid' ? 'border-green-500/25 bg-green-500/5' : 'border-white/5 bg-dark-900/40'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <p className="font-jakarta text-dark-500 text-xs font-medium">30% Balance</p>
                      {order.finalPayment?.status === 'paid' && (
                        <div className="w-4 h-4 rounded-full bg-green-500/20 flex items-center justify-center">
                          <FiCheck size={10} className="text-green-400" />
                        </div>
                      )}
                    </div>
                    <p className={`font-jakarta font-bold text-lg ${order.finalPayment?.status === 'paid' ? 'text-white' : 'text-dark-400'}`}>
                      {formatPrice(finalAmt)}
                    </p>
                    {order.finalPayment?.status === 'paid' ? (
                      <p className="font-jakarta text-green-500 text-[10px] font-medium mt-1">Paid{order.finalPayment?.paidAt ? ` · ${formatDateTime(order.finalPayment.paidAt)}` : ''}</p>
                    ) : (
                      <p className="font-jakarta text-dark-500 text-[10px] mt-1">Due when your order ships</p>
                    )}
                  </div>
                </div>

                {/* Pay buttons */}
                {order.status === 'quoted' && (
                  <button
                    onClick={() => handlePay('advance')}
                    disabled={processing}
                    className="btn-gold w-full py-3.5 font-jakarta font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {processing ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : (
                      <><FiCreditCard size={16} /> Pay 70% Advance — {formatPrice(advanceAmt)}</>
                    )}
                  </button>
                )}

                {['shipped', 'final_payment_pending'].includes(order.status) && order.finalPayment?.status !== 'paid' && (
                  <>
                    <div className="mb-3 text-center">
                      <p className="font-jakarta text-dark-500 text-xs">
                        Your order has shipped — complete the balance payment to confirm delivery.
                      </p>
                    </div>
                    <button
                      onClick={() => handlePay('final')}
                      disabled={processing}
                      className="btn-gold w-full py-3.5 font-jakarta font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {processing ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="w-4 h-4 border-2 border-dark-900/30 border-t-dark-900 rounded-full animate-spin" />
                          Processing…
                        </span>
                      ) : (
                        <><FiCreditCard size={16} /> Pay 30% Balance — {formatPrice(finalAmt)}</>
                      )}
                    </button>
                  </>
                )}

                {order.finalPayment?.status === 'paid' && (
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/5">
                    <p className="font-jakarta text-dark-500 text-xs">
                      Fully paid · Tax invoice{order.invoiceNumber ? <> <span className="font-mono text-dark-300">{order.invoiceNumber}</span></> : ''}
                    </p>
                    <button
                      onClick={() => downloadCustomOrderInvoice(order)}
                      className="flex items-center gap-2 text-sm text-gold-500 hover:text-gold-400 bg-gold-500/10 hover:bg-gold-500/15 border border-gold-500/20 px-4 py-2 rounded-xl transition-all"
                    >
                      <FiDownload size={14} /> Download Invoice
                    </button>
                  </div>
                )}

                {(order.status === 'quoted' || order.status === 'shipped') && processing && (
                  <p className="font-jakarta text-dark-600 text-xs text-center mt-3 flex items-center justify-center gap-1">
                    <FiAlertCircle size={11} /> Do not close this tab while payment is in progress
                  </p>
                )}
              </>
            );
          })()}
        </motion.div>
      )}

      {/* Design Specs */}
      <div className="rounded-2xl border border-white/[0.06] bg-dark-800 p-5">
        <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Details</p>
        <h3 className="font-serif text-white text-lg sm:text-xl font-semibold mb-4">Design Specifications</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
          {[
            ['Type',     order.type],
            ['Material', order.material],
            ['Purity',   order.purity !== 'None' ? order.purity : '—'],
            order.fingerSize && ['Finger Size', order.fingerSize],
            order.neckSize   && ['Neck Size',   order.neckSize],
            order.wristSize  && ['Wrist Size',  order.wristSize],
            order.weight     && ['Est. Weight', order.weight],
            order.budget     && ['Budget',      order.budget],
          ].filter(Boolean).map(([k, v]) => (
            <div key={k}>
              <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{k}</p>
              <p className="font-jakarta text-white font-semibold text-sm">{v}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-5 border-t border-white/5">
          <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-2">Description</p>
          <p className="font-jakarta text-dark-300 text-sm leading-relaxed">{order.description}</p>
        </div>
      </div>

      {/* Reference Images */}
      {order.referenceImages?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-dark-800 p-5">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Images</p>
          <h3 className="font-serif text-white text-lg sm:text-xl font-semibold mb-4">Reference Images</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {order.referenceImages.map((img) => (
              <div key={img.url} className="aspect-square rounded-xl overflow-hidden bg-dark-700 border border-white/5">
                <img src={img.url} alt="ref" className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Address */}
      {order.shippingAddress && (
        <div className="rounded-2xl border border-white/[0.06] bg-dark-800 p-5">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Shipping</p>
          <h3 className="font-serif text-white text-lg sm:text-xl font-semibold mb-4">Delivery Address</h3>
          <p className="font-jakarta text-dark-300 text-sm font-semibold">{order.shippingAddress.fullName}</p>
          <p className="font-jakarta text-dark-400 text-sm mt-0.5">{order.shippingAddress.addressLine1}</p>
          <p className="font-jakarta text-dark-400 text-sm">
            {order.shippingAddress.city}, {order.shippingAddress.state} — {order.shippingAddress.pincode}
          </p>
          <p className="font-jakarta text-dark-500 text-sm mt-1">{order.shippingAddress.phone}</p>
        </div>
      )}

      {/* Delivery / Tracking — only show when not yet delivered */}
      {showDeliveryCard && (
        <div className="rounded-2xl border border-white/[0.06] bg-dark-800 p-5">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Delivery</p>
          <h3 className="font-serif text-white text-lg sm:text-xl font-semibold mb-4">Shipment Tracking</h3>

          {order.estimatedDelivery && (
            <div className={`flex items-center gap-4 p-4 rounded-xl border border-gold-500/20 bg-gold-500/5 ${deliveryMeta.length > 0 ? 'mb-5' : ''}`}>
              <div className="w-11 h-11 rounded-full bg-gold-500/10 border border-gold-500/25 flex items-center justify-center flex-shrink-0">
                <FiTruck size={18} className="text-gold-400" />
              </div>
              <div>
                <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-0.5">Estimated Delivery</p>
                <p className="font-jakarta text-gold-400 font-bold text-base">{formatCalendarDate(order.estimatedDelivery)}</p>
              </div>
            </div>
          )}

          {deliveryMeta.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5 text-sm">
              {deliveryMeta.map(({ label, value, mono }) => (
                <div key={label}>
                  <p className="font-jakarta text-dark-500 text-[10px] font-semibold uppercase tracking-wider mb-1">{label}</p>
                  <p className={`text-white font-semibold text-sm ${mono ? 'font-mono tracking-wider' : 'font-jakarta'}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-jakarta text-gold-500 hover:text-gold-400 text-sm font-medium mt-5 inline-flex items-center gap-1 transition-colors"
            >
              Track Shipment <FiChevronRight size={13} />
            </a>
          )}
        </div>
      )}

      {/* Delivered */}
      {order.status === 'delivered' && (
        <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center flex-shrink-0">
              <FiCheck size={20} className="text-green-400" />
            </div>
            <div>
              <p className="font-jakarta text-white font-bold">Delivered Successfully</p>
              <p className="font-jakarta text-dark-400 text-xs mt-0.5">
                Delivered on{' '}
                {order.deliveredAt
                  ? new Date(order.deliveredAt).toLocaleString('en-IN', {
                      day: 'numeric', month: 'long', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })
                  : formatDate(order.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order history — every status change with its date & time */}
      {order.trackingHistory?.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-dark-800 p-5">
          <p className="font-jakarta text-[10px] font-semibold tracking-[0.22em] text-gold-600 uppercase mb-1">Updates</p>
          <h3 className="font-serif text-white text-lg sm:text-xl font-semibold mb-4">Order History</h3>
          <ol>
            {[...order.trackingHistory].reverse().map((entry, idx, list) => (
              <li key={`${entry.status}-${entry.timestamp || idx}`} className="flex gap-3">
                <div className="flex flex-col items-center w-3 flex-shrink-0">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1 ${idx === 0 ? 'bg-gold-400 ring-4 ring-gold-500/15' : 'bg-dark-600'}`} />
                  {idx !== list.length - 1 && <span className="flex-1 w-px bg-dark-700 my-1" />}
                </div>
                <div className="pb-4 flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className={`font-jakarta text-sm font-semibold ${idx === 0 ? 'text-white' : 'text-dark-300'}`}>{historyLabel(entry)}</p>
                    {entry.timestamp && <time className="font-jakarta text-dark-500 text-xs tabular-nums">{formatDateTime(entry.timestamp)}</time>}
                  </div>
                  {entry.comment && <p className="font-jakarta text-dark-400 text-xs mt-0.5 leading-relaxed">{entry.comment}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 text-dark-400 text-sm">
          <FiMessageSquare size={15} className="text-gold-500" />
          <span className="font-jakarta text-dark-400 text-sm">
            Need help?{' '}
            <a
              href="mailto:support@mbjewelry.com"
              className="font-jakarta text-white hover:text-gold-400 underline decoration-white/20 underline-offset-4 transition-colors"
            >
              Contact Support
            </a>
          </span>
        </div>
        {['pending', 'quoted'].includes(order.status) && (
          <button
            onClick={handleCancelOrder}
            disabled={processing}
            className="font-jakarta text-red-400 hover:text-red-300 text-sm font-medium transition-colors disabled:opacity-50"
          >
            Cancel Order
          </button>
        )}
      </div>
    </div>
  );
}

CustomOrderDetail.propTypes = {
  id: PropTypes.string.isRequired,
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CustomOrders() {
  const { id }  = useParams();
  const [orders,  setOrders]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Custom Orders — M.B. JEWELLERS';
    if (!id) {
      setLoading(true);
      customOrderService.getMyOrders()
        .then((res) => setOrders(res.data.orders || []))
        .catch(() => toast.error('Failed to load orders'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [id]);

  return (
    <div className="relative min-h-screen pt-24 pb-20 font-jakarta overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,rgba(212,175,55,0.10),transparent_70%)]" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-40 top-64 w-96 h-96 rounded-full bg-gold-500/[0.04] blur-3xl" aria-hidden="true" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6">

        {/* Header */}
        <div className="mb-8">
          {id && (
            <Link
              to="/custom-orders"
              className="font-jakarta text-xs font-medium text-dark-500 hover:text-gold-400 transition-colors inline-flex items-center gap-1.5 mb-4"
            >
              <FiChevronRight size={12} className="rotate-180" />
              Back to Custom Orders
            </Link>
          )}
          <p className="font-jakarta text-[11px] font-semibold tracking-[0.3em] text-gold-500 uppercase mb-2">
            {id ? 'Custom Orders' : 'My Account'}
          </p>
          <div className="flex items-end justify-between gap-4">
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-white leading-tight pt-0">
              {id ? 'Custom Order Details' : 'My Custom Orders'}
            </h1>
            {!id && !loading && orders.length > 0 && (
              <Link
                to="/custom-order"
                className="group flex-shrink-0 mb-1 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/[0.06] px-3.5 py-1.5 font-jakarta text-xs font-semibold text-gold-300 transition-colors hover:bg-gold-500 hover:text-dark-900"
              >
                <FiPlus size={13} className="transition-transform duration-300 group-hover:rotate-90" />
                <span className="hidden sm:inline">Design a new piece</span>
                <span className="sm:hidden">New</span>
              </Link>
            )}
          </div>
          <GoldOrnament className="mt-4" />
          {!id && (
            <p className="font-jakarta text-dark-400 text-sm mt-3 max-w-lg">
              Your bespoke pieces — from quote to craftsmanship to delivery, all in one place.
            </p>
          )}
        </div>

        {/* Content */}
        {id ? <CustomOrderDetail id={id} /> : <CustomOrdersListView orders={orders} loading={loading} />}
      </div>
    </div>
  );
}
