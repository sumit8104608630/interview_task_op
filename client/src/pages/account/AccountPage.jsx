import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { selectCustomer, clearCredentials } from '../../features/auth/authSlice';
import { addToast } from '../../features/ui/uiSlice';
import { apiClient } from '../../api/axiosClient';
import { User, Mail, Calendar, ShieldCheck, LogOut, Compass, ArrowRight } from 'lucide-react';

export const AccountPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const customer = useSelector(selectCustomer);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      dispatch(clearCredentials());
      dispatch(
        addToast({
          type: 'info',
          title: 'Signed Out',
          message: 'You have been safely signed out of your session.',
        })
      );
      navigate('/');
    } catch {
      dispatch(clearCredentials());
      navigate('/');
    }
  };

  return (
    <div className="w-full pb-24">
      {/* Editorial Header */}
      <section className="bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/70 py-12">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-champagne block mb-1">
                Atelier Profile
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight">
                Guest Sanctuary
              </h1>
              <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-1">
                Manage your credentials, reservations, and bespoke travel preferences.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold uppercase tracking-luxury text-error border border-error/30 hover:bg-error-container/20 transition-colors self-start sm:self-auto"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* Main Account Details */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Member Card */}
          <div className="md:col-span-1 bg-white border border-sand rounded p-6 shadow-architectural space-y-4 text-center">
            <div className="w-20 h-20 rounded-full bg-sand/60 text-charcoal flex items-center justify-center font-serif text-2xl font-semibold mx-auto border-2 border-sand">
              {customer?.fullName?.charAt(0)?.toUpperCase() || 'M'}
            </div>
            <div>
              <h3 className="font-serif text-xl text-charcoal font-semibold">
                {customer?.fullName || 'Distinguished Member'}
              </h3>
              <p className="font-sans text-xs text-warm-grey mt-0.5">{customer?.email}</p>
            </div>
            <div className="pt-2">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-sm bg-[#38765B]/10 text-[#38765B] text-[10px] font-semibold uppercase tracking-luxury border border-[#38765B]/20">
                <ShieldCheck className="w-3 h-3" />
                <span>Verified Member ({customer?.status || 'ACTIVE'})</span>
              </span>
            </div>
          </div>

          {/* Quick Actions / Shortcuts */}
          <div className="md:col-span-2 space-y-4">
            {/* Booking History Card */}
            <div className="bg-white border border-sand rounded p-6 shadow-architectural hover:border-champagne/60 transition-all duration-200 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-charcoal">
                  <Calendar className="w-5 h-5 text-champagne" />
                  <h4 className="font-serif text-lg font-semibold">My Reservations</h4>
                </div>
                <p className="text-xs text-on-surface-variant font-light">
                  View past and upcoming bookings, retrieve references, or request verified cancellation.
                </p>
              </div>
              <Link
                to="/account/bookings"
                className="px-4 py-2 rounded text-xs font-semibold uppercase tracking-luxury bg-charcoal text-white hover:bg-champagne transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>View Bookings</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Explore Sanctuaries Card */}
            <div className="bg-white border border-sand rounded p-6 shadow-architectural hover:border-champagne/60 transition-all duration-200 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-charcoal">
                  <Compass className="w-5 h-5 text-champagne" />
                  <h4 className="font-serif text-lg font-semibold">Explore the Collection</h4>
                </div>
                <p className="text-xs text-on-surface-variant font-light">
                  Discover 100 hand-selected boutique properties across premier Indian destinations.
                </p>
              </div>
              <Link
                to="/hotels"
                className="px-4 py-2 rounded text-xs font-semibold uppercase tracking-luxury border border-sand bg-white text-charcoal hover:border-champagne transition-colors shrink-0 flex items-center gap-1.5"
              >
                <span>Browse Hotels</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountPage;
