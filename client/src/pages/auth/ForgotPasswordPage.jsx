import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { authApi } from '../../api/authApi';
import { forgotPasswordSchema } from '../../features/auth/authSchemas';
import Spinner from '../../components/common/Spinner';
import { Mail, CheckCircle2, ArrowRight, ArrowLeft, ShieldCheck } from 'lucide-react';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values) => {
    try {
      setSubmitting(true);
      await authApi.forgotPassword({ email: values.email });
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch {
      // Even if API returns error, show generic delivery notice to prevent enumeration
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col justify-center py-12 sm:px-6 lg:px-8 bg-surface">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
          Credential Recovery
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight">
          Forgot Password
        </h1>
        <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-2 max-w-sm mx-auto">
          Enter your registered email address to receive password reset instructions.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white border border-sand rounded p-8 sm:p-10 shadow-architectural space-y-6">
          {submitted ? (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#f6f3ee] text-[#38765B] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="font-serif text-xl text-charcoal">Instructions Sent</h3>
                <p className="font-sans text-xs text-on-surface-variant mt-2 leading-relaxed">
                  If an account exists for <span className="font-medium text-charcoal">{submittedEmail}</span>, a 6-digit reset code has been dispatched.
                </p>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={() =>
                    navigate(`/reset-password?email=${encodeURIComponent(submittedEmail)}`)
                  }
                  className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-colors flex items-center justify-center gap-2"
                >
                  <span>Enter Reset Code</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-warm-grey hover:text-charcoal transition-colors py-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Return to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1.5">
                  Registered Email Address
                </label>
                <div className="relative">
                  <input
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

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
                >
                  {submitting ? (
                    <>
                      <Spinner size={16} color="white" />
                      <span>Sending reset code...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Reset Code</span>
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
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
