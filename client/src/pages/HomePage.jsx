import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, ShieldCheck, Sparkles, ArrowRight, BedDouble } from 'lucide-react';

export const HomePage = () => {
  return (
    <div className="w-full">
      {/* Editorial Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/60 py-24 sm:py-32 lg:py-36">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-sm bg-white border border-sand mb-6">
            <Sparkles className="w-3.5 h-3.5 text-champagne" />
            <span className="font-sans text-[11px] font-semibold tracking-luxury uppercase text-charcoal">
              Modern Luxury Hospitality
            </span>
          </div>

          <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl tracking-tight text-charcoal max-w-4xl mx-auto leading-[1.12]">
            Exquisite Sanctuaries for the Discerning Traveler
          </h1>

          <p className="font-sans text-base sm:text-lg text-on-surface-variant max-w-2xl mx-auto mt-6 leading-relaxed font-light">
            A curated portfolio of architectural retreats, coastal havens, and heritage estates. Impeccable craftsmanship, poised tranquility, and zero compromise.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/hotels"
              className="w-full sm:w-auto px-8 py-3.5 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface border border-charcoal hover:bg-champagne hover:border-champagne hover:text-white transition-all duration-300 shadow-sm flex items-center justify-center gap-2 group"
            >
              <span>Explore Collection</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/booking/lookup"
              className="w-full sm:w-auto px-8 py-3.5 rounded text-xs font-semibold tracking-luxury uppercase bg-transparent border border-sand hover:border-champagne text-charcoal hover:bg-sand/30 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <Compass className="w-4 h-4 text-champagne" />
              <span>Find My Reservation</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Editorial Value Pillars */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="font-serif text-2xl sm:text-3xl text-charcoal">
            The Principles of Quiet Luxury
          </h2>
          <div className="w-12 h-0.5 bg-champagne mx-auto mt-4" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Pillar 1 */}
          <div className="p-8 bg-white border border-sand rounded shadow-architectural transition-all hover:border-champagne/60 group">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] text-champagne flex items-center justify-center mb-6 group-hover:bg-champagne group-hover:text-white transition-colors">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-charcoal mb-3">
              Guaranteed Atomic Reservations
            </h3>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Every stay is secured with real-time transactional database locks. We eliminate overbooking and ghost reservations at the architectural foundation.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-8 bg-white border border-sand rounded shadow-architectural transition-all hover:border-champagne/60 group">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] text-champagne flex items-center justify-center mb-6 group-hover:bg-champagne group-hover:text-white transition-colors">
              <BedDouble className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-charcoal mb-3">
              100 Hand-Crafted Properties
            </h3>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Explore meticulously detailed accommodations across premier destinations, from Mumbai and Goa to Jaipur and Udaipur.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-8 bg-white border border-sand rounded shadow-architectural transition-all hover:border-champagne/60 group">
            <div className="w-10 h-10 rounded bg-[#f6f3ee] text-champagne flex items-center justify-center mb-6 group-hover:bg-champagne group-hover:text-white transition-colors">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-lg font-semibold text-charcoal mb-3">
              Friction-Free Guest Checkout
            </h3>
            <p className="font-sans text-sm text-on-surface-variant leading-relaxed">
              Book effortlessly as an honored guest or access unified booking history through verified Atelier membership. Your privacy is paramount.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
