export type ExpenseCategory = 'passagem_trem' | 'passagem_barco' | 'comida' | 'outro';

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  color_index: number;
  departure_country: string | null;
  departure_city: string | null;
  arrival_country: string | null;
  arrival_city: string | null;
  created_at: string;
}

export interface TripPerson {
  id: string;
  trip_id: string;
  name: string;
  age: number | null;
}

export interface TripRoute {
  id: string;
  trip_id: string;
  country: string;
  city: string;
  start_date: string | null;
  end_date: string | null;
  order_index: number;
  notes: string | null;
}

export interface Expense {
  id: string;
  trip_id: string;
  route_id: string | null;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  currency: string;
  expense_date: string | null;
}

export interface Flight {
  id: string;
  trip_id: string;
  description: string;
  amount: number;
  currency: string;
  flight_date: string | null;
}

export type TransportType = 'barco' | 'aviao' | 'trem' | 'carro' | 'onibus' | 'ferry' | 'mototaxi' | 'outro';

export interface TripTransport {
  id: string;
  trip_id: string;
  route_id: string | null;
  transport_type: TransportType;
  description: string | null;
  amount: number;
  currency: string;
  transport_date: string | null;
  flight_time: string | null;
  confirmation_code: string | null;
}

export type CollaboratorRole = 'viewer' | 'admin';

export interface TripCollaborator {
  id: string;
  trip_id: string;
  user_id: string;
  role: CollaboratorRole;
  email: string | null;
  created_at: string;
  full_name: string | null;
  photo_path: string | null;
}

export interface Hotel {
  id: string;
  trip_id: string;
  route_id: string | null;
  name: string;
  address: string | null;
  checkin: string | null;
  checkout: string | null;
  link: string | null;
  notes: string | null;
  amount: number;
  currency: string;
  reservation_file_path: string | null;
  reservation_number_decrypted: string | null;
}

export interface Place {
  id: string;
  route_id: string;
  name: string;
  notes: string | null;
  visited: boolean;
}

export interface TripWithRelations extends Trip {
  trip_people: TripPerson[];
  trip_routes: (TripRoute & { places: Place[] })[];
  expenses: Expense[];
  trip_transports: TripTransport[];
  hotels: Hotel[];
}

export type PersonalDocumentType = 'id' | 'passaporte' | 'outro';

export interface PersonalDocument {
  id: string;
  user_id: string;
  doc_type: PersonalDocumentType;
  label: string | null;
  file_path: string | null;
  created_at: string;
  document_number_decrypted: string | null;
}

export interface Profile {
  user_id: string;
  full_name: string | null;
  photo_path: string | null;
}
