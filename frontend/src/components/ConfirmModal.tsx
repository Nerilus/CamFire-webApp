import React, { useEffect } from 'react';
import { WarningIcon, TrashIcon, XIcon } from './icons';
import './ConfirmModal.css';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemHighlight?: string;
  itemIcon?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemHighlight,
  itemIcon,
  confirmText = 'Supprimer',
  cancelText = 'Annuler',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onClose,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="confirm-modal-overlay" onClick={() => !isLoading && onClose()}>
      <div
        className="confirm-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          className="confirm-modal-close-btn"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Fermer"
        >
          <XIcon size={18} />
        </button>

        <div className={`confirm-modal-icon-badge ${isDestructive ? 'destructive' : 'warning'}`}>
          {isDestructive ? <TrashIcon size={28} /> : <WarningIcon size={28} />}
        </div>

        <h3 className="confirm-modal-title">{title}</h3>
        <p className="confirm-modal-message">{message}</p>

        {itemHighlight && (
          <div className="confirm-modal-highlight">
            {itemIcon && <span className="confirm-modal-highlight-icon">{itemIcon}</span>}
            <span className="confirm-modal-highlight-text">{itemHighlight}</span>
          </div>
        )}

        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-btn cancel"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-modal-btn confirm ${isDestructive ? 'destructive' : 'primary'}`}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="confirm-modal-loading-text">Patientez...</span>
            ) : (
              <>
                {isDestructive && <TrashIcon size={16} />}
                <span>{confirmText}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
