import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import HomePage from './pages/HomePage';
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
        element: (
          <div className="max-w-7xl mx-auto px-4 py-16 text-center">
            <h1 className="font-serif text-3xl text-charcoal mb-4">Hotels Collection</h1>
            <p className="text-sm text-on-surface-variant font-sans">
              Discovering our 100 fictional sanctuaries across India... (Loading catalogue in Phase 2)
            </p>
          </div>
        ),
      },
      {
        path: 'booking/lookup',
        element: (
          <div className="max-w-xl mx-auto px-4 py-16 text-center">
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
