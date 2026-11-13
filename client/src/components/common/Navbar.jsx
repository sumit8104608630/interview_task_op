import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { selectCustomer, selectIsAuthenticated, clearCredentials } from '../../features/auth/authSlice';
import { selectMobileMenuOpen, toggleMobileMenu, setMobileMenuOpen, addToast } from '../../features/ui/uiSlice';
import { apiClient } from '../../api/axiosClient';
import { Menu, X, User, Calendar, LogOut, Compass } from 'lucide-react';

export const Navbar = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const customer = useSelector(selectCustomer);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const mobileMenuOpen = useSelector(selectMobileMenuOpen);

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
      dispatch(clearCredentials());
      dispatch(
        addToast({
          type: 'info',
          title: 'Signed Out',
          message: 'You have been logged out of your session.',
        })
      );
      navigate('/');
    } catch (err) {
      // Even if API fails, clear client credentials
      dispatch(clearCredentials());
      navigate('/');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full frosted-glass border-b border-sand/70 transition-colors print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        {/* Brand Logo & Editorial Monograph */}
        <Link
          to="/"
          className="group flex flex-col focus:outline-none"
          onClick={() => dispatch(setMobileMenuOpen(false))}
        >
          <span className="font-serif text-2xl sm:text-3xl tracking-tight text-charcoal group-hover:text-champagne transition-colors duration-300">
            LuxeStay
          </span>
          <span className="font-sans text-[10px] tracking-luxury uppercase text-warm-grey">
            Boutique Hotels & Retreats
          </span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link
            to="/hotels"
            className="text-sm tracking-wide text-on-surface-variant hover:text-champagne transition-colors duration-200"
          >
            Hotels & Sanctuaries
          </Link>
          <Link
            to="/booking/lookup"
            className="text-sm tracking-wide text-on-surface-variant hover:text-champagne transition-colors duration-200"
          >
            Find Reservation
          </Link>
          {isAuthenticated && (
            <Link
              to="/account/bookings"
              className="text-sm tracking-wide text-on-surface-variant hover:text-champagne transition-colors duration-200 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-champagne" />
              <span>My Bookings</span>
            </Link>
          )}
        </nav>

        {/* Desktop Auth Controls */}
        <div className="hidden md:flex items-center space-x-4">
          {isAuthenticated ? (
            <div className="flex items-center space-x-3">
              <Link
                to="/account"
                className="flex items-center space-x-2 py-1.5 px-3 rounded border border-sand bg-white hover:border-champagne transition-colors"
                title="Account Overview"
              >
                <div className="w-7 h-7 rounded-full bg-sand/60 text-charcoal flex items-center justify-center font-serif text-xs font-semibold">
                  {customer?.fullName?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <span className="text-xs font-medium text-charcoal max-w-[120px] truncate">
                  {customer?.fullName || 'My Account'}
                </span>
              </Link>
              <button
                onClick={handleLogout}
                className="p-2 text-outline hover:text-error transition-colors rounded hover:bg-error-container/20"
                title="Sign Out"
                aria-label="Sign out of account"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="px-4 py-2 text-xs font-medium tracking-luxury uppercase text-charcoal hover:text-champagne transition-colors"
              >
                Sign In
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 rounded text-xs font-medium tracking-luxury uppercase bg-charcoal text-surface border border-charcoal hover:bg-champagne hover:border-champagne hover:text-white transition-all duration-300 shadow-sm"
              >
                Join Atelier
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Menu Trigger */}
        <div className="flex md:hidden items-center">
          <button
            onClick={() => dispatch(toggleMobileMenu())}
            className="p-2 text-charcoal hover:text-champagne transition-colors rounded focus:outline-none"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-sand bg-surface px-6 pt-3 pb-6 space-y-4 animate-in slide-in-from-top-4">
          <nav className="flex flex-col space-y-3 pt-2">
            <Link
              to="/hotels"
              onClick={() => dispatch(setMobileMenuOpen(false))}
              className="text-base text-charcoal hover:text-champagne py-2 border-b border-sand/40"
            >
              Hotels & Sanctuaries
            </Link>
            <Link
              to="/booking/lookup"
              onClick={() => dispatch(setMobileMenuOpen(false))}
              className="text-base text-charcoal hover:text-champagne py-2 border-b border-sand/40"
            >
              Find Reservation
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/account/bookings"
                  onClick={() => dispatch(setMobileMenuOpen(false))}
                  className="text-base text-charcoal hover:text-champagne py-2 border-b border-sand/40 flex items-center justify-between"
                >
                  <span>My Bookings</span>
                  <Calendar className="w-4 h-4 text-champagne" />
                </Link>
                <Link
                  to="/account"
                  onClick={() => dispatch(setMobileMenuOpen(false))}
                  className="text-base text-charcoal hover:text-champagne py-2 border-b border-sand/40 flex items-center justify-between"
                >
                  <span>Account Profile</span>
                  <User className="w-4 h-4 text-champagne" />
                </Link>
              </>
            )}
          </nav>

          <div className="pt-2">
            {isAuthenticated ? (
              <button
                onClick={() => {
                  dispatch(setMobileMenuOpen(false));
                  handleLogout();
                }}
                className="w-full py-2.5 px-4 text-center text-xs uppercase tracking-luxury text-error border border-error/30 rounded hover:bg-error-container/20 transition-colors"
              >
                Sign Out
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Link
                  to="/login"
                  onClick={() => dispatch(setMobileMenuOpen(false))}
                  className="py-2.5 text-center text-xs font-medium tracking-luxury uppercase border border-sand bg-white text-charcoal rounded hover:border-champagne"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={() => dispatch(setMobileMenuOpen(false))}
                  className="py-2.5 text-center text-xs font-medium tracking-luxury uppercase bg-charcoal text-surface rounded hover:bg-champagne hover:text-white transition-colors"
                >
                  Join Atelier
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
