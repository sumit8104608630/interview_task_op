import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { hotelApi } from '../../api/hotelApi';
import { formatCurrency, formatNights } from '../../utils/formatters';
import {
  getTodayIsoString,
  getFutureDateIsoString,
  validateStayDates,
  formatDisplayDate,
} from '../../utils/dateUtils';
import { setDraftBooking, setBookingQuote } from '../../features/booking/bookingSlice';
import Spinner from '../common/Spinner';
import { Calendar, CheckCircle2, XCircle, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const RoomAvailabilityQuote = ({
  hotel,
  roomType,
  defaultCheckIn = '',
  defaultCheckOut = '',
  defaultRooms = 1,
}) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [checkIn, setCheckIn] = useState(
    defaultCheckIn || getFutureDateIsoString(getTodayIsoString(), 7)
  );
  const [checkOut, setCheckOut] = useState(
    defaultCheckOut || getFutureDateIsoString(getTodayIsoString(), 10)
  );
  const [rooms, setRooms] = useState(defaultRooms || 1);

  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');

  // Check availability whenever dates or rooms change
  useEffect(() => {
    let isMounted = true;

    const checkAvailability = async () => {
      if (!roomType?.id || !checkIn || !checkOut) return;

      const dateValidation = validateStayDates(checkIn, checkOut);
      if (!dateValidation.valid) {
        setError(dateValidation.error);
        setQuote(null);
        return;
      }

      try {
        setLoading(true);
        setError('');

        const res = await hotelApi.checkRoomAvailability({
          roomTypeId: roomType.id,
          checkIn,
          checkOut,
          rooms,
        });

        if (isMounted && res?.data) {
          setQuote(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.code === 'ROOM_UNAVAILABLE'
              ? 'This room category has insufficient inventory for the selected stay dates.'
              : err.message || 'Unable to check live inventory at this time.'
          );
          setQuote(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    checkAvailability();

    return () => {
      isMounted = false;
    };
  }, [roomType?.id, checkIn, checkOut, rooms]);

  const handleProceedToCheckout = () => {
    if (!quote) return;

    // Save authoritative booking parameters to Redux bookingSlice
    dispatch(
      setDraftBooking({
        hotel: {
          id: hotel.id,
          name: hotel.name,
          slug: hotel.slug,
          city: hotel.location?.city || '',
          state: hotel.location?.state || '',
        },
        roomType: {
          id: roomType.id,
          name: roomType.name,
          description: roomType.description,
          maxGuests: roomType.maxGuests || 2,
          pricePerNight: roomType.pricePerNight,
          currency: roomType.currency || 'INR',
        },
        checkIn,
        checkOut,
        rooms,
        quote: {
          nights: quote.nights,
          totalAmount: quote.totalAmount,
          averageNightlyRate: quote.averageNightlyRate,
          currency: quote.currency || roomType.currency || 'INR',
        },
      })
    );

    navigate('/checkout');
  };

  const todayStr = getTodayIsoString();
  const minCheckOutStr = checkIn ? getFutureDateIsoString(checkIn, 1) : todayStr;

  return (
    <div className="bg-white border border-sand rounded p-6 sm:p-8 shadow-architectural space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-sand/60 gap-3">
        <div>
          <span className="font-sans text-[10px] uppercase tracking-luxury text-champagne font-semibold block">
            Real-Time Inventory Check
          </span>
          <h4 className="font-serif text-xl text-charcoal">
            Availability & Authoritative Quote
          </h4>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#38765B] font-medium">
          <ShieldCheck className="w-4 h-4" />
          <span>Direct Inventory Verification</span>
        </div>
      </div>

      {/* Date & Rooms Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Check-In */}
        <div>
          <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
            Check-In
          </label>
          <input
            type="date"
            min={todayStr}
            value={checkIn}
            onChange={(e) => {
              setCheckIn(e.target.value);
              if (e.target.value >= checkOut) {
                setCheckOut(getFutureDateIsoString(e.target.value, 2));
              }
            }}
            className="w-full bg-[#f6f3ee] border border-sand rounded px-3 py-2 text-xs font-mono text-charcoal focus:border-champagne focus:outline-none"
          />
        </div>

        {/* Check-Out */}
        <div>
          <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
            Check-Out
          </label>
          <input
            type="date"
            min={minCheckOutStr}
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="w-full bg-[#f6f3ee] border border-sand rounded px-3 py-2 text-xs font-mono text-charcoal focus:border-champagne focus:outline-none"
          />
        </div>

        {/* Room Quantity */}
        <div>
          <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
            Rooms
          </label>
          <select
            value={rooms}
            onChange={(e) => setRooms(Number(e.target.value))}
            className="w-full bg-[#f6f3ee] border border-sand rounded px-3 py-2 text-xs font-medium text-charcoal focus:border-champagne focus:outline-none cursor-pointer"
          >
            {[1, 2, 3, 4].map((num) => (
              <option key={num} value={num}>
                {num} {num === 1 ? 'Room' : 'Rooms'}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading Indicator */}
      {loading && (
        <div className="p-6 bg-[#f6f3ee] rounded flex items-center justify-center gap-3">
          <Spinner size={20} color="champagne" />
          <span className="text-xs uppercase tracking-luxury text-warm-grey font-medium">
            Verifying inventory with backend...
          </span>
        </div>
      )}

      {/* Error / Sold Out Feedback */}
      {!loading && error && (
        <div className="p-4 bg-error-container/20 border border-error/30 rounded flex items-start gap-3">
          <XCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <div>
            <h5 className="font-serif text-sm font-semibold text-charcoal">
              Unavailable for Selected Dates
            </h5>
            <p className="text-xs text-on-surface-variant font-sans mt-0.5 leading-relaxed">
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Quote Display & Nightly Breakdown */}
      {!loading && quote && (
        <div className="p-6 bg-[#f6f3ee] border border-sand/70 rounded space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-sand/60 gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs text-[#38765B] font-semibold uppercase tracking-luxury mb-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Available for {formatNights(quote.nights)}</span>
              </div>
              <p className="text-xs text-warm-grey">
                {formatDisplayDate(checkIn)} — {formatDisplayDate(checkOut)}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="block text-[10px] uppercase tracking-luxury text-warm-grey">
                Total Stay Quote
              </span>
              <span className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal">
                {formatCurrency(quote.totalAmount, quote.currency || roomType.currency)}
              </span>
            </div>
          </div>

          {/* Daily Inventory Pills */}
          {quote.nightlyAvailability && quote.nightlyAvailability.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey font-semibold">
                Nightly Inventory Status
              </span>
              <div className="flex flex-wrap gap-2">
                {quote.nightlyAvailability.map((night) => (
                  <span
                    key={night.date}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-white border border-sand text-[11px] font-mono"
                  >
                    <span className="text-charcoal font-medium">{night.date}</span>
                    <span className="text-[#38765B] font-semibold text-[10px]">AVAILABLE</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Checkout CTA */}
          <div className="pt-2">
            <button
              onClick={handleProceedToCheckout}
              className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <span>Reserve Suite Now</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomAvailabilityQuote;
