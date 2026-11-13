import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  mobileMenuOpen: false,
  activeModal: null, // e.g. 'cancellation-otp'
  toasts: [],
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleMobileMenu: (state) => {
      state.mobileMenuOpen = !state.mobileMenuOpen;
    },
    setMobileMenuOpen: (state, action) => {
      state.mobileMenuOpen = action.payload;
    },
    openModal: (state, action) => {
      state.activeModal = action.payload;
    },
    closeModal: (state) => {
      state.activeModal = null;
    },
    addToast: (state, action) => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      state.toasts.push({
        id,
        type: action.payload.type || 'info', // 'success' | 'error' | 'info' | 'warning'
        title: action.payload.title || null,
        message: action.payload.message,
        duration: action.payload.duration || 4500,
      });
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  toggleMobileMenu,
  setMobileMenuOpen,
  openModal,
  closeModal,
  addToast,
  removeToast,
} = uiSlice.actions;

export const selectUi = (state) => state.ui;
export const selectToasts = (state) => state.ui.toasts;
export const selectMobileMenuOpen = (state) => state.ui.mobileMenuOpen;

export default uiSlice.reducer;
