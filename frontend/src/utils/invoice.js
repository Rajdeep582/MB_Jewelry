/**
 * invoice.js — printable GST tax invoice (opens in a new tab → browser "Save as PDF").
 *
 * Follows the particulars a tax invoice must carry (CGST Rules, rule 46): supplier name,
 * address and GSTIN; a consecutive invoice number (≤ 16 chars, issued by the server after
 * payment) and date; recipient name and address; place of supply with state code; HSN code,
 * description, quantity, rate and taxable value of each item; tax rate and amount split into
 * CGST + SGST (same state) or IGST (other state); total in figures and words; reverse-charge
 * declaration; and the authorised signatory.
 *
 * Exports
 *   downloadInvoice(order)              — shop order (Order model shape)
 *   downloadCustomOrderInvoice(order)   — custom order (CustomOrder model shape)
 * Both return false (and open nothing) when the order is not paid yet.
 *
 * Seller GSTIN comes from VITE_SELLER_GSTIN (frontend .env). Without it the document is
 * titled "Invoice" instead of "Tax Invoice".
 */

// ─── Seller (M.B. Jewellers) ─────────────────────────────────────────────────
const SELLER = {
  name: 'M.B. Jewellers',
  tagline: 'Fine Gold & Silver Jewellery · Since 2010',
  address: ["Boys' High School, 217/3, Netaji Subhash Bose Road", 'Beside New Barrackpore, New Barrackpur', 'West Bengal 700131, India'],
  phone: '098304 24257',
  email: 'mbjewellers2021@gmail.com',
  state: 'West Bengal',
  stateCode: '19',
  gstin: (import.meta.env?.VITE_SELLER_GSTIN || '').trim().toUpperCase(),
};

// HSN: 7113 = articles of jewellery of precious metal; 7118 = coin
const hsnFor = (name = '') => (/\bcoins?\b/i.test(name) ? '7118' : '7113');

// GST state codes (place of supply)
const STATE_CODES = {
  'jammu and kashmir': '01', 'himachal pradesh': '02', punjab: '03', chandigarh: '04', uttarakhand: '05',
  haryana: '06', delhi: '07', rajasthan: '08', 'uttar pradesh': '09', bihar: '10', sikkim: '11',
  'arunachal pradesh': '12', nagaland: '13', manipur: '14', mizoram: '15', tripura: '16', meghalaya: '17',
  assam: '18', 'west bengal': '19', jharkhand: '20', odisha: '21', chhattisgarh: '22', 'madhya pradesh': '23',
  gujarat: '24', 'dadra and nagar haveli and daman and diu': '26', maharashtra: '27', karnataka: '29', goa: '30',
  lakshadweep: '31', kerala: '32', 'tamil nadu': '33', puducherry: '34', 'andaman and nicobar islands': '35',
  telangana: '36', 'andhra pradesh': '37', ladakh: '38',
};
const STATE_ALIASES = { wb: 'west bengal', orissa: 'odisha', pondicherry: 'puducherry', 'new delhi': 'delhi', 'nct of delhi': 'delhi', 'j&k': 'jammu and kashmir', 'jammu & kashmir': 'jammu and kashmir' };
function placeOfSupply(state = '') {
  const key = String(state).toLowerCase().replaceAll('&', 'and').replaceAll(/[^a-z ]/g, ' ').replaceAll(/\s+/g, ' ').trim();
  const name = STATE_ALIASES[key] || STATE_ALIASES[String(state).toLowerCase().trim()] || key;
  return { name: state || '—', code: STATE_CODES[name] || '' };
}

