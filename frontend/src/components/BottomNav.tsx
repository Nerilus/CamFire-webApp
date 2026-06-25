import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, CameraIcon, MapIcon, ClockIcon, BellIcon, SettingsIcon } from './icons';

const items = [
  { to: '/home', label: 'ACCUEIL', Icon: HomeIcon },
  { to: '/scan', label: 'SCAN', Icon: CameraIcon },
  { to: '/carte', label: 'CARTE', Icon: MapIcon },
  { to: '/historique', label: 'HISTORIQUE', Icon: ClockIcon },
  { to: '/alertes', label: 'ALERTES', Icon: BellIcon },
  { to: '/reglages', label: 'RÉGLAGES', Icon: SettingsIcon },
];

export const BottomNav: React.FC = () => (
  <nav className="bottom-nav">
    {items.map(({ to, label, Icon }) => (
      <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon size={21} />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);
