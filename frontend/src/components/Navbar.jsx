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
    <>
      {/* Desktop Top Navbar */}
      <nav className="glass hidden md:flex sticky top-0 z-50 w-full px-8 py-4 shadow-lg justify-between items-center border-b border-darkBorder">
        <Link to="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-500 hover:opacity-90 font-display">
          RECALL
        </Link>
        
        <div className="flex items-center gap-3">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
                  isActive
                    ? 'bg-blue-600/10 text-blue-400 border-blue-500/25 shadow-md shadow-blue-950/20'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-900/40'
                }`}
              >
                <Icon size={16} />
                <span>{link.label}</span>
              </Link>
            );
          })}

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-350 hover:bg-rose-950/15 border border-transparent hover:border-rose-900/25 transition-all duration-200"
            title="Log Out"
          >
            <LogOut size={16} />
            <span>Log Out</span>
          </button>
        </div>
      </nav>

      {/* Mobile Bottom Tabbar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-darkCard/90 backdrop-blur-md border-t border-darkBorder flex justify-around items-center px-2 py-2 shadow-2xl">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = location.pathname === link.to;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-blue-400 font-bold'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              <Icon size={20} className={`transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[9px] mt-1 font-semibold tracking-wide uppercase">{link.label.split(' ')[0]}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
