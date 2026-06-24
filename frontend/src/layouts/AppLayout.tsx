import React from 'react';
import { Outlet } from 'react-router-dom';
import { BottomNav } from '../components/BottomNav';

export const AppLayout: React.FC = () => (
  <div className="app-shell">
    <Outlet />
    <BottomNav />
  </div>
);
