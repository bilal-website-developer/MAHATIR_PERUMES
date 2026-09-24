import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { ShieldX } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AccessDeniedPage: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
        <ShieldX className="h-8 w-8" />
      </div>
      <h1 className="font-serif text-3xl font-bold text-slate-100">403 — Restricted Formulation Vault</h1>
      <p className="text-sm text-slate-400 max-w-md">
        Your current operational role (<span className="text-gold-300 font-semibold">{user?.role}</span>) does
        not have clearance to access this module.
      </p>
      <div className="flex gap-3 pt-2">
        <Link to="/">
          <Button variant="primary" size="md">
            Return to Authorized Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
};
