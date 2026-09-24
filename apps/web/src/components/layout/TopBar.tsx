import React from 'react';
import { Building2, Shield, User as UserIcon, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from './NotificationCenter';

export const TopBar: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-[#0f121a]/95 backdrop-blur-md border-b border-slate-800/80 px-6 flex items-center justify-between sticky top-0 z-10">
      {/* Branch selector / indicator */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-[#161a24] px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
          <Building2 className="h-3.5 w-3.5 text-gold-400" />
          <span className="text-slate-400">Branch:</span>
          <span className="font-semibold text-slate-200">Main Boutique & Lab</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-4">
        {/* In-App Notification Center */}
        <NotificationCenter />

        {/* User profile dropdown badge */}
        <div className="flex items-center space-x-3 pl-2 border-l border-slate-800">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-slate-800 to-slate-700 border border-gold-400/40 flex items-center justify-center text-gold-300 font-semibold text-xs">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-slate-200 leading-tight">
              {user?.fullName || 'Staff Member'}
            </div>
            <div className="text-[10px] text-gold-400 flex items-center space-x-1 font-medium">
              <Shield className="h-2.5 w-2.5" />
              <span>{user?.role}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
