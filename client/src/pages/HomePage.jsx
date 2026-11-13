import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hotelApi } from '../api/hotelApi';
import HotelCard from '../components/hotel/HotelCard';
import HotelCardSkeleton from '../components/hotel/HotelCardSkeleton';
import DestinationPills from '../components/hotel/DestinationPills';
import SearchBar from '../components/search/SearchBar';
import { Compass, ShieldCheck, Sparkles, ArrowRight, BedDouble } from 'lucide-react';

export const HomePage = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState([]);
  const [featuredHotels, setFeaturedHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);

  // Load premier locations and featured sanctuaries
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        setLocationsLoading(true);
        setLoading(true);

        const [locationsRes, hotelsRes] = await Promise.allSettled([
          hotelApi.getLocations({ limit: 10 }),
          hotelApi.getHotels({ limit: 4, sortBy: 'price', sortOrder: 'asc' }),
        ]);

        if (isMounted) {
          if (locationsRes.status === 'fulfilled' && locationsRes.value?.data) {
            setLocations(locationsRes.value.data);
          }
          if (hotelsRes.status === 'fulfilled' && hotelsRes.value?.data) {
            setFeaturedHotels(hotelsRes.value.data);
          }
        }
      } catch (err) {
        console.error('Home page data load error:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
          setLocationsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSelectCity = (city) => {
    if (city) {
      navigate(`/hotels?city=${encodeURIComponent(city)}`);
    } else {
      navigate('/hotels');
    }
  };

  return (
    <div className="w-full">
      {/* Editorial Hero Section with Search Ribbon */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/60 py-20 sm:py-28 lg:py-32">
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

          {/* Interactive Date-Wise Search Bar */}
          <div className="mt-12 text-left">
            <SearchBar />
          </div>

          {/* Destination Shortcuts */}
          <div className="mt-8 max-w-3xl mx-auto">
            <p className="text-[11px] font-sans uppercase tracking-luxury text-warm-grey mb-3 font-medium text-center">
              Or Explore By Destination
            </p>
            <DestinationPills
              locations={locations}
              selectedCity=""
              onSelectCity={handleSelectCity}
              loading={locationsLoading}
            />
          </div>
        </div>
      </section>

      {/* Featured Collection Section */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12">
          <div>
            <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold block mb-1">
              Curated Highlights
            </span>
            <h2 className="font-serif text-3xl sm:text-4xl text-charcoal">
              Featured Sanctuaries
            </h2>
          </div>
          <Link
            to="/hotels"
            className="text-xs font-semibold tracking-luxury uppercase text-champagne hover:text-charcoal transition-colors mt-4 sm:mt-0 inline-flex items-center gap-1 group"
          >
            <span>View All 100 Properties</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {/* Featured Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <HotelCardSkeleton key={i} />)
            : featuredHotels.map((hotel, index) => (
                <HotelCard key={hotel.id} hotel={hotel} index={index} />
              ))}
        </div>
      </section>

      {/* Editorial Value Pillars */}
      <section className="py-20 bg-[#f6f3ee] border-t border-sand/70">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed font-light">
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
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed font-light">
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
              <p className="font-sans text-sm text-on-surface-variant leading-relaxed font-light">
                Book effortlessly as an honored guest or access unified booking history through verified Atelier membership. Your privacy is paramount.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
