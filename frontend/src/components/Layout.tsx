import React, { useCallback, useEffect, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, PenLine, FileText, ArrowLeftRight, Package, Factory,
  Wallet, BadgeDollarSign, FileBarChart, ListChecks, ScrollText, Users, Settings,
  LogOut, Scale, Gauge, Sun, Moon,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../lib/auth';
import { ROLE_LABEL } from '../lib/format';

export interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  roles: string[];
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'auditor', 'manager', 'operator'] },
  { to: '/journal', label: 'Journal Entries', icon: <PenLine className="h-4 w-4" />, roles: ['admin', 'director', 'accountant'] },
  { to: '/invoices', label: 'Sales Invoices', icon: <FileText className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'manager'] },
  { to: '/purchases', label: 'Purchase Bills', icon: <ArrowLeftRight className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'manager'] },
  { to: '/payments', label: 'Payments', icon: <Wallet className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'manager'] },
  { to: '/inventory', label: 'Inventory', icon: <Package className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'manager', 'operator'] },
  { to: '/payroll', label: 'Payroll', icon: <BadgeDollarSign className="h-4 w-4" />, roles: ['admin', 'director', 'accountant'] },
  { to: '/assets', label: 'Fixed Assets', icon: <Factory className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'auditor'] },
  { to: '/tax', label: 'Tax Management', icon: <Scale className="h-4 w-4" />, roles: ['admin', 'director', 'accountant'] },
  { to: '/surveyors', label: 'Surveyors & Pay Orders', icon: <Gauge className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'auditor', 'manager'] },
  { to: '/reports', label: 'Reports', icon: <FileBarChart className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'auditor', 'manager'] },
  { to: '/budgets', label: 'Budgets', icon: <Scale className="h-4 w-4" />, roles: ['admin', 'director', 'accountant'] },
  { to: '/reconciliations', label: 'Bank Recon', icon: <ArrowLeftRight className="h-4 w-4" />, roles: ['admin', 'director', 'accountant'] },
  { to: '/approvals', label: 'Approval Inbox', icon: <ListChecks className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'manager', 'auditor'] },
  { to: '/audit', label: 'Audit Trail', icon: <ScrollText className="h-4 w-4" />, roles: ['admin', 'director', 'auditor'] },
  { to: '/masters', label: 'Chart of Accounts', icon: <BookOpen className="h-4 w-4" />, roles: ['admin', 'director', 'accountant', 'auditor'] },
  { to: '/settings', label: 'Settings', icon: <Settings className="h-4 w-4" />, roles: ['admin'] },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const items = NAV.filter((i) => !user || i.roles.includes(user.role));

  const [navigating, setNavigating] = useState(false);
  useEffect(() => {
    setNavigating(true);
    const t = window.setTimeout(() => setNavigating(false), 500);
    return () => window.clearTimeout(t);
  }, [location.pathname]);

  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('rf_theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('rf_theme', dark ? 'dark' : 'light');
  }, [dark]);

  const doLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      <aside className="w-60 shrink-0 bg-ink-900 text-white flex flex-col">
        <div className="flex items-center gap-2.5 px-4 h-16 border-b border-white/10">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/95 ring-1 ring-white/20">
            <img src="/prl-logo.png" alt="PRL logo" className="h-8 w-8 object-contain" />
          </div>
          <div className="leading-tight min-w-0 flex-1">
            <p className="text-sm font-bold truncate">Pakistan Refinery Limited</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Finance System</p>
          </div>
          <button
            onClick={toggleTheme}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {items.map((i) => (
            <NavLink
              key={i.to}
              to={i.to}
              end={i.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                  isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {i.icon}
              {i.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-sm">
              {(user?.name || '?').slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xs font-semibold">{user?.name}</p>
              <p className="truncate text-[10px] text-slate-400">{user ? ROLE_LABEL[user.role] || user.role : ''}</p>
            </div>
            <button onClick={doLogout} title="Sign out" className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {navigating && (
          <div className="route-bar">
            <div className="route-bar-fill" />
          </div>
        )}
        <div key={location.pathname} className="page-enter mx-auto max-w-7xl p-5 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
