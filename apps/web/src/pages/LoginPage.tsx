import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { BrandLogo } from '../components/layout/BrandLogo';
import { Lock, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const success = await login(email, password);
    if (success) {
      navigate('/');
    } else {
      setError('Invalid email or password. Please try again.');
    }
  };

  const handleQuickLogin = async (userEmail: string) => {
    setEmail(userEmail);
    setPassword('password123');
    const ok = await login(userEmail, 'password123');
    if (ok) navigate('/');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <BrandLogo centered />
          <p className="text-xs uppercase tracking-widest text-muted">Manufacturing ERP & Retail POS Portal</p>
        </div>

        {/* Login Card */}
        <Card goldBorder className="space-y-6 bg-card/95 backdrop-blur-xl p-8">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
              <Lock className="h-4 w-4 text-gold-400" />
              <span>Sign In to System</span>
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Enter your credentials to continue</p>
          </div>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 p-3 rounded-lg flex items-center gap-2.5 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="user@mahatir.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-2"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium tracking-wide uppercase text-slate-400">
                1-Click Quick Demo Sign-In
              </span>
              <span className="text-[10px] text-gold-400/80 font-mono">No password needed</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@mahatir.com')}
                className="p-2 text-left rounded-lg bg-slate-900/60 hover:bg-gold-500/10 border border-slate-800 hover:border-gold-500/40 transition-all text-xs"
              >
                <div className="font-semibold text-gold-300">👑 Admin</div>
                <div className="text-[10px] text-slate-400 truncate">Master Perfumer</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('production@mahatir.com')}
                className="p-2 text-left rounded-lg bg-slate-900/60 hover:bg-emerald-500/10 border border-slate-800 hover:border-emerald-500/40 transition-all text-xs"
              >
                <div className="font-semibold text-emerald-300">🧪 Production</div>
                <div className="text-[10px] text-slate-400 truncate">Lab & Batch Lead</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('inventory@mahatir.com')}
                className="p-2 text-left rounded-lg bg-slate-900/60 hover:bg-cyan-500/10 border border-slate-800 hover:border-cyan-500/40 transition-all text-xs"
              >
                <div className="font-semibold text-cyan-300">📦 Inventory</div>
                <div className="text-[10px] text-slate-400 truncate">Oils & Raw Materials</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('sales@mahatir.com')}
                className="p-2 text-left rounded-lg bg-slate-900/60 hover:bg-violet-500/10 border border-slate-800 hover:border-violet-500/40 transition-all text-xs"
              >
                <div className="font-semibold text-violet-300">💰 Sales Staff</div>
                <div className="text-[10px] text-slate-400 truncate">Retail POS Register</div>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};