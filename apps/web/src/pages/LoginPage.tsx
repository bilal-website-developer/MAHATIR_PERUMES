import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Sparkles, Lock, AlertCircle } from 'lucide-react';

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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
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

        </Card>
      </div>
    </div>
  );
};
