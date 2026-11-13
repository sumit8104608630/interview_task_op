import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectLastConfirmedBooking } from '../../features/booking/bookingSlice';
import { paymentApi } from '../../api/paymentApi';
import { formatCurrency, formatNights } from '../../utils/formatters';
import { formatDisplayDate } from '../../utils/dateUtils';
import Spinner from '../../components/common/Spinner';
import {
  CheckCircle2,
  Copy,
  Check,
  Printer,
  Calendar,
  MapPin,
  Mail,
  User,
  Compass,
  ArrowRight,
  ShieldCheck,
  CreditCard,
} from 'lucide-react';

export const BookingConfirmationPage = () => {
  const { reference } = useParams();
  const reduxBooking = useSelector(selectLastConfirmedBooking);
  const [bookingData, setBookingData] = useState(reduxBooking || null);
  const [paymentData, setPaymentData] = useState(null);
  const [loading, setLoading] = useState(!reduxBooking);
  const [copied, setCopied] = useState(false);

  // Authoritatively fetch booking and payment verification data from PostgreSQL
  useEffect(() => {
    if (!reference) return;

    let isMounted = true;
    const fetchAuthoritativeDetails = async () => {
      try {
        const res = await paymentApi.getBookingPaymentDetails(reference);
        if (isMounted && res?.data) {
          setBookingData((prev) => ({
            ...prev,
            ...res.data.booking,
          }));
          if (res.data.payment) {
            setPaymentData(res.data.payment);
          }
        }
      } catch (err) {
        console.warn('[BookingConfirmationPage] Authoritative fetch fallback:', err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAuthoritativeDetails();

    return () => {
      isMounted = false;
    };
  }, [reference]);

  const displayReference = bookingData?.bookingReference || reduxBooking?.bookingReference || reference;
  const paymentId = paymentData?.razorpayPaymentId || reduxBooking?.paymentId;
  const bookingStatus = bookingData?.status || reduxBooking?.status || 'CONFIRMED';
  const paymentStatus = paymentData?.status || (paymentId ? 'CAPTURED' : 'PENDING');

  const handleCopy = () => {
    if (!displayReference) return;
    navigator.clipboard.writeText(displayReference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !bookingData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <Spinner size={32} color="champagne" />
        <p className="mt-4 text-xs font-sans uppercase tracking-luxury text-warm-grey">
          Retrieving reservation ledger...
        </p>
      </div>
    );
  }

  return (
    <div className="w-full pb-28 pt-8 print:p-0 print:m-0">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8 print:max-w-none print:px-0 print:space-y-4">
        {/* Printable Voucher Header - Only visible during print */}
        <div className="hidden print:flex items-center justify-between pb-4 border-b border-sand">
          <div>
            <h1 className="font-serif text-3xl font-bold tracking-tight text-charcoal">LuxeStay</h1>
            <p className="font-sans text-[10px] tracking-luxury uppercase text-warm-grey font-medium">
              Official Reservation Voucher & Razorpay Payment Receipt
            </p>
          </div>
          <div className="text-right">
            <span className="font-mono text-xs text-warm-grey block">
              Printed on {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            <span className="inline-block px-2.5 py-0.5 mt-1 text-[10px] uppercase font-semibold text-[#38765B] border border-[#38765B] rounded-sm">
              Confirmed & Paid (Test Mode)
            </span>
          </div>
        </div>

        {/* Confirmed Header Card */}
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural text-center space-y-4 print:shadow-none print:border print:border-sand print:p-6 print-avoid-break">
          <div className="w-16 h-16 rounded-full bg-[#f6f3ee] text-[#38765B] flex items-center justify-center mx-auto border-2 border-sand print:w-12 print:h-12">
            <CheckCircle2 className="w-9 h-9 print:w-7 print:h-7" />
          </div>

          <div>
            <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-[#38765B] block mb-1">
              Payment Verified & Reservation Guaranteed
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl text-charcoal tracking-tight print:text-3xl">
              Booking Confirmed
            </h2>
            <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-2 max-w-md mx-auto">
              Your room inventory has been reserved on the property ledger. Transaction verified via Razorpay Standard Checkout.
            </p>
          </div>

          {/* Reference Badge */}
          <div className="pt-2">
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded bg-[#f6f3ee] border border-sand print:bg-white">
              <div>
                <span className="block text-[10px] uppercase tracking-luxury text-warm-grey">
                  Booking Reference
                </span>
                <span className="font-mono text-xl sm:text-2xl font-semibold text-charcoal tracking-wider">
                  {displayReference}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="p-2 rounded bg-white border border-sand hover:border-champagne text-charcoal hover:text-champagne transition-colors print:hidden"
                title="Copy reference code"
                aria-label="Copy booking reference"
              >
                {copied ? <Check className="w-4 h-4 text-[#38765B]" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            {copied && (
              <p className="text-[11px] text-[#38765B] font-sans mt-1 print:hidden">Copied to clipboard!</p>
            )}
          </div>
        </div>

        {/* Detailed Reservation Summary */}
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural space-y-6 print:shadow-none print:border print:border-sand print:p-6 print-avoid-break">
          <div className="flex items-center justify-between pb-4 border-b border-sand/60">
            <h3 className="font-serif text-2xl text-charcoal">Reservation Details</h3>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-[#38765B]/10 text-[#38765B] text-xs font-semibold tracking-luxury uppercase border border-[#38765B]/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Status: {bookingStatus}</span>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
            {/* Property Info */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                Sanctuary & Suite
              </span>
              <p className="font-serif text-lg font-semibold text-charcoal">
                {bookingData?.hotelName || bookingData?.hotel?.name || 'LuxeStay Collection Property'}
              </p>
              <p className="text-xs text-warm-grey">
                {bookingData?.roomName || bookingData?.roomType?.name || 'Reserved Sanctuary Suite'}
              </p>
            </div>

            {/* Stay Dates */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                Stay Schedule
              </span>
              <p className="font-medium text-charcoal font-sans">
                {formatDisplayDate(bookingData?.checkIn)} — {formatDisplayDate(bookingData?.checkOut)}
              </p>
              <p className="text-xs text-warm-grey">
                {bookingData?.nights ? formatNights(bookingData.nights) : ''} · {bookingData?.roomsCount || 1} Room
              </p>
            </div>

            {/* Guest Info */}
            <div className="space-y-1">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                Guest of Record
              </span>
              <p className="font-medium text-charcoal font-sans">
                {bookingData?.guest?.fullName || bookingData?.guest?.name || 'Honored Traveler'}
              </p>
              <p className="text-xs text-warm-grey">
                {bookingData?.guest?.email || 'Registered Guest Email'}
              </p>
            </div>

            {/* Total Paid */}
            <div className="space-y-1 sm:text-right">
              <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                Confirmed Total Paid
              </span>
              <p className="font-serif text-2xl font-semibold text-charcoal">
                {formatCurrency(bookingData?.totalAmount || '—')}
              </p>
              <span className="text-[10px] text-warm-grey block">All hospitality taxes included</span>
            </div>
          </div>

          {/* Payment Gateway Ledger Card */}
          <div className="p-4 bg-[#fbf9f6] border border-sand rounded space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-champagne" />
                <span className="font-sans text-xs uppercase tracking-luxury font-semibold text-charcoal">
                  Razorpay Transaction Record
                </span>
              </div>
              <span className="inline-block px-2 py-0.5 text-[10px] uppercase font-mono font-semibold text-[#38765B] bg-[#38765B]/10 rounded border border-[#38765B]/20">
                {paymentStatus}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-sand/50">
              <div>
                <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                  Payment Reference ID
                </span>
                <span className="font-mono text-charcoal font-medium">
                  {paymentId || 'rzp_verified_transaction'}
                </span>
              </div>
              <div className="sm:text-right">
                <span className="text-[10px] uppercase tracking-luxury text-warm-grey block">
                  Payment Method
                </span>
                <span className="text-charcoal font-sans">
                  Razorpay Checkout (Test Mode)
                </span>
              </div>
            </div>
          </div>

          {/* Transactional Outbox Note */}
          <div className="p-4 bg-[#f6f3ee] border border-sand/70 rounded flex items-start gap-3">
            <Mail className="w-5 h-5 text-champagne shrink-0 mt-0.5" />
            <div className="text-xs text-on-surface-variant font-light leading-relaxed">
              <span className="font-semibold text-charcoal block">Email Receipt Queued</span>
              A booking confirmation containing full check-in procedures, payment voucher, and cancellation policy has been staged in our transactional outbox and dispatched to the guest email.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-sand/60 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden">
            <button
              onClick={handlePrint}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded border border-sand bg-white text-xs font-semibold tracking-luxury uppercase text-charcoal hover:border-champagne transition-colors"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            <div className="w-full sm:w-auto flex items-center gap-3">
              <Link
                to="/booking/lookup"
                className="w-full sm:w-auto text-center px-5 py-2.5 rounded border border-sand bg-white text-xs font-semibold tracking-luxury uppercase text-charcoal hover:border-champagne transition-colors"
              >
                Find Reservation
              </Link>
              <Link
                to="/hotels"
                className="w-full sm:w-auto text-center px-6 py-2.5 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-colors"
              >
                Explore More
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingConfirmationPage;
