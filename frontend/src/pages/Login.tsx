import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Fuel, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { errMsg } from '../lib/api';
import { ROLE_LABEL } from '../lib/format';

const DEMO_USERS = [
  { email: 'admin@meridianrefinery.ng', role: 'admin' },
  { email: 'director@meridianrefinery.ng', role: 'director' },
  { email: 'finance@meridianrefinery.ng', role: 'accountant' },
  { email: 'accountant@meridianrefinery.ng', role: 'accountant' },
  { email: 'auditor@meridianrefinery.ng', role: 'auditor' },
  { email: 'ops@meridianrefinery.ng', role: 'manager' },
  { email: 'operator@meridianrefinery.ng', role: 'operator' },
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
            <Fuel className="h-7 w-7 text-white" />
          </div>
          <div className="text-white">
            <h1 className="text-xl font-bold">Meridian Refinery</h1>
            <p className="text-xs uppercase tracking-widest text-brand-200">Finance &amp; Accounting System</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl">
          <h2 className="mb-1 text-lg font-bold text-slate-900">Sign in</h2>
          <p className="mb-5 text-sm text-slate-500">Use your role-specific credentials</p>
          <form onSubmit={submit} className="space-y-3">
            <div className="relative">
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
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input
                className="input pl-9"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button className="btn-primary w-full" disabled={loading || !email || !password}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-5 border-t border-slate-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Demo accounts</p>
            <div className="space-y-1">
              {DEMO_USERS.map((u) => (
                <button
                  key={u.email}
                  onClick={() => { setEmail(u.email); setPassword('Refinery@2026'); }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-brand-50 transition-colors"
                >
                  <span className="font-mono text-slate-600">{u.email}</span>
                  <span className="font-semibold text-brand-600">{ROLE_LABEL[u.role]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-slate-400">Password for all demo accounts: <span className="font-mono">Refinery@2026</span></p>
          </div>
        </div>
      </div>
    </div>
  );
};