// ─── Formatting ──────────────────────────────────────────────────────────────
const esc = (v) => String(v ?? '').replaceAll(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const money = (n) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(r2(n));
const rupees = (n) => `₹${money(n)}`;
const dateLong = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');

/** Indian-system amount in words: "Rupees One Lakh Fifty-Six Thousand ... and Forty-Four Paise Only" */
function amountInWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? `-${ones[n % 10]}` : ''}`);
  const three = (n) => [n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred` : '', two(n % 100)].filter(Boolean).join(' ');
  const words = (n) => {
    if (n === 0) return 'Zero';
    const parts = [];
    const crore = Math.floor(n / 1e7); n %= 1e7;
    const lakh = Math.floor(n / 1e5); n %= 1e5;
    const thousand = Math.floor(n / 1e3); n %= 1e3;
    if (crore) parts.push(`${words(crore)} Crore`);
    if (lakh) parts.push(`${two(lakh)} Lakh`);
    if (thousand) parts.push(`${two(thousand)} Thousand`);
    if (n) parts.push(three(n));
    return parts.join(' ');
  };
  const total = r2(amount);
  const rs = Math.floor(total);
  const paise = Math.round((total - rs) * 100);
  return `Rupees ${words(rs)}${paise ? ` and ${two(paise)} Paise` : ''} Only`;
}

// ─── Normalisers → one invoice document shape ────────────────────────────────
const fallbackNo = (id) => `INV-${String(id || '').replace(/^#/, '').replaceAll(/[^A-Za-z0-9]/g, '').slice(-10).toUpperCase()}`;

function fromOrder(order) {
  const orderId = order.orderId || `#${String(order._id || '').slice(-8).toUpperCase()}`;
  const p = order.payment || {};
  return {
    kind: 'order',
    invoiceNumber: order.invoiceNumber || fallbackNo(orderId),
    invoiceDate: order.invoiceDate || p.paidAt || order.createdAt,
    orderId,
    orderDate: order.createdAt,
    customer: { name: order.user?.name, email: order.user?.email, phone: order.user?.phone },
    address: order.shippingAddress || {},
    items: (order.items || []).map((it) => ({ name: it.name, hsn: hsnFor(it.name), qty: it.quantity ?? 1, rate: it.price || 0 })),
    taxable: order.itemsPrice ?? (order.items || []).reduce((s, it) => s + (it.price || 0) * (it.quantity ?? 1), 0),
    tax: order.taxPrice || 0,
    shipping: order.shippingPrice || 0,
    total: order.totalAmount || 0,
    payments: [{ label: 'Online payment', amount: order.totalAmount || 0, paidAt: p.paidAt, ref: p.razorpayPaymentId, method: p.method }],
    paid: p.status === 'paid' || !!order.invoiceNumber,
  };
}

function fromCustomOrder(order) {
  const orderId = order.customOrderId || `CUS-${String(order._id || '').slice(-8).toUpperCase()}`;
  const purity = order.purity && order.purity !== 'None' ? ` ${order.purity}` : '';
  const spec = [order.weight && `approx. ${/^\d+(\.\d+)?$/.test(String(order.weight).trim()) ? `${String(order.weight).trim()} g` : order.weight}`, order.fingerSize && `size ${order.fingerSize}`, order.neckSize && `length ${order.neckSize}`, order.wristSize && `size ${order.wristSize}`].filter(Boolean).join(', ');
  const adv = order.advancePayment || {};
  const fin = order.finalPayment || {};
  return {
    kind: 'custom',
    invoiceNumber: order.invoiceNumber || fallbackNo(orderId),
    invoiceDate: order.invoiceDate || fin.paidAt || order.updatedAt,
    orderId,
    orderDate: order.createdAt,
    customer: { name: order.user?.name, email: order.user?.email, phone: order.user?.phone },
    address: order.shippingAddress || {},
    items: [{ name: `Bespoke ${order.type} — ${order.material}${purity}`, note: spec ? `Made to order · ${spec}` : 'Made to order', hsn: '7113', qty: 1, rate: order.quoteAmount || 0 }],
    taxable: order.quoteAmount || 0,
    tax: order.taxAmount || 0,
    shipping: order.shippingAmount || 0,
    total: order.totalAmount || 0,
    payments: [
      adv.status === 'paid' && { label: 'Advance (70%)', amount: order.advanceAmount, paidAt: adv.paidAt, ref: adv.razorpayPaymentId, method: 'razorpay' },
      fin.status === 'paid' && { label: 'Balance (30%)', amount: order.finalAmount, paidAt: fin.paidAt, ref: fin.razorpayPaymentId, method: 'razorpay' },
    ].filter(Boolean),
    paid: fin.status === 'paid' || !!order.invoiceNumber,
  };
}

