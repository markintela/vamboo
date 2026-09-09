import { Plane, Sailboat, TrainFront, Car, Bus, Ship, Motorbike, HelpCircle, type LucideIcon } from 'lucide-react';
import type { ExpenseCategory, TransportType, AccommodationType } from './types';

export const CATEGORY_META: Record<ExpenseCategory, { labelKey: string; color: string }> = {
  comida: { labelKey: 'expense.catFood', color: '#f0bc2e' },
  passagem_trem: { labelKey: 'expense.tagTrain', color: '#24b8bd' },
  passagem_barco: { labelKey: 'expense.tagBoat', color: '#2f9be0' },
  outro: { labelKey: 'expense.catOther', color: '#9a6fe0' },
};

export const TRANSPORT_TYPES: TransportType[] = ['barco', 'aviao', 'trem', 'carro', 'onibus', 'ferry', 'mototaxi', 'outro'];
export const TRANSPORT_META: Record<TransportType, { labelKey: string; color: string; icon: LucideIcon }> = {
  barco: { labelKey: 'transport.typeBarco', color: '#2f9be0', icon: Sailboat },
  aviao: { labelKey: 'transport.typeAviao', color: '#24b8bd', icon: Plane },
  trem: { labelKey: 'transport.typeTrem', color: '#23b287', icon: TrainFront },
  carro: { labelKey: 'transport.typeCarro', color: '#ef9a3d', icon: Car },
  onibus: { labelKey: 'transport.typeOnibus', color: '#9a6fe0', icon: Bus },
  ferry: { labelKey: 'transport.typeFerry', color: '#79c94a', icon: Ship },
  mototaxi: { labelKey: 'transport.typeMototaxi', color: '#f0bc2e', icon: Motorbike },
  outro: { labelKey: 'transport.typeOutro', color: '#e8524b', icon: HelpCircle },
};

export const ACCOMMODATION_TYPES: AccommodationType[] = ['hotel', 'casa', 'hostel', 'airbnb', 'guesthouse', 'camping', 'outra'];
export const ACCOMMODATION_META: Record<AccommodationType, { labelKey: string; color: string }> = {
  hotel: { labelKey: 'hotel.typeHotel', color: '#2f9be0' },
  casa: { labelKey: 'hotel.typeCasa', color: '#79c94a' },
  hostel: { labelKey: 'hotel.typeHostel', color: '#ef9a3d' },
  airbnb: { labelKey: 'hotel.typeAirbnb', color: '#e8524b' },
  guesthouse: { labelKey: 'hotel.typeGuesthouse', color: '#9a6fe0' },
  camping: { labelKey: 'hotel.typeCamping', color: '#23b287' },
  outra: { labelKey: 'hotel.typeOutra', color: '#f0bc2e' },
};
