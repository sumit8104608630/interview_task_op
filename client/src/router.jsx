import React from 'react';
import { createBrowserRouter } from 'react-router-dom';
import MainLayout from './components/layout/MainLayout';
import ProtectedRoute from './components/auth/ProtectedRoute';
import HomePage from './pages/HomePage';
import HotelsPage from './pages/HotelsPage';
import HotelDetailPage from './pages/HotelDetailPage';
import SearchResultsPage from './pages/SearchResultsPage';
import CheckoutPage from './pages/booking/CheckoutPage';
import BookingConfirmationPage from './pages/booking/BookingConfirmationPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AccountPage from './pages/account/AccountPage';
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
        path: 'checkout',
        element: <CheckoutPage />,
      },
      {
        path: 'booking/confirmation/:reference',
        element: <BookingConfirmationPage />,
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
        path: 'login',
        element: <LoginPage />,
      },
      {
        path: 'register',
        element: <RegisterPage />,
      },
      {
        path: 'forgot-password',
        element: <ForgotPasswordPage />,
      },
      {
        path: 'reset-password',
        element: <ResetPasswordPage />,
      },
      // Protected Account Routes
      {
        element: <ProtectedRoute />,
        children: [
          {
            path: 'account',
            element: <AccountPage />,
          },
          {
            path: 'account/bookings',
            element: (
              <div className="max-w-4xl mx-auto px-4 py-20 text-center">
                <h1 className="font-serif text-3xl text-charcoal mb-4">My Bookings</h1>
                <p className="text-sm text-on-surface-variant font-sans">
                  Authenticated customer booking history will be activated in Phase 6.
                </p>
              </div>
            ),
          },
        ],
      },
      {
        path: '*',
        element: <NotFoundPage />,
      },
    ],
  },
]);

export default router;
