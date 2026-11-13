import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
import HotelsPage from './pages/HotelsPage';
import HotelDetailPage from './pages/HotelDetailPage';
import SearchResultsPage from './pages/SearchResultsPage';
import NotFoundPage from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <NotFoundPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: 'hotels',
        element: <HotelsPage />,
      },
      {
        path: 'hotels/:id',
        element: <HotelDetailPage />,
      },
      {
        path: 'search',
        element: <SearchResultsPage />,
      },
      {
        path: 'availability',
        element: <SearchResultsPage />,
      },
      {
        path: 'booking/lookup',
        element: (
          <div className="max-w-xl mx-auto px-4 py-20 text-center">
            <h1 className="font-serif text-3xl text-charcoal mb-4">Find Reservation</h1>
            <p className="text-sm text-on-surface-variant font-sans">
              Booking lookup and management interface will be activated in Phase 6.
            </p>
          </div>
        ),
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export default router;
