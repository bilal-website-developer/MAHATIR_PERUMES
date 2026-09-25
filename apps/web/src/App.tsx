import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { HealthPage } from './pages/HealthPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { LoginPage } from './pages/LoginPage';
import { AccessDeniedPage } from './pages/AccessDeniedPage';
import { NotFoundPage } from './pages/NotFoundPage';

import { RawMaterialsPage } from './pages/RawMaterialsPage';
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { FormulasPage } from './pages/FormulasPage';
import { BatchesPage } from './pages/BatchesPage';
import { BottlingPage } from './pages/BottlingPage';
import { PosPage } from './pages/PosPage';
import { DilutionPage } from './pages/DilutionPage';
import { ReportsPage } from './pages/ReportsPage';
import { TraceabilityPage } from './pages/TraceabilityPage';
import { AlertsPage } from './pages/AlertsPage';
import { ProductionSuggestionsPage } from './pages/ProductionSuggestionsPage';
import { CookieBanner } from './components/layout/CookieBanner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const ProtectedRoute: React.FC<{
  module: string;
  children: React.ReactElement;
}> = ({ module, children }) => {
  const { user, canAccess } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccess(module)) {
    return <Navigate to="/access-denied" replace />;
  }

  return children;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route
          path="settings"
          element={
            <ProtectedRoute module="settings">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute module="users">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit"
          element={
            <ProtectedRoute module="audit">
              <AuditLogPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="raw-materials"
          element={
            <ProtectedRoute module="raw_materials">
              <RawMaterialsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="purchase-orders"
          element={
            <ProtectedRoute module="purchases">
              <PurchaseOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="suppliers"
          element={
            <ProtectedRoute module="suppliers">
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="formulas"
          element={
            <ProtectedRoute module="formulas">
              <FormulasPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="batches"
          element={
            <ProtectedRoute module="batches">
              <BatchesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="finished-goods"
          element={
            <ProtectedRoute module="bottling">
              <BottlingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="bottling"
          element={
            <ProtectedRoute module="bottling">
              <BottlingPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="pos"
          element={
            <ProtectedRoute module="pos">
              <PosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="dilution"
          element={
            <ProtectedRoute module="dilution">
              <DilutionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="reports"
          element={
            <ProtectedRoute module="reports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="traceability"
          element={
            <ProtectedRoute module="reports">
              <TraceabilityPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="alerts"
          element={
            <ProtectedRoute module="dashboard">
              <AlertsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="suggestions"
          element={
            <ProtectedRoute module="batches">
              <ProductionSuggestionsPage />
            </ProtectedRoute>
          }
        />
        <Route path="access-denied" element={<AccessDeniedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <CookieBanner />
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
