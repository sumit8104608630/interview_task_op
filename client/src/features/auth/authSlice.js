import { createSlice } from '@reduxjs/toolkit';
import { setCsrfToken } from '../../api/axiosClient';

const initialState = {
  customer: null,
  isAuthenticated: false,
  isInitialized: false, // Tracks whether initial GET /api/auth/me has completed
  loading: false,
  error: null,
  csrfToken: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { customer, csrfToken } = action.payload;
      state.customer = customer || null;
      state.isAuthenticated = !!customer;
      state.loading = false;
      state.error = null;
      if (csrfToken) {
        state.csrfToken = csrfToken;
        setCsrfToken(csrfToken);
      }
    },
    clearCredentials: (state) => {
      state.customer = null;
      state.isAuthenticated = false;
      state.csrfToken = null;
      state.loading = false;
      state.error = null;
      setCsrfToken(null);
    },
    setInitialized: (state, action) => {
      state.isInitialized = action.payload !== undefined ? action.payload : true;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setCredentials,
  clearCredentials,
  setInitialized,
  setLoading,
  setError,
} = authSlice.actions;

export const selectAuth = (state) => state.auth;
export const selectCustomer = (state) => state.auth.customer;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsAuthInitialized = (state) => state.auth.isInitialized;

export default authSlice.reducer;
