import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  setCredentials,
  clearCredentials,
  setInitialized,
  selectIsAuthInitialized,
} from '../../features/auth/authSlice';
import { apiClient } from '../../api/axiosClient';
import Navbar from '../common/Navbar';
import Footer from '../common/Footer';
import ToastContainer from '../common/ToastContainer';
import Spinner from '../common/Spinner';

export const MainLayout = () => {
  const dispatch = useDispatch();
  const isAuthInitialized = useSelector(selectIsAuthInitialized);

  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        if (isMounted && response?.success && response?.data) {
          dispatch(
            setCredentials({
              customer: response.data,
              csrfToken: response.csrfToken || response.data?.csrfToken || null,
            })
          );
        }
      } catch (err) {
        // 401 is normal for guests/unauthenticated visitors
        if (isMounted) {
          dispatch(clearCredentials());
        }
      } finally {
        if (isMounted) {
          dispatch(setInitialized(true));
        }
      }
    };

    bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, [dispatch]);

  // Brief atmospheric loader during bootstrap to prevent flash of unauthenticated UI
  if (!isAuthInitialized) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center space-y-4">
        <h1 className="font-serif text-3xl tracking-tight text-charcoal">LuxeStay</h1>
        <Spinner size={32} color="champagne" />
        <span className="font-sans text-xs uppercase tracking-luxury text-warm-grey">
          Preparing your sanctuary...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface">
      <Navbar />
      <main className="flex-1 w-full">
        <Outlet />
      </main>
      <Footer />
      <ToastContainer />
    </div>
  );
};

export default MainLayout;
