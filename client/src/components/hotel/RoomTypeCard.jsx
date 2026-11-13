import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Users, Bed, Check, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { setDraftBooking } from '../../features/booking/bookingSlice';

export const RoomTypeCard = ({ roomType, hotel }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  if (!roomType) return null;

  const handleSelectRoom = () => {
    // Stage draft room selection into Redux
    dispatch(
      setDraftBooking({
        hotel: {
          id: hotel.id,
          name: hotel.name,
          slug: hotel.slug,
          city: hotel.location?.city || '',
          state: hotel.location?.state || '',
        },
        roomType: {
          id: roomType.id,
          name: roomType.name,
          description: roomType.description,
          maxGuests: roomType.maxGuests || 2,
          pricePerNight: roomType.pricePerNight,
          currency: roomType.currency || 'INR',
        },
      })
    );

    // Navigate to checkout or date selection
    navigate('/checkout');
  };

  return (
    <div className="bg-white border border-sand rounded p-6 sm:p-8 shadow-architectural hover:border-champagne/60 transition-all duration-300 flex flex-col md:flex-row md:items-center justify-between gap-6">
      {/* Room Details */}
      <div className="space-y-3 max-w-xl">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-sm bg-[#f6f3ee] border border-sand/60 text-warm-grey text-[11px] font-medium tracking-luxury uppercase">
          <Users className="w-3.5 h-3.5 text-champagne" />
          <span>Up to {roomType.maxGuests || 2} Guests</span>
        </div>

        <h3 className="font-serif text-2xl text-charcoal tracking-tight">
          {roomType.name}
        </h3>

        {roomType.description && (
          <p className="font-sans text-sm text-on-surface-variant font-light leading-relaxed">
            {roomType.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-warm-grey pt-1">
          <div className="flex items-center gap-1">
            <Bed className="w-3.5 h-3.5 text-champagne" />
            <span>King or Twin Sanctuary Bedding</span>
          </div>
          <div className="flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-champagne" />
            <span>Complimentary High-Speed WiFi</span>
          </div>
        </div>
      </div>

      {/* Pricing & Selection CTA */}
      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-sand/60 pt-4 md:pt-0 md:pl-8 shrink-0">
        <div className="text-left md:text-right mb-0 md:mb-4">
          <span className="block text-[10px] uppercase tracking-luxury text-warm-grey">
            Nightly Rate
          </span>
          <div className="flex items-baseline gap-1">
            <span className="font-serif text-2xl sm:text-3xl font-semibold text-charcoal">
              {formatCurrency(roomType.pricePerNight, roomType.currency)}
            </span>
            <span className="font-sans text-xs text-warm-grey">/ night</span>
          </div>
          <span className="text-[11px] text-warm-grey font-light">Taxes calculated at reservation</span>
        </div>

        <button
          onClick={handleSelectRoom}
          className="inline-flex items-center gap-2 px-6 py-3 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-all duration-300 shadow-sm"
        >
          <span>Select Suite</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default RoomTypeCard;
