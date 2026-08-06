'use client';

import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  error?: string;
  success?: string;
}

// Renderizado via portal direto no <body>: o modal fica preso dentro do
// stacking context de .app-content (z-index:1) se renderizar no lugar
// normal, e a bottom-nav fixa do mobile (z-index:80, fora do
// .app-content) pinta por cima da parte de baixo dele — cobrindo os
// botões de salvar. O portal tira o modal de dentro desse contexto, daí
// o z-index:100 dele passa a competir de verdade com a bottom-nav.
export function Modal({ title, onClose, children, error, success }: ModalProps) {
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {error && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}
        {children}
      </div>
    </div>,
    document.body
  );
}
