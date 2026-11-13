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
import BookingLookupPage from './pages/booking/BookingLookupPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';
import ResetPasswordPage from './pages/auth/ResetPasswordPage';
import AccountPage from './pages/account/AccountPage';
import MyBookingsPage from './pages/account/MyBookingsPage';
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
        element: <BookingLookupPage />,
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
            element: <MyBookingsPage />,
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
