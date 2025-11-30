
import { Resource, Personnel, TechnicalService, Project, Booking, Material, User, Client } from './types';

export const INITIAL_RESOURCES: Resource[] = [
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `offline-${i + 1}`,
    name: `חדר עריכה Offline ${i + 1}`,
    type: 'Offline' as const,
    color: 'bg-blue-200 border-blue-400 text-blue-800',
    listPrice: 1200,
  })),
  ...Array.from({ length: 3 }, (_, i) => ({
    id: `online-${i + 1}`,
    name: `חדר עריכה Online ${i + 1}`,
    type: 'Online' as const,
    color: 'bg-green-200 border-green-400 text-green-800',
    listPrice: 2500,
  })),
  {
    id: 'cinema-1',
    name: 'חדר עריכה קולנוע',
    type: 'Cinema' as const,
    color: 'bg-purple-200 border-purple-400 text-purple-800',
    listPrice: 4000,
  },
  {
    id: 'tech-room-1',
    name: 'חדר טכני',
    type: 'Technical' as const,
    color: 'bg-gray-200 border-gray-400 text-gray-800',
    listPrice: 500,
  },
];

export const INITIAL_PERSONNEL: Personnel[] = [
  { id: 'p-1', name: 'ישראל ישראלי', role: 'עורך וידאו', rate: 1500 },
  { id: 'p-2', name: 'משה כהן', role: 'עורך וידאו', rate: 1600 },
  { id: 'p-3', name: 'דנה לוי', role: 'קולוריסטית', rate: 2000 },
  { id: 'p-4', name: 'אביגיל שמש', role: 'סאונדמן', rate: 1800 },
];

export const INITIAL_TECHNICAL_SERVICES: TechnicalService[] = [
  { id: 'tech-1', name: 'המרת פורמט', price: 150 },
  { id: 'tech-2', name: 'שירותי אחסון (1TB)', price: 500 },
  { id: 'tech-3', name: 'QC', price: 300 },
  { id: 'tech-4', name: 'מאסטרינג סאונד', price: 800 },
];

export const INITIAL_MATERIALS: Material[] = [
    { id: 'mat-1', name: 'כונן קשיח SSD 1TB', purchasePrice: 250, sellingPrice: 400 },
    { id: 'mat-2', name: 'כונן קשיח HDD 4TB', purchasePrice: 300, sellingPrice: 500 },
];

export const INITIAL_USERS: User[] = [
  { id: 'user-1', username: 'admin', password: 'password123', email: 'admin@studioflow.com', role: 'admin' },
  { id: 'user-2', username: 'tech', password: 'password123', email: 'tech@studioflow.com', role: 'technician' },
];

export const INITIAL_CLIENTS: Client[] = [
    { 
        id: 'client-1', 
        name: 'קשת 12', 
        businessId: '514236589', 
        contacts: [{ id: 'c1', name: 'אבי כהן', phone: '050-1111111' }], 
        email: 'contact@keshet.co.il', 
        address: 'ראול ולנברג 12, תל אביב' 
    },
    { 
        id: 'client-2', 
        name: 'רשת 13', 
        businessId: '514236590', 
        contacts: [{ id: 'c2', name: 'מיכל לוי', phone: '050-2222222' }], 
        email: 'contact@reshet.tv', 
        address: 'הברזל 3, תל אביב' 
    },
    { 
        id: 'client-3', 
        name: 'כאן 11', 
        businessId: '514236591', 
        contacts: [{ id: 'c3', name: 'דוד ישראלי', phone: '050-3333333' }], 
        email: 'info@kan.org.il', 
        address: 'ירושלים' 
    },
    { 
        id: 'client-4', 
        name: 'yes', 
        businessId: '514236592', 
        contacts: [{ id: 'c4', name: 'רוני שמיר', phone: '050-4444444' }], 
        email: 'service@yes.co.il', 
        address: 'כפר סבא' 
    },
];

const today = new Date();
const getDay = (dayOffset: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + dayOffset);


export const INITIAL_PROJECTS: Project[] = [
    { id: 'project-1', name: 'הכוכב הבא לאירוויזיון', clientId: 'client-1', status: 'In Progress' },
    { id: 'project-2', name: 'האח הגדול', clientId: 'client-2', status: 'In Progress' },
    { id: 'project-3', name: 'קופה ראשית', clientId: 'client-3', status: 'Completed' },
    { id: 'project-4', name: 'פאודה', clientId: 'client-4', status: 'On Hold' },
];

export const INITIAL_BOOKINGS: Booking[] = [
  // Week 1
  { id: 'booking-1', projectId: 'project-1', clientId: 'client-1', resourceId: 'offline-1', personnelId: 'p-1', technicalServices: ['tech-1'], materials: [], startDate: getDay(0), endDate: getDay(2), startTime: '09:00', endTime: '18:00', notes: 'עריכת פרק 5' },
  { id: 'booking-2', projectId: 'project-2', clientId: 'client-2', resourceId: 'offline-2', personnelId: 'p-2', technicalServices: [], materials: [], startDate: getDay(1), endDate: getDay(3), startTime: '09:00', endTime: '18:00', notes: 'עריכת הדחה' },
  { id: 'booking-3', projectId: 'project-3', clientId: 'client-3', resourceId: 'online-1', personnelId: 'p-3', technicalServices: ['tech-3', 'tech-4'], materials: [], startDate: getDay(4), endDate: getDay(5), startTime: '09:00', endTime: '18:00', notes: 'מאסטרינג סאונד ו-QC' },

  // Week 2
  { id: 'booking-4', projectId: 'project-1', clientId: 'client-1', resourceId: 'offline-1', personnelId: 'p-1', technicalServices: ['tech-1'], materials: [], startDate: getDay(7), endDate: getDay(9), startTime: '09:00', endTime: '18:00', notes: 'עריכת פרק 6' },
  { id: 'booking-5', projectId: 'project-4', clientId: 'client-4', resourceId: 'cinema-1', personnelId: 'p-4', technicalServices: ['tech-4'], materials: [], startDate: getDay(8), endDate: getDay(12), startTime: '09:00', endTime: '18:00', notes: 'עריכת סאונד לסצנת אקשן' },

  // Week 3
  { id: 'booking-6', projectId: 'project-2', clientId: 'client-2', resourceId: 'offline-3', personnelId: 'p-2', technicalServices: [], materials: [], startDate: getDay(14), endDate: getDay(18), startTime: '09:00', endTime: '18:00', notes: 'עריכת פרק גמר' },
];
