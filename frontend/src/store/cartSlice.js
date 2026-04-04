import { createSlice } from '@reduxjs/toolkit';

const cartSlice = createSlice({
  name: 'cart',
  initialState: {
    items: [],
    isOpen: false,
  },
  reducers: {
    addToCart: (state, { payload }) => {
      const existing = state.items.find((i) => i._id === payload._id);
      if (existing) {
        // Cap at available stock
        const newQty = existing.quantity + (payload.quantity || 1);
        existing.quantity = Math.min(newQty, payload.stock ?? existing.stock ?? Infinity);
      } else {
        state.items.push({ ...payload, quantity: payload.quantity || 1 });
      }
    },

    removeFromCart: (state, { payload }) => {
      state.items = state.items.filter((i) => i._id !== payload);
    },

    updateQuantity: (state, { payload: { id, quantity } }) => {
      if (quantity <= 0) {
        // Quantity 0 or below → remove item
        state.items = state.items.filter((i) => i._id !== id);
      } else {
        const item = state.items.find((i) => i._id === id);
        if (item) {
          item.quantity = Math.min(quantity, item.stock ?? Infinity);
        }
      }
    },

    clearCart: (state) => {
      state.items = [];
    },

    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
    openCart: (state) => {
      state.isOpen = true;
    },
    closeCart: (state) => {
      state.isOpen = false;
    },
  },
});

export const {
  addToCart, removeFromCart, updateQuantity, clearCart, toggleCart, openCart, closeCart,
} = cartSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────
export const selectCartItems = (state) => state.cart.items;
export const selectCartCount = (state) =>
  state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectCartTotal = (state) =>
  state.cart.items.reduce(
    (sum, item) => sum + (item.discountedPrice ?? item.price) * item.quantity,
    0
  );
export const selectCartOpen = (state) => state.cart.isOpen;

export default cartSlice.reducer;
