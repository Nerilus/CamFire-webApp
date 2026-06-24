import React from 'react';
import { WarningIcon, XIcon } from './icons';

interface Props {
  message: string;
  onClose: () => void;
}

export const NearbyAlertBanner: React.FC<Props> = ({ message, onClose }) => (
  <div className="nearby-alert">
    <WarningIcon size={16} className="icon" />
    <span className="msg">{message}</span>
    <button className="close" onClick={onClose} aria-label="Fermer">
      <XIcon size={14} />
    </button>
  </div>
);
