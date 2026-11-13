import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { selectDraftBooking, setLastConfirmedBooking, clearDraftBooking } from '../../features/booking/bookingSlice';
import { selectCustomer, selectIsAuthenticated } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import { bookingApi } from '../../api/bookingApi';
import { paymentApi } from '../../api/paymentApi';
import { hotelApi } from '../../api/hotelApi';
import { loadRazorpayScript } from '../../utils/loadRazorpay';
import { guestCheckoutSchema } from '../../features/booking/bookingSchemas';
import { formatCurrency, formatNights } from '../../utils/formatters';
import {
  formatDisplayDate,
  calculateNights,
  getTodayIsoString,
  getFutureDateIsoString,
  validateStayDates,
} from '../../utils/dateUtils';
import Spinner from '../../components/common/Spinner';
import {
  ShieldCheck,
  User,
  Mail,
  Phone,
  BedDouble,
  MapPin,
  Calendar,
  AlertCircle,
  ArrowRight,
  Compass,
  CheckCircle2,
  Lock,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

export const CheckoutPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const draftBooking = useSelector(selectDraftBooking);
  const customer = useSelector(selectCustomer);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  // Fallback dates if user arrived directly
  const [checkIn, setCheckIn] = useState(
    draftBooking?.checkIn || getFutureDateIsoString(getTodayIsoString(), 7)
  );
  const [checkOut, setCheckOut] = useState(
    draftBooking?.checkOut || getFutureDateIsoString(getTodayIsoString(), 10)
  );
  const [rooms, setRooms] = useState(draftBooking?.rooms || 1);

  // Authoritative quote state
  const [quote, setQuote] = useState(draftBooking?.quote || null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // Submission & payment state
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [submissionError, setSubmissionError] = useState('');

  // Preserved pending booking context (allows retry without duplicate creation)
  const [pendingBooking, setPendingBooking] = useState(null);

  // Stable Idempotency Key for this checkout attempt
  const idempotencyKey = useMemo(() => {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'idemp-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }, []);

  // Form setup
  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(guestCheckoutSchema),
    defaultValues: {
      guestName: customer?.fullName || draftBooking?.guest?.name || '',
      guestEmail: customer?.email || draftBooking?.guest?.email || '',
      guestPhone: draftBooking?.guest?.phone || '',
    },
  });

  // Sync customer details when authenticated
  useEffect(() => {
    if (isAuthenticated && customer) {
      if (customer.fullName) setValue('guestName', customer.fullName);
      if (customer.email) setValue('guestEmail', customer.email);
    }
  }, [isAuthenticated, customer, setValue]);

  // Fetch or re-verify authoritative quote whenever roomTypeId, dates or rooms change
  useEffect(() => {
    let isMounted = true;

    const verifyQuote = async () => {
      if (!draftBooking?.roomType?.id || !checkIn || !checkOut) return;

      const dateVal = validateStayDates(checkIn, checkOut);
      if (!dateVal.valid) {
        setQuoteError(dateVal.error);
        setQuote(null);
        return;
      }

      try {
        setQuoteLoading(true);
        setQuoteError('');

        const res = await hotelApi.checkRoomAvailability({
          roomTypeId: draftBooking.roomType.id,
          checkIn,
          checkOut,
          rooms,
        });

        if (isMounted && res?.data) {
          setQuote(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setQuoteError(
            err.code === 'ROOM_UNAVAILABLE'
              ? 'This suite category is no longer available for your stay dates.'
              : err.message || 'Unable to confirm live room pricing.'
          );
          setQuote(null);
        }
      } finally {
        if (isMounted) setQuoteLoading(false);
      }
    };

    verifyQuote();

    return () => {
      isMounted = false;
    };
  }, [draftBooking?.roomType?.id, checkIn, checkOut, rooms]);

  /**
   * Opens the Razorpay Standard Checkout modal for a pending booking
   */
  const initiateRazorpayCheckout = async (targetBookingReference, guestInfo) => {
    // 1. Ensure Razorpay Checkout script is loaded
    const scriptLoaded = await loadRazorpayScript();
    if (!scriptLoaded || !window.Razorpay) {
      throw new Error('Unable to initialize payment gateway. Please check your internet connection.');
    }

    // 2. Call backend order creation endpoint
    const orderRes = await paymentApi.createOrder({
      bookingReference: targetBookingReference,
      guestEmail: guestInfo.email,
    });

    if (!orderRes?.data) {
      throw new Error('Could not establish secure payment order with gateway.');
    }

    const orderData = orderRes.data;

    // 3. Configure Razorpay Standard Checkout options
    return new Promise((resolve, reject) => {
      const options = {
        key: orderData.keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency || 'INR',
        name: orderData.hotelName || 'LuxeStay Sanctuaries',
        description: `${orderData.roomName || 'Sanctuary Suite'} (${orderData.bookingReference})`,
        image: '/favicon.svg',
        order_id: orderData.razorpayOrderId,
        prefill: {
          name: orderData.guestName || guestInfo.name || '',
          email: orderData.guestEmail || guestInfo.email || '',
          contact: orderData.guestPhone || guestInfo.phone || '',
        },
        notes: {
          bookingReference: orderData.bookingReference,
        },
        theme: {
          color: '#1a1a1a', // Luxury charcoal brand color
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
            setVerifying(false);
            dispatch(
              addToast({
                type: 'info',
                title: 'Payment Incomplete',
                message:
                  'Payment window was closed. Your room inventory is held for 15 minutes. You may retry payment below.',
                duration: 6500,
              })
            );
            resolve({ dismissed: true });
          },
        },
        handler: async (response) => {
          try {
            setVerifying(true);
            setSubmitting(true);

            // Cryptographic server-side verification: never trust frontend alone
            const verifyRes = await paymentApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes?.data?.status === 'CONFIRMED' || verifyRes?.success) {
              const confirmedPayload = {
                bookingReference: orderData.bookingReference,
                status: 'CONFIRMED',
                paymentId: response.razorpay_payment_id,
                totalAmount: orderData.amount / 100,
                currency: orderData.currency,
                hotelName: orderData.hotelName,
                roomName: orderData.roomName,
                hotel: draftBooking?.hotel,
                roomType: draftBooking?.roomType,
                checkIn,
                checkOut,
                nights: calculateNights(checkIn, checkOut),
                roomsCount: rooms,
                guest: {
                  fullName: guestInfo.name,
                  email: guestInfo.email,
                  phone: guestInfo.phone,
                },
              };

              dispatch(setLastConfirmedBooking(confirmedPayload));
              dispatch(clearDraftBooking());

              dispatch(
                addToast({
                  type: 'success',
                  title: 'Payment Verified & Booking Guaranteed',
                  message: `Payment ID: ${response.razorpay_payment_id}. Your reservation is confirmed.`,
                  duration: 7000,
                })
              );

              navigate(`/booking/confirmation/${orderData.bookingReference}`, {
                replace: true,
              });
              resolve({ verified: true });
            } else {
              throw new Error('Payment verification could not be confirmed by the server.');
            }
          } catch (verifyError) {
            setSubmitting(false);
            setVerifying(false);
            setSubmissionError(
              verifyError.message || 'Payment signature verification failed. Please contact support.'
            );
            reject(verifyError);
          }
        },
      };

      const rzpInstance = new window.Razorpay(options);

      rzpInstance.on('payment.failed', (failResponse) => {
        setSubmitting(false);
        setVerifying(false);
        const failMsg =
          failResponse.error?.description ||
          failResponse.error?.reason ||
          'Payment was declined. Your reservation is still held; you may retry with another card or UPI.';
        setSubmissionError(failMsg);
        dispatch(
          addToast({
            type: 'error',
            title: 'Payment Declined',
            message: failMsg,
            duration: 7000,
          })
        );
        resolve({ failed: true, error: failMsg });
      });

      rzpInstance.open();
    });
  };

  /**
   * Submit Final Booking:
   * 1. Create Pending Booking & Reserve Inventory on PostgreSQL
   * 2. Create Razorpay Order
   * 3. Open Razorpay Checkout Modal
   * 4. Verify Server-Side HMAC Signature
   * 5. Transition to Confirmed & Navigate
   */
  const onSubmit = async (values) => {
    if (!draftBooking?.roomType?.id) return;

    try {
      setSubmitting(true);
      setSubmissionError('');

      const guestData = {
        name: values.guestName.trim(),
        email: values.guestEmail.trim(),
        phone: values.guestPhone?.trim() || undefined,
      };

      let activeBookingRef = pendingBooking?.bookingReference;

      // If no pending booking created yet, create it atomically
      if (!activeBookingRef) {
        const payload = {
          roomTypeId: draftBooking.roomType.id,
          checkIn,
          checkOut,
          rooms,
          requirePayment: true,
          guest: guestData,
        };

        const res = await bookingApi.createBooking(payload, idempotencyKey);
        if (!res?.success || !res?.data) {
          throw new Error(res?.message || 'Failed to initialize reservation holding.');
        }

        const created = res.data;
        activeBookingRef = created.bookingReference;
        setPendingBooking(created);
      }

      // Launch Razorpay checkout
      await initiateRazorpayCheckout(activeBookingRef, guestData);
    } catch (err) {
      if (err.code === 'ROOM_UNAVAILABLE') {
        setSubmissionError(
          'Room inventory sold out during checkout. Please select alternate dates or choose another suite.'
        );
      } else {
        setSubmissionError(
          err.message || 'Unable to proceed to payment at this time. Please retry.'
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Retry Payment for existing pending reservation
   */
  const handleRetryPayment = async () => {
    if (!pendingBooking?.bookingReference) return;

    try {
      setSubmitting(true);
      setSubmissionError('');
      const values = getValues();
      await initiateRazorpayCheckout(pendingBooking.bookingReference, {
        name: values.guestName || pendingBooking.guest?.fullName,
        email: values.guestEmail || pendingBooking.guest?.email,
        phone: values.guestPhone || pendingBooking.guest?.phone,
      });
    } catch (err) {
      setSubmissionError(err.message || 'Payment retry failed.');
    } finally {
      setSubmitting(false);
    }
  };

  // If no hotel or suite is selected, render a luxury empty state
  if (!draftBooking?.hotel || !draftBooking?.roomType) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-sand/40 flex items-center justify-center text-champagne mb-6">
          <Compass className="w-8 h-8" />
        </div>
        <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold mb-1">
          Reservation Checkout
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal">No Suite Selected</h1>
        <p className="font-sans text-sm text-on-surface-variant max-w-md mt-3 leading-relaxed">
          Please explore our boutique collection and select your desired hotel suite before proceeding to reservation checkout.
        </p>
        <div className="mt-8">
          <Link
            to="/hotels"
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-colors shadow-sm"
          >
            <span>Explore Sanctuaries</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const totalAmount = quote?.totalAmount || Number(draftBooking.roomType.pricePerNight) * nights * rooms;
  const currency = quote?.currency || draftBooking.roomType.currency || 'INR';

  return (
    <div className="w-full pb-28">
      {/* Editorial Header */}
      <section className="bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/70 py-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
            Confirmed Reservation
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl text-charcoal tracking-tight">
            Sanctuary Checkout
          </h1>
          <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-1">
            Review your stay details, provide traveler information, and complete payment via Razorpay to guarantee your reservation.
          </p>
        </div>
      </section>

      {/* Main Checkout Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left Column: Guest Information & Controls */}
          <div className="lg:col-span-7 space-y-8">
            {/* Identity Status Pill */}
            <div className="p-4 bg-white border border-sand rounded flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#f6f3ee] text-champagne flex items-center justify-center">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-serif text-sm font-semibold text-charcoal">
                    {isAuthenticated ? `Atelier Member: ${customer?.fullName}` : 'Guest Traveler'}
                  </h4>
                  <p className="text-[11px] text-warm-grey font-light">
                    {isAuthenticated
                      ? 'Reservation will be linked to your member account'
                      : 'No mandatory account required for booking'}
                  </p>
                </div>
              </div>

              {!isAuthenticated && (
                <Link
                  to="/login"
                  className="text-xs font-semibold uppercase tracking-luxury text-champagne hover:text-charcoal transition-colors underline underline-offset-4"
                >
                  Sign In
                </Link>
              )}
            </div>

            {/* Active Pending Reservation Hold Banner */}
            {pendingBooking && (
              <div className="p-4 bg-sand/30 border border-sand rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold text-charcoal">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                    <span>Reservation Held: {pendingBooking.bookingReference}</span>
                  </div>
                  <p className="text-[11px] text-warm-grey font-light mt-0.5">
                    Rooms held in inventory. Complete payment via Razorpay to finalize confirmation.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleRetryPayment}
                  disabled={submitting || verifying}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-white hover:bg-champagne transition-colors shrink-0 disabled:opacity-60"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
                  <span>Resume Payment</span>
                </button>
              </div>
            )}

            {/* Submission Error Banner */}
            {submissionError && (
              <div className="p-4 bg-error-container/20 border border-error/30 rounded flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div>
                  <h5 className="font-serif text-sm font-semibold text-charcoal">
                    Payment / Reservation Issue
                  </h5>
                  <p className="text-xs text-on-surface-variant font-sans mt-0.5 leading-relaxed">
                    {submissionError}
                  </p>
                </div>
              </div>
            )}

            {/* Guest Form */}
            <form
              onSubmit={handleSubmit(onSubmit)}
              id="checkoutForm"
              className="bg-white border border-sand rounded p-6 sm:p-8 shadow-architectural space-y-6"
            >
              <div>
                <h3 className="font-serif text-xl text-charcoal mb-1">Traveler Details</h3>
                <p className="font-sans text-xs text-warm-grey font-light">
                  Primary guest name will be recorded on hotel registration documents and billing invoices.
                </p>
              </div>

              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Guest Full Name *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    autoComplete="name"
                    placeholder="Lady Eleanor Vance"
                    {...register('guestName')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errors.guestName && (
                  <p className="mt-1 text-[11px] text-error font-sans">{errors.guestName.message}</p>
                )}
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Email Address (For Booking & Payment Confirmation) *
                </label>
                <div className="relative">
                  <input
                    type="email"
                    autoComplete="email"
                    disabled={isAuthenticated && !!customer?.email}
                    placeholder="eleanor@sanctuary.com"
                    {...register('guestEmail')}
                    className={`w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors ${
                      isAuthenticated ? 'opacity-80 cursor-not-allowed' : ''
                    }`}
                  />
                  <Mail className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {isAuthenticated && (
                  <span className="block text-[10px] text-warm-grey mt-1">
                    Bound to your active Atelier session
                  </span>
                )}
                {errors.guestEmail && (
                  <p className="mt-1 text-[11px] text-error font-sans">{errors.guestEmail.message}</p>
                )}
              </div>

              {/* Contact Phone Number */}
              <div>
                <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Phone Number (For Stay & Payment Concierge)
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    autoComplete="tel"
                    placeholder="+91 98765 43210"
                    {...register('guestPhone')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <Phone className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errors.guestPhone && (
                  <p className="mt-1 text-[11px] text-error font-sans">{errors.guestPhone.message}</p>
                )}
              </div>

              {/* Security & Payment Protection Notice */}
              <div className="p-4 bg-[#f6f3ee] rounded flex items-start gap-3 border border-sand/60">
                <ShieldCheck className="w-5 h-5 text-[#38765B] shrink-0 mt-0.5" />
                <div className="text-xs text-on-surface-variant font-light leading-relaxed">
                  <span className="font-semibold text-charcoal block">Razorpay Standard Checkout (Test Mode)</span>
                  Your booking inventory is atomically held on PostgreSQL for 15 minutes while payment is completed. Cards, UPI, NetBanking, and Wallets supported.
                </div>
              </div>
            </form>
          </div>

          {/* Right Column: Authoritative Stay Summary Card */}
          <div className="lg:col-span-5 bg-white border border-sand rounded p-6 sm:p-8 shadow-architectural space-y-6">
            <div>
              <span className="font-sans text-[11px] uppercase tracking-luxury text-champagne font-semibold block mb-1">
                Stay Itinerary
              </span>
              <h3 className="font-serif text-2xl text-charcoal">{draftBooking.hotel.name}</h3>
              <div className="flex items-center gap-1.5 text-xs text-warm-grey mt-1">
                <MapPin className="w-3.5 h-3.5 text-champagne shrink-0" />
                <span>{draftBooking.hotel.city || 'India'}</span>
              </div>
            </div>

            {/* Suite Category */}
            <div className="p-4 bg-[#f6f3ee] border border-sand/60 rounded space-y-1">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                Selected Accommodations
              </span>
              <h4 className="font-serif text-base font-semibold text-charcoal">
                {draftBooking.roomType.name}
              </h4>
              <p className="text-xs text-warm-grey">
                Up to {draftBooking.roomType.maxGuests || 2} Guests per suite · {rooms}{' '}
                {rooms === 1 ? 'Room' : 'Rooms'}
              </p>
            </div>

            {/* Dates Summary */}
            <div className="grid grid-cols-2 gap-4 py-3 border-y border-sand/60 text-xs">
              <div>
                <span className="text-warm-grey uppercase text-[10px] tracking-luxury block">
                  Check-In
                </span>
                <span className="font-semibold text-charcoal font-sans">
                  {formatDisplayDate(checkIn)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-warm-grey uppercase text-[10px] tracking-luxury block">
                  Check-Out
                </span>
                <span className="font-semibold text-charcoal font-sans">
                  {formatDisplayDate(checkOut)}
                </span>
              </div>
            </div>

            {/* Authoritative Price Calculation */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-on-surface-variant font-light">
                <span>
                  {formatCurrency(draftBooking.roomType.pricePerNight, currency)} × {formatNights(nights)}
                </span>
                <span className="font-mono">
                  {formatCurrency(Number(draftBooking.roomType.pricePerNight) * nights, currency)}
                </span>
              </div>

              {rooms > 1 && (
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-light">
                  <span>Room Multiplier ({rooms} rooms)</span>
                  <span className="font-mono">× {rooms}</span>
                </div>
              )}

              <div className="pt-3 border-t border-sand flex items-baseline justify-between">
                <div>
                  <span className="font-serif text-lg text-charcoal font-semibold block">
                    Total Payable
                  </span>
                  <span className="text-[10px] text-warm-grey font-light">
                    Taxes & sanctuary access included
                  </span>
                </div>
                <div className="text-right">
                  {quoteLoading ? (
                    <Spinner size={18} color="champagne" />
                  ) : (
                    <span className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal">
                      {formatCurrency(totalAmount, currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <button
                type="submit"
                form="checkoutForm"
                disabled={submitting || verifying || quoteLoading || !!quoteError}
                className="w-full py-4 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                {verifying ? (
                  <>
                    <Spinner size={18} color="white" />
                    <span>Verifying payment with bank...</span>
                  </>
                ) : submitting ? (
                  <>
                    <Spinner size={18} color="white" />
                    <span>Connecting to Razorpay...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    <span>Pay {formatCurrency(totalAmount, currency)} & Confirm</span>
                  </>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 mt-3 text-[11px] text-warm-grey">
                <Lock className="w-3.5 h-3.5 text-champagne" />
                <span>HMAC SHA-256 Verified · 256-Bit SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
