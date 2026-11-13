import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import { bookingApi } from '../../api/bookingApi';
import { BookingCard } from '../../components/booking/BookingCard';
import {
  Calendar,
  Compass,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';

export const MyBookingsPage = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [meta, setMeta] = useState({
    total: 0,
    page: 1,
    limit: 5,
    totalPages: 1,
  });

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const params = {
        page: currentPage,
        limit: 5,
        ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
      };

      const res = await bookingApi.getMyBookings(params);

      if (res?.success && res?.data) {
        setBookings(res.data.bookings || res.data || []);
        setMeta({
          total: res.data.total ?? (res.data.bookings ? res.data.bookings.length : 0),
          page: res.data.page ?? currentPage,
          limit: res.data.limit ?? 5,
          totalPages: res.data.totalPages ?? 1,
        });
      } else {
        setBookings([]);
      }
    } catch (err) {
      setError(
        err.message || 'Failed to retrieve your reservations from the ledger. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleStatusTabChange = (newStatus) => {
    if (newStatus === statusFilter) return;
    setStatusFilter(newStatus);
    setCurrentPage(1);
  };

  const handleCancelSuccess = (updatedData) => {
    // Optimistically update the status of the cancelled booking in state
    setBookings((prev) =>
      prev.map((b) => {
        const ref = b.bookingReference || b.reference;
        if (ref === updatedData?.bookingReference) {
          return {
            ...b,
            status: 'CANCELLED',
            cancelledAt: updatedData?.cancelledAt || new Date().toISOString(),
          };
        }
        return b;
      })
    );
  };

  return (
    <div className="w-full pb-28 pt-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Breadcrumb Link */}
        <div>
          <Link
            to="/account"
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest font-medium text-[#707973] hover:text-[#b08d57] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Profile Overview</span>
          </Link>
        </div>

        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-[#e6dfd3]">
          <div>
            <span className="text-xs uppercase tracking-widest font-semibold text-[#b08d57] block mb-1">
              Member Sanctuary Ledger
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl text-primary font-normal tracking-tight">
              My Reservations
            </h1>
            <p className="text-sm text-[#707973] font-light mt-1">
              Review current and historical stays, access vouchers, or request verified cancellations.
            </p>
          </div>

          <button
            type="button"
            onClick={fetchBookings}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded text-xs uppercase tracking-widest font-medium border border-[#d1c5b6] text-primary hover:border-[#b08d57] transition-colors self-start sm:self-auto"
            title="Refresh reservations"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-2 border-b border-[#e6dfd3] pb-px">
          {[
            { label: 'All Reservations', value: 'ALL' },
            { label: 'Confirmed', value: 'CONFIRMED' },
            { label: 'Cancelled', value: 'CANCELLED' },
          ].map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => handleStatusTabChange(tab.value)}
                className={`px-5 py-3 text-xs uppercase tracking-widest font-medium transition-all relative ${
                  isActive
                    ? 'text-primary font-semibold'
                    : 'text-[#707973] hover:text-primary'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#b08d57]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-[#ba1a1a]/10 border border-[#ba1a1a]/20 p-4 rounded text-sm text-[#ba1a1a] flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={fetchBookings}
              className="text-xs uppercase tracking-widest font-semibold underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Loading Skeletons */}
        {loading && (
          <div className="space-y-6">
            {[1, 2].map((n) => (
              <div
                key={n}
                className="bg-surface-container-lowest border border-[#e6dfd3] rounded p-6 sm:p-8 space-y-4 shadow-architectural"
              >
                <div className="flex justify-between items-center pb-4 border-b border-[#e6dfd3]">
                  <Skeleton width={180} height={20} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                  <Skeleton width={90} height={24} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                </div>
                <div className="space-y-2">
                  <Skeleton width="60%" height={28} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                  <Skeleton width="40%" height={16} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                  <Skeleton height={50} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                  <Skeleton height={50} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                  <Skeleton height={50} baseColor="#f6f3ee" highlightColor="#fcf9f4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && bookings.length === 0 && (
          <div className="bg-surface-container-lowest border border-[#e6dfd3] rounded p-12 text-center shadow-architectural space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#f6f3ee] border border-[#e6dfd3] text-[#b08d57] flex items-center justify-center mx-auto">
              <FolderOpen className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-serif text-2xl text-primary font-normal">
                No Reservations Found
              </h3>
              <p className="text-xs sm:text-sm text-[#707973] font-light mt-1 max-w-md mx-auto leading-relaxed">
                {statusFilter === 'ALL'
                  ? 'You currently have no reservation history recorded on your profile ledger.'
                  : `You currently have no ${statusFilter.toLowerCase()} reservations in this ledger view.`}
              </p>
            </div>
            <div className="pt-2">
              <Link
                to="/hotels"
                className="inline-flex items-center gap-2 px-6 py-3 rounded bg-primary text-white text-xs uppercase tracking-widest font-semibold hover:bg-[#b08d57] transition-all shadow-md"
              >
                <Compass className="w-4 h-4" />
                <span>Explore Luxury Sanctuaries</span>
              </Link>
            </div>
          </div>
        )}

        {/* Reservation Cards List */}
        {!loading && !error && bookings.length > 0 && (
          <div className="space-y-6">
            {bookings.map((item) => (
              <BookingCard
                key={item.bookingReference || item.id}
                booking={item}
                onCancelSuccess={handleCancelSuccess}
              />
            ))}

            {/* Pagination Controls */}
            {meta.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-[#e6dfd3] pt-6">
                <span className="text-xs text-[#707973]">
                  Page {meta.page} of {meta.totalPages} ({meta.total} Total)
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1 || loading}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="p-2 rounded border border-[#d1c5b6] text-primary hover:border-[#b08d57] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {Array.from({ length: meta.totalPages }, (_, i) => i + 1).map((pageNum) => (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                        pageNum === currentPage
                          ? 'bg-primary text-white font-semibold'
                          : 'border border-[#d1c5b6] text-primary hover:border-[#b08d57]'
                      }`}
                    >
                      {pageNum}
                    </button>
                  ))}

                  <button
                    type="button"
                    disabled={currentPage >= meta.totalPages || loading}
                    onClick={() => setCurrentPage((p) => Math.min(meta.totalPages, p + 1))}
                    className="p-2 rounded border border-[#d1c5b6] text-primary hover:border-[#b08d57] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyBookingsPage;
