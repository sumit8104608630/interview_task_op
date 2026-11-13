import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated, selectIsAuthInitialized } from '../../features/auth/authSlice';
import Spinner from '../common/Spinner';

export const ProtectedRoute = () => {
  const location = useLocation();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isAuthInitialized = useSelector(selectIsAuthInitialized);

  if (!isAuthInitialized) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <Spinner size={32} color="champagne" />
        <span className="font-sans text-xs uppercase tracking-luxury text-warm-grey">
          Validating atelier session...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated visitor to login, saving original destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
