import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export const NotFoundPage = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-sand/40 flex items-center justify-center text-champagne mb-6">
        <Compass className="w-8 h-8" />
      </div>

      <span className="font-sans text-xs uppercase tracking-luxury text-champagne font-semibold mb-2">
        404 — Page Not Found
      </span>

      <h1 className="font-serif text-3xl sm:text-4xl text-charcoal max-w-md">
        This Sanctuary Cannot Be Found
      </h1>

      <p className="font-sans text-sm text-on-surface-variant max-w-sm mt-4 leading-relaxed">
        The destination or page you are seeking does not exist or may have been relocated.
      </p>

      <div className="mt-8">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded text-xs font-semibold tracking-luxury uppercase bg-charcoal text-surface hover:bg-champagne hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return Home</span>
        </Link>
      </div>
    </div>
  );
};

export default NotFoundPage;
