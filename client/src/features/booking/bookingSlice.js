import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  draftBooking: {
    hotel: null,
    roomType: null,
    checkIn: '',
    checkOut: '',
    rooms: 1,
    guests: 1,
    guest: {
      name: '',
      email: '',
      phone: '',
    },
    quote: null,
  },
  lastConfirmedBooking: null,
};

export const bookingSlice = createSlice({
  name: 'booking',
  initialState,
  reducers: {
    setDraftBooking: (state, action) => {
      state.draftBooking = {
        ...state.draftBooking,
        ...action.payload,
      };
    },
    updateDraftDates: (state, action) => {
      const { checkIn, checkOut } = action.payload;
      state.draftBooking.checkIn = checkIn;
      state.draftBooking.checkOut = checkOut;
    },
    updateGuestDetails: (state, action) => {
      state.draftBooking.guest = {
        ...state.draftBooking.guest,
        ...action.payload,
      };
    },
    setBookingQuote: (state, action) => {
      state.draftBooking.quote = action.payload;
    },
    setLastConfirmedBooking: (state, action) => {
      state.lastConfirmedBooking = action.payload;
    },
    clearDraftBooking: (state) => {
      state.draftBooking = initialState.draftBooking;
    },
  },
});

export const {
  setDraftBooking,
  updateDraftDates,
  updateGuestDetails,
  setBookingQuote,
  setLastConfirmedBooking,
  clearDraftBooking,
} = bookingSlice.actions;

export const selectDraftBooking = (state) => state.booking.draftBooking;
export const selectLastConfirmedBooking = (state) => state.booking.lastConfirmedBooking;

export default bookingSlice.reducer;
