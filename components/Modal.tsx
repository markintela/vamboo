'use client';

import { ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error?: string;
  success?: string;
}

export function Modal({ title, onClose, children, error, success }: ModalProps) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {error && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}
        {children}
      </div>
    </div>
  );
}
