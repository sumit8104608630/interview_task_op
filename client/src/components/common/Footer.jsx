import React from 'react';
import { Link } from 'react-router-dom';

export const Footer = () => {
  return (
    <footer className="w-full bg-[#f6f3ee] border-t border-sand/80 mt-auto print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
          {/* Brand & Manifesto Column */}
          <div className="md:col-span-5 space-y-4">
            <h3 className="font-serif text-2xl text-charcoal tracking-tight">
              LuxeStay
            </h3>
            <p className="font-sans text-xs uppercase tracking-luxury text-champagne font-medium">
              Curated Architectural Sanctuaries
            </p>
            <p className="font-sans text-sm text-on-surface-variant max-w-sm leading-relaxed">
              A bespoke collection of intimate boutique hotels, heritage villas, and architectural retreats designed for discerning travelers who revere quiet luxury, stately craftsmanship, and timeless hospitality.
            </p>
          </div>

          {/* Quick Links Column */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="font-sans text-xs uppercase tracking-luxury text-charcoal font-semibold">
              Discovery
            </h4>
            <ul className="space-y-2 text-sm text-on-surface-variant font-sans">
              <li>
                <Link to="/hotels" className="hover:text-champagne transition-colors">
                  All Properties & Sanctuaries
                </Link>
              </li>
              <li>
                <Link to="/booking/lookup" className="hover:text-champagne transition-colors">
                  Find Existing Reservation
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-champagne transition-colors">
                  Atelier Membership
                </Link>
              </li>
            </ul>
          </div>

          {/* Concierge & Security Column */}
          <div className="md:col-span-4 space-y-3">
            <h4 className="font-sans text-xs uppercase tracking-luxury text-charcoal font-semibold">
              Guest Care & Authenticity
            </h4>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Every reservation is held with real-time transactional inventory locking. Authenticated through secure cryptographic sessions and verified customer OTP protocols.
            </p>
            <div className="pt-2 text-xs text-warm-grey">
              <span>Customer Inquiries: concierge@luxestay.portfolio</span>
            </div>
          </div>
        </div>

        {/* Hairline Divider & Bottom Copyright */}
        <div className="mt-12 pt-8 border-t border-sand flex flex-col sm:flex-row items-center justify-between text-xs text-warm-grey space-y-4 sm:space-y-0">
          <p>© {new Date().getFullYear()} LuxeStay Hospitality Group. All rights reserved.</p>
          <div className="flex space-x-6">
            <span className="hover:text-charcoal cursor-pointer transition-colors">Privacy Policy</span>
            <span className="hover:text-charcoal cursor-pointer transition-colors">Terms of Hospitality</span>
            <span className="hover:text-charcoal cursor-pointer transition-colors">Anti-Overbooking Guarantee</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
