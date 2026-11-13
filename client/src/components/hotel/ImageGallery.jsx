import React, { useState } from 'react';
import { Sparkles, Maximize2, X } from 'lucide-react';
import { getFallbackImage } from '../../utils/formatters';

export const ImageGallery = ({ images = [], hotelName = 'Sanctuary' }) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // Normalize image objects or strings
  const formattedImages =
    images && images.length > 0
      ? images.map((img, i) => ({
          url: typeof img === 'string' ? img : img.url || getFallbackImage(i),
          altText: (typeof img === 'object' && img.altText) || `${hotelName} photo ${i + 1}`,
        }))
      : [{ url: getFallbackImage(0), altText: hotelName }];

  const currentImage = formattedImages[activeImageIndex] || formattedImages[0];

  return (
    <div className="w-full space-y-3">
      {/* Primary Featured Image */}
      <div className="relative aspect-[16/9] w-full bg-sand/30 rounded overflow-hidden shadow-architectural group">
        <img
          src={currentImage.url}
          alt={currentImage.altText}
          className="w-full h-full object-cover transition-all duration-500"
          onError={(e) => {
            e.currentTarget.src = getFallbackImage(activeImageIndex);
          }}
        />

        {/* Expand Action */}
        <button
          onClick={() => setLightboxOpen(true)}
          className="absolute bottom-4 right-4 p-2.5 rounded bg-charcoal/70 hover:bg-charcoal text-white backdrop-blur-sm transition-colors opacity-90 group-hover:opacity-100 flex items-center gap-1.5 text-xs font-sans tracking-luxury uppercase"
          aria-label="View photo in full screen"
        >
          <Maximize2 className="w-4 h-4" />
          <span className="hidden sm:inline">Expand Gallery</span>
        </button>

        {/* Image Counter */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-sm bg-surface/90 backdrop-blur-md border border-sand text-xs font-mono text-charcoal">
          {activeImageIndex + 1} / {formattedImages.length}
        </div>
      </div>

      {/* Thumbnail Strip (if more than 1 image) */}
      {formattedImages.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
          {formattedImages.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setActiveImageIndex(idx)}
              className={`relative aspect-[4/3] rounded overflow-hidden border transition-all duration-200 ${
                activeImageIndex === idx
                  ? 'border-champagne ring-2 ring-champagne/40'
                  : 'border-sand hover:border-charcoal/40 opacity-70 hover:opacity-100'
              }`}
            >
              <img
                src={img.url}
                alt={img.altText}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = getFallbackImage(idx);
                }}
              />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-charcoal/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in-50"
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="max-w-5xl w-full max-h-[85vh] flex flex-col items-center">
            <img
              src={currentImage.url}
              alt={currentImage.altText}
              className="max-h-[75vh] w-auto max-w-full object-contain rounded shadow-2xl"
            />
            <p className="mt-4 font-sans text-sm text-surface/80 tracking-wide text-center">
              {currentImage.altText} ({activeImageIndex + 1} of {formattedImages.length})
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
