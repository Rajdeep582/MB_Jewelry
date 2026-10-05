import { useEffect, useState } from 'react';
import { FiX, FiSearch, FiChevronDown, FiRadio, FiDownload, FiLock, FiUser, FiMail, FiPhone, FiMapPin, FiTruck, FiPackage, FiCreditCard, FiCalendar, FiEdit3, FiInbox } from 'react-icons/fi';
import { customOrderService, adminService, orderService } from '../../services/services';
import { downloadCustomOrderInvoice } from '../../utils/invoice';
import { formatPrice, formatDateTime, formatCalendarDate, todayInputValue, getCustomOrderStatusColor } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Chip, KV, SectionTitle, CopyBtn, Timeline } from '../../components/admin/OrderDetailUI';

// Escape customer-supplied text before writing it into a print window (stored-XSS guard)
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Simplified filter tabs for admin
const FILTER_OPTIONS = [
  { value: '',               label: 'All' },
  { value: 'pending',        label: 'Order Placed' },
  { value: 'quoted',         label: 'Quoted' },
  { value: 'confirmed',      label: 'In Production' }, // backend: advance_paid + confirmed
  { value: 'shipped',        label: 'Shipped' },
  { value: 'delivered',      label: 'Delivered' },
  { value: 'cancelled',      label: 'Cancelled' },
];

// Human-readable stage labels
const STAGE_LABELS = {
  pending:                'Order Placed',
  quoted:                 'Quoted',
  advance_paid:           'Confirmed & In Production',
  confirmed:              'Confirmed & In Production',
  in_production:          'Confirmed & In Production',
  final_payment_pending:  'Final Payment Pending',
  final_payment_paid:     'Final Payment Paid',
  ready_to_ship:          'Ready to Ship',
  shipped:                'Shipped',
  delivered:              'Delivered',
  cancelled:              'Cancelled',
};

