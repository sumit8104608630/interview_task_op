import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingApi } from '../../api/bookingApi';
import { bookingLookupSchema } from '../../features/booking/bookingSchemas';
import { BookingCard } from '../../components/booking/BookingCard';
import Spinner from '../../components/common/Spinner';
import {
  Search,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Building2,
  Compass,
  ArrowRight,
} from 'lucide-react';

export const BookingLookupPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState(null);
  const [error, setError] = useState('');

  const initialReference = searchParams.get('reference') || '';
  const initialEmail = searchParams.get('email') || '';

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(bookingLookupSchema),
    defaultValues: {
      bookingReference: initialReference,
      email: initialEmail,
    },
  });

  // Auto-search if both reference and email are present in URL query params
  useEffect(() => {
    if (initialReference && initialEmail && !bookingData && !loading) {
      handleLookup({ bookingReference: initialReference, email: initialEmail });
    }
  }, [initialReference, initialEmail]);

  const handleLookup = async (values) => {
    try {
      setLoading(true);
      setError('');
      setBookingData(null);

      const normalizedReference = values.bookingReference.trim().toUpperCase();
      const normalizedEmail = values.email.trim().toLowerCase();

      // Update URL query params smoothly
      setSearchParams({ reference: normalizedReference, email: normalizedEmail });

      const res = await bookingApi.lookupBooking({
        bookingReference: normalizedReference,
        email: normalizedEmail,
      });

      if (res?.success && res?.data) {
        setBookingData(res.data);
      } else {
        setError('No reservation could be located for the provided details.');
      }
    } catch (err) {
      // Intentional generic anti-enumeration message
      setError(
        err.message ||
          'We were unable to locate a reservation matching this reference and email address. Please verify your details or consult concierge.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetSearch = () => {
    setBookingData(null);
    setError('');
    setSearchParams({});
    reset({ bookingReference: '', email: '' });
  };

  const handleCancelSuccess = (updatedData) => {
    if (bookingData) {
      setBookingData((prev) => ({
        ...prev,
        status: 'CANCELLED',
        cancelledAt: updatedData?.cancelledAt || new Date().toISOString(),
      }));
    }
  };

  return (
    <div className="w-full pb-28 pt-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-3">
          <span className="text-xs uppercase tracking-widest font-semibold text-[#b08d57]">
            Sanctuary Ledger Services
          </span>
          <h1 className="font-serif text-3xl sm:text-5xl text-primary font-normal tracking-tight">
            Find Your Reservation
          </h1>
          <p className="text-sm sm:text-base text-[#707973] max-w-xl mx-auto font-light leading-relaxed">
            Review your stay itinerary, examine confirmation details, or execute a verified cancellation with our guest ledger.
          </p>
        </div>

        {/* Lookup Search Form Card */}
        {!bookingData ? (
          <div className="bg-surface-container-lowest border border-[#e6dfd3] rounded p-6 sm:p-10 shadow-architectural">
            <form onSubmit={handleSubmit(handleLookup)} className="space-y-6">
              {error && (
                <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 p-4 rounded text-sm text-[#ba1a1a] flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#ba1a1a]" />
                  <div className="leading-relaxed">
                    <span className="font-semibold block">Lookup Notice</span>
                    {error}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Booking Reference */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="bookingReference"
                    className="block text-xs uppercase tracking-widest font-semibold text-primary"
                  >
                    Booking Reference <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    id="bookingReference"
                    type="text"
                    placeholder="e.g. HBP-A83F9D21"
                    className={`w-full px-4 py-3 bg-[#fcf9f4] border ${
                      errors.bookingReference ? 'border-[#ba1a1a]' : 'border-[#d1c5b6]'
                    } rounded text-sm font-mono uppercase tracking-wider text-primary placeholder-[#707973]/50 focus:outline-none focus:border-[#b08d57] transition-colors`}
                    {...register('bookingReference')}
                  />
                  {errors.bookingReference ? (
                    <p className="text-xs text-[#ba1a1a] font-sans">
                      {errors.bookingReference.message}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#707973] font-light">
                      Found in your confirmation email or reservation receipt.
                    </p>
                  )}
                </div>

                {/* Guest Email */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="email"
                    className="block text-xs uppercase tracking-widest font-semibold text-primary"
                  >
                    Guest Email Address <span className="text-[#ba1a1a]">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="e.g. guest@luxuryestates.com"
                    className={`w-full px-4 py-3 bg-[#fcf9f4] border ${
                      errors.email ? 'border-[#ba1a1a]' : 'border-[#d1c5b6]'
                    } rounded text-sm text-primary placeholder-[#707973]/50 focus:outline-none focus:border-[#b08d57] transition-colors`}
                    {...register('email')}
                  />
                  {errors.email ? (
                    <p className="text-xs text-[#ba1a1a] font-sans">
                      {errors.email.message}
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#707973] font-light">
                      The exact email address supplied during checkout.
                    </p>
                  )}
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#e6dfd3]">
                <div className="flex items-center gap-2 text-xs text-[#707973]">
                  <ShieldCheck className="w-4 h-4 text-[#38765B]" />
                  <span>Encrypted Anti-Enumeration Ledger Verification</span>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3 rounded bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-[#b08d57] transition-all disabled:opacity-50 shadow-md"
                >
                  {loading ? (
                    <>
                      <Spinner size={16} color="#ffffff" />
                      <span>Verifying Ledger...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Retrieve Reservation</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          /* Retrieved Reservation Card View */
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-surface-container-lowest border border-[#e6dfd3] px-6 py-4 rounded">
              <span className="text-xs uppercase tracking-widest text-[#707973] font-medium">
                Active Ledger Record
              </span>
              <button
                type="button"
                onClick={handleResetSearch}
                className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#b08d57] hover:text-primary transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Find Another Reservation
              </button>
            </div>

            <BookingCard booking={bookingData} onCancelSuccess={handleCancelSuccess} />
          </div>
        )}

        {/* Concierge & Support Footer Note */}
        <div className="bg-[#fcf9f4] border border-[#e6dfd3] rounded p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="font-serif text-lg text-primary font-medium">
              Require Personal Assistance?
            </h4>
            <p className="text-xs sm:text-sm text-[#707973] font-light max-w-md">
              Our 24/7 Hospitality Concierge team is available to assist with special requests, itinerary modifications, or billing inquiries.
            </p>
          </div>
          <Link
            to="/hotels"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-surface-container-lowest border border-[#d1c5b6] text-xs uppercase tracking-widest font-semibold text-primary hover:border-[#b08d57] transition-colors"
          >
            <Compass className="w-4 h-4 text-[#b08d57]" />
            <span>Discover More Hotels</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default BookingLookupPage;
