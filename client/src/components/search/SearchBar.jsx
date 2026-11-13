import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Calendar, Users, Search, AlertCircle } from 'lucide-react';
import { hotelApi } from '../../api/hotelApi';
import {
  getTodayIsoString,
  getFutureDateIsoString,
  validateStayDates,
} from '../../utils/dateUtils';

export const SearchBar = ({ initialValues = {}, className = '' }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Load locations for destination dropdown
  const [locations, setLocations] = useState([]);
  const [validationError, setValidationError] = useState('');

  // Form State
  const [city, setCity] = useState(
    initialValues.city || searchParams.get('city') || ''
  );
  const [checkIn, setCheckIn] = useState(
    initialValues.checkIn ||
      searchParams.get('checkIn') ||
      getFutureDateIsoString(getTodayIsoString(), 7)
  );
  const [checkOut, setCheckOut] = useState(
    initialValues.checkOut ||
      searchParams.get('checkOut') ||
      getFutureDateIsoString(getTodayIsoString(), 10)
  );
  const [guests, setGuests] = useState(
    parseInt(initialValues.guests || searchParams.get('guests') || '2', 10)
  );
  const [rooms, setRooms] = useState(
    parseInt(initialValues.rooms || searchParams.get('rooms') || '1', 10)
  );

  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        const res = await hotelApi.getLocations({ limit: 50 });
        if (isMounted && res?.data) {
          setLocations(res.data);
        }
      } catch (err) {
        console.error('Failed to load locations for search bar', err);
      }
    };
    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Update checkOut automatically if user picks checkIn after checkOut
  const handleCheckInChange = (newCheckIn) => {
    setCheckIn(newCheckIn);
    setValidationError('');
    if (newCheckIn >= checkOut) {
      setCheckOut(getFutureDateIsoString(newCheckIn, 2));
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();

    // Validate dates
    const validation = validateStayDates(checkIn, checkOut);
    if (!validation.valid) {
      setValidationError(validation.error);
      return;
    }

    setValidationError('');

    // Construct query parameters
    const params = new URLSearchParams();
    if (city.trim()) params.set('city', city.trim());
    params.set('checkIn', checkIn);
    params.set('checkOut', checkOut);
    params.set('guests', guests.toString());
    params.set('rooms', rooms.toString());
    params.set('page', '1');

    navigate(`/search?${params.toString()}`);
  };

  const todayStr = getTodayIsoString();
  const minCheckOutStr = checkIn ? getFutureDateIsoString(checkIn, 1) : todayStr;

  return (
    <div className={`w-full max-w-5xl mx-auto ${className}`}>
      <form
        onSubmit={handleSearch}
        className="bg-white border border-sand rounded p-3 sm:p-4 shadow-architectural"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4 items-center">
          {/* 1. Destination Field */}
          <div className="lg:col-span-3 relative border-b sm:border-b-0 sm:border-r border-sand/60 pb-3 sm:pb-0 sm:pr-3">
            <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
              Destination
            </label>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-champagne shrink-0" />
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full bg-transparent text-sm font-medium text-charcoal focus:outline-none cursor-pointer truncate"
              >
                <option value="">All Destinations (India)</option>
                {locations.map((loc) => (
                  <option key={loc.id || loc.city} value={loc.city}>
                    {loc.city}, {loc.state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 2. Check-In Date */}
          <div className="lg:col-span-3 relative border-b sm:border-b-0 sm:border-r border-sand/60 pb-3 sm:pb-0 sm:pr-3">
            <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
              Check-In
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-champagne shrink-0" />
              <input
                type="date"
                min={todayStr}
                value={checkIn}
                onChange={(e) => handleCheckInChange(e.target.value)}
                required
                className="w-full bg-transparent text-xs sm:text-sm font-mono text-charcoal focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Check-Out Date */}
          <div className="lg:col-span-3 relative border-b sm:border-b-0 sm:border-r border-sand/60 pb-3 sm:pb-0 sm:pr-3">
            <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
              Check-Out
            </label>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-champagne shrink-0" />
              <input
                type="date"
                min={minCheckOutStr}
                value={checkOut}
                onChange={(e) => {
                  setCheckOut(e.target.value);
                  setValidationError('');
                }}
                required
                className="w-full bg-transparent text-xs sm:text-sm font-mono text-charcoal focus:outline-none cursor-pointer"
              />
            </div>
          </div>

          {/* 4. Guests & Rooms Counter */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-sans uppercase tracking-luxury text-warm-grey font-semibold mb-1">
              Guests & Rooms
            </label>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Users className="w-4 h-4 text-champagne shrink-0" />
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full bg-transparent text-xs sm:text-sm font-medium text-charcoal focus:outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Guest' : 'Guests'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Multi-room quantity selector supported by backend */}
              <div className="flex items-center gap-1 text-xs">
                <select
                  value={rooms}
                  onChange={(e) => setRooms(Number(e.target.value))}
                  className="bg-transparent text-xs sm:text-sm font-medium text-charcoal focus:outline-none cursor-pointer"
                >
                  {[1, 2, 3, 4].map((num) => (
                    <option key={num} value={num}>
                      {num} {num === 1 ? 'Room' : 'Rooms'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 5. Search Submit CTA */}
          <div className="lg:col-span-12 sm:col-span-2 pt-2 sm:pt-0">
            <button
              type="submit"
              className="w-full py-3.5 px-6 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-all duration-300 flex items-center justify-center gap-2 shadow-sm"
            >
              <Search className="w-4 h-4" />
              <span>Search Sanctuaries</span>
            </button>
          </div>
        </div>

        {/* Validation Error Feedback */}
        {validationError && (
          <div className="mt-3 pt-2 border-t border-error/20 flex items-center gap-2 text-xs text-error font-sans">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}
      </form>
    </div>
  );
};

export default SearchBar;
