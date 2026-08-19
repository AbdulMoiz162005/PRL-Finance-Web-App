import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fuel, Lock, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/api';
import { ROLE_LABEL } from '../lib/format';

const DEMO_USERS = [
  { email: 'admin@prl.com.pk', role: 'admin' },
  { email: 'director@prl.com.pk', role: 'director' },
  { email: 'finance@prl.com.pk', role: 'accountant' },
  { email: 'accountant@prl.com.pk', role: 'accountant' },
  { email: 'auditor@prl.com.pk', role: 'auditor' },
  { email: 'ops@prl.com.pk', role: 'manager' },
  { email: 'operator@prl.com.pk', role: 'operator' },
];

export const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      navigate('/');
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
      <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-prl-blue/25 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 animate-fade-in-up">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20 animate-pulse-soft">
            <Fuel className="h-7 w-7 text-white" />
          </div>
          <div className="text-white">
            <h1 className="text-xl font-bold">Pakistan Refinery Limited</h1>
            <p className="text-xs uppercase tracking-widest text-brand-200">Finance &amp; Accounting System</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl animate-fade-in-up dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800" style={{ animationDelay: '80ms' }}>
          <h2 className="mb-1 text-lg font-bold text-slate-900 dark:text-slate-100">Sign in</h2>
          <p className="mb-5 text-sm text-slate-500 dark:text-slate-400">Use your role-specific credentials</p>
          <form onSubmit={submit} className="space-y-3">
            <div className="relative animate-fade-in-up" style={{ animationDelay: '140ms' }}>
              <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
              />
            </div>
            <div className="relative animate-fade-in-up" style={{ animationDelay: '200ms' }}>
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-rose-600 animate-fade-in">{error}</p>}
            <button className="btn-primary w-full animate-fade-in-up" style={{ animationDelay: '260ms' }} disabled={loading || !email || !password}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in...</> : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4 animate-fade-in-up dark:border-slate-800" style={{ animationDelay: '320ms' }}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Demo accounts</p>
            <div className="space-y-1">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => { setEmail(u.email); setPassword('Refinery@2026'); }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-brand-50 dark:hover:bg-slate-800"
                >
                  <span className="font-mono text-slate-600 dark:text-slate-300">{u.email}</span>
                  <span className="font-semibold text-brand-600">{ROLE_LABEL[u.role]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500">Password for all demo accounts: <span className="font-mono">Refinery@2026</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};
