import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Compass, Search } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4">
      <div className="h-16 w-16 rounded-full bg-gold-500/10 border border-gold-400/20 flex items-center justify-center text-gold-400">
        <Compass className="h-8 w-8 animate-spin-slow" />
      </div>
      <h1 className="font-serif text-3xl font-bold text-foreground">404 - Essence Not Found</h1>
      <p className="max-w-md text-sm text-muted">
        The requested screen or formulation module does not exist or has been moved.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link to="/">
          <Button variant="primary" size="md">Return to Dashboard</Button>
        </Link>
        <Link to="/reports">
          <Button variant="outline" size="md">
            <Search className="mr-2 h-4 w-4" />
            Open Reports
          </Button>
        </Link>
      </div>
    </div>
  );
};
