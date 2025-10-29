// src/App.tsx
import React from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Engines from './pages/Engines';
import Warehouse from './pages/Warehouse';
import Faults from './pages/Faults';
import Tests from './pages/Tests';
import Assembler from './pages/Assembler';
import Reports from './pages/Reports';
import Login from './pages/Login';

const AppLayout: React.FC = () => (
    <div className="flex bg-brand-dark text-white min-h-screen">
        <Sidebar />
        <main className="flex-1 p-8 ml-64 overflow-y-auto">
             <Outlet />
        </main>
    </div>
);

const App: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="flex justify-center items-center h-screen bg-brand-dark text-white">Loading...</div>; // Or a proper spinner
  }

  return (
      <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" />} />
          <Route path="/*" element={isAuthenticated ? <AppRoutes /> : <Navigate to="/login" />} />
      </Routes>
  );
};

const AppRoutes = () => (
    <Routes>
        <Route element={<AppLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/engines" element={<Engines />} />
            <Route path="/warehouse" element={<Warehouse />} />
            <Route path="/faults" element={<Faults />} />
            <Route path="/tests" element={<Tests />} />
            <Route path="/assembler" element={<Assembler />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<Navigate to="/" />} />
        </Route>
    </Routes>
);


export default App;
