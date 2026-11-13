import React, { useEffect, useState } from 'react';
import { hotelApi } from '../../api/hotelApi';
import { getAmenityIcon } from '../../utils/amenityIcons';
import { Sliders, RotateCcw, Check } from 'lucide-react';

export const FilterSidebar = ({
  minPrice = '',
  maxPrice = '',
  selectedAmenities = [],
  onPriceChange,
  onAmenitiesChange,
  onReset,
}) => {
  const [amenitiesList, setAmenitiesList] = useState([]);
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);

  useEffect(() => {
    let isMounted = true;
    const loadAmenities = async () => {
      try {
        const res = await hotelApi.getAmenities();
        if (isMounted && res?.data) {
          setAmenitiesList(res.data);
        }
      } catch (err) {
        console.error('Failed to load amenities', err);
      }
    };
    loadAmenities();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setLocalMin(minPrice);
    setLocalMax(maxPrice);
  }, [minPrice, maxPrice]);

  const handleApplyPrice = (e) => {
    e.preventDefault();
    onPriceChange(localMin, localMax);
  };

  const handleToggleAmenity = (code) => {
    const isSelected = selectedAmenities.includes(code);
    let updated;
    if (isSelected) {
      updated = selectedAmenities.filter((a) => a !== code);
    } else {
      updated = [...selectedAmenities, code];
    }
    onAmenitiesChange(updated);
  };

  return (
    <aside className="w-full bg-white border border-sand rounded p-6 shadow-architectural space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-sand/60">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-champagne" />
          <h3 className="font-serif text-lg text-charcoal">Filter Results</h3>
        </div>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-[11px] font-sans uppercase tracking-luxury text-warm-grey hover:text-charcoal transition-colors"
          title="Reset all filters"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

      {/* Price Range Filter */}
      <div className="space-y-3">
        <span className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold">
          Nightly Rate (₹)
        </span>
        <form onSubmit={handleApplyPrice} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-warm-grey uppercase">Min</label>
              <input
                type="number"
                placeholder="₹ Min"
                value={localMin}
                onChange={(e) => setLocalMin(e.target.value)}
                className="w-full bg-[#f6f3ee] border border-sand rounded px-2.5 py-1.5 text-xs text-charcoal focus:border-champagne focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] text-warm-grey uppercase">Max</label>
              <input
                type="number"
                placeholder="₹ Max"
                value={localMax}
                onChange={(e) => setLocalMax(e.target.value)}
                className="w-full bg-[#f6f3ee] border border-sand rounded px-2.5 py-1.5 text-xs text-charcoal focus:border-champagne focus:outline-none"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full py-1.5 px-3 rounded text-[11px] font-semibold tracking-luxury uppercase border border-charcoal bg-charcoal text-white hover:bg-champagne hover:border-champagne transition-colors"
          >
            Apply Price
          </button>
        </form>
      </div>

      {/* Amenities Multi-Select Filter */}
      {amenitiesList.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-sand/60">
          <span className="block text-[11px] font-sans uppercase tracking-luxury text-warm-grey font-semibold">
            Amenities & Comforts
          </span>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {amenitiesList.map((amenity) => {
              const code = amenity.code || amenity.name;
              const isChecked = selectedAmenities.includes(code);
              return (
                <label
                  key={amenity.id || code}
                  className="flex items-center gap-2.5 text-xs text-on-surface-variant hover:text-charcoal cursor-pointer select-none py-1"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleToggleAmenity(code)}
                    className="w-4 h-4 rounded border-sand text-champagne focus:ring-champagne"
                  />
                  <div className="text-champagne">
                    {getAmenityIcon(amenity.code, amenity.name, 'w-3.5 h-3.5')}
                  </div>
                  <span className="truncate">{amenity.name}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
};

export default FilterSidebar;
