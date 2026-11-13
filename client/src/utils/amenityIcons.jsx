import React from 'react';
import {
  Wifi,
  Waves,
  Sparkles,
  Utensils,
  Dumbbell,
  Car,
  Wind,
  Wine,
  Sun,
  Tv,
  Coffee,
  ConciergeBell,
  Bath,
} from 'lucide-react';

/**
 * Returns a corresponding semantic icon for a given amenity code or name
 * @param {string} [code='']
 * @param {string} [name='']
 * @param {string} [className='w-4 h-4']
 * @returns {React.ReactNode}
 */
export const getAmenityIcon = (code = '', name = '', className = 'w-4 h-4') => {
  const normalized = `${code} ${name}`.toUpperCase();

  if (normalized.includes('WIFI') || normalized.includes('INTERNET')) {
    return <Wifi className={className} />;
  }
  if (normalized.includes('POOL') || normalized.includes('SWIM')) {
    return <Waves className={className} />;
  }
  if (normalized.includes('SPA') || normalized.includes('WELLNESS') || normalized.includes('MASSAGE')) {
    return <Sparkles className={className} />;
  }
  if (normalized.includes('RESTAURANT') || normalized.includes('DINING') || normalized.includes('BREAKFAST') || normalized.includes('FOOD')) {
    return <Utensils className={className} />;
  }
  if (normalized.includes('GYM') || normalized.includes('FITNESS')) {
    return <Dumbbell className={className} />;
  }
  if (normalized.includes('PARKING') || normalized.includes('VALET')) {
    return <Car className={className} />;
  }
  if (normalized.includes('AIR') || normalized.includes('AC') || normalized.includes('CLIMATE')) {
    return <Wind className={className} />;
  }
  if (normalized.includes('BAR') || normalized.includes('LOUNGE') || normalized.includes('WINE')) {
    return <Wine className={className} />;
  }
  if (normalized.includes('BEACH') || normalized.includes('OCEAN') || normalized.includes('SEA')) {
    return <Sun className={className} />;
  }
  if (normalized.includes('TV') || normalized.includes('ENTERTAINMENT')) {
    return <Tv className={className} />;
  }
  if (normalized.includes('COFFEE') || normalized.includes('TEA')) {
    return <Coffee className={className} />;
  }
  if (normalized.includes('BATHTUB') || normalized.includes('JACUZZI')) {
    return <Bath className={className} />;
  }

  return <ConciergeBell className={className} />;
};