// ─── HTML ─────────────────────────────────────────────────────────────────────
function renderInvoice(doc) {
  const a = Object.fromEntries(Object.entries(doc.address || {}).map(([k, v]) => [k, esc(v)]));
  const pos = placeOfSupply(doc.address?.state);
  const intra = pos.code ? pos.code === SELLER.stateCode : String(doc.address?.state || '').toLowerCase().includes('bengal');
  const rate = doc.taxable > 0 ? r2((doc.tax / doc.taxable) * 100) : 0;
  const cgst = intra ? r2(doc.tax / 2) : 0;
  const sgst = intra ? r2(doc.tax - cgst) : 0;
  const igst = intra ? 0 : r2(doc.tax);
  const title = SELLER.gstin ? 'Tax Invoice' : 'Invoice';
  const methodLabel = (m) => (m === 'razorpay' || !m ? 'Online · Razorpay' : esc(m));

  // HSN-wise tax summary (tax shared in proportion to taxable value)
  const byHsn = {};
  doc.items.forEach((it) => { byHsn[it.hsn] = (byHsn[it.hsn] || 0) + it.rate * it.qty; });
  const hsnRows = Object.entries(byHsn).map(([hsn, value]) => {
    const t = doc.taxable > 0 ? r2((doc.tax * value) / doc.taxable) : 0;
    const c = intra ? r2(t / 2) : 0;
    return `<tr><td>${hsn}</td><td class="r">${money(value)}</td>${intra
      ? `<td class="r">${r2(rate / 2)}%</td><td class="r">${money(c)}</td><td class="r">${r2(rate / 2)}%</td><td class="r">${money(t - c)}</td>`
      : `<td class="r">${rate}%</td><td class="r">${money(t)}</td>`}<td class="r b">${money(t)}</td></tr>`;
  }).join('');

  const itemRows = doc.items.map((it, i) => `
    <tr>
      <td class="c muted">${i + 1}</td>
      <td><div class="item">${esc(it.name) || '—'}</div>${it.note ? `<div class="item-note">${esc(it.note)}</div>` : ''}</td>
      <td class="c">${it.hsn}</td>
      <td class="c">${it.qty} <span class="muted">pc${it.qty > 1 ? 's' : ''}</span></td>
      <td class="r">${money(it.rate)}</td>
      <td class="r b">${money(it.rate * it.qty)}</td>
    </tr>`).join('');

  const paymentRows = doc.payments.map((p) => `
    <div class="pay-row">
      <div><div class="pay-label">${esc(p.label)}</div><div class="pay-meta">${dateTime(p.paidAt)} · ${methodLabel(p.method)}${p.ref ? ` · <span class="mono">${esc(p.ref)}</span>` : ''}</div></div>
      <div class="pay-amt">${rupees(p.amount)}</div>
    </div>`).join('');

  const fileTitle = `Invoice ${doc.invoiceNumber.replaceAll('/', '-')} · ${SELLER.name}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(fileTitle)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4; margin: 10mm; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --gold:#B8862B; --gold2:#D4AF37; --gold-soft:#FBF6EA; --ink:#17140F; --text:#3A352C; --muted:#8A8273; --line:#ECE4D3; --green:#15803D; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; color: var(--text); background: #EFEBE3; font-size: 11.5px; line-height: 1.45; }
  .sheet { position: relative; width: 210mm; min-height: 277mm; margin: 24px auto; background: #fff; padding: 0 0 6px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,.12); }
  .bar { height: 7px; background: linear-gradient(90deg, #8C6418, #D4AF37 30%, #F2D27A 50%, #D4AF37 70%, #8C6418); }
  .wm { position: absolute; top: 46%; left: 50%; transform: translate(-50%,-50%); width: 360px; height: 360px; border-radius: 50%; border: 2px solid rgba(212,175,55,.08); display: flex; align-items: center; justify-content: center; font-family: 'Playfair Display', Georgia, serif; font-size: 150px; color: rgba(212,175,55,.06); pointer-events: none; }
  .pad { padding: 0 14mm; position: relative; }
  .mono { font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-size: .95em; }
  .muted { color: var(--muted); } .b { font-weight: 700; color: var(--ink); } .r { text-align: right; } .c { text-align: center; }

  /* Header */
  .head { display: flex; justify-content: space-between; gap: 24px; padding-top: 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line); }
  .brand { display: flex; gap: 14px; align-items: flex-start; }
  .medal { width: 54px; height: 54px; border-radius: 50%; flex: none; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #D4AF37 0%, #F2C94C 50%, #C5973B 100%); color: #14110B; font-family: 'Playfair Display', Georgia, serif; font-weight: 700; font-size: 17px; box-shadow: 0 0 0 3px #fff, 0 0 0 4px rgba(212,175,55,.45); }
  .bname { font-family: 'Playfair Display', Georgia, serif; font-size: 23px; font-weight: 700; color: var(--ink); letter-spacing: 1.5px; }
  .bname span { color: var(--gold); }
  .btag { font-size: 9px; letter-spacing: 2.4px; text-transform: uppercase; color: var(--gold); font-weight: 600; margin: 3px 0 8px; }
  .baddr { font-size: 10.5px; color: var(--muted); line-height: 1.55; }
  .baddr b { color: var(--text); font-weight: 600; }
  .doc { text-align: right; flex: none; }
  .doc h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 27px; font-weight: 700; color: var(--ink); letter-spacing: 1px; text-transform: uppercase; }
  .doc .copy { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; color: var(--muted); margin-top: 2px; }
  .paid { display: inline-flex; align-items: center; gap: 6px; margin-top: 10px; padding: 5px 12px; border-radius: 999px; background: #ECFDF3; border: 1px solid #A7E3BD; color: var(--green); font-weight: 700; font-size: 10.5px; letter-spacing: 1.5px; }
  .paid i { width: 15px; height: 15px; border-radius: 50%; background: var(--green); color: #fff; font-style: normal; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; }

  /* Meta strip */
  .meta { display: grid; grid-template-columns: 1.3fr 1fr 1.15fr 1fr; margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--gold-soft); }
  .meta > div { padding: 8px 11px; border-right: 1px solid var(--line); }
  .meta > div:nth-child(4n) { border-right: 0; }
  .meta > div:nth-child(n+5) { border-top: 1px solid var(--line); }
  .k { font-size: 8.5px; text-transform: uppercase; letter-spacing: 1.6px; color: var(--muted); font-weight: 600; }
  .v { font-size: 11px; color: var(--ink); font-weight: 600; margin-top: 2px; overflow-wrap: anywhere; }
  .v.big { font-size: 12.5px; color: var(--gold); white-space: nowrap; word-break: normal; }

  /* Parties */
  .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
  .card { border: 1px solid var(--line); border-radius: 10px; padding: 9px 12px; }
  .card h3 { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
  .card .nm { font-size: 12.5px; color: var(--ink); font-weight: 700; margin-bottom: 2px; }
  .card p { font-size: 10.5px; color: var(--text); }

  /* Tables */
  table { width: 100%; border-collapse: separate; border-spacing: 0; }
  .items { margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .items th { background: #1C1912; color: #F2D27A; font-size: 8.5px; letter-spacing: 1.6px; text-transform: uppercase; font-weight: 700; padding: 9px 10px; text-align: left; }
  .items th.r { text-align: right; } .items th.c { text-align: center; }
  .items td { padding: 7px 10px; border-top: 1px solid var(--line); vertical-align: top; font-size: 11px; }
  .items tbody tr:nth-child(even) td { background: #FDFBF6; }
  .item { color: var(--ink); font-weight: 600; } .item-note { font-size: 9.5px; color: var(--muted); margin-top: 2px; }

  .lower { display: grid; grid-template-columns: minmax(0, 1.18fr) minmax(0, 1fr); gap: 12px; margin-top: 10px; align-items: start; }
  .tax { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .tax caption { caption-side: top; text-align: left; padding: 8px 11px; font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); font-weight: 700; background: var(--gold-soft); border-bottom: 1px solid var(--line); }
  .tax th { white-space: nowrap; font-size: 8px; color: var(--muted); text-transform: uppercase; letter-spacing: .6px; font-weight: 600; padding: 7px 9px; text-align: right; border-bottom: 1px solid var(--line); }
  .tax th:first-child { text-align: left; }
  .tax td { padding: 7px 9px; font-size: 10.5px; font-variant-numeric: tabular-nums; }
  .tax tfoot td { border-top: 1px solid var(--line); font-weight: 700; color: var(--ink); }

  .totals { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
  .trow { display: flex; justify-content: space-between; padding: 6px 13px; font-size: 11px; }
  .trow span:last-child { color: var(--ink); font-weight: 600; font-variant-numeric: tabular-nums; }
  .trow:first-child { padding-top: 10px; }
  .grand { margin-top: 6px; padding: 10px 13px; gap: 4px 10px; flex-wrap: wrap; background: linear-gradient(135deg, #1C1912, #2A241A); color: #fff; display: flex; justify-content: space-between; align-items: baseline; }
  .grand .gl { font-size: 9px; letter-spacing: 2px; white-space: nowrap; text-transform: uppercase; color: #F2D27A; font-weight: 700; }
  .grand .ga { margin-left: auto; font-family: 'Playfair Display', Georgia, serif; font-size: 19px; white-space: nowrap; font-weight: 700; color: #F2D27A; }
  .words { padding: 9px 13px; font-size: 10px; color: var(--text); background: var(--gold-soft); border-top: 1px solid var(--line); }
  .words b { color: var(--ink); }

  .pays { margin-top: 0; border: 1px solid var(--line); border-radius: 10px; padding: 4px 13px; }
  .pays h3 { font-size: 8.5px; letter-spacing: 2px; text-transform: uppercase; color: var(--gold); font-weight: 700; padding: 8px 0 4px; }
  .pay-row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-top: 1px dashed var(--line); }
  .pay-row:first-of-type { border-top: 0; }
  .pay-label { font-weight: 700; color: var(--ink); font-size: 11px; } .pay-meta { font-size: 9.5px; color: var(--muted); margin-top: 1px; }
  .pay-amt { font-weight: 700; color: var(--green); white-space: nowrap; }

  .foot { display: grid; grid-template-columns: 1.4fr 1fr; gap: 18px; margin-top: 12px; align-items: end; }
  .decl { font-size: 9.5px; color: var(--muted); line-height: 1.55; }
  .decl b { color: var(--text); }
  .sign { text-align: right; }
  .sign .for { font-size: 10.5px; color: var(--ink); font-weight: 700; }
  .sign .line { margin: 26px 0 4px auto; width: 170px; border-top: 1px solid var(--ink); }
  .sign .who { font-size: 9px; letter-spacing: 1.5px; text-transform: uppercase; color: var(--muted); }
  .thanks { margin-top: 12px; padding: 9px 14mm; display: flex; justify-content: space-between; align-items: center; background: var(--gold-soft); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .thanks .t1 { font-family: 'Playfair Display', Georgia, serif; font-size: 14px; color: var(--gold); font-weight: 600; }
  .thanks .t2 { font-size: 9.5px; color: var(--muted); text-align: right; }

  /* Screen-only toolbar */
  .toolbar { position: sticky; top: 0; z-index: 5; display: flex; justify-content: center; gap: 10px; padding: 10px; background: rgba(23,20,15,.92); backdrop-filter: blur(6px); }
  .toolbar button { font: 600 12px 'Plus Jakarta Sans', sans-serif; border: 0; border-radius: 10px; padding: 9px 16px; cursor: pointer; }
  .toolbar .primary { background: linear-gradient(135deg, #D4AF37, #F2C94C 50%, #C5973B); color: #17140F; }
  .toolbar .ghost { background: transparent; color: #E9E2D2; border: 1px solid rgba(255,255,255,.2); }
  .toolbar span { color: #B9B09E; font-size: 11px; align-self: center; }
  @media print { body { background: #fff; } .toolbar { display: none; } .sheet { margin: 0; width: auto; min-height: auto; box-shadow: none; } }
  tr, .card, .totals, .pays, .foot { break-inside: avoid; page-break-inside: avoid; }
  @media screen and (max-width: 820px) {
    .sheet { width: 100%; min-height: auto; margin: 0; box-shadow: none; }
    .pad { padding: 0 16px; } .thanks { padding: 10px 16px; flex-direction: column; align-items: flex-start; gap: 4px; } .thanks .t2 { text-align: left; }
    .head { flex-direction: column; } .doc { text-align: left; }
    .meta { grid-template-columns: 1fr 1fr; } .meta > div { border-right: 0; border-top: 1px solid var(--line); } .meta > div:nth-child(-n+2) { border-top: 0; }
    .parties, .lower, .foot { grid-template-columns: 1fr; } .sign { text-align: left; } .sign .line { margin-left: 0; }
    .items, .tax { display: block; overflow-x: auto; } .toolbar span { display: none; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <button class="primary" onclick="window.print()">Download PDF / Print</button>
    <button class="ghost" onclick="window.close()">Close</button>
    <span>Choose “Save as PDF” as the destination.</span>
  </div>

  <div class="sheet">
    <div class="bar"></div>
    <div class="wm">MB</div>
    <div class="pad">
      <div class="head">
        <div class="brand">
          <div class="medal">MB</div>
          <div>
            <div class="bname">M.B. <span>JEWELLERS</span></div>
            <div class="btag">${esc(SELLER.tagline)}</div>
            <div class="baddr">
              ${SELLER.address.map(esc).join('<br/>')}<br/>
              ${esc(SELLER.phone)} · ${esc(SELLER.email)}<br/>
              ${SELLER.gstin ? `<b>GSTIN:</b> <span class="mono">${esc(SELLER.gstin)}</span> · ` : ''}<b>State:</b> ${SELLER.state} (Code ${SELLER.stateCode})
            </div>
          </div>
        </div>
        <div class="doc">
          <h1>${title}</h1>
          <div class="copy">Original for recipient</div>
          <div class="paid"><i>✓</i> PAID</div>
        </div>
      </div>

      <div class="meta">
        <div><div class="k">Invoice No.</div><div class="v big mono">${esc(doc.invoiceNumber)}</div></div>
        <div><div class="k">Invoice Date</div><div class="v">${dateLong(doc.invoiceDate)}</div></div>
        <div><div class="k">${doc.kind === 'custom' ? 'Custom Order' : 'Order No.'}</div><div class="v mono">${esc(doc.orderId)}</div></div>
        <div><div class="k">Order Date</div><div class="v">${dateLong(doc.orderDate)}</div></div>
        <div><div class="k">Place of Supply</div><div class="v">${esc(pos.name)}${pos.code ? ` (${pos.code})` : ''}</div></div>
        <div><div class="k">Payment</div><div class="v">Prepaid · Online</div></div>
        <div><div class="k">Supply Type</div><div class="v">${intra ? 'Intra-state' : 'Inter-state'} <span class="muted" style="font-weight:500">· ${intra ? 'CGST + SGST' : 'IGST'}</span></div></div>
        <div><div class="k">Reverse Charge</div><div class="v">No</div></div>
      </div>

      <div class="parties">
        <div class="card">
          <h3>Billed To</h3>
          <div class="nm">${esc(doc.customer.name) || a.fullName || '—'}</div>
          <p>${[esc(doc.customer.email), a.phone || esc(doc.customer.phone)].filter(Boolean).join(' · ') || '—'}</p>
          <p class="muted" style="margin-top:3px">Unregistered customer (B2C)</p>
        </div>
        <div class="card">
          <h3>Shipped To</h3>
          <div class="nm">${a.fullName || esc(doc.customer.name) || '—'}</div>
          <p>${[a.addressLine1, a.addressLine2].filter(Boolean).join(', ')}</p>
          <p>${[a.city, a.state].filter(Boolean).join(', ')}${a.pincode ? ` — <b>${a.pincode}</b>` : ''}, ${a.country || 'India'}</p>
          ${a.phone ? `<p>Phone: ${a.phone}</p>` : ''}
        </div>
      </div>

      <table class="items">
        <thead><tr><th class="c" style="width:28px">#</th><th>Description of goods</th><th class="c" style="width:58px">HSN</th><th class="c" style="width:58px">Qty</th><th class="r" style="width:96px">Rate (₹)</th><th class="r" style="width:110px">Taxable value (₹)</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <table class="tax" style="margin-top:10px">
            <caption>Tax summary · HSN-wise</caption>
            <thead><tr><th>HSN</th><th>Taxable ₹</th>${intra ? '<th>CGST %</th><th>CGST ₹</th><th>SGST %</th><th>SGST ₹</th>' : '<th>IGST %</th><th>IGST ₹</th>'}<th>Tax ₹</th></tr></thead>
            <tbody>${hsnRows}</tbody>
            <tfoot><tr><td>Total</td><td class="r">${money(doc.taxable)}</td>${intra ? `<td></td><td class="r">${money(cgst)}</td><td></td><td class="r">${money(sgst)}</td>` : `<td></td><td class="r">${money(igst)}</td>`}<td class="r">${money(doc.tax)}</td></tr></tfoot>
          </table>

      <div class="lower">
        <div>
          ${doc.payments.length ? `<div class="pays"><h3>Payments received</h3>${paymentRows}</div>` : ''}
        </div>

        <div class="totals">
          <div class="trow"><span>Taxable value</span><span>${rupees(doc.taxable)}</span></div>
          ${intra
            ? `<div class="trow"><span>CGST @ ${r2(rate / 2)}%</span><span>${rupees(cgst)}</span></div><div class="trow"><span>SGST @ ${r2(rate / 2)}%</span><span>${rupees(sgst)}</span></div>`
            : `<div class="trow"><span>IGST @ ${rate}%</span><span>${rupees(igst)}</span></div>`}
          <div class="trow"><span>Shipping &amp; delivery${a.pincode ? ` (PIN ${a.pincode})` : ''}</span><span>${doc.shipping > 0 ? rupees(doc.shipping) : 'Free'}</span></div>
          <div class="grand"><span class="gl">Grand total</span><span class="ga">${rupees(doc.total)}</span></div>
          <div class="words"><b>In words:</b> ${amountInWords(doc.total)}</div>
        </div>
      </div>

      <div class="foot">
        <div class="decl">
          <b>Declaration:</b> We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.
          Prices of goods exclude GST; GST is charged as shown above.<br/>This is a computer-generated invoice and does not require a physical signature.
        </div>
        <div class="sign">
          <div class="for">For ${esc(SELLER.name)}</div>
          <div class="line"></div>
          <div class="who">Authorised signatory</div>
        </div>
      </div>
    </div>

    <div class="thanks">
      <div class="t1">Thank you for choosing M.B. Jewellers ✦</div>
      <div class="t2">Questions about this invoice?<br/>${esc(SELLER.email)} · ${esc(SELLER.phone)}</div>
    </div>
  </div>

  <script>
    // Print once the web fonts are ready so the PDF uses the brand typefaces
    window.addEventListener('load', function () {
      var go = function () { setTimeout(function () { window.print(); }, 150); };
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(go); else go();
    });
  </script>
</body>
</html>`;
}

/** Open the invoice in a new tab (falls back to a hidden frame when pop-ups are blocked). */
function openInvoice(doc) {
  if (!doc.paid) return false;
  const html = renderInvoice(doc);
  const win = window.open('', '_blank');
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    return true;
  }
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.contentDocument.open();
  frame.contentDocument.write(html.replace(/<script>[\s\S]*?<\/script>/, ''));
  frame.contentDocument.close();
  setTimeout(() => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => frame.remove(), 60000);
  }, 600);
  return true;
}

export function downloadInvoice(order) {
  return openInvoice(fromOrder(order));
}

export function downloadCustomOrderInvoice(order) {
  return openInvoice(fromCustomOrder(order));
}

// Exposed for tests
export const __invoiceInternals = { amountInWords, placeOfSupply, fromOrder, fromCustomOrder, renderInvoice };
