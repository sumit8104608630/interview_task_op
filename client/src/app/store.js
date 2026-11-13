import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';
import uiReducer from '../features/ui/uiSlice';
import bookingReducer from '../features/booking/bookingSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    ui: uiReducer,
    booking: bookingReducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});

export default store;
