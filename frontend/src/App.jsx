import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';

// Pages
import Login from './pages/Login';
import Home from './pages/Home';
import AddQuestions from './pages/AddQuestions';
import PracticeSetup from './pages/PracticeSetup';
import PracticeRun from './pages/PracticeRun';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-darkBg text-slate-100 flex flex-col">
          {/* Global Header Navigation */}
          <Navbar />
          
          {/* Main Routing Container */}
          <main className="flex-grow pb-24 md:pb-16">
            <Routes>
              {/* Unauthenticated routes */}
              <Route path="/login" element={<Login />} />

              {/* Authenticated routes */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Home />} />
                <Route path="/add" element={<AddQuestions />} />
                <Route path="/practice" element={<PracticeSetup />} />
                <Route path="/practice/run" element={<PracticeRun />} />
                <Route path="/stats" element={<Stats />} />
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}
