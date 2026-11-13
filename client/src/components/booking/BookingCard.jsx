import React, { useState } from 'react';
import { formatCurrency, formatNights } from '../../utils/formatters';
import { formatDisplayDate } from '../../utils/dateUtils';
import { CancellationModal } from './CancellationModal';
import {
  Calendar,
  Building2,
  Users,
  Mail,
  Phone,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  ShieldAlert,
} from 'lucide-react';

/**
 * Editorial Luxury Booking Card for both Lookup and Account History
 * Displays comprehensive reservation details, guest verification, and embedded cancellation flow
 */
export const BookingCard = ({ booking, onCancelSuccess }) => {
  const [copied, setCopied] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState(booking);

  // Sync if parent updates
  React.useEffect(() => {
    setCurrentBooking(booking);
  }, [booking]);

  if (!currentBooking) return null;

  const reference = currentBooking.bookingReference || currentBooking.reference;
  const status = (currentBooking.status || 'CONFIRMED').toUpperCase();
  const isConfirmed = status === 'CONFIRMED';
  const isCancelled = status === 'CANCELLED';

  const guestName = currentBooking.guest?.fullName || currentBooking.guestName || 'Valued Guest';
  const guestEmail = currentBooking.guest?.email || currentBooking.guestEmail || '';
  const guestPhone = currentBooking.guest?.phone || currentBooking.guestPhone || '';

  const handleCopyReference = () => {
    if (!reference) return;
    navigator.clipboard.writeText(reference);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancellationCompleted = (updatedData) => {
    setCurrentBooking((prev) => ({
      ...prev,
      status: 'CANCELLED',
      cancelledAt: updatedData?.cancelledAt || new Date().toISOString(),
    }));
    setIsCancelModalOpen(false);
    if (onCancelSuccess) {
      onCancelSuccess(updatedData);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-[#e6dfd3] rounded shadow-architectural overflow-hidden transition-all duration-300 hover:border-[#b08d57]/50 mb-8">
      {/* Top Meta Bar */}
      <div className="bg-[#fcf9f4] border-b border-[#e6dfd3] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase tracking-widest text-[#707973] font-medium">
            Reservation Ref
          </span>
          <div className="flex items-center gap-2 bg-surface-container-lowest border border-[#d1c5b6] px-3 py-1 rounded">
            <span className="font-mono text-sm font-semibold tracking-wider text-primary">
              {reference}
            </span>
            <button
              type="button"
              onClick={handleCopyReference}
              className="text-[#707973] hover:text-[#b08d57] transition-colors"
              title="Copy reservation reference"
              aria-label="Copy reservation reference"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#38765B]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          {copied && (
            <span className="text-xs text-[#38765B] font-medium animate-fade-in">
              Copied!
            </span>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-2">
          {isConfirmed ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold tracking-widest uppercase bg-[#38765B]/10 text-[#38765B] border border-[#38765B]/30">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Confirmed
            </span>
          ) : isCancelled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold tracking-widest uppercase bg-[#ba1a1a]/10 text-[#ba1a1a] border border-[#ba1a1a]/30">
              <XCircle className="w-3.5 h-3.5" />
              Cancelled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold tracking-widest uppercase bg-amber-50 text-amber-800 border border-amber-200">
              <AlertCircle className="w-3.5 h-3.5" />
              {status}
            </span>
          )}
        </div>
      </div>

      {/* Main Reservation Card Body */}
      <div className="p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-[#e6dfd3]/80">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-[#b08d57] font-semibold mb-1">
              <Building2 className="w-4 h-4" />
              Luxury Sanctuary
            </div>
            <h3 className="font-serif text-2xl sm:text-3xl font-normal text-primary">
              {currentBooking.hotelName || 'Luxury Hotel Estate'}
            </h3>
            <p className="text-sm font-medium text-[#707973] uppercase tracking-wider mt-1">
              {currentBooking.roomName || 'Signature Luxury Suite'}
            </p>
          </div>

          {/* Pricing Summary */}
          <div className="text-left lg:text-right bg-[#fcf9f4] lg:bg-transparent p-4 lg:p-0 rounded border lg:border-none border-[#e6dfd3]">
            <span className="text-xs uppercase tracking-widest text-[#707973] block mb-1">
              Total Amount
            </span>
            <div className="font-serif text-2xl sm:text-3xl font-medium text-primary">
              {formatCurrency(currentBooking.totalAmount, currentBooking.currency || 'INR')}
            </div>
            <span className="text-xs text-[#707973] mt-0.5 block">
              Inclusive of all taxes & luxury fees
            </span>
          </div>
        </div>

        {/* Stay Itinerary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-6 border-b border-[#e6dfd3]/80">
          {/* Check-In */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] border border-[#e6dfd3] flex items-center justify-center text-primary flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#b08d57]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#707973] block font-medium">
                Check-In
              </span>
              <p className="font-serif text-lg font-normal text-primary mt-0.5">
                {formatDisplayDate(currentBooking.checkIn, true)}
              </p>
              <span className="text-xs text-[#707973]">From 3:00 PM</span>
            </div>
          </div>

          {/* Check-Out */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] border border-[#e6dfd3] flex items-center justify-center text-primary flex-shrink-0">
              <Calendar className="w-5 h-5 text-[#b08d57]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#707973] block font-medium">
                Check-Out
              </span>
              <p className="font-serif text-lg font-normal text-primary mt-0.5">
                {formatDisplayDate(currentBooking.checkOut, true)}
              </p>
              <span className="text-xs text-[#707973]">Until 12:00 PM</span>
            </div>
          </div>

          {/* Duration & Rooms */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] border border-[#e6dfd3] flex items-center justify-center text-primary flex-shrink-0">
              <Clock className="w-5 h-5 text-[#b08d57]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-[#707973] block font-medium">
                Duration & Volume
              </span>
              <p className="font-serif text-lg font-normal text-primary mt-0.5">
                {formatNights(currentBooking.nights)} &middot; {currentBooking.roomsCount || 1} Room
                {(currentBooking.roomsCount || 1) > 1 ? 's' : ''}
              </p>
              <span className="text-xs text-[#707973]">Guaranteed reservation</span>
            </div>
          </div>
        </div>

        {/* Guest Details & Reservation Timestamp */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6">
          <div className="space-y-1">
            <span className="text-xs uppercase tracking-widest text-[#707973] font-medium block">
              Primary Guest
            </span>
            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-primary">
              <span className="font-medium flex items-center gap-1.5">
                <Users className="w-4 h-4 text-[#707973]" />
                {guestName}
              </span>
              {guestEmail && (
                <span className="text-[#707973] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  {guestEmail}
                </span>
              )}
              {guestPhone && (
                <span className="text-[#707973] flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" />
                  {guestPhone}
                </span>
              )}
            </div>
          </div>

          {/* Cancellation Button or Cancelled Note */}
          <div className="flex items-center gap-3 pt-2 sm:pt-0">
            {isConfirmed && (
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-widest font-semibold text-[#ba1a1a] border border-[#ba1a1a]/40 rounded hover:bg-[#ba1a1a]/10 hover:border-[#ba1a1a] transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                Cancel Reservation
              </button>
            )}

            {isCancelled && currentBooking.cancelledAt && (
              <div className="text-xs text-[#ba1a1a] bg-[#ba1a1a]/5 border border-[#ba1a1a]/20 px-3 py-1.5 rounded">
                Cancelled on {formatDisplayDate(currentBooking.cancelledAt.slice(0, 10), true)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Modal Overlay */}
      <CancellationModal
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        bookingReference={reference}
        email={guestEmail}
        onSuccess={handleCancellationCompleted}
      />
    </div>
  );
};

export default BookingCard;
