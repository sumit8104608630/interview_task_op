import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useDispatch } from 'react-redux';
import { authApi } from '../../api/authApi';
import { loginSchema } from '../../features/auth/authSchemas';
import { setCredentials } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import Spinner from '../../components/common/Spinner';
import { Lock, Mail, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [serverError, setServerError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      setServerError('');

      const res = await authApi.login({
        email: values.email,
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
            title: 'Welcome Back',
            message: `Signed in successfully as ${res.data.customer.fullName || res.data.customer.email}.`,
          })
        );

        // Redirect back to intended protected page or hotels
        const searchParams = new URLSearchParams(location.search);
        const redirectUrl = searchParams.get('redirect');
        const fromPath = redirectUrl || location.state?.from?.pathname || '/hotels';
        navigate(fromPath, { replace: true });
      }
    } catch (err) {
      setServerError(
        err.message || 'Invalid email or password. Please verify your credentials and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isSessionExpired = new URLSearchParams(location.search).get('expired') === 'true';

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
          Atelier Member Access
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight">
          Welcome Back
        </h1>
        <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-2 max-w-sm mx-auto">
          Sign in with your email and password to access your reservations and guest preferences.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural space-y-6">
          {/* Session Expired Notice */}
          {isSessionExpired && !serverError && (
            <div className="p-3.5 bg-sand/40 border border-champagne/40 rounded flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-champagne shrink-0 mt-0.5" />
              <p className="text-xs text-charcoal font-sans leading-relaxed">
                Your session has expired. Please sign in again to continue where you left off.
              </p>
            </div>
          )}

          {/* Server Error Notice */}
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
              <label htmlFor="login-email" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  id="login-email"
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

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-champagne hover:text-charcoal transition-colors tracking-wide"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  {...register('password')}
                  className="w-full bg-[#f6f3ee] border border-sand rounded px-3.5 py-2.5 text-xs sm:text-sm text-charcoal focus:border-champagne focus:bg-white focus:outline-none transition-colors"
                />
                <Lock className="w-4 h-4 text-warm-grey absolute right-3.5 top-3 pointer-events-none" />
              </div>
              {errors.password && (
                <p className="mt-1 text-[11px] text-error font-sans">{errors.password.message}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
              >
                {submitting ? (
                  <>
                    <Spinner size={16} color="white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Atelier</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Registration Prompt */}
          <div className="pt-4 border-t border-sand/60 text-center">
            <p className="text-xs text-warm-grey">
              Not yet a member of LuxeStay?{' '}
              <Link
                to="/register"
                className="font-medium text-charcoal hover:text-champagne transition-colors underline underline-offset-4"
              >
                Join the Atelier
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
