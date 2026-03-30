import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import cartReducer from './cartSlice';
import productReducer from './productSlice';
import uiReducer from './uiSlice';

// Load cart from localStorage
const loadCartState = () => {
  try {
    const serialized = localStorage.getItem('mb_jewelry_cart');
    return serialized ? JSON.parse(serialized) : undefined;
  } catch {
    return undefined;
  }
};

const preloadedState = {
  cart: loadCartState(),
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

// Persist cart to localStorage on every state change
let prevCart = store.getState().cart;
store.subscribe(() => {
  const nextCart = store.getState().cart;
  if (nextCart !== prevCart) {
    prevCart = nextCart;
    try {
      localStorage.setItem('mb_jewelry_cart', JSON.stringify(nextCart));
    } catch {}
  }
});

export default store;
