import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { hotelApi } from '../api/hotelApi';
import ImageGallery from '../components/hotel/ImageGallery';
import RoomTypeCard from '../components/hotel/RoomTypeCard';
import { getLuxuryCategoryBadge } from '../utils/formatters';
import { getAmenityIcon } from '../utils/amenityIcons';
import { MapPin, ArrowLeft, ShieldCheck, Compass, AlertCircle } from 'lucide-react';

export const HotelDetailPage = () => {
  const { id } = useParams();
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchHotel = async () => {
      try {
        setLoading(true);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const res = await hotelApi.getHotelById(id);
        if (isMounted && res?.data) {
          setHotel(res.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err.status === 404
              ? 'Sanctuary not found. The property you are seeking may no longer be active.'
              : err.message || 'Unable to retrieve property details at this time.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    if (id) {
      fetchHotel();
    }

    return () => {
      isMounted = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-pulse">
        {/* Breadcrumb Skeleton */}
        <div className="w-48"><Skeleton height={16} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>

        {/* Title & Location Skeleton */}
        <div className="space-y-3">
          <div className="w-32"><Skeleton height={14} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
          <div className="w-3/4 max-w-xl"><Skeleton height={40} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
          <div className="w-64"><Skeleton height={16} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
        </div>

        {/* Gallery Skeleton */}
        <div className="aspect-[16/9] w-full bg-[#f0ede8] rounded overflow-hidden">
          <Skeleton height="100%" baseColor="#f0ede8" highlightColor="#fcf9f4" borderRadius={4} />
        </div>

        {/* Content Skeletons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-6">
          <div className="md:col-span-2 space-y-4">
            <Skeleton count={4} height={18} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>
          <div className="space-y-4">
            <Skeleton height={120} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !hotel) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-sand/40 flex items-center justify-center text-champagne mb-6">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="font-serif text-3xl text-charcoal">Property Unavailable</h1>
        <p className="font-sans text-sm text-on-surface-variant max-w-md mt-3 leading-relaxed">
          {error || 'The requested hotel could not be loaded.'}
        </p>
        <div className="mt-8">
          <Link
            to="/hotels"
            className="inline-flex items-center gap-2 px-6 py-3 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Sanctuaries</span>
          </Link>
        </div>
      </div>
    );
  }

  const categoryBadge = getLuxuryCategoryBadge(hotel.name);
  const locationText = hotel.location
    ? `${hotel.location.city}, ${hotel.location.state}, ${hotel.location.country}`
    : 'India';

  const roomCategories = hotel.roomCategories || hotel.roomTypes || [];

  return (
    <div className="w-full pb-28">
      {/* Editorial Breadcrumbs & Header */}
      <section className="bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/70 pt-8 pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb Navigation */}
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-warm-grey mb-6">
            <Link to="/" className="hover:text-charcoal transition-colors">Home</Link>
            <span>/</span>
            <Link to="/hotels" className="hover:text-charcoal transition-colors">Hotels</Link>
            {hotel.location?.city && (
              <>
                <span>/</span>
                <Link
                  to={`/hotels?city=${encodeURIComponent(hotel.location.city)}`}
                  className="hover:text-charcoal transition-colors"
                >
                  {hotel.location.city}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-charcoal font-medium truncate max-w-xs">{hotel.name}</span>
          </nav>

          {/* Hotel Title & Badges */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-sm bg-white border border-sand text-[10px] font-semibold tracking-luxury uppercase text-charcoal">
                {categoryBadge}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-luxury text-champagne font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Atelier Property</span>
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-charcoal tracking-tight">
              {hotel.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-warm-grey font-sans pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-champagne shrink-0" />
                <span>{hotel.addressLine || hotel.address_line}, {locationText}</span>
              </div>
              {hotel.postalCode && (
                <span className="font-mono text-[11px]">Pin: {hotel.postalCode}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-14">
        {/* Architectural Image Gallery */}
        <section aria-label="Hotel Gallery">
          <ImageGallery images={hotel.images} hotelName={hotel.name} />
        </section>

        {/* Narrative & Curated Amenities */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-4 border-t border-sand/70">
          {/* Property Description Narrative */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold block mb-2">
                Architectural Monograph
              </span>
              <h2 className="font-serif text-2xl sm:text-3xl text-charcoal">
                About the Sanctuary
              </h2>
            </div>

            <div className="prose prose-stone font-sans text-base text-on-surface-variant font-light leading-relaxed space-y-4">
              <p>
                {hotel.description ||
                  `${hotel.name} embodies the zenith of poised hospitality and timeless serenity. Situated in the heart of ${hotel.location?.city || 'India'}, the estate seamlessly balances modern luxury with heritage craftsmanship.`}
              </p>
              <p>
                Guests enjoy private balconies, artisan dining curated from seasonal local harvests, and dedicated concierge attendants available throughout their stay.
              </p>
            </div>
          </div>

          {/* Curated Amenities Showcase */}
          <div className="lg:col-span-5 bg-white border border-sand rounded p-8 shadow-architectural space-y-6">
            <div>
              <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold block mb-1">
                Curated Comforts
              </span>
              <h3 className="font-serif text-xl text-charcoal">
                Estate Amenities & Services
              </h3>
            </div>

            {hotel.amenities && hotel.amenities.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {hotel.amenities.map((amenity) => (
                  <div
                    key={amenity.id || amenity.code}
                    className="flex items-center gap-2.5 p-2 rounded bg-[#f6f3ee] border border-sand/40"
                  >
                    <div className="text-champagne shrink-0">
                      {getAmenityIcon(amenity.code, amenity.name, 'w-4 h-4')}
                    </div>
                    <span className="text-xs font-medium text-charcoal truncate">
                      {amenity.name}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-warm-grey font-light">
                Full concierge services, high-speed connectivity, and daily housekeeping included.
              </p>
            )}
          </div>
        </section>

        {/* Room Categories Section */}
        <section className="pt-8 border-t border-sand/70 space-y-8">
          <div>
            <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold block mb-2">
              Accommodations
            </span>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-serif text-3xl sm:text-4xl text-charcoal">
                  Available Suites & Villas
                </h2>
                <p className="font-sans text-sm text-on-surface-variant font-light mt-2">
                  Select your desired suite to proceed with real-time room availability and reservation.
                </p>
              </div>

              <Link
                to="/hotels"
                className="text-xs font-medium tracking-luxury uppercase text-champagne hover:text-charcoal transition-colors self-start sm:self-auto"
              >
                ← View Other Sanctuaries
              </Link>
            </div>
          </div>

          {/* Room Categories List */}
          <div className="space-y-6">
            {roomCategories.length > 0 ? (
              roomCategories.map((roomType) => (
                <RoomTypeCard key={roomType.id} roomType={roomType} hotel={hotel} />
              ))
            ) : (
              <div className="p-8 bg-white border border-sand rounded text-center">
                <p className="text-sm text-warm-grey">
                  No specific room categories are currently listed for online selection.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default HotelDetailPage;
