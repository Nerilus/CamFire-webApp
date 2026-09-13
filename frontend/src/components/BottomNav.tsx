import React from 'react';
import { NavLink } from 'react-router-dom';
import { HomeIcon, MapIcon, ClockIcon, BellIcon, UsersIcon } from './icons';

const items = [
  { to: '/home', label: 'Accueil', Icon: HomeIcon },
  { to: '/carte', label: 'Carte', Icon: MapIcon },
  { to: '/historique', label: 'Historique', Icon: ClockIcon },
  { to: '/alertes', label: 'Alertes', Icon: BellIcon },
  { to: '/profil', label: 'Profil', Icon: UsersIcon },
];

export const BottomNav: React.FC = () => (
  <nav className="bottom-nav">
    {items.map(({ to, label, Icon }) => (
      <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
        <Icon size={20} />
        <span>{label}</span>
      </NavLink>
    ))}
  </nav>
);
