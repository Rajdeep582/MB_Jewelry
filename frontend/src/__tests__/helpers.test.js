import { describe, it, expect } from 'vitest';
import { formatPrice, discountPercent, formatTrackingNumber, REQUIRED_ADDR_FIELDS } from '../utils/helpers';
import { ADMIN_BASE, ADMIN_LOGIN } from '../utils/adminPaths';
import { DELIVERY_BASE } from '../utils/deliveryPaths';

describe('helpers', () => {
  it('formats rupees the Indian way', () => {
    expect(formatPrice(103100)).toMatch(/1,03,100/);
    expect(formatPrice(103100)).toMatch(/₹/);
  });
  it('discount percent', () => {
    expect(discountPercent(1000, 750)).toBe(25);
  });
  it('tracking number is shown in a readable form', () => {
    expect(typeof formatTrackingNumber('a1b2c3d4-0000-4000-8000-000000000001')).toBe('string');
  });
  it('address requires the delivery fields', () => {
    expect(REQUIRED_ADDR_FIELDS).toEqual(expect.arrayContaining(['fullName', 'phone', 'pincode']));
  });
});

describe('staff portal paths', () => {
  it('fall back to the current unlisted paths when no env var is set', () => {
    expect(ADMIN_BASE).toMatch(/^\/[A-Za-z0-9_-]{6,64}$/);
    expect(ADMIN_LOGIN).toBe(`${ADMIN_BASE}/login`);
    expect(DELIVERY_BASE).toMatch(/^\/[A-Za-z0-9_-]{6,64}$/);
    expect(ADMIN_BASE).not.toBe('/admin');
  });
});
