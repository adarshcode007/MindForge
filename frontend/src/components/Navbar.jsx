import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Award, BarChart3, Settings, PlusCircle, LogOut } from 'lucide-react';

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const links = [
    { to: '/', label: 'Decks', icon: BookOpen },
    { to: '/practice', label: 'Practice', icon: Award },
    { to: '/add', label: 'Add Questions', icon: PlusCircle },
    { to: '/stats', label: 'Stats', icon: BarChart3 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav class="glass sticky top-0 z-50 w-full px-6 py-4 shadow-lg flex justify-between items-center transition-all duration-300">
      <Link to="/" class="flex items-center gap-2 text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500 hover:opacity-90">
        RECALL
      </Link>
      
      {/* Navigation Links */}
      <div class="flex items-center gap-2 sm:gap-6">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
              }`}
            >
              <Icon size={16} />
              <span class="hidden md:inline">{link.label}</span>
            </Link>
          );
        })}

        {/* Log Out Button */}
        <button
          onClick={logout}
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 transition-all duration-200"
          title="Log Out"
        >
          <LogOut size={16} />
          <span class="hidden md:inline">Log Out</span>
        </button>
      </div>
    </nav>
  );
}
