import React from 'react';
import { Compass } from 'lucide-react';

export const DestinationPills = ({
  locations = [],
  selectedCity = '',
  onSelectCity,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-9 w-24 bg-[#f0ede8] animate-pulse rounded border border-sand/40 shrink-0"
          />
        ))}
      </div>
    );
  }

  if (!locations || locations.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 overflow-x-auto pb-3 pt-1 scrollbar-none no-scrollbar">
        {/* 'All' Pill */}
        <button
          type="button"
          onClick={() => onSelectCity('')}
          className={`shrink-0 px-4 py-2 rounded text-xs font-medium tracking-luxury uppercase transition-all duration-200 border ${
            !selectedCity
              ? 'bg-charcoal text-white border-charcoal shadow-sm'
              : 'bg-white text-charcoal border-sand hover:border-champagne hover:bg-sand/20'
          }`}
        >
          All Sanctuaries
        </button>

        {/* Location Pills */}
        {locations.map((loc) => {
          const isSelected = selectedCity.toLowerCase() === loc.city.toLowerCase();
          return (
            <button
              key={loc.id || loc.city}
              type="button"
              onClick={() => onSelectCity(loc.city)}
              className={`shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-medium tracking-luxury uppercase transition-all duration-200 border ${
                isSelected
                  ? 'bg-charcoal text-white border-charcoal shadow-sm'
                  : 'bg-white text-charcoal border-sand hover:border-champagne hover:bg-sand/20'
              }`}
            >
              <span>{loc.city}</span>
              {loc.hotelCount > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-sm ${
                    isSelected ? 'bg-champagne text-white' : 'bg-sand/60 text-charcoal'
                  }`}
                >
                  {loc.hotelCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default DestinationPills;