// ─── Display helpers ──────────────────────────────────────────────────────────
const displayId = (order) => order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`;
const trackingNo = (order) => (order.deliveryId ? `MB-${order.deliveryId.replaceAll('-', '').slice(-8).toUpperCase()}` : '');
const withGrams = (w) => (w && /^\d+(\.\d+)?$/.test(String(w).trim()) ? `${String(w).trim()} g` : w);
const customerName = (order) => order.user?.name || order.shippingAddress?.fullName || 'Deleted account';

// ─── Quote helpers ────────────────────────────────────────────────────────────
// Mirrors setQuote on the server: tax = round(quote × GST), shipping = PIN-code charge,
// total = quote + tax + shipping, advance = round(total × 70%), rest = balance.
const MIN_QUOTE = 10;
const RAZORPAY_MAX_INR = 50000000; // ₹5 crore per instalment
function quoteMath(quote, gstRate, shipping = 0) {
  const q = Number(quote) || 0;
  const tax = Math.round(q * (gstRate ?? 0));
  const ship = Number(shipping) || 0;
  const total = q + tax + ship;
  const advance = Math.round(total * 0.7);
  return { q, tax, ship, total, advance, balance: total - advance };
}
/** shippingLabel — "Shipping (PIN 700131 · New Barrackpore)" */
const shippingLabel = (zone, pincode) => `Shipping${pincode ? ` (PIN ${pincode}${zone?.area ? ` · ${zone.area}` : ''})` : ''}`;
const toInputDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
const addDaysInput = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return toInputDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))); };
function daysFromToday(input) {
  if (!input) return null;
  const today = new Date(`${todayInputValue()}T00:00:00Z`).getTime();
  return Math.round((new Date(`${input}T00:00:00Z`).getTime() - today) / 864e5);
}

function Field({ step, done, label, hint, children, htmlFor }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="flex items-center justify-between gap-2 mb-1.5">
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-dark-200">
          {step && (
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${done ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300' : 'bg-gold-500/10 border-gold-500/30 text-gold-300'}`}>
              {done ? '✓' : step}
            </span>
          )}
          {label}
        </span>
        {hint && <span className="text-[10px] text-dark-500 normal-case">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Quote Confirm Modal ──────────────────────────────────────────────────────
function QuoteConfirmModal({ order, form, gstRate, zone, onConfirm, onBack, saving }) {
  const m = quoteMath(form.quoteAmount, gstRate, zone?.charge);
  const days = daysFromToday(form.expectedDeliveryDate);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 12 }}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto overscroll-contain rounded-2xl border border-red-500/30 bg-dark-800 shadow-[0_0_60px_rgba(200,30,30,0.18)]" data-lenis-prevent="true"
      >
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
              <FiLock size={17} className="text-red-400" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-lg text-white leading-tight">Lock this quote?</h2>
              <p className="text-red-300/90 text-xs mt-0.5">The price cannot be changed after this. The customer is asked to pay the advance.</p>
            </div>
          </div>

          <div className="rounded-xl bg-dark-900/70 border border-white/[0.08] p-3.5 grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
            <div className="min-w-0"><p className="text-dark-500 text-[10px] uppercase tracking-wider">Order</p><p className="text-gold-400 font-mono font-semibold">{displayId(order)}</p></div>
            <div className="min-w-0"><p className="text-dark-500 text-[10px] uppercase tracking-wider">Customer</p><p className="text-white truncate">{customerName(order)}</p></div>
            <div className="min-w-0"><p className="text-dark-500 text-[10px] uppercase tracking-wider">Item</p><p className="text-white">Custom {order.type} · {order.material}{order.purity && order.purity !== 'None' ? ` ${order.purity}` : ''}</p></div>
            <div className="min-w-0">
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Expected delivery</p>
              <p className={form.expectedDeliveryDate ? 'text-emerald-400' : 'text-dark-500'}>
                {form.expectedDeliveryDate ? `${formatCalendarDate(form.expectedDeliveryDate, 'short')}${days !== null ? ` · ${days}d` : ''}` : 'Not set'}
              </p>
            </div>
            {form.quoteNote && <p className="col-span-2 text-dark-300 italic border-t border-white/[0.06] pt-2">&ldquo;{form.quoteNote}&rdquo;</p>}
          </div>

          <div className="rounded-xl border border-gold-500/25 bg-gradient-to-br from-gold-500/[0.08] to-transparent p-3.5 text-sm tabular-nums space-y-1.5">
            <div className="flex justify-between text-dark-400"><span>Quote (excl. GST)</span><span className="text-white">{formatPrice(m.q)}</span></div>
            <div className="flex justify-between text-dark-400"><span>GST ({Math.round(gstRate * 100)}%)</span><span className="text-dark-200">{formatPrice(m.tax)}</span></div>
            <div className="flex justify-between text-dark-400"><span>{shippingLabel(zone, order.shippingAddress?.pincode)}</span><span className="text-dark-200">{formatPrice(m.ship)}</span></div>
            <div className="flex justify-between items-baseline pt-1.5 border-t border-white/[0.08]"><span className="text-white font-semibold">Customer pays</span><span className="text-gold-400 font-bold text-xl">{formatPrice(m.total)}</span></div>
            <div className="grid grid-cols-2 gap-2 pt-1.5">
              <div className="rounded-lg bg-dark-900/60 border border-white/[0.06] px-2.5 py-2"><p className="text-[10px] uppercase tracking-wider text-dark-500">Advance 70%</p><p className="text-white font-semibold">{formatPrice(m.advance)}</p><p className="text-[10px] text-dark-500">Pays now to start</p></div>
              <div className="rounded-lg bg-dark-900/60 border border-white/[0.06] px-2.5 py-2"><p className="text-[10px] uppercase tracking-wider text-dark-500">Balance 30%</p><p className="text-dark-200 font-semibold">{formatPrice(m.balance)}</p><p className="text-[10px] text-dark-500">Due when shipped</p></div>
            </div>
          </div>

          <div className="flex gap-2.5">
            <button type="button" onClick={onBack} disabled={saving} className="btn-dark flex-1 py-2.5 text-sm disabled:opacity-50">← Edit</button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={saving}
              className="flex-[1.4] py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(200,30,30,0.3)] flex items-center justify-center gap-2"
            >
              {saving
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Locking…</>
                : <><FiLock size={14} /> Confirm &amp; lock quote</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Quote Modal ──────────────────────────────────────────────────────────────
function QuoteModal({ order, onClose, onSaved }) {
  const [form, setForm] = useState({
    quoteAmount: '',
    quoteNote:   order.quoteNote   || '',
    expectedDeliveryDate: toInputDate(order.expectedDeliveryDate),
    adminNotes:  order.adminNotes  || '',
  });
  const [saving,       setSaving]       = useState(false);
  const [gstRate,      setGstRate]      = useState(null); // null until the live rate is known
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showReq,      setShowReq]      = useState(false); // phones: request details collapsed
  // Shipping zone for this order's PIN — same mapping the server uses (undefined = loading, null = not serviceable)
  const [zone,         setZone]         = useState(undefined);
  const [zoneError,    setZoneError]    = useState('');

  useEffect(() => {
    const pin = String(order.shippingAddress?.pincode || '').replaceAll(/\s+/g, '');
    orderService.getShippingZones()
      .then((r) => {
        const zones = r.data.zones || [];
        const z = zones.find((x) => x.pincode === pin);
        setZone(z || null);
        if (!z) setZoneError(`We do not deliver to PIN ${pin || '—'}. Delivery areas: ${zones.map((x) => `${x.area} (${x.pincode})`).join(', ')}.`);
      })
      .catch(() => { setZone(null); setZoneError('Could not load shipping charges. Close and try again.'); });
  }, [order.shippingAddress?.pincode]);

  useEffect(() => {
    adminService.getGlobalPricing()
      .then(res => {
        // Same rate selection as the backend (setQuote): exact purity (Hallmark ≙ Hallmarked) → material → 18%
        const purity = order.purity === 'Hallmark' ? 'Hallmarked' : order.purity;
        const match = (res.data.pricing || []).find(p => p.material === order.material && p.purity === purity)
          || (res.data.pricing || []).find(p => p.material === order.material);
        setGstRate(match ? match.gst / 100 : 0.18);
      })
      .catch(() => setGstRate(0.18));
  }, []);

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return toast.error('Popup blocked. Please allow popups to download PDF.');
    const html = `
      <html>
        <head>
          <title>Order Request - ${esc(order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`)}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; color: #111; padding: 40px; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            h1 { font-size: 24px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .field { margin-bottom: 15px; }
            .label { font-size: 10px; text-transform: uppercase; color: #666; font-weight: bold; letter-spacing: 1px; margin-bottom: 4px; }
            .value { font-size: 14px; font-weight: 500; }
            .full-width { grid-column: span 2; }
            .desc { background: #f9f9f9; padding: 15px; border-radius: 8px; border: 1px solid #eee; font-style: italic; white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>Custom Order Request</h1>
          <div class="grid">
            <div class="field"><div class="label">Order ID</div><div class="value">${esc(order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`)}</div></div>
            <div class="field"><div class="label">Date Created</div><div class="value">${new Date(order.createdAt).toLocaleDateString()}</div></div>
            <div class="field"><div class="label">Customer Name</div><div class="value">${esc(order.user?.name || 'N/A')}</div></div>
            <div class="field"><div class="label">Customer Email</div><div class="value">${esc(order.user?.email || 'N/A')}</div></div>
            <div class="field"><div class="label">Product Type</div><div class="value">${esc(order.type)} — ${esc(order.material)}</div></div>
            <div class="field"><div class="label">Purity</div><div class="value">${esc(order.purity !== 'None' ? order.purity : 'N/A')}</div></div>
            ${order.budget ? `<div class="field"><div class="label">Budget</div><div class="value">${esc(order.budget)}</div></div>` : ''}
            ${order.weight ? `<div class="field"><div class="label">Expected Weight</div><div class="value">${esc(order.weight)}</div></div>` : ''}
            ${order.fingerSize ? `<div class="field"><div class="label">Finger Size</div><div class="value">${esc(order.fingerSize)}</div></div>` : ''}
            ${order.neckSize ? `<div class="field"><div class="label">Neck Size</div><div class="value">${esc(order.neckSize)}</div></div>` : ''}
            ${order.wristSize ? `<div class="field"><div class="label">Wrist Size</div><div class="value">${esc(order.wristSize)}</div></div>` : ''}
            <div class="field full-width"><div class="label">Design Description</div><div class="value desc">${esc(order.description)}</div></div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const m = quoteMath(form.quoteAmount, gstRate, zone?.charge);
  const amountError = !form.quoteAmount ? ''
    : m.q < MIN_QUOTE ? `Minimum quote is ${formatPrice(MIN_QUOTE)}.`
      : m.advance > RAZORPAY_MAX_INR || m.balance > RAZORPAY_MAX_INR ? 'Too large: each instalment must be under ₹5 crore for online payment.'
        : '';
  const canReview = m.q >= MIN_QUOTE && !amountError && gstRate !== null && !!zone;
  const days = daysFromToday(form.expectedDeliveryDate);
  const wantedBy = toInputDate(order.preferredDeliveryDate);
  const sizes = [['Finger', order.fingerSize], ['Neck', order.neckSize], ['Wrist', order.wristSize]].filter(([, v]) => v);
  const addr = order.shippingAddress || {};

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canReview) { toast.error(amountError || 'Please enter a valid quote amount'); return; }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await customOrderService.setQuote(order._id, {
        quoteAmount: m.q,
        quoteNote:   form.quoteNote.trim(),
        expectedDeliveryDate: form.expectedDeliveryDate,
        adminNotes:  form.adminNotes,
      });
      toast.success('Quote locked successfully');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to set quote');
      setShowConfirm(false);
    } finally {
      setSaving(false);
    }
  };

  const dateChips = [
    wantedBy && wantedBy >= todayInputValue() && { label: "Customer's date", value: wantedBy },
    { label: '+7 days', value: addDaysInput(7) },
    { label: '+14 days', value: addDaysInput(14) },
    { label: '+21 days', value: addDaysInput(21) },
  ].filter(Boolean);

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
        <motion.form
          onSubmit={handleSubmit}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-white/10 bg-dark-800 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 border-b border-white/[0.07] bg-gradient-to-r from-gold-500/[0.08] to-transparent">
            <span className="w-9 h-9 rounded-xl bg-gold-500/15 border border-gold-500/25 flex items-center justify-center text-gold-300 shrink-0"><FiCreditCard size={16} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg text-white leading-tight flex items-center gap-2 flex-wrap">
                Set quote <span className="font-mono text-xs text-gold-400">{displayId(order)}</span>
              </h2>
              <p className="text-amber-400/90 text-[11px] flex items-center gap-1 truncate"><FiLock size={10} className="shrink-0" /> Locks once confirmed<span className="hidden sm:inline"> — no edits after</span></p>
            </div>
            <button type="button" onClick={handleDownloadPDF} className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-lg text-xs text-dark-200 border border-white/10 hover:border-gold-500/40 hover:text-gold-300 transition-colors" title="Download request as PDF">
              <FiDownload size={12} /> PDF
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 p-1.5 rounded-lg text-dark-400 hover:text-white hover:bg-white/5"><FiX size={16} /></button>
          </div>

          {/* Body — the only scroll area */}
          <div className="flex-1 overflow-y-auto overscroll-contain" data-lenis-prevent="true">
            <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">

              {/* Request (read-only) */}
              <section className="p-4 sm:p-5 space-y-3 md:border-r border-white/[0.06] bg-dark-900/40">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-300 flex items-center gap-1.5"><FiPackage size={12} className="text-gold-500" /> Customer request</p>
                  <button type="button" onClick={() => setShowReq(v => !v)} aria-expanded={showReq} className="md:hidden inline-flex items-center gap-1 text-[11px] text-gold-400">
                    {showReq ? 'Hide' : 'Details'} <FiChevronDown size={12} className={`transition-transform ${showReq ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 rounded-md border border-gold-500/25 bg-gold-500/10 text-[11px] text-gold-200">Custom {order.type} · {order.material}{order.purity && order.purity !== 'None' ? ` ${order.purity}` : ''}</span>
                  {order.weight && <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-dark-200">{withGrams(order.weight)}</span>}
                  {sizes.map(([k, v]) => <span key={k} className="px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-dark-200">{k} {v}</span>)}
                  {order.budget && <span className="px-2 py-0.5 rounded-md border border-white/10 bg-white/[0.03] text-[11px] text-dark-200">Budget {order.budget}</span>}
                </div>
                <div className={`space-y-3 ${showReq ? '' : 'hidden md:block'}`}>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                  <div><dt className="text-[10px] uppercase tracking-wider text-dark-500">Requested</dt><dd className="text-dark-200">{formatDateTime(order.createdAt)}</dd></div>
                  {order.preferredDeliveryDate && <div><dt className="text-[10px] uppercase tracking-wider text-dark-500">Wanted by</dt><dd className="text-emerald-400">{formatCalendarDate(order.preferredDeliveryDate, 'short')}</dd></div>}
                </dl>

                {order.description && (
                  <div className="rounded-xl bg-dark-800/80 border border-white/[0.06] p-3">
                    <p className={`text-xs text-dark-200 leading-relaxed whitespace-pre-wrap break-words ${showFullDesc ? '' : 'line-clamp-4'}`}>{order.description}</p>
                    {order.description.length > 180 && (
                      <button type="button" onClick={() => setShowFullDesc(v => !v)} className="text-[11px] text-gold-400 hover:text-gold-300 mt-1">{showFullDesc ? 'Show less' : 'Show more'}</button>
                    )}
                  </div>
                )}

                {order.referenceImages?.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {order.referenceImages.map((img, idx) => (
                      <a key={img.url || idx} href={img.url} target="_blank" rel="noopener noreferrer" className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-gold-500/60 transition-colors bg-dark-800" title="Open reference image">
                        <img src={img.url} alt={`Reference ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                )}

                <div className="pt-2.5 border-t border-white/[0.06] text-xs space-y-0.5">
                  <p className="text-white font-medium flex items-center gap-1.5"><FiUser size={11} className="text-dark-500" />{customerName(order)}</p>
                  {(addr.phone || order.user?.email) && <p className="text-dark-400 flex items-center gap-1.5"><FiPhone size={11} className="text-dark-500" />{addr.phone || order.user?.email}</p>}
                  {addr.city && <p className="text-dark-400 flex items-center gap-1.5"><FiMapPin size={11} className="text-dark-500" />{addr.city} · {addr.pincode}</p>}
                </div>
                </div>
              </section>

              {/* Quote form */}
              <section className="p-4 sm:p-5 space-y-3.5">
                <Field step={1} done={canReview} label="Quote amount" hint="excl. GST · min ₹10" htmlFor="quote-amount">
                  <div className={`flex items-center rounded-xl border bg-dark-900 transition-colors focus-within:border-gold-500/60 ${amountError ? 'border-red-500/50' : 'border-white/10'}`}>
                    <span className="pl-3.5 pr-1 text-gold-400 text-lg font-semibold">₹</span>
                    <input
                      id="quote-amount"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      value={form.quoteAmount}
                      onChange={(e) => setForm({ ...form, quoteAmount: e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9) })}
                      placeholder="0"
                      className="w-full bg-transparent py-2.5 pr-3 text-lg font-semibold text-white tabular-nums placeholder-dark-600 outline-none"
                    />
                  </div>
                  {amountError && <p className="text-red-400 text-[11px] mt-1">{amountError}</p>}
                </Field>

                {/* Live breakdown */}
                <div className="rounded-xl border border-gold-500/20 bg-gradient-to-br from-gold-500/[0.07] to-transparent p-3 text-xs tabular-nums space-y-1">
                  <div className="flex justify-between text-dark-400"><span>GST{gstRate !== null ? ` (${Math.round(gstRate * 100)}%)` : ''}</span><span className="text-dark-200">{gstRate === null ? <span className="inline-block w-10 h-3 rounded skeleton" /> : formatPrice(m.tax)}</span></div>
                  <div className="flex justify-between text-dark-400">
                    <span>{shippingLabel(zone, addr.pincode)}</span>
                    <span className={zone === null ? 'text-red-400' : 'text-dark-200'}>{zone === undefined ? <span className="inline-block w-10 h-3 rounded skeleton" /> : zone === null ? 'Not deliverable' : formatPrice(zone.charge)}</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1 border-t border-white/[0.07]"><span className="text-white font-medium">Customer pays</span><span className="text-gold-400 font-bold text-base">{formatPrice(m.total)}</span></div>
                  <div className="flex justify-between text-[11px] text-dark-500 pt-0.5">
                    <span>Advance 70% <span className="text-dark-200">{formatPrice(m.advance)}</span></span>
                    <span>Balance 30% <span className="text-dark-200">{formatPrice(m.balance)}</span> <span className="hidden sm:inline">· when shipped</span></span>
                  </div>
                </div>
                {zoneError && <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-2.5 py-2">{zoneError}</p>}

                <Field step={2} done={!!form.expectedDeliveryDate} label="Expected delivery" hint={days !== null ? (days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`) : 'shown to customer'} htmlFor="quote-eta">
                  <input id="quote-eta" type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} className="input-dark !py-2 text-sm [color-scheme:dark]" min={todayInputValue()} />
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {dateChips.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setForm({ ...form, expectedDeliveryDate: c.value })}
                        className={`px-2 py-0.5 rounded-md border text-[11px] transition-colors ${form.expectedDeliveryDate === c.value ? 'border-gold-500/60 bg-gold-500/15 text-gold-300' : 'border-white/10 text-dark-400 hover:text-white hover:border-white/25'}`}
                      >
                        {c.label}
                      </button>
                    ))}
                    {form.expectedDeliveryDate && (
                      <button type="button" onClick={() => setForm({ ...form, expectedDeliveryDate: '' })} className="px-2 py-0.5 rounded-md text-[11px] text-dark-500 hover:text-white">Clear</button>
                    )}
                  </div>
                </Field>

                <Field step={3} done={!!form.quoteNote.trim()} label="Note to customer" hint={`${form.quoteNote.length}/300 · optional`} htmlFor="quote-note">
                  <textarea id="quote-note" maxLength={300} value={form.quoteNote} onChange={(e) => setForm({ ...form, quoteNote: e.target.value })} className="input-dark !py-2 text-sm resize-none" rows={2} placeholder="e.g. Includes hallmark and making charges" />
                </Field>

                <Field step={4} done={!!form.adminNotes.trim()} label="Internal note" hint="admin only" htmlFor="quote-admin-note">
                  <textarea id="quote-admin-note" value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} className="input-dark !py-2 text-sm resize-none" rows={2} placeholder="For the production team — never shown to the customer" />
                </Field>
              </section>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3 border-t border-white/[0.07] bg-dark-900/60">
            <p className="hidden sm:block flex-1 text-[11px] text-dark-500">Total = quote + GST + shipping for the customer's PIN. Customer sees it with the 70/30 split, your note and the date.</p>
            <button type="button" onClick={onClose} className="btn-dark px-4 py-2 text-sm flex-1 sm:flex-none">Cancel</button>
            <button type="submit" disabled={!canReview} className="btn-gold !px-5 !py-2 !text-sm flex-[1.4] sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed hover:!translate-y-0">
              Review &amp; lock →
            </button>
          </div>
        </motion.form>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <QuoteConfirmModal
            order={order}
            form={form}
            gstRate={gstRate}
            zone={zone}
            saving={saving}
            onConfirm={handleConfirm}
            onBack={() => setShowConfirm(false)}
          />
        )}
      </AnimatePresence>
    </>
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
    status:            order.status,
    comment:           '',
    estimatedDelivery: order.estimatedDelivery
      ? new Date(order.estimatedDelivery).toISOString().split('T')[0]
      : '',
  });
  const [saving, setSaving] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const isDeliverSelected = form.status === 'delivered';
  const confirmValid = !isDeliverSelected || confirmText.trim().toUpperCase() === 'DELIVER';

  const isShippedContext = form.status === 'shipped' || order.status === 'shipped';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.status === 'shipped' && !form.estimatedDelivery) {
      toast.error('Please set an estimated delivery date before marking as shipped.');
      return;
    }
    if (isDeliverSelected && !confirmValid) {
      toast.error('Please type DELIVER to confirm.');
      return;
    }
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
  
  // Payment info
  const advanceStatus = order.advancePayment?.status || 'pending';
  const finalStatus = order.finalPayment?.status || 'pending';

  const availableStages = ADMIN_STAGE_OPTIONS.filter((opt) => {
    // Cannot cancel after advance payment is received
    if (opt.value === 'cancelled') return advanceStatus !== 'paid';
    // Guard: cannot ship unless advance payment is done
    if (opt.value === 'shipped' && advanceStatus !== 'paid') return false;
    // Guard: cannot deliver unless final payment is done AND the delivery partner confirmed (server rule)
    if (opt.value === 'delivered' && (!isFinalPaid || !order.dpConfirmedAt)) return false;
    const optIdx = allStatuses.indexOf(opt.value);
    return optIdx > currentIdx;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md max-h-[90vh] overflow-y-auto overscroll-contain glass rounded-2xl p-6" data-lenis-prevent="true"
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

        {/* Shipped guard warning */}
        {advanceStatus !== 'paid' && order.status !== 'shipped' && order.status !== 'delivered' && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠ Cannot mark as Shipped until the 70% advance payment is received.
          </div>
        )}

        {/* Delivered guard warning */}
        {!isFinalPaid && order.status === 'shipped' && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠ Cannot mark as Delivered until the 30% final payment is received.
          </div>
        )}
        {order.status === 'shipped' && !order.dpConfirmedAt && (
          <div className="mb-4 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            ⚠ Delivered unlocks after the delivery partner confirms the handover in their portal.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-dark">Update Stage</label>
            <select value={form.status} onChange={(e) => { setForm({ ...form, status: e.target.value }); setConfirmText(''); }} className="input-dark">
              <option value={order.status} disabled>{STAGE_LABELS[order.status] || order.status.replace(/_/g, ' ')} (current)</option>
              {availableStages.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          {isShippedContext && (
            <div>
              <label className="label-dark">
                Estimated Delivery Date
                {form.status === 'shipped' && <span className="text-red-400 ml-1">*</span>}
                {order.status === 'shipped' && form.status === order.status && (
                  <span className="text-dark-500 font-normal ml-1">(editable — updates customer view)</span>
                )}
              </label>
              <input
                type="date"
                value={form.estimatedDelivery}
                onChange={(e) => setForm({ ...form, estimatedDelivery: e.target.value })}
                className="input-dark [color-scheme:dark]"
                min={todayInputValue()}
              />
              <p className="text-dark-500 text-xs mt-1">Shown to customer as estimated delivery date (replaces the quoted date on their page)</p>
              {order.expectedDeliveryDate && (
                <p className="text-dark-500 text-xs mt-1 flex flex-wrap items-center gap-1.5">
                  Quoted to customer: <span className="text-emerald-400">{formatCalendarDate(order.expectedDeliveryDate)}</span>
                  {form.estimatedDelivery !== new Date(order.expectedDeliveryDate).toISOString().split('T')[0] && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, estimatedDelivery: new Date(order.expectedDeliveryDate).toISOString().split('T')[0] })}
                      className="text-gold-400 hover:text-gold-300 underline underline-offset-2"
                    >
                      Use quoted date
                    </button>
                  )}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="label-dark">Comment <span className="text-dark-500 font-normal">(optional · shown in the customer's order history)</span></label>
            <input value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} placeholder="e.g. Confirmed by artisan team" className="input-dark" />
          </div>

          {/* Delivered confirmation */}
          {isDeliverSelected && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
              <p className="text-amber-400 text-xs font-medium flex items-center gap-1.5">⚠ This action is final and irreversible</p>
              <p className="text-dark-400 text-xs">Once marked as delivered, this order cannot be edited. Type <span className="text-white font-mono font-bold">DELIVER</span> to confirm.</p>
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELIVER"
                className="input-dark text-sm font-mono tracking-wider"
                autoComplete="off"
                spellCheck="false"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={
                saving ||
                !confirmValid ||
                (form.status === order.status && form.estimatedDelivery === (order.estimatedDelivery ? new Date(order.estimatedDelivery).toISOString().split('T')[0] : ''))
              }
              className="btn-gold flex-1 py-2.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? 'Updating…' : form.status === order.status ? 'Update Date' : 'Update Stage'}
            </button>
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto overscroll-contain glass rounded-2xl p-6" data-lenis-prevent="true">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Reference Images ({images.length})</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <a key={img.url} href={img.url} target="_blank" rel="noopener noreferrer">
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

/** paymentSummary — what was charged, what was received, what is still due (all incl. GST). */
function paymentSummary(order) {
  const quoted = order.quoteAmount > 0;
  const total = order.totalAmount > 0 ? order.totalAmount : (order.quoteAmount || 0);
  const advPaid = order.advancePayment?.status === 'paid';
  const finPaid = order.finalPayment?.status === 'paid';
  const paid = (advPaid ? order.advanceAmount || 0 : 0) + (finPaid ? order.finalAmount || 0 : 0);
  const due = Math.max(0, total - paid);

  let label = 'Awaiting quote';
  let tone = 'text-dark-400 bg-white/[0.03] border-white/10';
  if (order.status === 'cancelled') { label = paid > 0 ? 'Cancelled · paid' : 'Cancelled'; tone = 'text-red-300 bg-red-500/10 border-red-500/20'; }
  else if (finPaid) { label = 'Fully paid'; tone = 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'; }
  else if (advPaid && order.status === 'shipped') { label = 'Balance due'; tone = 'text-amber-300 bg-amber-500/10 border-amber-500/25'; }
  else if (advPaid) { label = 'Advance paid'; tone = 'text-sky-300 bg-sky-500/10 border-sky-500/20'; }
  else if (quoted) { label = 'Awaiting advance'; tone = 'text-amber-300 bg-amber-500/10 border-amber-500/25'; }

  return { quoted, total, paid, due, advPaid, finPaid, label, tone, pct: total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0 };
}

function PaymentLine({ label, amount, payment }) {
  const paid = payment?.status === 'paid';
  const failed = payment?.status === 'failed';
  const refunded = payment?.status === 'refunded';
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="min-w-0">
        <p className="text-xs text-dark-300">{label}</p>
        {paid && payment?.paidAt && <p className="text-[10px] text-dark-500 mt-0.5">Paid {formatDateTime(payment.paidAt)}</p>}
        {paid && payment?.razorpayPaymentId && <p className="text-[10px] text-dark-600 font-mono break-all">{payment.razorpayPaymentId}</p>}
        {failed && payment?.failReason && <p className="text-[10px] text-red-400/80 mt-0.5">{payment.failReason}</p>}
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${paid ? 'text-emerald-400' : 'text-dark-200'}`}>{formatPrice(amount || 0)}</p>
        <p className={`text-[10px] ${paid ? 'text-emerald-400/80' : failed ? 'text-red-400/80' : 'text-dark-500'}`}>
          {paid ? 'Received' : failed ? 'Failed' : refunded ? 'Refunded' : 'Pending'}
        </p>
      </div>
    </div>
  );
}

// ─── Custom Order Details (expanded card) ─────────────────────────────────────
function CustomOrderDetails({ order, onImage }) {
  const pay = paymentSummary(order);
  const addr = order.shippingAddress || {};
  const gstPct = order.quoteAmount > 0 && order.taxAmount > 0 ? Math.round((order.taxAmount / order.quoteAmount) * 100) : null;
  const sizes = [
    order.fingerSize && ['Finger size', order.fingerSize],
    order.neckSize && ['Neck size', order.neckSize],
    order.wristSize && ['Wrist size', order.wristSize],
  ].filter(Boolean);
  const open = !['delivered', 'cancelled'].includes(order.status);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="overflow-hidden"
    >
      <div className="border-t border-white/[0.06] bg-dark-900/50 p-4 grid gap-4 lg:grid-cols-3">

        {/* ── Design request ── */}
        <section className="min-w-0">
          <SectionTitle icon={FiPackage}>Design request</SectionTitle>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            <KV label="Item">{order.type}</KV>
            <KV label="Metal">{order.material}{order.purity && order.purity !== 'None' ? ` · ${order.purity}` : ''}</KV>
            <KV label="Weight">{withGrams(order.weight)}</KV>
            <KV label="Budget">{order.budget}</KV>
            {sizes.map(([l, v]) => <KV key={l} label={l}>{v}</KV>)}
            <KV label="Requested">{formatDateTime(order.createdAt)}</KV>
            <KV label="Wanted by">{order.preferredDeliveryDate ? formatCalendarDate(order.preferredDeliveryDate, 'short') : null}</KV>
          </dl>
          {order.description && (
            <p className="mt-3 rounded-xl bg-dark-800/70 border border-white/5 p-3 text-xs text-dark-200 leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto" data-lenis-prevent="true">
              {order.description}
            </p>
          )}
          {order.referenceImages?.length > 0 && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {order.referenceImages.slice(0, 4).map((img, i) => (
                <button
                  key={img.url || i}
                  type="button"
                  onClick={() => onImage(order.referenceImages)}
                  className="w-14 h-14 rounded-lg overflow-hidden border border-white/10 hover:border-gold-500/50 transition-colors bg-dark-800"
                  title="View reference images"
                >
                  <img src={img.url} alt={`Reference ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
              <span className="text-[11px] text-dark-500">{order.referenceImages.length} reference image{order.referenceImages.length > 1 ? 's' : ''}</span>
            </div>
          )}
        </section>

        {/* ── Quote & payment ── */}
        <section className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-4">
          <SectionTitle icon={FiCreditCard} right={<Chip className={pay.tone}>{pay.label}</Chip>}>Quote &amp; payment</SectionTitle>
          {pay.quoted ? (
            <>
              <div className="space-y-1 text-xs tabular-nums">
                <div className="flex justify-between text-dark-400"><span>Quote (excl. GST)</span><span className="text-dark-200">{formatPrice(order.quoteAmount)}</span></div>
                <div className="flex justify-between text-dark-400"><span>GST{gstPct !== null ? ` (${gstPct}%)` : ''}</span><span className="text-dark-200">{formatPrice(order.taxAmount || 0)}</span></div>
                <div className="flex justify-between text-dark-400"><span>Shipping{addr.pincode ? ` (PIN ${addr.pincode})` : ''}</span><span className="text-dark-200">{order.shippingAmount > 0 ? formatPrice(order.shippingAmount) : 'Not charged'}</span></div>
                <div className="flex justify-between items-baseline pt-1.5 mt-1 border-t border-white/[0.06]">
                  <span className="text-white font-medium">Total</span><span className="text-gold-400 font-bold text-base">{formatPrice(pay.total)}</span>
                </div>
              </div>
              <div className="mt-2.5">
                <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${pay.pct}%` }} />
                </div>
                <div className="flex justify-between text-[10px] text-dark-500 mt-1 tabular-nums">
                  <span>Paid {formatPrice(pay.paid)}</span>
                  <span>{pay.due > 0 ? `Due ${formatPrice(pay.due)}` : 'Nothing due'}</span>
                </div>
              </div>
              <div className="mt-1 divide-y divide-white/[0.05]">
                <PaymentLine label="Advance (70%)" amount={order.advanceAmount} payment={order.advancePayment} />
                <PaymentLine label="Final balance (30%)" amount={order.finalAmount} payment={order.finalPayment} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                <KV label="Quoted on">{order.quotedAt ? formatDateTime(order.quotedAt) : null}</KV>
                <KV label="Quoted delivery">{order.expectedDeliveryDate ? formatCalendarDate(order.expectedDeliveryDate, 'short') : null}</KV>
                <KV label="Invoice no." mono>{order.invoiceNumber || null}</KV>
              </dl>
              {pay.finPaid && (
                <button
                  type="button"
                  onClick={() => downloadCustomOrderInvoice(order)}
                  className="mt-3 w-full py-2 text-xs inline-flex items-center justify-center gap-1.5 text-gold-300 bg-gold-500/10 border border-gold-500/20 hover:bg-gold-500/20 rounded-xl transition-colors"
                >
                  <FiDownload size={12} /> Download tax invoice
                </button>
              )}
              {order.quoteNote && <p className="mt-2 text-[11px] text-dark-400"><span className="text-dark-500">Note to customer:</span> {order.quoteNote}</p>}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 p-4 text-center">
              <p className="text-xs text-dark-400">No quote sent yet</p>
              {open && <p className="text-[11px] text-dark-500 mt-1">Use <span className="text-gold-400">Quote</span> on the card above to price this request.</p>}
            </div>
          )}
          {order.adminNotes && (
            <p className="mt-2.5 rounded-lg bg-gold-500/[0.06] border border-gold-500/15 px-2.5 py-2 text-[11px] text-dark-300">
              <span className="text-gold-400 font-medium">Internal note:</span> {order.adminNotes}
            </p>
          )}
        </section>

        {/* ── Customer, delivery, timeline ── */}
        <section className="min-w-0 lg:border-l lg:border-white/[0.06] lg:pl-4 space-y-4">
          <div>
            <SectionTitle icon={FiUser}>Customer</SectionTitle>
            <div className="text-xs space-y-1">
              <p className="text-white font-medium">{customerName(order)}</p>
              {order.user?.email && (
                <a href={`mailto:${order.user.email}`} className="flex items-center gap-1.5 text-dark-400 hover:text-gold-400 break-all"><FiMail size={11} className="shrink-0" />{order.user.email}</a>
              )}
              {(addr.phone || order.user?.phone) && (
                <a href={`tel:${addr.phone || order.user.phone}`} className="flex items-center gap-1.5 text-dark-400 hover:text-gold-400"><FiPhone size={11} className="shrink-0" />{addr.phone || order.user.phone}</a>
              )}
              {addr.addressLine1 && (
                <p className="flex items-start gap-1.5 text-dark-400 pt-0.5">
                  <FiMapPin size={11} className="shrink-0 mt-0.5" />
                  <span>
                    {addr.fullName && addr.fullName !== customerName(order) && <span className="text-dark-200">{addr.fullName}, </span>}
                    {[addr.addressLine1, addr.addressLine2, addr.city, addr.state].filter(Boolean).join(', ')} — <span className="text-dark-200">{addr.pincode}</span>
                  </span>
                </p>
              )}
            </div>
          </div>

          {(order.deliveryId || order.dispatchedAt || order.dpConfirmedAt || order.deliveredAt) && (
            <div>
              <SectionTitle icon={FiTruck}>Delivery</SectionTitle>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                {order.deliveryId && (
                  <div className="col-span-2 min-w-0">
                    <dt className="text-[10px] uppercase tracking-wider text-dark-500">Tracking no.</dt>
                    <dd className="flex items-center gap-1 text-xs text-white font-mono mt-0.5">{trackingNo(order)}<CopyBtn value={trackingNo(order)} label="Tracking number" /></dd>
                  </div>
                )}
                <KV label="Dispatched">{order.dispatchedAt ? formatDateTime(order.dispatchedAt) : null}</KV>
                <KV label="ETA">{order.estimatedDelivery ? formatCalendarDate(order.estimatedDelivery, 'short') : null}</KV>
                <KV label="Partner confirmed">{order.dpConfirmedAt ? formatDateTime(order.dpConfirmedAt) : null}</KV>
                <KV label="Delivered">{order.deliveredAt ? <span className="text-emerald-400">{formatDateTime(order.deliveredAt)}</span> : null}</KV>
                <KV label="Delivered by">{order.deliveredByPartnerName || null}</KV>
              </dl>
              {order.dpNote && <p className="mt-2 text-[11px] text-dark-400"><span className="text-dark-500">Partner note:</span> &ldquo;{order.dpNote}&rdquo;</p>}
            </div>
          )}

          <Timeline entries={order.trackingHistory} labels={STAGE_LABELS} />
        </section>
      </div>
    </motion.div>
  );
}

// ─── Custom Order Card (list row) ─────────────────────────────────────────────
function CustomOrderCard({ order, expanded, onToggle, onQuote, onStatus, onImage }) {
  const pay = paymentSummary(order);
  const thumb = order.referenceImages?.[0]?.url;
  const awaitingAdmin = order.dpConfirmedAt && order.status === 'shipped';
  return (
    <div className={`rounded-2xl border transition-colors overflow-hidden ${expanded ? 'border-gold-500/30 bg-white/[0.02]' : 'border-white/[0.07] bg-dark-900/40 hover:border-white/15'}`}>
      <div
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); } }}
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-2.5 p-3 sm:p-3.5 cursor-pointer outline-none focus-visible:bg-white/[0.03] lg:gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.1fr)_10.5rem] lg:items-center"
      >
        {/* Item + id + date */}
        <div className="col-span-2 lg:col-span-1 flex items-center gap-3 min-w-0">
          <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-dark-800 border border-white/10 shrink-0 flex items-center justify-center">
            {thumb ? <img src={thumb} alt="" className="w-full h-full object-cover" loading="lazy" /> : <FiPackage size={18} className="text-dark-500" />}
            {order.referenceImages?.length > 1 && (
              <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-black/70 text-[9px] text-dark-200">{order.referenceImages.length}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-gold-400 font-mono text-xs font-semibold">{displayId(order)}</span>
              <span className={`${getCustomOrderStatusColor(order.status === 'confirmed' ? 'in_production' : order.status)} !text-[10px] !px-2 !py-0.5`}>{STAGE_LABELS[order.status] || order.status.replaceAll('_', ' ')}</span>
              {awaitingAdmin && <Chip className="text-amber-300 bg-amber-500/10 border-amber-500/25" title="Delivery partner confirmed — awaiting your confirmation"><span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />DP confirmed</Chip>}
            </div>
            <p className="text-white text-sm font-medium mt-0.5 truncate">
              Custom {order.type} <span className="text-dark-400 font-normal">· {order.material}{order.purity && order.purity !== 'None' ? ` ${order.purity}` : ''}</span>
            </p>
            <p className="text-[11px] text-dark-500 mt-0.5 flex items-center gap-1"><FiCalendar size={10} /> {formatDateTime(order.createdAt)}</p>
          </div>
        </div>

        {/* Customer */}
        <div className="col-span-2 lg:col-span-1 min-w-0 pl-[3.75rem] lg:pl-0">
          <p className="text-dark-200 text-xs font-medium truncate flex items-center gap-1.5"><FiUser size={11} className="text-dark-500 shrink-0" />{customerName(order)}</p>
          {(order.shippingAddress?.phone || order.user?.email) && (
            <p className="text-[11px] text-dark-500 truncate mt-0.5">{order.shippingAddress?.phone || order.user?.email}</p>
          )}
          {order.shippingAddress?.city && (
            <p className="text-[11px] text-dark-500 truncate flex items-center gap-1"><FiMapPin size={10} className="shrink-0" />{order.shippingAddress.city} · {order.shippingAddress.pincode}</p>
          )}
        </div>

        {/* Money */}
        <div className="min-w-0 sm:pl-[3.75rem] lg:pl-0">
          {pay.quoted ? (
            <>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-gold-400 font-semibold text-sm tabular-nums">{formatPrice(pay.total)}</span>
                <Chip className={pay.tone}>{pay.label}</Chip>
              </div>
              <p className="text-[11px] text-dark-500 mt-1 tabular-nums">
                Paid {formatPrice(pay.paid)}{pay.due > 0 && order.status !== 'cancelled' ? ` · Due ${formatPrice(pay.due)}` : ''}
              </p>
            </>
          ) : (
            <Chip className={pay.tone}>{order.status === 'cancelled' ? 'Cancelled' : 'Quote pending'}</Chip>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1.5 self-end lg:self-auto" onClick={(e) => e.stopPropagation()}>
          {!order.quotedAt && !['delivered', 'cancelled'].includes(order.status) && (
            <button type="button" onClick={() => onQuote(order)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-dark-900 bg-gold-500 hover:bg-gold-400 transition-colors">Quote</button>
          )}
          {!['delivered', 'cancelled'].includes(order.status) && (
            <button type="button" onClick={() => onStatus(order)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-dark-200 border border-white/10 hover:border-gold-500/40 hover:text-gold-300 transition-colors" title="Update status">
              <FiEdit3 size={11} /> <span className="hidden min-[380px]:inline">Update</span>
            </button>
          )}
          <button type="button" onClick={onToggle} className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/5 transition-colors" aria-expanded={expanded} aria-label={expanded ? 'Hide details' : 'Show details'}>
            <FiChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180 text-gold-400' : ''}`} />
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded && <CustomOrderDetails order={order} onImage={onImage} />}
      </AnimatePresence>
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
  const [stats,       setStats]       = useState(null);
  const [seenCounts,  setSeenCounts]  = useState({});
  const [quoteModal,  setQuoteModal]  = useState(null);
  const [statusModal, setStatusModal] = useState(null);
  const [imgModal,    setImgModal]    = useState(null);
  const [dpConfirmModal, setDpConfirmModal] = useState(null);
  const [dpInput, setDpInput]   = useState('');
  const [dpBusy,  setDpBusy]    = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [search,      setSearch]      = useState('');
  const [query,       setQuery]       = useState(''); // debounced, sent to the server

  useEffect(() => { document.title = 'Custom Orders — Admin'; }, []);

  // Support lookup across all pages: CUS-… id, tracking MB-…, customer, phone, PIN, item type
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (stats?.statusCounts && filter) {
      setSeenCounts(prev => ({ ...prev, [filter]: stats.statusCounts[filter] }));
    }
  }, [stats, filter]);

  const loadOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const res = await customOrderService.getAllOrders({ status: filter, search: query || undefined, page, limit: 15 });
      setOrders(res.data.orders);
      setTotal(res.data.total);
      setPages(res.data.pages);
      const statsRes = await customOrderService.getStats();
      setStats(statsRes.data.stats);
    } catch (err) {
      if (!isBackground) setError(err.response?.data?.message || 'Failed to load custom orders');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, [filter, page, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => { loadOrders(true); }, 30000);
    return () => clearInterval(interval);
  }, [filter, page, query]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-xl text-white">Custom Orders</h1>
          <p className="text-dark-400 text-sm flex items-center gap-2">{total} {filter || query ? 'matching' : 'requests total'} <span className="text-dark-600 text-xs flex items-center gap-1"><FiRadio size={10} className="text-green-500" /> Auto-sync 30s</span></p>
        </div>
        {stats && (
          <div className="flex gap-2">
            <div className="rounded-xl border border-white/[0.07] bg-dark-900/40 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-dark-500">Needs quote</p>
              <p className={`text-sm font-semibold tabular-nums ${stats.pendingCount > 0 ? 'text-amber-300' : 'text-dark-300'}`}>{stats.pendingCount || 0}</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-dark-900/40 px-3 py-1.5">
              <p className="text-[10px] uppercase tracking-wider text-dark-500">Collected</p>
              <p className="text-sm font-semibold tabular-nums text-emerald-400">{formatPrice(stats.totalRevenue || 0)}</p>
            </div>
          </div>
        )}
      </div>

      <div className="card p-4">
        <div className="flex gap-2 mb-3 -mx-1 px-1 overflow-x-auto scrollbar-hide sm:flex-wrap sm:overflow-visible">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value || 'all'}
              onClick={() => { setFilter(value); setPage(1); setExpandedRow(null); }}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs transition-all border flex items-center gap-1.5 ${
                filter === value
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {label}
              {(() => {
                const c = !value ? stats?.total : value === 'confirmed'
                  ? (stats?.statusCounts?.confirmed || 0) + (stats?.statusCounts?.in_production || 0)
                  : stats?.statusCounts?.[value];
                return c > 0 ? <span className={`tabular-nums text-[10px] ${filter === value ? 'text-gold-300/80' : 'text-dark-500'}`}>{c}</span> : null;
              })()}
              {value && stats?.statusCounts?.[value] > (seenCounts[value] || 0) && filter !== value && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="New updates" />
              )}
            </button>
          ))}
        </div>

        <div className="relative mb-3">
          <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-500 pointer-events-none" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search CUS ID, tracking no., customer, phone, PIN, item…"
            className="input-dark pl-8 pr-8 text-xs py-2 w-full"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-500 hover:text-white">
              <FiX size={12} />
            </button>
          )}
        </div>

        {error && (
          <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 6 }, (_, i) => i).map((n) => (
              <div key={n} className="skeleton h-[74px] rounded-2xl" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center">
            <FiInbox size={26} className="text-dark-600 mb-2" />
            <p className="text-dark-400 text-sm">{query ? `No custom orders match "${query}".` : 'No custom orders for this filter.'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map((order) => (
              <CustomOrderCard
                key={order._id}
                order={order}
                expanded={expandedRow === order._id}
                onToggle={() => setExpandedRow((prev) => (prev === order._id ? null : order._id))}
                onQuote={(o) => setQuoteModal(o)}
                onStatus={(o) => setStatusModal(o)}
                onImage={(imgs) => setImgModal(imgs)}
              />
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => { setPage(p); setExpandedRow(null); }}
                className={`w-8 h-8 rounded-lg text-xs ${p === page ? 'bg-gold-500 text-dark-900' : 'bg-dark-800 text-dark-400 hover:text-white border border-white/10'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {quoteModal  && <QuoteModal  order={quoteModal}  onClose={() => setQuoteModal(null)}  onSaved={loadOrders} />}
        {statusModal && <StatusModal order={statusModal} onClose={() => setStatusModal(null)} onSaved={loadOrders} />}
        {imgModal    && <ImagesModal images={imgModal}   onClose={() => setImgModal(null)} />}
        {dpConfirmModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => { setDpConfirmModal(null); setDpInput(''); }}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div>
                <h3 className="text-white font-semibold">Final Delivery Confirmation</h3>
                <p className="text-dark-400 text-sm mt-1">
                  Delivery partner confirmed this order as delivered.
                  {dpConfirmModal.dpNote && <span className="text-dark-500"> &ldquo;{dpConfirmModal.dpNote}&rdquo;</span>}
                </p>
              </div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-xs text-amber-400 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                Awaiting your final confirmation
              </div>
              <div>
                <p className="text-xs text-dark-500 mb-1.5">Type <span className="text-white font-mono">DELIVERED</span> to confirm:</p>
                <input
                  value={dpInput}
                  onChange={e => setDpInput(e.target.value)}
                  placeholder="DELIVERED"
                  className="w-full bg-dark-900 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-emerald-500/40"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setDpConfirmModal(null); setDpInput(''); }} className="flex-1 py-2.5 rounded-xl bg-dark-700 text-dark-300 text-sm hover:bg-dark-600 transition-colors">Cancel</button>
                <button
                  disabled={dpBusy || dpInput.trim() !== 'DELIVERED'}
                  onClick={async () => {
                    setDpBusy(true);
                    try {
                      await adminService.adminConfirmDelivery(dpConfirmModal._id, { source: 'custom_order' });
                      toast.success('Custom order marked as delivered');
                      setDpConfirmModal(null);
                      setDpInput('');
                      loadOrders(true);
                    } catch (e) {
                      toast.error(e.response?.data?.message || 'Failed to confirm');
                    }
                    setDpBusy(false);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >{dpBusy ? 'Confirming…' : 'Confirm Delivered'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
