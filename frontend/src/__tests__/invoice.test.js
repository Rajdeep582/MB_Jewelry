import { describe, it, expect } from 'vitest';
import { __invoiceInternals } from '../utils/invoice';

const { amountInWords, placeOfSupply, fromOrder, fromCustomOrder, fromAdvanceReceipt, renderInvoice } = __invoiceInternals;

const address = { fullName: 'Asha Roy', phone: '9876543210', addressLine1: '12 Lake Rd', city: 'Kolkata', state: 'West Bengal', pincode: '700131' };
const order = {
  _id: '6a1b2c3d4e5f6a7b8c9d0e1f', orderId: 'ORD-1A2B3C4D', createdAt: '2026-10-20T10:00:00Z', user: { name: 'Asha Roy', email: 'asha@example.com' },
  shippingAddress: address, items: [{ name: 'Lotus Gold Ring', price: 67200, quantity: 1 }],
  itemsPrice: 67200, taxPrice: 2016, shippingPrice: 100, totalAmount: 69316,
  payment: { status: 'paid', paidAt: '2026-10-20T10:05:00Z', razorpayPaymentId: 'pay_X' }, invoiceNumber: 'MBJ/26-27/00001',
};
const custom = {
  _id: '6a1b2c3d4e5f6a7b8c9d0e2f', customOrderId: 'CUS-1A2B3C4D', type: 'Ring', material: 'Gold', purity: '22K', weight: '6', createdAt: '2026-10-01T10:00:00Z',
  user: { name: 'Asha Roy' }, shippingAddress: address, quoteAmount: 100000, taxAmount: 3000, shippingAmount: 100, totalAmount: 103100,
  advanceAmount: 72170, finalAmount: 30930,
  advancePayment: { status: 'paid', paidAt: '2026-10-02T10:00:00Z', razorpayPaymentId: 'pay_A' },
  finalPayment: { status: 'pending' }, advanceReceiptNumber: 'MBRV/26-27/00001', advanceReceiptDate: '2026-10-02T10:00:00Z',
};

describe('amount in words / place of supply', () => {
  it('writes Indian-system amounts', () => {
    expect(amountInWords(69316)).toMatch(/Sixty[- ]Nine Thousand Three Hundred Sixteen/i);
    expect(amountInWords(103100)).toMatch(/One Lakh Three Thousand One Hundred/i);
  });
  it('maps West Bengal to state code 19', () => {
    expect(placeOfSupply('West Bengal').code).toBe('19');
    expect(placeOfSupply('wb').code).toBe('19');
  });
});

describe('shop order invoice', () => {
  it('shows the server invoice number, intra-state CGST+SGST and the total', () => {
    const html = renderInvoice(fromOrder(order));
    expect(html).toContain('MBJ/26-27/00001');
    expect(html).toMatch(/CGST/);
    expect(html).toMatch(/SGST/);
    expect(html).toContain('69,316.00');
    expect(html).toMatch(/PAID/);
  });
  it('is not issued for an unpaid order', () => {
    expect(fromOrder({ ...order, payment: { status: 'pending' }, invoiceNumber: undefined }).paid).toBe(false);
  });
  it('a cancelled + refunded order is clearly marked', () => {
    const html = renderInvoice(fromOrder({ ...order, orderStatus: 'cancelled', cancellation: { refundStatus: 'refunded' } }));
    expect(html).toMatch(/CANCELLED · REFUNDED/);
  });
  it('escapes customer text', () => {
    const html = renderInvoice(fromOrder({ ...order, user: { name: '<img src=x onerror=alert(1)>' } }));
    expect(html).not.toContain('<img src=x');
  });
});

describe('custom order: advance receipt + final invoice', () => {
  it('advance receipt voucher: own number, advance received, balance due, no tax table', () => {
    const doc = fromAdvanceReceipt(custom);
    expect(doc.paid).toBe(true);
    const html = renderInvoice(doc);
    expect(html).toMatch(/Receipt Voucher/);
    expect(html).toContain('MBRV/26-27/00001');
    expect(html).toMatch(/ADVANCE PAID/);
    expect(html).toContain('72,170.00');
    expect(html).toContain('30,930.00');
    expect(html).not.toMatch(/Tax summary/);
  });
  it('no receipt before the advance is paid', () => {
    expect(fromAdvanceReceipt({ ...custom, advancePayment: { status: 'pending' } }).paid).toBe(false);
  });
  it('final tax invoice lists both payments once fully paid', () => {
    const paid = { ...custom, finalPayment: { status: 'paid', paidAt: '2026-10-10T10:00:00Z', razorpayPaymentId: 'pay_F' }, invoiceNumber: 'MBJ/26-27/00002' };
    const doc = fromCustomOrder(paid);
    expect(doc.paid).toBe(true);
    const html = renderInvoice(doc);
    expect(html).toContain('MBJ/26-27/00002');
    expect(html).toMatch(/Advance \(70%\)/);
    expect(html).toMatch(/Balance \(30%\)/);
    expect(html).toContain('1,03,100.00');
  });
  it('invoice is not available while only the advance is paid', () => {
    expect(fromCustomOrder(custom).paid).toBe(false);
  });
});
