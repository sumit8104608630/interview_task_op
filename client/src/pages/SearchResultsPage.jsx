import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hotelApi } from '../api/hotelApi';
import SearchBar from '../components/search/SearchBar';
import FilterSidebar from '../components/search/FilterSidebar';
import HotelCard from '../components/hotel/HotelCard';
import HotelCardSkeleton from '../components/hotel/HotelCardSkeleton';
import { formatDisplayDate, calculateNights, getTodayIsoString, getFutureDateIsoString } from '../utils/dateUtils';
import { Compass, AlertCircle, ArrowUpDown, Calendar, CheckCircle, RefreshCw } from 'lucide-react';

export const SearchResultsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Extract query parameters
  const city = searchParams.get('city') || '';
  const checkIn = searchParams.get('checkIn') || getFutureDateIsoString(getTodayIsoString(), 7);
  const checkOut = searchParams.get('checkOut') || getFutureDateIsoString(getTodayIsoString(), 10);
  const guests = parseInt(searchParams.get('guests') || '2', 10);
  const rooms = parseInt(searchParams.get('rooms') || '1', 10);
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const amenitiesParam = searchParams.get('amenities') || '';
  const sortBy = searchParams.get('sortBy') || 'price';
  const sortOrder = searchParams.get('sortOrder') || 'asc';
  const page = parseInt(searchParams.get('page') || '1', 10);

  const selectedAmenities = amenitiesParam ? amenitiesParam.split(',') : [];

  // State
  const [hotels, setHotels] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 9, totalPages: 1 });
  const [stayMeta, setStayMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch search results on search parameters change
  useEffect(() => {
    let isMounted = true;

    const performSearch = async () => {
      try {
        setLoading(true);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const res = await hotelApi.searchHotels({
          city: city || undefined,
          checkIn,
          checkOut,
          guests,
          rooms,
          minPrice: minPrice ? Number(minPrice) : undefined,
          maxPrice: maxPrice ? Number(maxPrice) : undefined,
          amenities: amenitiesParam || undefined,
          sortBy,
          sortOrder,
          page,
          limit: 9,
        });

        if (isMounted && res?.data) {
          setHotels(res.data);
          setMeta(res.meta || { total: res.data.length, page, limit: 9, totalPages: 1 });
          if (res.meta?.stay) {
            setStayMeta(res.meta.stay);
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve available hotels for your requested dates.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    performSearch();

    return () => {
      isMounted = false;
    };
  }, [city, checkIn, checkOut, guests, rooms, minPrice, maxPrice, amenitiesParam, sortBy, sortOrder, page]);

  // Handle Sort Change
  const handleSortChange = (e) => {
    const value = e.target.value;
    const params = new URLSearchParams(searchParams);
    if (value === 'price-asc') {
      params.set('sortBy', 'price');
      params.set('sortOrder', 'asc');
    } else if (value === 'price-desc') {
      params.set('sortBy', 'price');
      params.set('sortOrder', 'desc');
    } else {
      params.set('sortBy', 'name');
      params.set('sortOrder', 'asc');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  // Handle Price Filter
  const handlePriceChange = (newMin, newMax) => {
    const params = new URLSearchParams(searchParams);
    if (newMin) params.set('minPrice', newMin);
    else params.delete('minPrice');

    if (newMax) params.set('maxPrice', newMax);
    else params.delete('maxPrice');

    params.set('page', '1');
    setSearchParams(params);
  };

  // Handle Amenities Filter
  const handleAmenitiesChange = (newAmenities) => {
    const params = new URLSearchParams(searchParams);
    if (newAmenities.length > 0) {
      params.set('amenities', newAmenities.join(','));
    } else {
      params.delete('amenities');
    }
    params.set('page', '1');
    setSearchParams(params);
  };

  // Handle Reset Filters
  const handleResetFilters = () => {
    const params = new URLSearchParams();
    if (city) params.set('city', city);
    params.set('checkIn', checkIn);
    params.set('checkOut', checkOut);
    params.set('guests', guests.toString());
    params.set('rooms', rooms.toString());
    params.set('page', '1');
    setSearchParams(params);
  };

  // Handle Page Change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > meta.totalPages) return;
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const nights = calculateNights(checkIn, checkOut);

  return (
    <div className="w-full pb-24">
      {/* Top Floating Search Bar */}
      <section className="bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/70 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
          <div className="text-center sm:text-left">
            <span className="font-sans text-[11px] uppercase tracking-luxury text-champagne font-semibold block mb-1">
              Verified Real-Time Inventory
            </span>
            <h1 className="font-serif text-2xl sm:text-4xl text-charcoal tracking-tight">
              Available Sanctuaries & Suites
            </h1>
            <p className="font-sans text-xs sm:text-sm text-on-surface-variant font-light mt-1">
              Showing verified accommodations with contiguous inventory for {formatDisplayDate(checkIn)} to {formatDisplayDate(checkOut)} ({nights} {nights === 1 ? 'night' : 'nights'}).
            </p>
          </div>

          <SearchBar
            initialValues={{ city, checkIn, checkOut, guests, rooms }}
            className="pt-2"
          />
        </div>
      </section>

      {/* Main Results Layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Filter Sidebar */}
          <div className="lg:col-span-3">
            <FilterSidebar
              minPrice={minPrice}
              maxPrice={maxPrice}
              selectedAmenities={selectedAmenities}
              onPriceChange={handlePriceChange}
              onAmenitiesChange={handleAmenitiesChange}
              onReset={handleResetFilters}
            />
          </div>

          {/* Right Column: Search Results */}
          <div className="lg:col-span-9 space-y-6">
            {/* Results Header / Sorter */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-sand/60 gap-4">
              <p className="text-xs tracking-luxury uppercase text-warm-grey font-medium">
                {loading ? (
                  'Checking live room availability...'
                ) : (
                  <>
                    <span className="text-[#38765B] font-semibold">{meta.total}</span> Available Properties
                    {city && (
                      <span>
                        {' '}
                        in <span className="text-charcoal font-semibold capitalize">{city}</span>
                      </span>
                    )}
                  </>
                )}
              </p>

              <div className="flex items-center gap-2">
                <label htmlFor="sortSelectSearch" className="text-xs uppercase tracking-luxury text-warm-grey flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5 text-champagne" />
                  <span>Sort:</span>
                </label>
                <select
                  id="sortSelectSearch"
                  value={
                    sortBy === 'price'
                      ? `price-${sortOrder}`
                      : 'name-asc'
                  }
                  onChange={handleSortChange}
                  className="bg-white border border-sand rounded px-3 py-1.5 text-xs font-sans text-charcoal focus:border-champagne focus:outline-none cursor-pointer"
                >
                  <option value="price-asc">Stay Price (Lowest First)</option>
                  <option value="price-desc">Stay Price (Highest First)</option>
                  <option value="name-asc">Property Name (A — Z)</option>
                </select>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-6 bg-error-container/20 border border-error/30 rounded flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-serif text-base text-charcoal font-semibold">
                    Search Error
                  </h3>
                  <p className="text-sm text-on-surface-variant font-sans mt-1">{error}</p>
                </div>
              </div>
            )}

            {/* Results Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading
                ? Array.from({ length: 6 }).map((_, idx) => (
                    <HotelCardSkeleton key={idx} />
                  ))
                : hotels.map((hotel, index) => (
                    <div key={hotel.id} className="relative flex flex-col h-full">
                      {/* Live Availability Badge */}
                      <div className="absolute top-2 right-2 z-10">
                        <span className="px-2 py-0.5 rounded-sm bg-[#38765B] text-white text-[10px] font-semibold tracking-luxury uppercase shadow-sm">
                          Available
                        </span>
                      </div>
                      <HotelCard hotel={hotel} index={index} />
                    </div>
                  ))}
            </div>

            {/* Empty State */}
            {!loading && !error && hotels.length === 0 && (
              <div className="my-16 py-16 px-4 bg-white border border-sand rounded text-center max-w-lg mx-auto shadow-architectural">
                <Compass className="w-12 h-12 text-champagne mx-auto mb-4" />
                <h3 className="font-serif text-2xl text-charcoal">
                  No Available Sanctuaries
                </h3>
                <p className="text-sm text-on-surface-variant font-sans mt-2 leading-relaxed">
                  Every property in this destination is either fully booked for your requested dates or does not meet your capacity criteria.
                </p>
                <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={handleResetFilters}
                    className="w-full sm:w-auto px-5 py-2.5 rounded text-xs font-semibold uppercase tracking-luxury bg-charcoal text-white hover:bg-champagne transition-colors"
                  >
                    Clear Filter Constraints
                  </button>
                  <Link
                    to="/hotels"
                    className="w-full sm:w-auto px-5 py-2.5 rounded text-xs font-semibold uppercase tracking-luxury border border-sand bg-white text-charcoal hover:border-champagne transition-colors"
                  >
                    Browse All 100 Hotels
                  </Link>
                </div>
              </div>
            )}

            {/* Pagination Controls */}
            {!loading && !error && meta.totalPages > 1 && (
              <div className="mt-12 pt-6 border-t border-sand flex items-center justify-between">
                <button
                  onClick={() => handlePageChange(meta.page - 1)}
                  disabled={meta.page <= 1}
                  className="px-4 py-2 rounded border border-sand bg-white text-xs font-semibold uppercase tracking-luxury text-charcoal hover:border-champagne disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>

                <span className="font-mono text-xs text-warm-grey">
                  Page {meta.page} of {meta.totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(meta.page + 1)}
                  disabled={meta.page >= meta.totalPages}
                  className="px-4 py-2 rounded border border-sand bg-white text-xs font-semibold uppercase tracking-luxury text-charcoal hover:border-champagne disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultsPage;
