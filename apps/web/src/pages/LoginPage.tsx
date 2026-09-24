import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, UserRole } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles, Shield, Lock, User, AlertCircle } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const { login, loginAs, isLoading } = useAuth();
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
      setError('Invalid email or password. Please try again or use a demo role below.');
    }
  };

  const handleRoleSelect = async (role: UserRole) => {
    await loginAs(role);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#090b0f] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 rounded-xl bg-gradient-to-br from-gold-300 via-gold-500 to-amber-700 items-center justify-center shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <Sparkles className="h-6 w-6 text-slate-950" />
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-wider gold-gradient-text">
            MAHATIR PERFUMES
          </h1>
          <p className="text-xs uppercase tracking-widest text-slate-400">
            Manufacturing ERP & Retail POS Portal
          </p>
        </div>

        {/* Login Card */}
        <Card goldBorder className="space-y-6 bg-[#131722]/95 backdrop-blur-xl p-8">
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

          {/* Quick Demo Role Switcher for Phase Verification */}
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-gold-400" />
                <span>Instant Demo Role Access:</span>
              </span>
              <span className="text-[10px] text-gold-400 font-semibold uppercase">Phase 1 Testing</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleRoleSelect('admin')}
                className="flex items-center gap-1.5 p-2 rounded-md bg-[#181d2a] hover:bg-gold-500/15 border border-slate-700/60 hover:border-gold-400/50 text-slate-200 transition-all text-left"
              >
                <User className="h-3.5 w-3.5 text-gold-400" />
                <div>
                  <div className="font-semibold text-[11px]">Admin</div>
                  <div className="text-[9px] text-slate-400">Full Access</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('production_manager')}
                className="flex items-center gap-1.5 p-2 rounded-md bg-[#181d2a] hover:bg-gold-500/15 border border-slate-700/60 hover:border-gold-400/50 text-slate-200 transition-all text-left"
              >
                <User className="h-3.5 w-3.5 text-gold-400" />
                <div>
                  <div className="font-semibold text-[11px]">Production</div>
                  <div className="text-[9px] text-slate-400">Lab & Batches</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('inventory_manager')}
                className="flex items-center gap-1.5 p-2 rounded-md bg-[#181d2a] hover:bg-gold-500/15 border border-slate-700/60 hover:border-gold-400/50 text-slate-200 transition-all text-left"
              >
                <User className="h-3.5 w-3.5 text-gold-400" />
                <div>
                  <div className="font-semibold text-[11px]">Inventory</div>
                  <div className="text-[9px] text-slate-400">Oils & POs</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSelect('sales_staff')}
                className="flex items-center gap-1.5 p-2 rounded-md bg-[#181d2a] hover:bg-gold-500/15 border border-slate-700/60 hover:border-gold-400/50 text-slate-200 transition-all text-left"
              >
                <User className="h-3.5 w-3.5 text-gold-400" />
                <div>
                  <div className="font-semibold text-[11px]">Sales Staff</div>
                  <div className="text-[9px] text-slate-400">POS & Counter</div>
                </div>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
