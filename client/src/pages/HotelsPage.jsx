import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { hotelApi } from '../api/hotelApi';
import HotelCard from '../components/hotel/HotelCard';
import HotelCardSkeleton from '../components/hotel/HotelCardSkeleton';
import DestinationPills from '../components/hotel/DestinationPills';
import { SlidersHorizontal, ArrowUpDown, Compass, AlertCircle, RefreshCw } from 'lucide-react';

export const HotelsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // Query parameter state
  const cityParam = searchParams.get('city') || '';
  const sortByParam = searchParams.get('sortBy') || 'name';
  const sortOrderParam = searchParams.get('sortOrder') || 'asc';
  const pageParam = parseInt(searchParams.get('page') || '1', 10);

  // Local state
  const [hotels, setHotels] = useState([]);
  const [locations, setLocations] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 9, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch locations for destination filters
  useEffect(() => {
    let isMounted = true;
    const fetchLocations = async () => {
      try {
        setLocationsLoading(true);
        const res = await hotelApi.getLocations({ limit: 50 });
        if (isMounted && res?.data) {
          setLocations(res.data);
        }
      } catch (err) {
        console.error('Failed to load locations', err);
      } finally {
        if (isMounted) setLocationsLoading(false);
      }
    };
    fetchLocations();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch hotels whenever query params change
  useEffect(() => {
    let isMounted = true;
    const fetchHotels = async () => {
      try {
        setLoading(true);
        setError(null);
        window.scrollTo({ top: 0, behavior: 'smooth' });

        const res = await hotelApi.getHotels({
          city: cityParam || undefined,
          sortBy: sortByParam,
          sortOrder: sortOrderParam,
          page: pageParam,
          limit: 9,
        });

        if (isMounted && res?.data) {
          setHotels(res.data);
          setMeta(res.meta || { total: res.data.length, page: pageParam, limit: 9, totalPages: 1 });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to retrieve hotels at this moment.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchHotels();

    return () => {
      isMounted = false;
    };
  }, [cityParam, sortByParam, sortOrderParam, pageParam]);

  // Handle City Change
  const handleSelectCity = (newCity) => {
    const params = new URLSearchParams(searchParams);
    if (newCity) {
      params.set('city', newCity);
    } else {
      params.delete('city');
    }
    params.set('page', '1'); // Reset to first page
    setSearchParams(params);
  };

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

  // Handle Pagination Page Change
  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > meta.totalPages) return;
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    setSearchParams(params);
  };

  const currentSortValue = `${sortByParam}-${sortOrderParam}`;

  return (
    <div className="w-full pb-24">
      {/* Editorial Page Header */}
      <section className="bg-gradient-to-b from-[#f6f3ee] to-surface border-b border-sand/70 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold block mb-2">
              The Portfolio
            </span>
            <h1 className="font-serif text-3xl sm:text-5xl text-charcoal tracking-tight">
              Boutique Hotels & Architectural Retreats
            </h1>
            <p className="font-sans text-sm sm:text-base text-on-surface-variant font-light mt-3 leading-relaxed">
              Explore 100 fictional sanctuaries across India. Browse without dates or check availability for tailored dates.
            </p>
          </div>

          {/* Destination Filter Pills */}
          <div className="mt-8">
            <DestinationPills
              locations={locations}
              selectedCity={cityParam}
              onSelectCity={handleSelectCity}
              loading={locationsLoading}
            />
          </div>
        </div>
      </section>

      {/* Main Content & Listings Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {/* Controls Bar: Results Count + Sort Dropdown */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-sand/60 gap-4">
          <div>
            <p className="text-xs tracking-luxury uppercase text-warm-grey font-medium">
              {loading ? (
                'Discovering sanctuaries...'
              ) : (
                <>
                  Showing <span className="text-charcoal font-semibold">{hotels.length}</span> of{' '}
                  <span className="text-charcoal font-semibold">{meta.total}</span> Properties
                  {cityParam && (
                    <span>
                      {' '}
                      in <span className="text-charcoal font-semibold capitalize">{cityParam}</span>
                    </span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
            <label htmlFor="sortSelect" className="text-xs uppercase tracking-luxury text-warm-grey flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-champagne" />
              <span>Sort By:</span>
            </label>
            <select
              id="sortSelect"
              value={
                sortByParam === 'price'
                  ? `price-${sortOrderParam}`
                  : 'name-asc'
              }
              onChange={handleSortChange}
              className="bg-white border border-sand rounded px-3 py-1.5 text-xs font-sans text-charcoal focus:border-champagne focus:outline-none cursor-pointer"
            >
              <option value="name-asc">Name (A — Z)</option>
              <option value="price-asc">Price (Lowest First)</option>
              <option value="price-desc">Price (Highest First)</option>
            </select>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="my-8 p-6 bg-error-container/20 border border-error/30 rounded flex items-start gap-4">
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-serif text-base text-charcoal font-semibold">
                Unable to Load Collection
              </h3>
              <p className="text-sm text-on-surface-variant font-sans mt-1">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold uppercase tracking-luxury bg-charcoal text-white hover:bg-champagne transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry Connection</span>
              </button>
            </div>
          </div>
        )}

        {/* Hotels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pt-8">
          {loading
            ? Array.from({ length: 9 }).map((_, index) => (
                <HotelCardSkeleton key={index} />
              ))
            : hotels.map((hotel, index) => (
                <HotelCard key={hotel.id} hotel={hotel} index={index} />
              ))}
        </div>

        {/* Empty State */}
        {!loading && !error && hotels.length === 0 && (
          <div className="my-16 py-16 px-4 bg-white border border-sand rounded text-center max-w-lg mx-auto shadow-architectural">
            <Compass className="w-12 h-12 text-champagne mx-auto mb-4" />
            <h3 className="font-serif text-2xl text-charcoal">
              No Sanctuaries Located
            </h3>
            <p className="text-sm text-on-surface-variant font-sans mt-2 leading-relaxed">
              We couldn't find any properties matching the selected criteria. Try selecting another destination or resetting your filters.
            </p>
            <div className="mt-6">
              <button
                type="button"
                onClick={() => handleSelectCity('')}
                className="px-6 py-2.5 rounded text-xs font-semibold uppercase tracking-luxury bg-charcoal text-white hover:bg-champagne transition-colors"
              >
                View All Sanctuaries
              </button>
            </div>
          </div>
        )}

        {/* Server Pagination */}
        {!loading && !error && meta.totalPages > 1 && (
          <div className="mt-16 pt-8 border-t border-sand flex items-center justify-between">
            <button
              onClick={() => handlePageChange(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-5 py-2.5 rounded border border-sand bg-white text-xs font-semibold uppercase tracking-luxury text-charcoal hover:border-champagne disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>

            <div className="hidden sm:flex items-center space-x-2">
              {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((pageNum) => (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`w-9 h-9 rounded text-xs font-mono transition-colors ${
                    meta.page === pageNum
                      ? 'bg-charcoal text-white font-semibold'
                      : 'bg-white border border-sand text-charcoal hover:border-champagne'
                  }`}
                >
                  {pageNum}
                </button>
              ))}
            </div>

            <div className="sm:hidden font-mono text-xs text-warm-grey">
              Page {meta.page} of {meta.totalPages}
            </div>

            <button
              onClick={() => handlePageChange(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="px-5 py-2.5 rounded border border-sand bg-white text-xs font-semibold uppercase tracking-luxury text-charcoal hover:border-champagne disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default HotelsPage;
