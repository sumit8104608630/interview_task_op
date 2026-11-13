import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, ArrowRight } from 'lucide-react';
import { formatCurrency, getLuxuryCategoryBadge, getFallbackImage } from '../../utils/formatters';
import { getAmenityIcon } from '../../utils/amenityIcons';

export const HotelCard = ({ hotel, index = 0 }) => {
  if (!hotel) return null;

  // Extract primary image or fallback
  const primaryImage =
    hotel.images && hotel.images.length > 0
      ? hotel.images[0].url || hotel.images[0]
      : getFallbackImage(index);

  const categoryBadge = getLuxuryCategoryBadge(hotel.name);
  const locationText = hotel.location
    ? `${hotel.location.city}, ${hotel.location.state}`
    : 'India';

  const previewAmenities = (hotel.amenities || []).slice(0, 3);
  const hotelPath = `/hotels/${hotel.slug || hotel.id}`;

  return (
    <article className="group bg-white border border-sand rounded overflow-hidden shadow-architectural hover:border-champagne/60 transition-all duration-300 flex flex-col h-full">
      {/* Architectural Image with 1.02x scale zoom on hover */}
      <Link to={hotelPath} className="relative aspect-[16/10] w-full overflow-hidden block bg-sand/20">
        <img
          src={primaryImage}
          alt={hotel.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]"
          onError={(e) => {
            e.currentTarget.src = getFallbackImage(index);
          }}
        />
        <div className="absolute top-3 left-3">
          <span className="px-2.5 py-1 rounded-sm bg-surface/90 backdrop-blur-md border border-sand text-[10px] font-semibold tracking-luxury uppercase text-charcoal">
            {categoryBadge}
          </span>
        </div>
      </Link>

      {/* Card Content */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Location Line */}
          <div className="flex items-center gap-1.5 text-xs text-warm-grey mb-2">
            <MapPin className="w-3.5 h-3.5 text-champagne shrink-0" />
            <span className="tracking-wide uppercase text-[11px] font-medium">{locationText}</span>
          </div>

          {/* Hotel Name */}
          <h3 className="font-serif text-xl sm:text-2xl text-charcoal tracking-tight group-hover:text-champagne transition-colors duration-200 line-clamp-1 mb-2">
            <Link to={hotelPath}>{hotel.name}</Link>
          </h3>

          {/* Brief Description */}
          {hotel.description && (
            <p className="font-sans text-sm text-on-surface-variant line-clamp-2 leading-relaxed mb-4 font-light">
              {hotel.description}
            </p>
          )}

          {/* Amenities Preview Chips */}
          {previewAmenities.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {previewAmenities.map((amenity) => (
                <span
                  key={amenity.id || amenity.code}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-[#f6f3ee] text-charcoal text-[11px] font-medium border border-sand/40"
                  title={amenity.name}
                >
                  {getAmenityIcon(amenity.code, amenity.name, 'w-3 h-3 text-champagne')}
                  <span>{amenity.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Pricing & CTA Line */}
        <div className="pt-4 border-t border-sand/60 flex items-end justify-between mt-auto">
          <div>
            <span className="block text-[10px] uppercase tracking-luxury text-warm-grey">
              Rates Starting From
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-serif text-xl font-semibold text-charcoal">
                {formatCurrency(hotel.startingPrice)}
              </span>
              <span className="font-sans text-xs text-warm-grey">/ night</span>
            </div>
          </div>

          <Link
            to={hotelPath}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-all duration-300"
          >
            <span>View</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </article>
  );
};

export default HotelCard;
