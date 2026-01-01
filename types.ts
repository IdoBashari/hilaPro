export interface Contact {
  id: string;
  name: string;
  phone: string;
}
export interface Client {
  id: string;
  name: string;
  businessId: string;
  contacts: Contact[];
  email: string;
  address: string;
}
export interface Project {
  id: string;
  name: string;
  clientId: string;
  status: 'In Progress' | 'Completed' | 'On Hold';
}
export interface Resource {
  id: string;
  name: string;
  type: 'Offline' | 'Online' | 'Cinema' | 'Technical';
  color: string;
  listPrice: number;
}
export interface Personnel {
  id: string;
  name: string;
  role: string;
  rate: number;
}
export interface TechnicalService {
  id: string;
  name: string;
  price: number;
}
export interface Material {
    id: string;
    name: string;
    purchasePrice: number;
    sellingPrice: number;
}
export interface MaterialBooking {
    materialId: string;
    quantity: number;
    sellingPrice: number;
}
export interface Booking {
  id: string;
  projectId: string;
  clientId: string;
  resourceId: string;
  personnelId?: string;
  technicalServices: string[]; // array of service ids
  materials: MaterialBooking[];
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  notes: string;
  doNotChargeResource?: boolean;
  billed?: boolean;
  billedDate?: Date;
}
export interface User {
  id: string;
  username: string;
  password: string;
  email: string;
  role: 'admin' | 'technician';
}

// ================================================================
// REPORTS
// ================================================================

export interface Report {
  id: string;
  createdAt: Date;
  createdByUserId?: string;
  clientId?: string;
  projectId?: string;
  startDate: Date;
  endDate: Date;
  statusFilter: 'all' | 'open' | 'closed';
  totalAmount: number;
}

export interface ReportLineItem {
  id: string;
  reportId: string;
  bookingId?: string;
  date: string;
  clientName: string;
  projectName: string;
  description: string;
  notes: string;
  quantity: number;
  unit: string;
  price: number;
  total: number;
  billed: boolean;
}

export type ViewMode = 'day' | 'week' | 'month' | 'year';
export type AppView = 'calendar' | 'projects' | 'clients' | 'resources' | 'reports' | 'personnel' | 'services' | 'materials' | 'users';