import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import cartReducer from './cartSlice';
import productReducer from './productSlice';
import uiReducer from './uiSlice';

// ─── Cart Persistence ─────────────────────────────────────────────────────────
// Only persist cart items — NOT isOpen (drawer state should reset on every visit)

const CART_STORAGE_KEY = 'mb_jewelry_cart';

const loadCartState = () => {
  try {
    const serialized = localStorage.getItem(CART_STORAGE_KEY);
    if (!serialized) return undefined;
    const parsed = JSON.parse(serialized);
    // Validate shape before injecting into Redux
    if (!Array.isArray(parsed?.items)) {
      localStorage.removeItem(CART_STORAGE_KEY);
      return undefined;
    }
    return { items: parsed.items, isOpen: false }; // always reset isOpen
  } catch {
    // Corrupt data — clear it
    localStorage.removeItem(CART_STORAGE_KEY);
    return undefined;
  }
};

const preloadedState = {
  cart: loadCartState() ?? { items: [], isOpen: false },
};

export const store = configureStore({
  reducer: {
    auth: authReducer,
    cart: cartReducer,
    products: productReducer,
    ui: uiReducer,
  },
  preloadedState,
});

// ─── Subscribe: persist only cart items (not isOpen or any transient UI state) ─
let prevCartItems = store.getState().cart.items;

store.subscribe(() => {
  const nextCartItems = store.getState().cart.items;
  if (nextCartItems !== prevCartItems) {
    prevCartItems = nextCartItems;
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items: nextCartItems }));
    } catch {
      // Storage quota — silently ignore
    }
  }
});

export default store;
