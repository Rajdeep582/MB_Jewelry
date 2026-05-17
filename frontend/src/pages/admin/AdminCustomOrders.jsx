import { useEffect, useState } from 'react';
import { FiX, FiChevronDown, FiChevronUp, FiImage, FiRadio, FiDownload, FiLock, FiAlertTriangle, FiUser, FiMail, FiPhone, FiMapPin, FiTruck, FiClock, FiPackage, FiCreditCard } from 'react-icons/fi';
import { customOrderService, adminService } from '../../services/services';
import { formatPrice, formatDate, formatDateTime, getCustomOrderStatusColor } from '../../utils/helpers';
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

// ─── Quote Confirm Modal ──────────────────────────────────────────────────────
function QuoteConfirmModal({ order, form, gstRate, onConfirm, onBack, saving }) {
  const quoteAmt   = Number(form.quoteAmount);
  const taxAmt     = Math.round(quoteAmt * gstRate);
  const totalAmt   = quoteAmt + taxAmt;
  const advanceAmt = Math.round(totalAmt * 0.70);
  const finalAmt   = totalAmt - advanceAmt;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 16 }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-red-500/30 bg-dark-800 shadow-[0_0_60px_rgba(200,30,30,0.18)]"
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center flex-shrink-0">
              <FiAlertTriangle size={18} className="text-red-400" />
            </div>
            <div>
              <h2 className="font-display text-xl text-white font-bold">Confirm Quote — Final</h2>
              <p className="text-red-400 text-xs font-medium mt-0.5">This action is irreversible. Price cannot be changed after confirmation.</p>
            </div>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mx-6 mt-4 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
          <p className="text-red-300 text-sm font-semibold flex items-center gap-2">
            <FiLock size={13} /> Once confirmed, the quote is permanently locked
          </p>
          <p className="text-red-400/70 text-xs mt-1">The customer will be notified and can proceed with payment. No edits allowed after this point.</p>
        </div>

        {/* Order Info */}
        <div className="mx-6 mt-4 bg-dark-900/70 border border-white/8 rounded-xl p-4">
          <p className="text-dark-500 text-[10px] uppercase tracking-wider font-semibold mb-3">Order Details</p>
          <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Order ID</p>
              <p className="text-gold-400 font-mono font-semibold">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Customer</p>
              <p className="text-white font-medium">{order.user?.name || 'N/A'}</p>
              <p className="text-dark-500 text-xs">{order.user?.email}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Product</p>
              <p className="text-white font-medium">{order.type} — {order.material}</p>
            </div>
            <div>
              <p className="text-dark-500 text-[10px] uppercase tracking-wider">Purity</p>
              <p className="text-white font-medium">{order.purity !== 'None' ? order.purity : 'N/A'}</p>
            </div>
            {form.expectedDeliveryDate && (
              <div>
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Expected Delivery</p>
                <p className="text-emerald-400 font-medium">{new Date(form.expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
            )}
            {form.quoteNote && (
              <div className="col-span-2">
                <p className="text-dark-500 text-[10px] uppercase tracking-wider">Quote Note</p>
                <p className="text-dark-300 text-xs italic mt-0.5">{form.quoteNote}</p>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="mx-6 mt-4 rounded-xl border border-gold-500/20 bg-gradient-to-br from-gold-500/8 to-dark-900/60 p-4">
          <p className="text-dark-500 text-[10px] uppercase tracking-wider font-semibold mb-3">Pricing Breakdown</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-dark-400">Base Quote</span>
              <span className="text-white font-semibold">{formatPrice(quoteAmt)}</span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b border-white/8">
              <span className="text-dark-500">{Math.round(gstRate * 100)}% GST</span>
              <span className="text-dark-400">{formatPrice(taxAmt)}</span>
            </div>
            <div className="flex justify-between items-center text-base pt-1">
              <span className="text-white font-bold">Grand Total</span>
              <span className="text-gold-400 font-bold text-xl">{formatPrice(totalAmt)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/8">
            <div className="bg-dark-800/60 rounded-lg p-3">
              <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-1">70% Advance</p>
              <p className="text-white font-bold text-base">{formatPrice(advanceAmt)}</p>
              <p className="text-dark-600 text-[10px] mt-0.5">Customer pays first</p>
            </div>
            <div className="bg-dark-800/60 rounded-lg p-3">
              <p className="text-dark-500 text-[10px] uppercase tracking-wider mb-1">30% Balance</p>
              <p className="text-dark-300 font-bold text-base">{formatPrice(finalAmt)}</p>
              <p className="text-dark-600 text-[10px] mt-0.5">After delivery</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 pt-5 flex gap-3">
          <button
            type="button"
            onClick={onBack}
            disabled={saving}
            className="btn-dark flex-1 py-3 disabled:opacity-50"
          >
            ← Go Back & Edit
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_4px_20px_rgba(200,30,30,0.3)] hover:shadow-[0_4px_24px_rgba(200,30,30,0.45)] flex items-center justify-center gap-2"
          >
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Locking Quote…</>
            ) : (
              <><FiLock size={14} /> Confirm & Lock Quote</>
            )}
          </button>
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
    expectedDeliveryDate: order.expectedDeliveryDate ? new Date(order.expectedDeliveryDate).toISOString().split('T')[0] : '',
    adminNotes:  order.adminNotes  || '',
  });
  const [saving,       setSaving]       = useState(false);
  const [gstRate,      setGstRate]      = useState(0.18);
  const [showConfirm,  setShowConfirm]  = useState(false);

  useEffect(() => {
    adminService.getGlobalPricing()
      .then(res => {
        const match = (res.data.pricing || []).find(
          p => p.material === order.material && (p.purity === order.purity || order.purity === 'None')
        ) || (res.data.pricing || []).find(p => p.material === order.material);
        if (match) setGstRate(match.gst / 100);
      })
      .catch(() => {/* keep default */});
  }, []);

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '', 'width=800,height=800');
    if (!printWindow) return toast.error('Popup blocked. Please allow popups to download PDF.');
    const html = `
      <html>
        <head>
          <title>Order Request - ${order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</title>
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
            <div class="field"><div class="label">Order ID</div><div class="value">${order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</div></div>
            <div class="field"><div class="label">Date Created</div><div class="value">${new Date(order.createdAt).toLocaleDateString()}</div></div>
            <div class="field"><div class="label">Customer Name</div><div class="value">${order.user?.name || 'N/A'}</div></div>
            <div class="field"><div class="label">Customer Email</div><div class="value">${order.user?.email || 'N/A'}</div></div>
            <div class="field"><div class="label">Product Type</div><div class="value">${order.type} — ${order.material}</div></div>
            <div class="field"><div class="label">Purity</div><div class="value">${order.purity !== 'None' ? order.purity : 'N/A'}</div></div>
            ${order.budget ? `<div class="field"><div class="label">Budget</div><div class="value">${order.budget}</div></div>` : ''}
            ${order.weight ? `<div class="field"><div class="label">Expected Weight</div><div class="value">${order.weight}</div></div>` : ''}
            ${order.fingerSize ? `<div class="field"><div class="label">Finger Size</div><div class="value">${order.fingerSize}</div></div>` : ''}
            ${order.neckSize ? `<div class="field"><div class="label">Neck Size</div><div class="value">${order.neckSize}</div></div>` : ''}
            ${order.wristSize ? `<div class="field"><div class="label">Wrist Size</div><div class="value">${order.wristSize}</div></div>` : ''}
            <div class="field full-width"><div class="label">Design Description</div><div class="value desc">${order.description}</div></div>
          </div>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 250);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.quoteAmount || Number(form.quoteAmount) <= 0) {
      toast.error('Please enter a valid quote amount'); return;
    }
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await customOrderService.setQuote(order._id, {
        quoteAmount: Number(form.quoteAmount),
        quoteNote:   form.quoteNote,
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

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md max-h-[90vh] overflow-y-auto glass rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-xl text-white">Set Quote</h2>
              <p className="text-amber-400 text-xs mt-0.5 flex items-center gap-1">
                <FiLock size={10} /> Price will be locked permanently after confirmation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleDownloadPDF} className="btn-dark px-3 py-1.5 text-xs inline-flex items-center gap-1.5 hover:text-white" title="Download Request as PDF">
                <FiDownload size={12} /> Download PDF
              </button>
              <button onClick={onClose} className="p-1 text-dark-400 hover:text-white ml-2"><FiX /></button>
            </div>
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
              {order.budget && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Budget</p><p className="text-gold-400 font-medium">{order.budget}</p></div>}
              {order.weight && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Exp. Weight</p><p className="text-white">{order.weight}</p></div>}
              {order.fingerSize && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Finger Size</p><p className="text-white">{order.fingerSize}</p></div>}
              {order.neckSize && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Neck Size</p><p className="text-white">{order.neckSize}</p></div>}
              {order.wristSize && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Wrist Size</p><p className="text-white">{order.wristSize}</p></div>}
              {order.preferredDeliveryDate && <div><p className="text-dark-500 text-[10px] uppercase tracking-wider">Customer Exp. Date</p><p className="text-emerald-400 font-medium">{formatDate(order.preferredDeliveryDate)}</p></div>}
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
                  Customer pays: {formatPrice(Math.round(Number(form.quoteAmount) * (1 + gstRate)))} (incl. {Math.round(gstRate * 100)}% GST)
                </p>
              )}
            </div>
            <div>
              <label className="label-dark">Quote Note <span className="text-dark-500 font-normal">(visible to customer)</span></label>
              <textarea value={form.quoteNote} onChange={(e) => setForm({ ...form, quoteNote: e.target.value })} className="input-dark resize-none" rows={2} placeholder="e.g. Includes hallmark charges." />
            </div>
            <div>
              <label className="label-dark">Expected Delivery Date <span className="text-dark-500 font-normal">(visible to customer)</span></label>
              <input type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} className="input-dark" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="label-dark">Admin Notes <span className="text-dark-500 font-normal">(internal only)</span></label>
              <textarea value={form.adminNotes} onChange={(e) => setForm({ ...form, adminNotes: e.target.value })} className="input-dark resize-none" rows={2} placeholder="Internal notes for tracking / production team" />
            </div>
            <div className="flex gap-3 pt-2">
              <button type="submit" className="btn-gold flex-1 py-2.5">
                Review & Confirm Quote →
              </button>
              <button type="button" onClick={onClose} className="btn-dark flex-1 py-2.5">Cancel</button>
            </div>
          </form>
        </motion.div>
      </div>

      <AnimatePresence>
        {showConfirm && (
          <QuoteConfirmModal
            order={order}
            form={form}
            gstRate={gstRate}
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
    // Guard: cannot deliver unless final payment is done
    if (opt.value === 'delivered' && !isFinalPaid) return false;
    const optIdx = allStatuses.indexOf(opt.value);
    return optIdx > currentIdx;
  });

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
                className="input-dark"
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-dark-500 text-xs mt-1">Shown to customer as estimated delivery date</p>
            </div>
          )}

          <div>
            <label className="label-dark">Comment <span className="text-dark-500 font-normal">(optional)</span></label>
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
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="w-full max-w-2xl glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg text-white">Reference Images ({images.length})</h2>
          <button onClick={onClose} className="p-1 text-dark-400 hover:text-white"><FiX /></button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {images.map((img) => (
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

function getPaymentAmountCell(order) {
  if (order.finalPayment?.status === 'paid') {
    return <span className="text-green-400 font-medium">{formatPrice(order.quoteAmount || (order.advanceAmount + order.finalAmount))}</span>;
  }
  if (order.advancePayment?.status === 'paid') {
    return <span className="text-blue-400 font-medium">{formatPrice(order.advanceAmount)}</span>;
  }
  return <span className="text-dark-400 text-xs">—</span>;
}

function getPaymentStatusCell(order) {
  if (order.finalPayment?.status === 'paid') {
    return <span className="text-green-400 text-xs font-medium">Fully Paid</span>;
  }
  if (order.advancePayment?.status === 'paid') {
    return <span className="text-blue-400 text-xs font-medium">Advance Paid</span>;
  }
  return <span className="text-dark-400 text-xs">Pending</span>;
}

// ─── Custom Order Detail Drawer ───────────────────────────────────────────────
function CustomOrderDetailDrawer({ order, onQuote, onStatus, onImage }) {
  const [showTimeline, setShowTimeline] = useState(true);
  const reversed = [...(order.trackingHistory || [])].reverse();

  return (
    <motion.tr
      key={`drawer-${order._id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <td colSpan={9} className="p-0">
        <div className="bg-dark-900/60 border-t border-white/5 p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT — Design Info + Payment Breakdown */}
          <div className="lg:col-span-2 space-y-4">

            {/* Design Details */}
            <div>
              <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FiPackage size={11} /> Design Request
              </h4>
              <div className="grid grid-cols-2 gap-3 text-xs mb-3">
                <div><p className="text-dark-500 mb-0.5">Type</p><p className="text-white font-medium">{order.type}</p></div>
                <div><p className="text-dark-500 mb-0.5">Material</p><p className="text-white font-medium">{order.material} {order.purity !== 'None' ? `· ${order.purity}` : ''}</p></div>
                {order.size && <div><p className="text-dark-500 mb-0.5">Size</p><p className="text-dark-300">{order.size}</p></div>}
                {order.weight && <div><p className="text-dark-500 mb-0.5">Weight</p><p className="text-dark-300">{order.weight}g</p></div>}
                {order.engraving && <div className="col-span-2"><p className="text-dark-500 mb-0.5">Engraving</p><p className="text-dark-300">{order.engraving}</p></div>}
              </div>
              {order.description && (
                <div className="bg-dark-800/60 rounded-xl p-3 text-xs text-dark-300 leading-relaxed">
                  {order.description}
                </div>
              )}
              {order.referenceImages?.length > 0 && (
                <button
                  onClick={() => onImage(order.referenceImages)}
                  className="mt-2 text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1.5 transition-colors"
                >
                  <FiImage size={12} /> View {order.referenceImages.length} reference image{order.referenceImages.length > 1 ? 's' : ''}
                </button>
              )}
            </div>

            {/* Payment Breakdown */}
            {order.quoteAmount && (
              <div>
                <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FiCreditCard size={11} /> Payment Breakdown
                </h4>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-dark-500">
                    <span>Quote (excl. GST)</span><span className="text-dark-300">{formatPrice(order.quoteAmount)}</span>
                  </div>
                  {order.taxAmount > 0 && (
                    <div className="flex justify-between text-dark-500">
                      <span>Tax (GST)</span><span className="text-dark-300">{formatPrice(order.taxAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-white/8 pt-2 mt-1 text-sm">
                    <span className="text-white">Total</span><span className="text-gold-500">{formatPrice(order.totalAmount)}</span>
                  </div>
                  <div className="flex justify-between text-dark-500 pt-1">
                    <span>Advance (70%)</span><span className={order.advancePayment?.status === 'paid' ? 'text-green-400' : 'text-dark-300'}>{formatPrice(order.advanceAmount)}</span>
                  </div>
                  <div className="flex justify-between text-dark-500">
                    <span>Final (30%)</span><span className={order.finalPayment?.status === 'paid' ? 'text-green-400' : 'text-dark-300'}>{formatPrice(order.finalAmount)}</span>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                  {order.advancePayment?.paidAt && (
                    <div>
                      <p className="text-dark-500 mb-0.5">Advance Paid At</p>
                      <p className="text-dark-300">{formatDateTime(order.advancePayment.paidAt)}</p>
                      {order.advancePayment.razorpayPaymentId && (
                        <p className="text-dark-600 font-mono text-[10px] mt-0.5 break-all">{order.advancePayment.razorpayPaymentId}</p>
                      )}
                    </div>
                  )}
                  {order.finalPayment?.paidAt && (
                    <div>
                      <p className="text-dark-500 mb-0.5">Final Paid At</p>
                      <p className="text-dark-300">{formatDateTime(order.finalPayment.paidAt)}</p>
                      {order.finalPayment.razorpayPaymentId && (
                        <p className="text-dark-600 font-mono text-[10px] mt-0.5 break-all">{order.finalPayment.razorpayPaymentId}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Customer, Shipping, Delivery, Timeline, Actions */}
          <div className="space-y-4">

            <div>
              <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FiUser size={11} /> Customer
              </h4>
              <div className="text-xs space-y-1.5">
                <p className="text-white font-medium flex items-center gap-1.5"><FiUser size={10} className="text-dark-500" />{order.user?.name || 'N/A'}</p>
                <a href={`mailto:${order.user?.email}`} className="text-dark-400 hover:text-gold-400 transition-colors flex items-center gap-1.5">
                  <FiMail size={10} className="text-dark-500" />{order.user?.email}
                </a>
                {order.shippingAddress?.phone && (
                  <p className="text-dark-400 flex items-center gap-1.5"><FiPhone size={10} className="text-dark-500" />{order.shippingAddress.phone}</p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <FiMapPin size={11} /> Shipping Address
              </h4>
              <div className="text-xs text-dark-400 space-y-0.5">
                <p className="text-white font-medium">{order.shippingAddress?.fullName}</p>
                <p>{order.shippingAddress?.addressLine1}</p>
                {order.shippingAddress?.addressLine2 && <p>{order.shippingAddress.addressLine2}</p>}
                <p>{order.shippingAddress?.city}, {order.shippingAddress?.state} — {order.shippingAddress?.pincode}</p>
                <p>{order.shippingAddress?.country}</p>
              </div>
            </div>

            {(order.dispatchedAt || order.deliveredAt || order.deliveryId) && (
              <div>
                <h4 className="text-dark-400 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <FiTruck size={11} /> Delivery Info
                </h4>
                <div className="text-xs space-y-1.5">
                  {order.deliveryId && (
                    <div><p className="text-dark-500">Tracking No.</p><p className="text-white font-mono">MB-{order.deliveryId.replaceAll('-', '').slice(-8).toUpperCase()}</p></div>
                  )}
                  {order.dispatchedAt && (
                    <div><p className="text-dark-500">Dispatched</p><p className="text-dark-300">{formatDateTime(order.dispatchedAt)}</p></div>
                  )}
                  {order.estimatedDelivery && (
                    <div><p className="text-dark-500">Est. Delivery</p><p className="text-dark-300">{formatDateTime(order.estimatedDelivery)}</p></div>
                  )}
                  {order.deliveredAt && (
                    <div><p className="text-dark-500">Delivered</p><p className="text-green-400 font-medium">{formatDateTime(order.deliveredAt)}</p></div>
                  )}
                </div>
              </div>
            )}

            {reversed.length > 0 && (
              <div>
                <button
                  onClick={() => setShowTimeline(v => !v)}
                  className="flex items-center justify-between w-full text-dark-400 text-xs uppercase tracking-wider mb-2 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5"><FiClock size={11} /> Timeline ({reversed.length})</span>
                  {showTimeline ? <FiChevronUp size={12} /> : <FiChevronDown size={12} />}
                </button>
                {showTimeline && (
                  <div className="space-y-0">
                    {reversed.map((entry, idx) => (
                      <div key={entry.timestamp || idx} className="flex gap-3">
                        <div className="flex flex-col items-center w-4 flex-shrink-0">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${idx === 0 ? 'bg-gold-500' : 'bg-dark-600'}`} />
                          {idx !== reversed.length - 1 && <div className="flex-1 w-px bg-dark-700 my-0.5" />}
                        </div>
                        <div className="pb-3 flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1 flex-wrap">
                            <p className={`text-xs font-medium capitalize ${idx === 0 ? 'text-white' : 'text-dark-400'}`}>
                              {STAGE_LABELS[entry.status] || entry.status?.replaceAll('_', ' ')}
                            </p>
                            <time className="text-dark-600 text-[10px] flex-shrink-0">{formatDateTime(entry.timestamp || entry.createdAt)}</time>
                          </div>
                          {entry.comment && <p className="text-dark-500 text-[11px] mt-0.5 leading-snug">{entry.comment}</p>}
                          {entry.updatedBy?.name && <p className="text-dark-600 text-[10px] mt-0.5">by {entry.updatedBy.name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2 pt-1">
              {!['delivered', 'cancelled'].includes(order.status) && (
                !order.quotedAt ? (
                  <button onClick={() => onQuote(order)} className="btn-outline-gold w-full py-2 text-xs">Set Quote</button>
                ) : null
              )}
              {!['delivered', 'cancelled'].includes(order.status) && (
                <button onClick={() => onStatus(order)} className="btn-gold w-full py-2 text-xs flex items-center justify-center gap-1.5">
                  Update Status
                </button>
              )}
            </div>
          </div>
        </div>
      </td>
    </motion.tr>
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

  useEffect(() => { document.title = 'Custom Orders — Admin'; }, []);

  useEffect(() => {
    if (stats?.statusCounts && filter) {
      setSeenCounts(prev => ({ ...prev, [filter]: stats.statusCounts[filter] }));
    }
  }, [stats, filter]);

  const loadOrders = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    setError('');
    try {
      const res = await customOrderService.getAllOrders({ status: filter, page, limit: 15 });
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

  useEffect(() => { loadOrders(); }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const interval = setInterval(() => { loadOrders(true); }, 30000);
    return () => clearInterval(interval);
  }, [filter, page]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl text-white">Custom Orders</h1>
          <p className="text-dark-400 text-sm flex items-center gap-2">{total} requests total <span className="text-dark-600 text-xs flex items-center gap-1"><FiRadio size={10} className="text-green-500" /> Auto-sync 30s</span></p>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {FILTER_OPTIONS.map(({ value, label }) => (
            <button
              key={value || 'all'}
              onClick={() => { setFilter(value); setPage(1); setExpandedRow(null); }}
              className={`px-4 py-1.5 rounded-full text-xs transition-all border flex items-center gap-1.5 ${
                filter === value
                  ? 'bg-gold-500/15 border-gold-500/50 text-gold-400'
                  : 'border-white/10 text-dark-400 hover:border-white/30'
              }`}
            >
              {label}
              {value && stats?.statusCounts?.[value] > (seenCounts[value] || 0) && filter !== value && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="New updates" />
              )}
            </button>
          ))}
        </div>

        {error && (
          <div className="text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-white/10">
              <tr className="text-dark-500 text-xs uppercase tracking-wider">
                <th className="text-left py-2 pr-4">ID</th>
                <th className="text-left py-2 pr-4">Customer</th>
                <th className="text-left py-2 pr-4">Type / Material</th>
                <th className="text-left py-2 pr-4">Total Amount</th>
                <th className="text-left py-2 pr-4">Paid Amount</th>
                <th className="text-left py-2 pr-4">Payment</th>
                <th className="text-left py-2 pr-4">Stage</th>
                <th className="text-left py-2 pr-4">Date</th>
                <th className="text-right py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                Array.from({ length: 8 }, (_, i) => i).map((n) => (
                  <tr key={n}><td colSpan={9} className="py-3"><div className="skeleton h-8 rounded-lg" /></td></tr>
                ))
              ) : orders.flatMap((order) => {
                const isExpanded = expandedRow === order._id;
                return [
                  <tr
                    key={order._id}
                    onClick={() => setExpandedRow(prev => prev === order._id ? null : order._id)}
                    className={`cursor-pointer transition-colors ${isExpanded ? 'bg-white/[0.02]' : 'hover:bg-white/[0.015]'}`}
                  >
                    <td className="py-3 pr-4">
                      <span className="text-gold-400 font-mono text-xs">{order.customOrderId || `CUS-${order._id.slice(-8).toUpperCase()}`}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-dark-300 text-xs">{order.user?.name || 'N/A'}</p>
                      <a href={`mailto:${order.user?.email}`} onClick={e => e.stopPropagation()} className="text-dark-500 hover:text-gold-400 text-xs transition-colors">{order.user?.email}</a>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-white text-xs">{order.type}</p>
                      <p className="text-dark-500 text-xs">{order.material} {order.purity !== 'None' ? `· ${order.purity}` : ''}</p>
                    </td>
                    <td className="py-3 pr-4">
                      {order.quoteAmount
                        ? <span className="text-gold-500 font-medium">{formatPrice(order.quoteAmount)}</span>
                        : <span className="text-dark-600 text-xs italic">Not set</span>}
                    </td>
                    <td className="py-3 pr-4">{getPaymentAmountCell(order)}</td>
                    <td className="py-3 pr-4">{getPaymentStatusCell(order)}</td>
                    <td className="py-3 pr-4">
                      <span className={getCustomOrderStatusColor(order.status)}>{STAGE_LABELS[order.status] || order.status.replace(/_/g, ' ')}</span>
                      {order.dpConfirmedAt && order.status !== 'delivered' && (
                        <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Delivery partner confirmed — awaiting admin" />
                      )}
                    </td>
                    <td className="py-3 pr-4 text-dark-500 text-xs">{formatDate(order.createdAt)}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {order.referenceImages?.length > 0 && (
                          <button onClick={() => setImgModal(order.referenceImages)} className="p-1.5 text-dark-400 hover:text-gold-400 transition-colors" title="View reference images">
                            <FiImage size={14} />
                          </button>
                        )}
                        {isExpanded ? <FiChevronUp size={14} className="text-dark-500 ml-1" /> : <FiChevronDown size={14} className="text-dark-500 ml-1" />}
                      </div>
                    </td>
                  </tr>,
                  isExpanded && (
                    <CustomOrderDetailDrawer
                      key={`drawer-${order._id}`}
                      order={order}
                      onQuote={(o) => setQuoteModal(o)}
                      onStatus={(o) => setStatusModal(o)}
                      onImage={(imgs) => setImgModal(imgs)}
                    />
                  ),
                ].filter(Boolean);
              })}
            </tbody>
          </table>
        </div>

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
