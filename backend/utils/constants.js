/**
 * ORDER_STATUSES — canonical lifecycle states for CustomOrder.
 * ORDER MATTERS: these values are used for index-based forward-only transition validation
 * in customOrderController.js. Adding a new state here requires updating the transition map.
 *
 * Flow: pending → quoted → advance_paid → confirmed → ready_to_ship → shipped → delivered
 *                                                                              ↘ cancelled (from most states)
 */
const ORDER_STATUSES = {
  PENDING:       'pending',
  QUOTED:        'quoted',
  ADVANCE_PAID:  'advance_paid',
  CONFIRMED:     'confirmed',       // "In Production" in UI
  READY_TO_SHIP: 'ready_to_ship',
  SHIPPED:       'shipped',
  DELIVERED:     'delivered',
  CANCELLED:     'cancelled',
};

/**
 * PAYMENT_STATUSES — possible states for payment.status on Order / advancePayment / finalPayment on CustomOrder.
 * IMPORTANT: 'paid' status may ONLY be set by the Razorpay webhook handler.
 * No controller may directly assign 'paid' via a client-supplied body field.
 */
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
