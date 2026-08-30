import type { ExpenseCategory, TransportType } from './types';

export const CATEGORY_META: Record<ExpenseCategory, { labelKey: string; color: string }> = {
  comida: { labelKey: 'expense.catFood', color: '#f0bc2e' },
  passagem_trem: { labelKey: 'expense.tagTrain', color: '#24b8bd' },
  passagem_barco: { labelKey: 'expense.tagBoat', color: '#2f9be0' },
  outro: { labelKey: 'expense.catOther', color: '#9a6fe0' },
};

export const TRANSPORT_TYPES: TransportType[] = ['barco', 'aviao', 'trem', 'carro', 'onibus', 'ferry', 'mototaxi', 'outro'];
export const TRANSPORT_META: Record<TransportType, { labelKey: string; color: string }> = {
  barco: { labelKey: 'transport.typeBarco', color: '#2f9be0' },
  aviao: { labelKey: 'transport.typeAviao', color: '#24b8bd' },
  trem: { labelKey: 'transport.typeTrem', color: '#23b287' },
  carro: { labelKey: 'transport.typeCarro', color: '#ef9a3d' },
  onibus: { labelKey: 'transport.typeOnibus', color: '#9a6fe0' },
  ferry: { labelKey: 'transport.typeFerry', color: '#79c94a' },
  mototaxi: { labelKey: 'transport.typeMototaxi', color: '#f0bc2e' },
  outro: { labelKey: 'transport.typeOutro', color: '#e8524b' },
};
