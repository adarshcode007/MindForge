import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div class="min-h-screen bg-darkBg flex items-center justify-center">
        <div class="relative w-16 h-16">
          <div class="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
          <div class="absolute inset-0 rounded-full border-4 border-t-indigo-500 animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children ? children : <Outlet />;
}
