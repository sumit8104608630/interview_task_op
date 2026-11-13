import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { authApi } from '../../api/authApi';
import { resetPasswordSchema } from '../../features/auth/authSchemas';
import { clearCredentials } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import Spinner from '../../components/common/Spinner';
import { Mail, KeyRound, Lock, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

export const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const initialEmail = searchParams.get('email') || '';

  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: initialEmail,
      otp: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      setServerError('');

      await authApi.resetPassword({
        email: values.email,
        otp: values.otp,
        newPassword: values.newPassword,
      });

      // Clear any prior authenticated state
      dispatch(clearCredentials());

      dispatch(
        addToast({
          type: 'success',
          title: 'Password Updated',
          message: 'Your password has been reset successfully. Please sign in with your new password.',
        })
      );

      navigate('/login', { replace: true });
    } catch (err) {
      setServerError(
        err.message || 'Password reset failed. The code may be invalid, expired, or the account not found.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
          Credential Recovery
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight">
          Reset Your Password
        </h1>
        <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-2 max-w-sm mx-auto">
          Enter the 6-digit verification code and establish your new account password.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural space-y-6">
          {serverError && (
            <div className="p-3.5 bg-error-container/20 border border-error/30 rounded flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
                {serverError}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email Field */}
            <div>
              <label htmlFor="reset-email" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  {...register('email')}
                  className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                />
                <Mail className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
              </div>
              {errors.email && (
                <p className="mt-1 text-[11px] text-error font-sans">{errors.email.message}</p>
              )}
            </div>

            {/* OTP Code */}
            <div>
              <label htmlFor="reset-otp" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                6-Digit Reset Code
              </label>
              <div className="relative">
                <input
                  id="reset-otp"
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

            {/* New Password */}
            <div>
              <label htmlFor="reset-new-password" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                New Password (Min 8 chars, 1 letter, 1 number)
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('newPassword')}
                  className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
              </div>
              {errors.newPassword && (
                <p className="mt-1 text-[11px] text-error font-sans">
                  {errors.newPassword.message}
                </p>
              )}
            </div>

            {/* Confirm New Password */}
            <div>
              <label htmlFor="reset-confirm-password" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="reset-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  {...register('confirmPassword')}
                  className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-[11px] text-error font-sans">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Spinner size={16} color="white" />
                    <span>Resetting password...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm Password Reset</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            <div className="pt-4 border-t border-sand/60 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1 text-xs text-warm-grey hover:text-charcoal transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Sign In</span>
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
