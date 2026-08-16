import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { JournalEntries } from './pages/JournalEntries';
import { Invoices } from './pages/Invoices';
import { Payments } from './pages/Payments';
import { Inventory } from './pages/Inventory';
import { Payroll } from './pages/Payroll';
import { Assets } from './pages/Assets';
import { Tax } from './pages/Tax';
import { Reports } from './pages/Reports';
import { Budgets } from './pages/Budgets';
import { Reconciliations } from './pages/Reconciliations';
import { Approvals } from './pages/Approvals';
import { Audit } from './pages/Audit';
import { Masters } from './pages/Masters';
import { Settings } from './pages/Settings';
import { Surveyors } from './pages/Surveyors';

const Guard: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return (
      <Layout>
        <div className="card flex flex-col items-center justify-center p-12 text-center">
          <p className="text-lg font-bold text-slate-800">Access restricted</p>
          <p className="mt-1 text-sm text-slate-500">Your role does not have permission to view this page.</p>
        </div>
      </Layout>
    );
  }
  return <Layout>{children}</Layout>;
};

const page = (el: React.ReactNode, roles?: string[]) => <Guard roles={roles}>{el}</Guard>;

export const App: React.FC = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={page(<Dashboard />)} />
        <Route path="/journal" element={page(<JournalEntries />, ['admin', 'director', 'accountant'])} />
        <Route path="/invoices" element={page(<Invoices kind="sale" />, ['admin', 'director', 'accountant', 'manager'])} />
        <Route path="/purchases" element={page(<Invoices kind="purchase" />, ['admin', 'director', 'accountant', 'manager'])} />
        <Route path="/payments" element={page(<Payments />, ['admin', 'director', 'accountant', 'manager'])} />
        <Route path="/inventory" element={page(<Inventory />)} />
        <Route path="/payroll" element={page(<Payroll />, ['admin', 'director', 'accountant'])} />
        <Route path="/assets" element={page(<Assets />, ['admin', 'director', 'accountant', 'auditor'])} />
        <Route path="/tax" element={page(<Tax />, ['admin', 'director', 'accountant'])} />
        <Route path="/reports" element={page(<Reports />)} />
        <Route path="/budgets" element={page(<Budgets />, ['admin', 'director', 'accountant'])} />
        <Route path="/reconciliations" element={page(<Reconciliations />, ['admin', 'director', 'accountant'])} />
        <Route path="/approvals" element={page(<Approvals />)} />
        <Route path="/audit" element={page(<Audit />, ['admin', 'director', 'auditor'])} />
        <Route path="/masters" element={page(<Masters />)} />
        <Route path="/settings" element={page(<Settings />, ['admin'])} />
        <Route path="/surveyors" element={page(<Surveyors />, ['admin', 'director', 'accountant', 'auditor', 'manager'])} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);
