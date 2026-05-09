/**
 * Shared invoice generator — opens print dialog in new tab.
 * No order stage labels printed (confirmed/shipped/delivered etc.)
 *
 * @param {object} order - normalized order object:
 *   orderId, createdAt, items[], itemsPrice, shippingPrice, taxPrice, totalAmount,
 *   payment: { status, method, paidAt, razorpayPaymentId },
 *   shippingAddress: { fullName, addressLine1, addressLine2, city, state, pincode, country, phone },
 *   user: { name, email }
 */
export function downloadInvoice(order) {
  const fmt = (n) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const orderId = order.orderId || `#${(order._id || '').slice(-8).toUpperCase()}`;
  const addr    = order.shippingAddress || {};

  const itemRows = (order.items || []).map(item => `
    <tr>
      <td class="td">${item.name || '—'}</td>
      <td class="td" style="text-align:center">${item.quantity ?? 1}</td>
      <td class="td" style="text-align:right">${fmt(item.price)}</td>
      <td class="td" style="text-align:right;font-weight:600">${fmt((item.price || 0) * (item.quantity || 1))}</td>
    </tr>`).join('');

  const payMethod = order.payment?.method === 'razorpay'
    ? 'Online (Razorpay)'
    : (order.payment?.method || '—');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice · ${orderId}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #1a1a1a;
      background: #fff;
      padding: 48px 56px;
      max-width: 820px;
      margin: 0 auto;
    }

    /* ── Header ── */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding-bottom: 24px;
      border-bottom: 2.5px solid #B8860B;
      margin-bottom: 36px;
    }
    .brand { line-height: 1; }
    .brand-name {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: 3px;
      color: #B8860B;
      font-variant: small-caps;
    }
    .brand-tag {
      font-size: 10px;
      color: #999;
      letter-spacing: 2px;
      margin-top: 5px;
      text-transform: uppercase;
    }
    .invoice-label { text-align: right; }
    .invoice-label h2 {
      font-size: 26px;
      font-weight: 700;
      color: #1a1a1a;
      letter-spacing: 3px;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .invoice-label p { font-size: 12px; color: #666; line-height: 2; }
    .invoice-label strong { color: #1a1a1a; }

    /* ── Two-col info grid ── */
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
      margin-bottom: 32px;
    }
    .info-box {}
    .info-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #B8860B;
      font-weight: 700;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f0e8d0;
    }
    .info-name { font-size: 14px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
    .info-line { font-size: 12px; color: #555; line-height: 1.8; }
    .status-paid {
      display: inline-block;
      background: #f0fdf4;
      color: #16a34a;
      border: 1px solid #bbf7d0;
      border-radius: 20px;
      padding: 2px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
      margin-top: 4px;
    }
    .status-unpaid {
      display: inline-block;
      background: #fef2f2;
      color: #dc2626;
      border: 1px solid #fecaca;
      border-radius: 20px;
      padding: 2px 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: capitalize;
      margin-top: 4px;
    }

    /* ── Items table ── */
    .section-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: #B8860B;
      font-weight: 700;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #f0e8d0;
    }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #faf8f3; }
    th {
      padding: 11px 10px;
      text-align: left;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: #888;
      font-weight: 700;
      border-bottom: 1px solid #e8e0ce;
    }
    th:nth-child(2) { text-align: center; }
    th:nth-child(3), th:nth-child(4) { text-align: right; }
    .td {
      padding: 11px 10px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 13px;
      color: #333;
      vertical-align: middle;
    }

    /* ── Totals ── */
    .totals {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 7px;
      margin-top: 20px;
    }
    .total-row {
      display: flex;
      gap: 80px;
      font-size: 13px;
      color: #666;
    }
    .tval { text-align: right; min-width: 90px; color: #333; }
    .total-final {
      border-top: 1.5px solid #B8860B;
      padding-top: 10px;
      margin-top: 4px;
      display: flex;
      gap: 80px;
      font-size: 16px;
      font-weight: 700;
    }
    .total-final .tval { color: #B8860B; text-align: right; min-width: 90px; }

    /* ── Footer ── */
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .footer-left { font-size: 11px; color: #aaa; line-height: 1.8; }
    .footer-right { font-size: 11px; color: #B8860B; font-weight: 600; letter-spacing: 1px; }

    .watermark {
      text-align: center;
      margin-top: 16px;
      font-size: 10px;
      color: #ddd;
      letter-spacing: 3px;
      text-transform: uppercase;
    }

    @media print {
      body { padding: 20px 28px; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div class="brand">
      <div class="brand-name">M.B. Jewellers</div>
      <div class="brand-tag">Fine Jewellery · Est. 2024</div>
    </div>
    <div class="invoice-label">
      <h2>Invoice</h2>
      <p>Order: <strong>${orderId}</strong></p>
      <p>Date: <strong>${fmtDate(order.createdAt)}</strong></p>
      ${order.payment?.paidAt ? `<p>Paid on: <strong>${fmtDate(order.payment.paidAt)}</strong></p>` : ''}
    </div>
  </div>

  <!-- Bill To + Payment -->
  <div class="info-grid">
    <div class="info-box">
      <div class="info-title">Bill To</div>
      <div class="info-name">${addr.fullName || order.user?.name || '—'}</div>
      <div class="info-line">
        ${addr.addressLine1 || ''}
        ${addr.addressLine2 ? '<br/>' + addr.addressLine2 : ''}
        <br/>${[addr.city, addr.state].filter(Boolean).join(', ')} ${addr.pincode ? '— ' + addr.pincode : ''}
        <br/>${addr.country || 'India'}
        ${addr.phone ? '<br/>' + addr.phone : ''}
      </div>
    </div>
    <div class="info-box">
      <div class="info-title">Payment Info</div>
      <div class="info-line" style="margin-bottom:6px">
        <strong style="color:#1a1a1a">Method:</strong> ${payMethod}
      </div>
      <div class="info-line" style="margin-bottom:6px">
        <strong style="color:#1a1a1a">Status:</strong>
        <span class="${order.payment?.status === 'paid' ? 'status-paid' : 'status-unpaid'}">${order.payment?.status || '—'}</span>
      </div>
      ${order.payment?.razorpayPaymentId ? `
      <div class="info-line" style="margin-top:8px">
        <strong style="color:#1a1a1a">Transaction ID:</strong><br/>
        <span style="font-size:11px;word-break:break-all;color:#777">${order.payment.razorpayPaymentId}</span>
      </div>` : ''}
    </div>
  </div>

  <!-- Items -->
  <div class="section-title">Items Ordered</div>
  <table>
    <thead>
      <tr>
        <th>Product</th>
        <th>Qty</th>
        <th>Unit Price</th>
        <th>Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="totals">
    <div class="total-row"><span>Subtotal</span><span class="tval">${fmt(order.itemsPrice)}</span></div>
    <div class="total-row"><span>Shipping</span><span class="tval">${(order.shippingPrice || 0) > 0 ? fmt(order.shippingPrice) : 'Free'}</span></div>
    <div class="total-row"><span>Tax (GST)</span><span class="tval">${fmt(order.taxPrice)}</span></div>
    <div class="total-final"><span>Total</span><span class="tval">${fmt(order.totalAmount)}</span></div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-left">
      M.B. Jewellers · Fine Jewellery<br/>
      support@mbjewelry.com · www.mbjewelry.com
    </div>
    <div class="footer-right">Thank You ✦</div>
  </div>

  <div class="watermark">M · B · J E W E L L E R S</div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
