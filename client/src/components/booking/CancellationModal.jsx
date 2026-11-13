import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingApi } from '../../api/bookingApi';
import { cancellationOtpSchema } from '../../features/booking/bookingSchemas';
import Spinner from '../common/Spinner';
import { X, AlertTriangle, KeyRound, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

export const CancellationModal = ({
  isOpen = false,
  onClose,
  bookingReference,
  email,
  onSuccess,
}) => {
  // Step 1: 'prompt' -> Step 2: 'otp' -> Step 3: 'confirm'
  const [step, setStep] = useState('prompt');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // In-memory single-use cancellation proof token (never stored in localStorage)
  const [cancellationProof, setCancellationProof] = useState(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(cancellationOtpSchema),
    defaultValues: { otp: '', reason: '' },
  });

  // Reset internal modal state whenever isOpen toggles
  useEffect(() => {
    if (!isOpen) {
      setStep('prompt');
      setError('');
      setLoading(false);
      setCancellationProof(null);
      setResendCooldown(0);
    }
  }, [isOpen]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  // Step 1 -> Step 2: Dispatch Cancellation OTP
  const handleSendOtp = async () => {
    try {
      setLoading(true);
      setError('');

      await bookingApi.sendCancellationOtp({
        bookingReference,
        email,
      });

      setResendCooldown(60);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Failed to dispatch cancellation code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> Step 3: Verify OTP & Receive In-Memory Cancellation Proof
  const handleVerifyOtp = async (values) => {
    try {
      setLoading(true);
      setError('');

      const res = await bookingApi.verifyCancellationOtp({
        bookingReference,
        email,
        otp: values.otp,
      });

      if (res?.success && res?.data?.cancellationProof) {
        // Store in memory ONLY
        setCancellationProof(res.data.cancellationProof);
        setStep('confirm');
      }
    } catch (err) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Final Atomic Cancellation Execution
  const handleExecuteCancel = async (values) => {
    if (!cancellationProof) return;

    try {
      setLoading(true);
      setError('');

      const res = await bookingApi.cancelBooking({
        bookingReference,
        email,
        cancellationProof,
        reason: values.reason?.trim() || undefined,
      });

      if (res?.success) {
        setCancellationProof(null);
        setStep('prompt');
        if (onSuccess) {
          onSuccess(res.data);
        }
        if (onClose) {
          onClose();
        }
      }
    } catch (err) {
      setError(
        err.message || 'Cancellation failed. Your proof may have expired or already been consumed.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-charcoal/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-50"
    >
      <div className="bg-white border border-sand rounded max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="p-1 rounded text-outline hover:text-charcoal transition-colors absolute right-5 top-5"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1 text-[11px] font-semibold tracking-luxury uppercase text-error">
            <ShieldAlert className="w-4 h-4" />
            <span>Reservation Cancellation</span>
          </div>
          <h3 className="font-serif text-2xl text-charcoal">
            Cancel Booking {bookingReference}
          </h3>
          <p className="font-sans text-xs text-warm-grey">
            Verification required for guest: <span className="font-medium text-charcoal">{email}</span>
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-error-container/20 border border-error/30 rounded flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
              {error}
            </p>
          </div>
        )}

        {/* STEP 1: INITIAL PROMPT */}
        {step === 'prompt' && (
          <div className="space-y-6">
            <div className="p-4 bg-[#f6f3ee] border border-sand/70 rounded space-y-2 text-xs text-on-surface-variant font-light leading-relaxed">
              <span className="font-semibold text-charcoal block">Cancellation Advisory</span>
              <p>
                Cancelling this reservation will immediately restore all reserved room inventory back to the public catalogue.
              </p>
              <p>
                For security and to protect your booking, an email OTP code will be sent to your verified guest address.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded text-xs uppercase tracking-luxury text-charcoal hover:bg-sand/30 transition-colors"
              >
                Keep Reservation
              </button>
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-luxury bg-error text-white hover:bg-error/90 disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner size={16} color="white" />
                    <span>Sending code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ENTER OTP */}
        {step === 'otp' && (
          <form onSubmit={handleSubmit(handleVerifyOtp)} className="space-y-5">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold">
                  6-Digit Cancellation Code
                </label>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={resendCooldown > 0 || loading}
                  className="text-[11px] text-champagne hover:text-charcoal disabled:opacity-50 transition-colors"
                >
                  {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                </button>
              </div>
              <div className="relative">
                <input
                  type="text"
                  maxLength={10}
                  placeholder="123456"
                  {...register('otp')}
                  className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-center font-mono text-base tracking-widest text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                />
                <KeyRound className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
              </div>
              {errors.otp && (
                <p className="mt-1 text-[11px] text-error font-sans">{errors.otp.message}</p>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded text-xs uppercase tracking-luxury text-charcoal hover:bg-sand/30 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-luxury bg-charcoal text-white hover:bg-champagne disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Spinner size={16} color="white" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: CONFIRM & SUBMIT CANCELLATION WITH PROOF */}
        {step === 'confirm' && (
          <form onSubmit={handleSubmit(handleExecuteCancel)} className="space-y-5">
            <div className="p-4 bg-[#f6f3ee] rounded space-y-2 border border-sand/60">
              <div className="flex items-center gap-1.5 text-xs text-[#38765B] font-semibold uppercase tracking-luxury">
                <CheckCircle2 className="w-4 h-4" />
                <span>Identity Verified</span>
              </div>
              <p className="text-xs text-on-surface-variant font-light leading-relaxed">
                Single-use cancellation proof has been authorized in memory. Click below to execute atomic cancellation.
              </p>
            </div>

            <div>
              <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                Reason for Cancellation (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g., Change in itinerary dates"
                {...register('reason')}
                className="w-full bg-[#f6f3ee] border border-sand rounded p-2.5 text-xs font-sans text-charcoal focus:border-champagne focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded text-xs uppercase tracking-luxury text-charcoal hover:bg-sand/30 transition-colors"
              >
                Abort
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 rounded text-xs font-semibold uppercase tracking-luxury bg-error text-white hover:bg-error/90 disabled:opacity-60 transition-colors flex items-center gap-2 shadow-sm"
              >
                {loading ? (
                  <>
                    <Spinner size={16} color="white" />
                    <span>Processing cancellation...</span>
                  </>
                ) : (
                  <span>Confirm Atomic Cancellation</span>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default CancellationModal;
