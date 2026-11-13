import React from 'react';
import Skeleton from 'react-loading-skeleton';

export const HotelCardSkeleton = () => {
  return (
    <div className="bg-white border border-sand rounded overflow-hidden shadow-architectural flex flex-col">
      {/* 16:10 Aspect Ratio Image Skeleton */}
      <div className="aspect-[16/10] w-full overflow-hidden bg-[#f0ede8]">
        <Skeleton
          height="100%"
          baseColor="#f0ede8"
          highlightColor="#fcf9f4"
          borderRadius={0}
        />
      </div>

      {/* Card Body Skeleton */}
      <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Category Badge */}
          <div className="mb-2 w-28">
            <Skeleton height={14} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>

          {/* Title */}
          <div className="mb-2">
            <Skeleton height={24} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>

          {/* Location */}
          <div className="w-36 mb-4">
            <Skeleton height={14} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>

          {/* Amenities Chips */}
          <div className="flex gap-2 mb-4">
            <div className="w-16"><Skeleton height={20} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
            <div className="w-16"><Skeleton height={20} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
            <div className="w-16"><Skeleton height={20} baseColor="#f0ede8" highlightColor="#fcf9f4" /></div>
          </div>
        </div>

        {/* Footer: Price + Button */}
        <div className="pt-4 border-t border-sand/50 flex items-center justify-between">
          <div className="w-24">
            <Skeleton height={20} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>
          <div className="w-28">
            <Skeleton height={32} baseColor="#f0ede8" highlightColor="#fcf9f4" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HotelCardSkeleton;
