import React from 'react';
import { Building2, Shield, User as UserIcon, LogOut, Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { NotificationCenter } from './NotificationCenter';
import { ThemeToggle } from './ThemeToggle';
import { GlobalSearch } from './GlobalSearch';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export const TopBar: React.FC<{ isScrolled: boolean; onMenuOpen: () => void }> = ({ isScrolled, onMenuOpen }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = React.useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header
      data-print-hidden="true"
      className={`sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/80 bg-sidebar/95 px-6 backdrop-blur-md transition-shadow duration-200 ${isScrolled ? 'shadow-lg shadow-foreground/10' : 'shadow-none'
        }`}
    >
      {/* Branch selector / indicator */}
      <div className="flex items-center space-x-3">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onMenuOpen}
          className="rounded-lg p-2 text-muted hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center space-x-2 bg-surface px-3 py-1.5 rounded-lg border border-border/60 text-xs">
          <Building2 className="h-3.5 w-3.5 text-accent" />
          <span className="text-muted">Branch:</span>
          <span className="font-semibold text-foreground">Main Boutique & Lab</span>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center space-x-4">
        <GlobalSearch />
        {/* In-App Notification Center */}
        <NotificationCenter />
        <ThemeToggle />

        {/* User profile dropdown badge */}
        <div className="flex items-center space-x-3 pl-2 border-l border-border">
          <div className="h-8 w-8 rounded-full bg-surface border border-accent/40 flex items-center justify-center text-accent font-semibold text-xs">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="text-left hidden sm:block">
            <div className="text-xs font-semibold text-foreground leading-tight">
              {user?.fullName || 'Staff Member'}
            </div>
            <div className="text-[10px] text-accent flex items-center space-x-1 font-medium">
              <Shield className="h-2.5 w-2.5" />
              <span>{user?.role}</span>
            </div>
          </div>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="p-1.5 text-muted hover:text-danger rounded-lg transition-colors"
            title="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={showLogoutConfirm}
        title="Sign out of Mahatir ERP?"
        message="Your current session will end on this device. Any unsaved form changes will be lost."
        confirmLabel="Sign out"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
};
