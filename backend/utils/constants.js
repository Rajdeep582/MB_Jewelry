const ORDER_STATUSES = {
  PENDING: 'pending',
  QUOTED: 'quoted',
  ADVANCE_PAID: 'advance_paid',
  IN_PRODUCTION: 'in_production',
  FINAL_PAYMENT_PENDING: 'final_payment_pending',
  FINAL_PAYMENT_PAID: 'final_payment_paid',
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};

const PAYMENT_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

module.exports = {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
};
