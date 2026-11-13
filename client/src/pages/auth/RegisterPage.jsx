import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { authApi } from '../../api/authApi';
import {
  sendRegistrationOtpSchema,
  verifyRegistrationWithPasswordSchema,
} from '../../features/auth/authSchemas';
import { setCredentials } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import Spinner from '../../components/common/Spinner';
import { User, Mail, KeyRound, Lock, AlertCircle, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const RegisterPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Step 1: 'details' -> Step 2: 'otp-password'
  const [step, setStep] = useState('details');
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Form for Step 1
  const {
    register: registerStep1,
    handleSubmit: handleSubmitStep1,
    formState: { errors: errorsStep1 },
  } = useForm({
    resolver: zodResolver(sendRegistrationOtpSchema),
    defaultValues: { fullName: '', email: '' },
  });

  // Form for Step 2
  const {
    register: registerStep2,
    handleSubmit: handleSubmitStep2,
    formState: { errors: errorsStep2 },
  } = useForm({
    resolver: zodResolver(verifyRegistrationWithPasswordSchema),
    defaultValues: { otp: '', password: '', confirmPassword: '' },
  });

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Step 1 Submission: Send Registration OTP
  const onStep1Submit = async (values) => {
    try {
      setSubmitting(true);
      setServerError('');

      await authApi.sendOtp({
        email: values.email,
        fullName: values.fullName,
      });

      setRegisteredEmail(values.email);
      setRegisteredName(values.fullName);
      setResendCooldown(60);
      setStep('otp-password');

      dispatch(
        addToast({
          type: 'info',
          title: 'Verification Code Dispatched',
          message: `A 6-digit verification code was sent to ${values.email}.`,
        })
      );
    } catch (err) {
      setServerError(err.message || 'Unable to dispatch verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2 Submission: Verify OTP & Save Initial Password
  const onStep2Submit = async (values) => {
    try {
      setSubmitting(true);
      setServerError('');

      const res = await authApi.verifyOtp({
        email: registeredEmail,
        fullName: registeredName,
        otp: values.otp,
        password: values.password,
      });

      if (res?.success && res?.data?.customer) {
        dispatch(
          setCredentials({
            customer: res.data.customer,
            csrfToken: res.data.csrfToken || null,
          })
        );

        dispatch(
          addToast({
            type: 'success',
            title: 'Welcome to LuxeStay',
            message: 'Your atelier account has been created and verified.',
          })
        );

        navigate('/hotels', { replace: true });
      }
    } catch (err) {
      setServerError(
        err.message || 'Verification failed. The code may be invalid or expired.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Resend OTP handler
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      setSubmitting(true);
      setServerError('');

      await authApi.sendOtp({
        email: registeredEmail,
        fullName: registeredName,
      });

      setResendCooldown(60);
      dispatch(
        addToast({
          type: 'info',
          title: 'New Code Sent',
          message: `A fresh verification code was sent to ${registeredEmail}.`,
        })
      );
    } catch (err) {
      setServerError(err.message || 'Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
          Atelier Membership
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight">
          Join the Collection
        </h1>
        <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-2 max-w-sm mx-auto">
          {step === 'details'
            ? 'Begin your membership journey with verified email credentials.'
            : `Enter the 6-digit code sent to ${registeredEmail} and set your account password.`}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between pb-4 border-b border-sand/60 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                  step === 'details'
                    ? 'bg-charcoal text-white font-semibold'
                    : 'bg-[#38765B] text-white'
                }`}
              >
                {step === 'details' ? '1' : '✓'}
              </span>
              <span className="font-medium text-charcoal">Details</span>
            </div>
            <div className="w-12 h-px bg-sand" />
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[11px] ${
                  step === 'otp-password'
                    ? 'bg-charcoal text-white font-semibold'
                    : 'bg-sand/60 text-warm-grey'
                }`}
              >
                2
              </span>
              <span
                className={`font-medium ${
                  step === 'otp-password' ? 'text-charcoal' : 'text-warm-grey'
                }`}
              >
                Verify & Password
              </span>
            </div>
          </div>

          {/* Server Error Alert */}
          {serverError && (
            <div className="p-3.5 bg-error-container/20 border border-error/30 rounded flex items-start gap-3">
              <AlertCircle className="w-4 h-4 text-error shrink-0 mt-0.5" />
              <p className="text-xs text-on-surface-variant font-sans leading-relaxed">
                {serverError}
              </p>
            </div>
          )}

          {/* STEP 1 FORM: NAME & EMAIL */}
          {step === 'details' && (
            <form onSubmit={handleSubmitStep1(onStep1Submit)} className="space-y-5">
              <div>
                <label htmlFor="reg-fullname" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    id="reg-fullname"
                    type="text"
                    autoComplete="name"
                    placeholder="Lady Eleanor Vance"
                    {...registerStep1('fullName')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <User className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errorsStep1.fullName && (
                  <p className="mt-1 text-[11px] text-error font-sans">
                    {errorsStep1.fullName.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg-email" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    id="reg-email"
                    type="email"
                    autoComplete="email"
                    placeholder="eleanor@sanctuary.com"
                    {...registerStep1('email')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <Mail className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errorsStep1.email && (
                  <p className="mt-1 text-[11px] text-error font-sans">
                    {errorsStep1.email.message}
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
                      <span>Sending verification code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to Verification</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2 FORM: 6-DIGIT OTP & PASSWORD CREATION */}
          {step === 'otp-password' && (
            <form onSubmit={handleSubmitStep2(onStep2Submit)} className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="reg-otp" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold">
                    6-Digit Verification Code
                  </label>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resendCooldown > 0 || submitting}
                    className="text-[11px] text-champagne hover:text-charcoal disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="reg-otp"
                    type="text"
                    maxLength={10}
                    placeholder="123456"
                    {...registerStep2('otp')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-center font-mono text-base tracking-widest text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <KeyRound className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errorsStep2.otp && (
                  <p className="mt-1 text-[11px] text-error font-sans">{errorsStep2.otp.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="reg-password" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Create Password (Min 8 chars, 1 letter, 1 number)
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...registerStep2('password')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errorsStep2.password && (
                  <p className="mt-1 text-[11px] text-error font-sans">
                    {errorsStep2.password.message}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="reg-confirm-password" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="reg-confirm-password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...registerStep2('confirmPassword')}
                    className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
                </div>
                {errorsStep2.confirmPassword && (
                  <p className="mt-1 text-[11px] text-error font-sans">
                    {errorsStep2.confirmPassword.message}
                  </p>
                )}
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="py-3 px-4 rounded text-xs font-semibold uppercase tracking-luxury border border-sand bg-white text-charcoal hover:border-champagne transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Spinner size={16} color="white" />
                      <span>Creating account...</span>
                    </>
                  ) : (
                    <>
                      <span>Complete Registration</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Already have an account prompt */}
          <div className="pt-4 border-t border-sand/60 text-center">
            <p className="text-xs text-warm-grey">
              Already have an account?{' '}
              <Link
                to="/login"
                className="font-medium text-charcoal hover:text-champagne transition-colors underline underline-offset-4"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
