
// FIX: Imported useEffect from React to fix 'Cannot find name' error.
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';

import { supabase } from './supabaseClient';

import { 
  convertResourceFromDB, convertResourceToDB, 
  convertBookingFromDB, convertBookingToDB, 
  convertClientFromDB, convertClientToDB,
  convertProjectFromDB, convertProjectToDB,
  convertPersonnelFromDB, convertPersonnelToDB,
  convertTechnicalServiceFromDB, convertTechnicalServiceToDB,
  convertMaterialFromDB, convertMaterialToDB,
  convertUserFromDB, convertUserToDB,
  convertContactFromDB, convertContactToDB
} from './helpers/supabaseHelpers';

import { AppView, ViewMode, Booking, Client, Project, Resource, Personnel, Contact, TechnicalService, Material, MaterialBooking, User } from './types';
import { INITIAL_RESOURCES, INITIAL_PERSONNEL, INITIAL_TECHNICAL_SERVICES, INITIAL_PROJECTS, INITIAL_BOOKINGS, INITIAL_MATERIALS, INITIAL_USERS, INITIAL_CLIENTS } from './constants';

// --- RESPONSIVE HOOK ---
const useIsMobile = (breakpoint = 768) => {
    const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < breakpoint);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [breakpoint]);

    return isMobile;
};


// --- HELPER FUNCTIONS ---
const getWeekDays = (date: Date): Date[] => {
    const startOfWeek = new Date(date);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
    startOfWeek.setHours(0,0,0,0);
    return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        return day;
    });
};

const getMonthDays = (date: Date): Date[] => {
    const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const startDate = new Date(startOfMonth);
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start from the Sunday of the first week
    const endDate = new Date(endOfMonth);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay())); // End on the Saturday of the last week

    const days = [];
    let current = new Date(startDate);
    while (current <= endDate) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
    }
    return days;
};

const formatDate = (date: Date, options?: Intl.DateTimeFormatOptions): string => {
    return new Intl.DateTimeFormat('he-IL', options).format(date);
};

const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

const generateId = () => `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const startOfDay = (date: Date) => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

const formatDateForInput = (date: Date): string => {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const createFullDateTime = (date: Date, time?: string): Date => {
    const newDate = new Date(date);
    if (time) {
        const [hours, minutes] = time.split(':').map(Number);
        newDate.setHours(hours, minutes, 0, 0);
    } else {
    }
    return newDate;
};


const findCollisions = (bookingToCheck: Partial<Booking> & {id?: string}, allBookings: Booking[], allResources: Resource[]): Booking[] => {
    if (!bookingToCheck.resourceId || !bookingToCheck.startDate || !bookingToCheck.endDate) {
        return [];
    }

    const resource = allResources.find(r => r.id === bookingToCheck.resourceId);
    if (resource && resource.type === 'Technical') {
        return []; // Technical room allows overlaps as per original logic
    }

    const checkStartDay = startOfDay(new Date(bookingToCheck.startDate));
    const checkEndDay = startOfDay(new Date(bookingToCheck.endDate));

    return allBookings.filter(existingBooking => {
        // Don't compare with itself
        if (bookingToCheck.id && existingBooking.id === bookingToCheck.id) return false;
        // Only check for the same resource
        if (existingBooking.resourceId !== bookingToCheck.resourceId) return false;

        const existingStartDay = startOfDay(new Date(existingBooking.startDate));
        const existingEndDay = startOfDay(new Date(existingBooking.endDate));
        
        // Check for date range overlap. This is the crucial part for multi-day bookings.
        const datesOverlap = checkStartDay <= existingEndDay && existingStartDay <= checkEndDay;

        if (!datesOverlap) {
            return false;
        }

        // If dates overlap, we need to check if times also overlap.
        const checkHasTime = bookingToCheck.startTime && bookingToCheck.endTime;
        const existingHasTime = existingBooking.startTime && existingBooking.endTime;

        // If either booking is a full-day booking (e.g. some technical tasks might not have times), any date overlap is a collision.
        // Assuming bookings without times are "all day".
        if (!checkHasTime || !existingHasTime) {
            return true;
        }

        // Both have times, so check for time overlap using string comparison.
        const timesOverlap = bookingToCheck.startTime! < existingBooking.endTime! && existingBooking.startTime! < bookingToCheck.endTime!;
        
        return timesOverlap;
    });
};


// --- GENERIC CRUD VIEW COMPONENT ---
interface CrudListViewProps<T extends { id: string }> {
    title?: string;
    items: T[];
    columns: { header: string; accessor: (item: T) => React.ReactNode }[];
    onAddItem?: () => void;
    onEditItem: (item: T) => void;
    onDeleteItem: (id: string) => void;
}

const CrudListView = <T extends { id: string }>({ title, items, columns, onAddItem, onEditItem, onDeleteItem }: CrudListViewProps<T>) => {
    return (
        <div>
            { (title || onAddItem) &&
              <div className="flex justify-between items-center mb-6">
                  {title && <h1 className="text-3xl font-bold text-gray-800">{title}</h1>}
                  {onAddItem && <button
                      onClick={onAddItem}
                      className="bg-studio-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300 flex items-center gap-2"
                  >
                      <i className="fas fa-plus"></i> הוסף חדש
                  </button>}
              </div>
            }
            <div className="bg-white shadow-md rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {columns.map(col => <th key={col.header} className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{col.header}</th>)}
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {items.map(item => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    {columns.map(col => <td key={col.header} className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{col.accessor(item)}</td>)}
                                    <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                                        <button onClick={() => onEditItem(item)} className="text-studio-blue-600 hover:text-studio-blue-900 mr-4"><i className="fas fa-pen"></i></button>
                                        <button onClick={() => { if (window.confirm('האם אתה בטוח שברצונך למחוק?')) onDeleteItem(item.id) }} className="text-red-600 hover:text-red-900"><i className="fas fa-trash"></i></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

// --- TYPE DEFINITIONS for MODALS ---
type BookingFormData = Omit<Booking, 'id'> & { id?: string };
interface CollisionDetails {
  bookingToSave: BookingFormData;
  collidingBookings: Booking[];
}

// --- SUB-COMPONENTS ---

const LoginScreen: React.FC<{ users: User[], onLogin: (user: User) => void, onForgotPasswordRequest: (email: string) => void }> = ({ users, onLogin, onForgotPasswordRequest }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [view, setView] = useState<'login' | 'forgot'>('login');
    const [email, setEmail] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const user = users.find(u => u.username === username && u.password === password);
        if (user) {
            onLogin(user);
        } else {
            setError('שם משתמש או סיסמה שגויים');
        }
    };

    const handleForgotPassword = (e: React.FormEvent) => {
        e.preventDefault();
        onForgotPasswordRequest(email);
        setView('login');
        setEmail('');
    };

    if (view === 'forgot') {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
                    <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">שחזור סיסמה</h2>
                    <form onSubmit={handleForgotPassword} className="space-y-6">
                        <p className="text-sm text-gray-600 text-center">הזן את כתובת המייל של המנהל כדי להתחיל בתהליך איפוס סיסמה.</p>
                        <InputGroup label="אימייל" type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} required />
                        <button type="submit" className="w-full bg-studio-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300">שלח</button>
                        <button type="button" onClick={() => setView('login')} className="w-full text-center text-sm text-studio-blue-600 hover:underline">חזור למסך הכניסה</button>
                    </form>
                </div>
            </div>
        );
    }
    
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">StudioFlow</h2>
                <p className="text-center text-gray-500 mb-8">ניהול סטודיו פוסט</p>
                <form onSubmit={handleLogin} className="space-y-6">
                    <InputGroup label="שם משתמש" name="username" value={username} onChange={e => setUsername(e.target.value)} required />
                    <PasswordInputGroup label="סיסמה" name="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" className="w-full bg-studio-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300">כניסה</button>
                    <div className="text-center">
                        <button type="button" onClick={() => setView('forgot')} className="text-sm text-studio-blue-600 hover:underline">שכחתי סיסמה (למנהלים)</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const PasswordResetScreen: React.FC<{ user: User, onReset: (userId: string, newPass: string) => void, onCancel: () => void }> = ({ user, onReset, onCancel }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!password || !confirmPassword) {
            setError('נא למלא את שני השדות.');
            return;
        }
        if (password !== confirmPassword) {
            setError('הסיסמאות אינן תואמות.');
            return;
        }
        onReset(user.id, password);
    };
    
    return (
        <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
                <h2 className="text-3xl font-bold text-center text-gray-800 mb-6">איפוס סיסמה</h2>
                <p className="text-center text-gray-600 mb-4">איפוס סיסמה עבור <strong>{user.username}</strong></p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <PasswordInputGroup label="סיסמה חדשה" name="password" value={password} onChange={e => setPassword(e.target.value)} required />
                    <PasswordInputGroup label="אישור סיסמה חדשה" name="confirmPassword" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button type="submit" className="w-full bg-studio-blue-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300">אפס סיסמה</button>
                    <button type="button" onClick={onCancel} className="w-full text-center text-sm text-studio-blue-600 hover:underline">חזור למסך הכניסה</button>
                </form>
            </div>
        </div>
    );
};

const ConfirmationModal: React.FC<{
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmButtonText?: string;
    isDestructive?: boolean;
}> = ({ title, message, onConfirm, onCancel, confirmButtonText = "אישור", isDestructive = false }) => {
    const confirmButtonClasses = isDestructive 
        ? "bg-red-600 text-white hover:bg-red-700" 
        : "bg-cyan-500 text-white hover:bg-cyan-600";
    
    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-md p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{title}</h3>
                <p className="text-slate-600 mb-8">{message}</p>
                <div className="flex justify-end gap-4">
                    <button onClick={onCancel} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300">ביטול</button>
                    <button onClick={onConfirm} className={`${confirmButtonClasses} py-2 px-5 rounded-lg transition duration-300`}>{confirmButtonText}</button>
                </div>
            </div>
        </div>
    );
};

const UpdateSeriesModal: React.FC<{
    onConfirmSingle: () => void;
    onConfirmAll: () => void;
    onCancel: () => void;
}> = ({ onConfirmSingle, onConfirmAll, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-lg p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">עדכון סדרת הזמנות</h3>
                <p className="text-slate-600 mb-8">להזמנה זו קיימים רישומים עתידיים נוספים. שינוי החדר ישפיע על המשך הסדרה. כיצד תרצה להמשיך?</p>
                <div className="flex flex-col sm:flex-row justify-end gap-4">
                    <button onClick={onCancel} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300 order-3 sm:order-1">ביטול</button>
                    <button onClick={onConfirmSingle} className="bg-white border border-studio-blue-500 text-studio-blue-600 py-2 px-5 rounded-lg hover:bg-studio-blue-50 transition duration-300 order-2 sm:order-2">רק הזמנה זו</button>
                    <button onClick={onConfirmAll} className="bg-studio-blue-500 text-white py-2 px-5 rounded-lg hover:bg-studio-blue-600 transition duration-300 order-1 sm:order-3">הזמנה זו וכל העתידיות</button>
                </div>
            </div>
        </div>
    );
};

const UpdateMultiDayMoveModal: React.FC<{
    onConfirmSingle: () => void;
    onConfirmAll: () => void;
    onCancel: () => void;
}> = ({ onConfirmSingle, onConfirmAll, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onCancel}>
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-lg p-8" onClick={e => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-slate-900 mb-4">הזזת הזמנה מרובת ימים</h3>
                <p className="text-slate-600 mb-8">ההזמנה שגררת הינה מרובת ימים. כיצד תרצה להחיל את השינוי?</p>
                <div className="flex flex-col sm:flex-row justify-end gap-4">
                    <button onClick={onCancel} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300 order-3 sm:order-1">ביטול</button>
                    <button onClick={onConfirmSingle} className="bg-white border border-studio-blue-500 text-studio-blue-600 py-2 px-5 rounded-lg hover:bg-studio-blue-50 transition duration-300 order-2 sm:order-2">העבר יום זה בלבד</button>
                    <button onClick={onConfirmAll} className="bg-studio-blue-500 text-white py-2 px-5 rounded-lg hover:bg-studio-blue-600 transition duration-300 order-1 sm:order-3">העבר את כל הימים</button>
                </div>
            </div>
        </div>
    );
};


const CollisionModal: React.FC<{
    details: CollisionDetails;
    onClose: () => void;
    onForceBook: () => void;
    onBookAvailable: () => void;
    clients: Client[];
    projects: Project[];
}> = ({ details, onClose, onForceBook, onBookAvailable, clients, projects }) => {
    
    const { bookingToSave, collidingBookings } = details;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-slate-50 rounded-xl shadow-2xl w-full max-w-2xl p-8" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-4">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <i className="fas fa-exclamation-triangle text-red-600"></i>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:text-right flex-1">
                        <h3 className="text-2xl leading-6 font-bold text-slate-900">התנגשות בהזמנה</h3>
                        <div className="mt-4 text-slate-600 space-y-3">
                            <p>השינוי המבוקש גורם לכפילות עם הזמנות קיימות.</p>
                            <div>
                                <p className="font-semibold">פרטי ההתנגשות:</p>
                                <ul className="list-disc list-inside mt-1 max-h-24 overflow-y-auto bg-slate-100 p-2 rounded-md">
                                    {collidingBookings.map(cb => {
                                        const client = clients.find(c => c.id === cb.clientId);
                                        const project = projects.find(p => p.id === cb.projectId);
                                        return <li key={cb.id} className="text-sm">
                                            <strong>{project?.name || 'פרויקט לא ידוע'}</strong> ({client?.name || 'לקוח לא ידוע'}) 
                                            בתאריכים {formatDate(new Date(cb.startDate))} - {formatDate(new Date(cb.endDate))} 
                                            בשעות {cb.startTime} - {cb.endTime}
                                            </li>
                                    })}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
                    <button onClick={onBookAvailable} type="button" className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-studio-blue-600 text-base font-medium text-white hover:bg-studio-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-blue-500">
                        שבץ בימים הפנויים
                    </button>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                         <button onClick={onClose} type="button" className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                            ביטול
                        </button>
                        <button onClick={onForceBook} type="button" className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                            אשר כפילות
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Sidebar: React.FC<{
    currentView: AppView;
    setCurrentView: (view: AppView) => void;
    onNewBooking: () => void;
    currentUser: User;
    onLogout: () => void;
}> = ({ currentView, setCurrentView, onNewBooking, currentUser, onLogout }) => {
    const navItems = [
        { id: 'calendar', label: 'לוח שנה', icon: 'fa-calendar-days', role: ['admin', 'technician'] },
        { id: 'reports', label: 'דוחות', icon: 'fa-chart-pie', role: ['admin'] },
        { id: 'projects', label: 'פרויקטים', icon: 'fa-folder-open', role: ['admin'] },
        { id: 'clients', label: 'לקוחות', icon: 'fa-users', role: ['admin'] },
        { id: 'resources', label: 'חדרי עריכה', icon: 'fa-desktop', role: ['admin'] },
        { id: 'personnel', label: 'משאבי אנוש', icon: 'fa-user-tie', role: ['admin'] },
        { id: 'services', label: 'שירותים', icon: 'fa-concierge-bell', role: ['admin'] },
        { id: 'materials', label: 'חומרי גלם', icon: 'fa-box', role: ['admin'] },
        { id: 'users', label: 'ניהול משתמשים', icon: 'fa-user-cog', role: ['admin'] },
    ];

    const filteredNavItems = useMemo(() => {
        return navItems.filter(item => item.role.includes(currentUser.role));
    }, [currentUser.role]);

    const isMobile = useIsMobile();
    if (isMobile) return null;


    return (
        <aside className="w-64 bg-white border-l border-gray-200 p-4 flex-col shadow-md hidden md:flex">
            <div className="text-2xl font-bold text-studio-blue-700 mb-8">StudioFlow</div>
            <button onClick={onNewBooking} className="w-full bg-studio-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300 flex items-center justify-center gap-2 mb-6">
                <i className="fas fa-plus"></i> צור הזמנה
            </button>
            <nav className="flex flex-col gap-2">
                {filteredNavItems.map(item => (
                    <a key={item.id} href="#" onClick={(e) => { e.preventDefault(); setCurrentView(item.id as AppView); }}
                        className={`flex items-center gap-3 px-4 py-2 rounded-md text-gray-700 transition-colors ${currentView === item.id ? 'bg-studio-blue-100 text-studio-blue-700 font-bold' : 'hover:bg-gray-100'}`}>
                        <i className={`fas ${item.icon} w-5 text-center`}></i>
                        <span>{item.label}</span>
                    </a>
                ))}
            </nav>
            <div className="mt-auto border-t pt-4">
                <div className="text-sm text-gray-500 mb-2">מחובר/ת כ: <strong>{currentUser.username}</strong> ({currentUser.role === 'admin' ? 'מנהל' : 'טכנאי'})</div>
                <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }}
                    className="flex items-center gap-3 px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors">
                    <i className="fas fa-sign-out-alt w-5 text-center"></i>
                    <span>התנתקות</span>
                </a>
            </div>
        </aside>
    );
};

type ViewFilters = {
    offline: boolean;
    onlineCinema: boolean;
    technical: boolean;
};

const FilterCheckbox: React.FC<{ label: string; checked: boolean; onChange: () => void; }> = ({ label, checked, onChange }) => (
    <li>
        <label className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
            <input type="checkbox" className="form-checkbox h-4 w-4 text-studio-blue-600 border-gray-300 rounded focus:ring-studio-blue-500 ml-3" checked={checked} onChange={onChange} />
            {label}
        </label>
    </li>
);


const HeaderDatePicker: React.FC<{
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    onClose: () => void;
}> = ({ currentDate, onDateSelect, onClose }) => {
    const [displayDate, setDisplayDate] = useState(currentDate);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef, onClose]);

    const handleMonthChange = (amount: number) => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const calendarDays = useMemo(() => getMonthDays(displayDate), [displayDate]);
    const weekDayLabels = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

    return (
        <div ref={wrapperRef} className="absolute left-0 md:left-auto md:right-0 z-30 mt-2 w-72 rounded-lg bg-white shadow-lg ring-1 ring-black ring-opacity-5 p-4">
            <div className="flex justify-between items-center mb-2">
                <button type="button" onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100"><i className="fas fa-chevron-right"></i></button>
                <span className="font-bold text-gray-800">{formatDate(displayDate, { month: 'long', year: 'numeric' })}</span>
                <button type="button" onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100"><i className="fas fa-chevron-left"></i></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 mb-2">
                {weekDayLabels.map(d => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, i) => {
                    const isCurrentMonth = day.getMonth() === displayDate.getMonth();
                    const isToday = isSameDay(day, new Date());
                    const isSelected = isSameDay(day, currentDate);

                    let btnClass = 'w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors';
                    if (!isCurrentMonth) {
                        btnClass += ' text-gray-300 cursor-not-allowed';
                    } else if (isSelected) {
                        btnClass += ' bg-studio-blue-500 text-white font-bold';
                    } else if (isToday) {
                        btnClass += ' bg-studio-blue-100 text-studio-blue-700';
                    } else {
                        btnClass += ' hover:bg-gray-100';
                    }
                    
                    return (
                        <button
                            key={i}
                            type="button"
                            onClick={() => onDateSelect(day)}
                            className={btnClass}
                            disabled={!isCurrentMonth}
                        >
                            {day.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    )
};


const CalendarHeader: React.FC<{
    isMobile: boolean;
    currentDate: Date;
    setCurrentDate: (date: Date) => void;
    viewMode: ViewMode;
    setViewMode: (mode: ViewMode) => void;
    viewFilters: ViewFilters;
    setViewFilters: React.Dispatch<React.SetStateAction<ViewFilters>>;
    onSearchClick: () => void;
    canUndo: boolean;
    onUndo: () => void;
    onNewBooking: () => void;
}> = ({ isMobile, currentDate, setCurrentDate, viewMode, setViewMode, viewFilters, setViewFilters, onSearchClick, canUndo, onUndo, onNewBooking }) => {
    
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    
    const handleNav = (amount: number) => {
        const newDate = new Date(currentDate);
        if (viewMode === 'day') newDate.setDate(newDate.getDate() + amount);
        if (viewMode === 'week') newDate.setDate(newDate.getDate() + (amount * 7));
        if (viewMode === 'month') newDate.setMonth(newDate.getMonth() + amount);
        if (viewMode === 'year') newDate.setFullYear(newDate.getFullYear() + amount);
        setCurrentDate(newDate);
    };

    const handleToday = () => setCurrentDate(new Date());

    const getHeaderText = () => {
        if (viewMode === 'day') return formatDate(currentDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (viewMode === 'week') {
            const weekDays = getWeekDays(currentDate);
            const firstDay = weekDays[0];
            const lastDay = weekDays[6];
            return `${formatDate(firstDay, { month: 'long', day: 'numeric' })} – ${formatDate(lastDay, { day: 'numeric', month: 'long', year: 'numeric' })}`;
        }
        if (viewMode === 'month') return formatDate(currentDate, { month: 'long', year: 'numeric' });
        if (viewMode === 'year') return formatDate(currentDate, { year: 'numeric' });
        return '';
    };

    const viewOptions: { id: ViewMode, label: string }[] = [
        { id: 'day', label: 'יום' },
        { id: 'week', label: 'שבוע' },
        { id: 'month', label: 'חודש' },
        { id: 'year', label: 'שנה' },
    ];
    
    const handleFilterChange = (filterName: keyof typeof viewFilters) => {
        setViewFilters(prev => ({...prev, [filterName]: !prev[filterName]}));
    }

    return (
        <header className="p-4 flex flex-col md:flex-row items-center justify-between bg-white border-b gap-4 md:gap-0">
            {isMobile && (
                 <div className="w-full flex justify-between items-center md:hidden">
                    <h1 className="text-xl font-bold text-gray-800">לוח שנה</h1>
                    <button
                        onClick={onNewBooking}
                        className="bg-studio-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300 flex items-center gap-2 text-sm"
                    >
                        <i className="fas fa-plus"></i> הזמנה חדשה
                    </button>
                </div>
            )}
            <div className="flex items-center gap-4">
                <div className="flex items-center border rounded-md">
                    <button onClick={() => handleNav(-1)} className="p-2 hover:bg-gray-100 border-l rounded-r-md"><i className="fas fa-chevron-right"></i></button>
                    <button onClick={handleToday} className="p-2 px-4 hover:bg-gray-100 text-sm font-semibold">היום</button>
                    <button onClick={() => handleNav(1)} className="p-2 hover:bg-gray-100 border-r rounded-l-md"><i className="fas fa-chevron-left"></i></button>
                </div>
                <div className="flex items-center gap-1">
                    <h2 className="text-xl font-semibold text-gray-700">{getHeaderText()}</h2>
                     <div className="relative">
                        <button
                            onClick={() => setIsDatePickerOpen(prev => !prev)}
                            className="p-2 text-gray-500 hover:text-gray-800 rounded-full"
                            aria-label="בחר תאריך"
                            title="בחר תאריך"
                        >
                            <i className="fas fa-calendar-alt"></i>
                        </button>
                        {isDatePickerOpen && (
                            <HeaderDatePicker
                                currentDate={currentDate}
                                onDateSelect={(date) => {
                                    setCurrentDate(date);
                                    setIsDatePickerOpen(false);
                                }}
                                onClose={() => setIsDatePickerOpen(false)}
                            />
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                 <button 
                    onClick={onUndo} 
                    disabled={!canUndo} 
                    className="p-2 px-3 text-sm font-semibold border rounded-md hover:bg-gray-100 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="בטל פעולה אחרונה"
                    title="בטל"
                >
                    <i className="fas fa-undo"></i>
                </button>
                {!isMobile && (
                    <div className="flex border rounded-md">
                        {viewOptions.map(opt => (
                            <button key={opt.id} onClick={() => setViewMode(opt.id)}
                                className={`p-2 px-4 text-sm font-semibold ${viewMode === opt.id ? 'bg-studio-blue-500 text-white' : 'hover:bg-gray-100'}`}>
                                {opt.label}
                            </button>
                        ))}
                    </div>
                )}
                <button onClick={onSearchClick} className="p-2 px-4 text-sm font-semibold border rounded-md hover:bg-gray-100 flex items-center gap-2">
                    <i className="fas fa-search"></i>
                </button>
                <div className="relative">
                     <button onClick={() => setIsFilterOpen(prev => !prev)} className="p-2 px-4 text-sm font-semibold border rounded-md hover:bg-gray-100 flex items-center gap-2">
                        <i className="fas fa-filter"></i> סינון
                    </button>
                    {isFilterOpen && (
                        <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg z-30 border">
                            <ul className="py-1">
                                <FilterCheckbox label="חדרי Offline" checked={viewFilters.offline} onChange={() => handleFilterChange('offline')} />
                                <FilterCheckbox label="Online וקולנוע" checked={viewFilters.onlineCinema} onChange={() => handleFilterChange('onlineCinema')} />
                                <FilterCheckbox label="חדר טכני" checked={viewFilters.technical} onChange={() => handleFilterChange('technical')} />
                            </ul>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

const CalendarContainer: React.FC<{
    isMobile: boolean;
    viewMode: ViewMode;
    currentDate: Date;
    bookings: Booking[]; projects: Project[]; personnel: Personnel[]; resources: Resource[]; clients: Client[];
    onSelectBooking: (booking: Booking, date: Date) => void;
    onNewBooking: (resourceId: string, date: Date) => void;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, bookingId: string, dayDragged: Date) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, resourceId: string, date: Date) => void;
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    draggedBookingId: string | null;
    setCurrentDate: (date: Date) => void;
}> = (props) => {
    switch(props.viewMode) {
        case 'day': return <WeekView {...props} weekDays={[startOfDay(props.currentDate)]} />;
        case 'month': return <MonthView {...props} />;
        case 'year': return <YearView {...props} />;
        case 'week': 
        default:
            return <WeekView {...props} weekDays={getWeekDays(props.currentDate)} />;
    }
};

const WeekView: React.FC<Omit<React.ComponentProps<typeof CalendarContainer>, 'viewMode' | 'currentDate' | 'onDragStart'> & { weekDays: Date[], onDragStart: (e: React.DragEvent<HTMLDivElement>, bookingId: string, dayDragged: Date) => void; }> = 
({ weekDays, bookings, projects, personnel, clients, resources, onSelectBooking, onNewBooking, onDragStart, onDrop, onDragOver, draggedBookingId, isMobile, setCurrentDate }) => {
    
    const touchStart = useRef<{ x: number, y: number } | null>(null);
    const MIN_SWIPE_DISTANCE = 60;
    
    const handleTouchStart = (e: React.TouchEvent) => {
        if (!isMobile || weekDays.length > 1) return;
        touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (!touchStart.current || !isMobile || weekDays.length > 1) return;

        const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        
        const deltaX = touchEnd.x - touchStart.current.x;
        const deltaY = touchEnd.y - touchStart.current.y;
        
        // Only trigger swipe if horizontal movement is greater than vertical
        if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > MIN_SWIPE_DISTANCE) {
            // In RTL, swiping finger to the right (positive deltaX) means going to previous date.
            // Swiping finger to the left (negative deltaX) means going to next date.
            const direction = deltaX > 0 ? -1 : 1;
            
            const newDate = new Date(weekDays[0]);
            newDate.setDate(newDate.getDate() + direction);
            setCurrentDate(newDate);
        }

        touchStart.current = null;
    };


    const isBookingOnDay = (booking: Booking, day: Date) => {
        return startOfDay(day) >= startOfDay(booking.startDate) && startOfDay(day) <= startOfDay(booking.endDate);
    }
    
    const dayColumnStyle = { gridTemplateColumns: `repeat(${weekDays.length}, minmax(90px, 1fr))` };

    return (
        <div className="grid text-sm" style={{ gridTemplateColumns: '12rem auto' }} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
            {/* Header */}
            <div className="sticky top-0 bg-white z-20 p-2 border-b border-l text-right font-semibold text-gray-600">משאב</div>
            <div className="sticky top-0 bg-white z-20 grid" style={dayColumnStyle}>
                {weekDays.map(day => (
                    <div key={day.toISOString()} className="p-2 border-b border-r text-center font-semibold">
                        <div>{formatDate(day, { weekday: 'long' })}</div>
                        <div className={`text-xl ${isSameDay(day, new Date()) ? 'bg-studio-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto' : ''}`}>{day.getDate()}</div>
                    </div>
                ))}
            </div>

            {/* Grid Body */}
            {resources.map((resource, resourceIndex) => (
                <React.Fragment key={resource.id}>
                    <div className={`p-2 border-l border-b text-right font-bold text-gray-700 ${resourceIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>{resource.name}</div>
                    <div className="grid border-b" style={dayColumnStyle}>
                        {weekDays.map(day => {
                            const bookingsForCell = bookings
                                .filter(b => b.resourceId === resource.id && isBookingOnDay(b, day))
                                .sort((a, b) => (a.startTime || '0').localeCompare(b.startTime || '0'));

                            return (
                                <div
                                    key={day.toISOString()}
                                    onDrop={(e) => onDrop(e, resource.id, day)}
                                    onDragOver={onDragOver}
                                    onClick={() => onNewBooking(resource.id, day)}
                                    className={`relative border-r min-h-[2.8rem] p-1 flex flex-col gap-1 ${resourceIndex % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-studio-blue-50 cursor-pointer transition-colors`}
                                >
                                    {bookingsForCell.map(booking => {
                                        const project = projects.find(p => p.id === booking.projectId);
                                        const client = clients.find(c => c.id === booking.clientId);
                                        const paddingClass = resource.type === 'Offline' ? 'py-0.5 px-1' : 'p-1';
                                        
                                        return (
                                            <div
                                                key={booking.id}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, booking.id, day)}
                                                onClick={(e) => { e.stopPropagation(); onSelectBooking(booking, day); }}
                                                className={`${resource.color} ${paddingClass} rounded-md shadow-sm text-xs cursor-grab active:cursor-grabbing ${draggedBookingId === booking.id ? 'opacity-50' : ''}`}
                                            >
                                                <div className="font-bold truncate">{project?.name || '?'}</div>
                                                <div className="truncate text-[10px]">{client?.name || '?'}</div>
                                                {resource.type !== 'Offline' && booking.startTime && booking.endTime && <div className="text-[10px] font-mono">{booking.startTime} - {booking.endTime}</div>}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </React.Fragment>
            ))}
        </div>
    );
};


const MonthView: React.FC<React.ComponentProps<typeof CalendarContainer>> = ({ currentDate, bookings, projects, onSelectBooking, onNewBooking }) => {
    const monthDays = getMonthDays(currentDate);
    const weekDays = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

    return (
        <div className="grid grid-cols-7 grid-rows-[auto_repeat(5,1fr)] flex-1">
            {weekDays.map(day => <div key={day} className="text-center p-2 font-bold text-sm text-gray-600 border-b">{day}</div>)}
            {monthDays.map(day => {
                const dayBookings = bookings.filter(b => startOfDay(day) >= startOfDay(new Date(b.startDate)) && startOfDay(day) <= startOfDay(new Date(b.endDate)));
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                return (
                    <div key={day.toISOString()} onClick={() => onNewBooking('', day)} className={`relative border-t border-r p-1 flex flex-col gap-1 min-h-[8rem] ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'} hover:bg-studio-blue-50 cursor-pointer`}>
                        <div className={`text-sm ${isSameDay(day, new Date()) ? 'bg-studio-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center' : ''} ${!isCurrentMonth ? 'text-gray-400' : ''}`}>
                            {day.getDate()}
                        </div>
                        <div className="overflow-y-auto space-y-1">
                            {dayBookings.map(booking => {
                                const project = projects.find(p => p.id === booking.projectId);
                                return (
                                    <div key={booking.id} onClick={(e) => { e.stopPropagation(); onSelectBooking(booking, day); }} className={`bg-blue-100 text-blue-800 p-1 rounded-md text-xs truncate`}>
                                        {project?.name || 'Unknown'} {booking.startTime}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const YearView: React.FC<React.ComponentProps<typeof CalendarContainer>> = ({ currentDate, bookings, onNewBooking }) => {
    const year = currentDate.getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));
    
    const bookingsByDay = useMemo(() => {
        const map = new Map<string, number>();
        bookings.forEach(booking => {
            let current = startOfDay(new Date(booking.startDate));
            const end = startOfDay(new Date(booking.endDate));
            while(current <= end) {
                const key = current.toISOString().split('T')[0];
                map.set(key, (map.get(key) || 0) + 1);
                current.setDate(current.getDate() + 1);
            }
        });
        return map;
    }, [bookings]);

    return (
        <div className="p-4 bg-gray-50 h-full overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {months.map(monthDate => (
                    <MiniMonth key={monthDate.getMonth()} monthDate={monthDate} bookingsByDay={bookingsByDay} onDayClick={onNewBooking} />
                ))}
            </div>
        </div>
    );
};

const MiniMonth: React.FC<{
    monthDate: Date;
    bookingsByDay: Map<string, number>;
    onDayClick: (resourceId: string, date: Date) => void;
}> = ({ monthDate, bookingsByDay, onDayClick }) => {
    const monthName = formatDate(monthDate, { month: 'long' });
    const month = monthDate.getMonth();
    
    const daysInCalendar = getMonthDays(monthDate);
    const weekDays = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];
    
    return (
        <div className="bg-white p-3 rounded-lg shadow">
            <h3 className="font-bold text-center text-studio-blue-700 mb-2">{monthName}</h3>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-500">
                {weekDays.map(wd => <div key={wd}>{wd}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-1">
                {daysInCalendar.map(day => {
                    const isCurrentMonth = day.getMonth() === month;
                    const dayKey = day.toISOString().split('T')[0];
                    const hasBooking = bookingsByDay.has(dayKey);

                    let dayClass = 'w-7 h-7 flex items-center justify-center rounded-full text-xs cursor-pointer';
                    if (!isCurrentMonth) {
                        dayClass += ' text-gray-300';
                    } else if (isSameDay(day, new Date())) {
                        dayClass += ' bg-studio-blue-500 text-white';
                    } else if (hasBooking) {
                        dayClass += ' bg-blue-100 text-blue-700 font-bold';
                    } else {
                        dayClass += ' hover:bg-gray-100';
                    }

                    return (
                        <div key={dayKey} className={dayClass} onClick={() => isCurrentMonth && onDayClick('', day)}>
                            {day.getDate()}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}


const SearchableSelect: React.FC<{
    label: string; name: string; value: string; onChange: (e: { target: { name: string; value: string; } }) => void;
    options: { value: string; label: string }[];
    required?: boolean; disabled?: boolean;
    placeholder?: string;
}> = ({ label, name, value, onChange, options, required = false, disabled = false, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);

    const selectedOption = useMemo(() => options.find(opt => opt.value === value), [options, value]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);
    
    const filteredOptions = useMemo(() => 
        options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    , [options, searchTerm]);

    const handleSelect = (optionValue: string) => {
        onChange({ target: { name, value: optionValue } });
        setIsOpen(false);
        setSearchTerm('');
    };

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
            <div ref={wrapperRef} className="relative mt-1">
                <button type="button" onClick={() => !disabled && setIsOpen(!isOpen)} disabled={disabled}
                    className="relative w-full cursor-default rounded-md bg-white border border-gray-300 p-2.5 text-right text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-studio-blue-500 sm:text-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed">
                    <span className="block truncate">{selectedOption?.label || placeholder || `בחר ${label}`}</span>
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                         <i className="fas fa-chevron-down text-gray-400"></i>
                    </span>
                </button>
                {isOpen && !disabled && (
                    <div className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                        <div className="p-2">
                           <input type="text" placeholder="חיפוש..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} 
                           className="w-full bg-gray-50 border-gray-300 rounded-md p-2 focus:ring-studio-blue-500 focus:border-studio-blue-500" />
                        </div>
                        <ul tabIndex={-1} role="listbox">
                             {filteredOptions.length > 0 ? filteredOptions.map(option => (
                                <li key={option.value} onClick={() => handleSelect(option.value)}
                                    className={`relative cursor-default select-none py-2 px-4 hover:bg-gray-100 ${option.value === value ? 'bg-studio-blue-100' : ''}`}>
                                    {option.label}
                                </li>
                            )) : <li className="relative cursor-default select-none py-2 px-4">לא נמצאו תוצאות</li>}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

const DeleteOptionsView: React.FC<{
    booking: Booking;
    selectedDate: Date;
    onDeleteEntire: (id: string) => void;
    onDeleteDay: (id: string, day: Date) => void;
    onDeleteRange: (id: string, start: Date, end: Date) => void;
    onShowConfirmation: (message: string, onConfirm: () => void) => void;
}> = ({ booking, selectedDate, onDeleteEntire, onDeleteDay, onDeleteRange, onShowConfirmation }) => {
    const [deleteRange, setDeleteRange] = useState({ 
        start: formatDateForInput(booking.startDate), 
        end: formatDateForInput(booking.endDate) 
    });

    const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDeleteRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleEntireDelete = () => {
        onShowConfirmation(
            `האם אתה בטוח שברצונך למחוק את כל ההזמנה (${formatDate(booking.startDate)} - ${formatDate(booking.endDate)})?`,
            () => onDeleteEntire(booking.id)
        );
    };

    const handleDayDelete = () => {
        onShowConfirmation(
            `האם אתה בטוח שברצונך למחוק רק את התאריך ${formatDate(selectedDate)}? הפעולה עשויה לפצל את ההזמנה.`,
            () => onDeleteDay(booking.id, selectedDate)
        );
    };

    const handleRangeSubmit = () => {
        if (!deleteRange.start || !deleteRange.end) {
            alert('אנא בחר תאריך התחלה וסיום למחיקה.');
            return;
        }
        const [yS, mS, dS] = deleteRange.start.split('-').map(Number);
        const start = new Date(yS, mS - 1, dS);
        const [yE, mE, dE] = deleteRange.end.split('-').map(Number);
        const end = new Date(yE, mE - 1, dE);
        
        if (start > end) {
            alert('תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום.');
            return;
        }
        onShowConfirmation(
            `האם אתה בטוח שברצונך למחוק את ההזמנות מ-${formatDate(start)} עד ${formatDate(end)}?`,
            () => onDeleteRange(booking.id, start, end)
        );
    };


    return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-xl font-bold text-red-800 mb-4">אפשרויות מחיקה</h3>
            <div className="space-y-4">
                <button 
                    onClick={handleEntireDelete} 
                    className="w-full text-left p-3 bg-red-100 hover:bg-red-200 rounded-md transition"
                >
                    <i className="fas fa-trash-alt ml-2"></i> מחק את כל ההזמנה (${formatDate(booking.startDate)} - ${formatDate(booking.endDate)})
                </button>
                
                {selectedDate && (
                    <button 
                        onClick={handleDayDelete} 
                        className="w-full text-left p-3 bg-red-100 hover:bg-red-200 rounded-md transition"
                    >
                        <i className="fas fa-calendar-times ml-2"></i> מחק רק את התאריך הנבחר ({formatDate(selectedDate)})
                    </button>
                )}

                <div className="p-3 bg-red-100 rounded-md">
                    <p className="font-semibold mb-2"><i className="fas fa-calendar-minus ml-2"></i> מחק לפי טווח תאריכים</p>
                    <div className="flex items-end gap-2">
                        <InputGroup label="מ-" type="date" name="start" value={deleteRange.start} onChange={handleRangeChange} />
                        <InputGroup label="עד-" type="date" name="end" value={deleteRange.end} onChange={handleRangeChange} />
                        <button onClick={handleRangeSubmit} className="bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition h-[42px]">מחק טווח</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DatePicker: React.FC<{
    label: string;
    selectedDate: Date | undefined;
    onChange: (date: Date) => void;
    required?: boolean;
    disabled?: boolean;
}> = ({ label, selectedDate, onChange, required, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [displayDate, setDisplayDate] = useState(selectedDate || new Date());
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setDisplayDate(selectedDate || new Date());
    }, [selectedDate]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleMonthChange = (amount: number) => {
        setDisplayDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));
    };

    const handleDateSelect = (day: Date) => {
        onChange(day);
        setIsOpen(false);
    };

    const calendarDays = useMemo(() => getMonthDays(displayDate), [displayDate]);
    const weekDayLabels = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
            <div ref={wrapperRef} className="relative mt-1">
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    disabled={disabled}
                    className="relative w-full cursor-default rounded-md bg-white border border-gray-300 p-2.5 text-right text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-studio-blue-500 sm:text-sm disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
                >
                    <span className="block truncate">{selectedDate ? formatDate(selectedDate, { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'בחר תאריך...'}</span>
                    <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-2">
                        <i className="fas fa-calendar-alt text-gray-400"></i>
                    </span>
                </button>
                {isOpen && !disabled && (
                    <div className="absolute z-30 mt-1 w-full rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 p-4">
                        <div className="flex justify-between items-center mb-2">
                            <button type="button" onClick={() => handleMonthChange(-1)} className="p-2 rounded-full hover:bg-gray-100"><i className="fas fa-chevron-right"></i></button>
                            <span className="font-bold text-gray-800">{formatDate(displayDate, { month: 'long', year: 'numeric' })}</span>
                            <button type="button" onClick={() => handleMonthChange(1)} className="p-2 rounded-full hover:bg-gray-100"><i className="fas fa-chevron-left"></i></button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 mb-2">
                            {weekDayLabels.map(d => <div key={d}>{d}</div>)}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, i) => {
                                const isCurrentMonth = day.getMonth() === displayDate.getMonth();
                                const isToday = isSameDay(day, new Date());
                                const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;

                                let btnClass = 'w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors';
                                if (!isCurrentMonth) {
                                    btnClass += ' text-gray-300';
                                } else if (isSelected) {
                                    btnClass += ' bg-studio-blue-500 text-white font-bold';
                                } else if (isToday) {
                                    btnClass += ' bg-studio-blue-100 text-studio-blue-700';
                                } else {
                                    btnClass += ' hover:bg-gray-100';
                                }
                                
                                return (
                                    <button
                                        key={i}
                                        type="button"
                                        onClick={() => handleDateSelect(day)}
                                        className={btnClass}
                                        disabled={!isCurrentMonth}
                                    >
                                        {day.getDate()}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const TimePicker: React.FC<{
    label: string;
    value: string | undefined;
    onChange: (value: string) => void;
    required?: boolean;
    disabled?: boolean;
}> = ({ label, value, onChange, required, disabled }) => {
    const isMobile = useIsMobile();
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '09:00');
    const listRef = useRef<HTMLUListElement>(null);
    const activeItemRef = useRef<HTMLLIElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setInputValue(value || '09:00');
    }, [value]);

    const timeOptions = useMemo(() => {
        const options = [];
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            }
        }
        return options;
    }, []);

    useEffect(() => {
        if (isOpen && !isMobile && listRef.current && activeItemRef.current) {
            listRef.current.scrollTop = activeItemRef.current.offsetTop - listRef.current.offsetTop;
        }
    }, [isOpen, isMobile, value]);

    const handleSelect = (time: string) => {
        onChange(time);
        setInputValue(time);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    const handleInputBlur = () => {
        const match = inputValue.match(/^(\d{1,2}):(\d{1,2})$/);
        if (match) {
            let [_, h, m] = match.map(Number);
            h = Math.max(0, Math.min(23, h));
            m = Math.max(0, Math.min(59, m));
            const formattedTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            if (formattedTime !== value) {
                onChange(formattedTime);
            }
            setInputValue(formattedTime);
        } else {
            setInputValue(value || '09:00');
        }
    };
    
    const [mobileH, setMobileH] = useState('09');
    const [mobileM, setMobileM] = useState('00');
    
    useEffect(() => {
        if(value) {
            const [h,m] = value.split(":");
            setMobileH(h);
            setMobileM(m);
        }
    }, [value]);

    const openMobilePicker = () => {
        if(disabled) return;
        if(value) {
            const [h, m] = value.split(':');
            setMobileH(h);
            setMobileM(m);
        } else {
            setMobileH('09');
            setMobileM('00');
        }
        setIsOpen(true);
    }
    
    const handleMobileConfirm = () => {
        const newTime = `${mobileH}:${mobileM}`;
        onChange(newTime);
        setIsOpen(false);
    }

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen && !isMobile) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef, isMobile, isOpen]);
    
    const TimeScroller: React.FC<{
        values: string[];
        selectedValue: string;
        onSelect: (value: string) => void;
    }> = ({ values, selectedValue, onSelect }) => {
        const scrollerRef = useRef<HTMLDivElement>(null);
        
        useEffect(() => {
            const scroller = scrollerRef.current;
            if (scroller) {
                const selectedElement = scroller.querySelector(`[data-value="${selectedValue}"]`) as HTMLElement;
                if(selectedElement) {
                    const scrollTop = selectedElement.offsetTop - scroller.offsetTop - (scroller.clientHeight / 2) + (selectedElement.clientHeight / 2);
                    scroller.scrollTo({ top: scrollTop, behavior: 'smooth' });
                }
            }
        }, [selectedValue]);

        return (
            <div ref={scrollerRef} className="h-48 overflow-y-scroll snap-y snap-mandatory scroll-smooth no-scrollbar border-y bg-gray-100">
                <div className="h-[calc(50%-1.25rem)]"></div>
                {values.map(v => (
                    <div 
                        key={v}
                        data-value={v}
                        onClick={() => onSelect(v)}
                        className={`py-1 text-center text-xl snap-center cursor-pointer ${selectedValue === v ? 'font-bold text-studio-blue-600' : 'text-gray-500'}`}
                    >
                        {v}
                    </div>
                ))}
                <div className="h-[calc(50%-1.25rem)]"></div>
            </div>
        )
    };
    
    const renderDesktopPicker = () => (
        <div ref={wrapperRef} className="relative mt-1">
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onFocus={() => setIsOpen(true)}
                disabled={disabled}
                className="w-full cursor-default rounded-md bg-white border border-gray-300 p-2.5 text-right text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-studio-blue-500 sm:text-sm disabled:bg-gray-200"
            />
            {isOpen && (
                <ul ref={listRef} className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {timeOptions.map(time => {
                        const isSelected = time === value;
                        return (
                            <li
                                key={time}
                                ref={isSelected ? activeItemRef : null}
                                onClick={() => handleSelect(time)}
                                className={`relative cursor-pointer select-none py-2 px-4 text-center hover:bg-gray-100 ${isSelected ? 'bg-studio-blue-100 font-bold' : ''}`}
                            >
                                {time}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
    
    const renderMobilePicker = () => {
        const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), []);
        const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')), []);

        return (
            <>
                <button
                    type="button"
                    onClick={openMobilePicker}
                    disabled={disabled}
                    className="w-full cursor-default rounded-md bg-white border border-gray-300 p-2.5 text-center text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-studio-blue-500 sm:text-sm disabled:bg-gray-200"
                >
                    <span className="text-xl font-mono">{value || '--:--'}</span>
                </button>
                {isOpen && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end" onClick={() => setIsOpen(false)}>
                        <div className="bg-white w-full rounded-t-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center p-4 border-b">
                                <button type="button" onClick={() => setIsOpen(false)} className="text-studio-blue-600">ביטול</button>
                                <h3 className="font-bold">בחר שעה</h3>
                                <button type="button" onClick={handleMobileConfirm} className="text-studio-blue-600 font-bold">אישור</button>
                            </div>
                            <div className="flex justify-center items-center p-4 relative h-56">
                                <div className="absolute top-0 left-0 right-0 bottom-0 flex items-center justify-center pointer-events-none">
                                    <div className="w-full h-10 bg-studio-blue-100 border-y border-studio-blue-300 rounded-md"></div>
                                </div>
                                <div className="flex-1">
                                    <TimeScroller values={hours} selectedValue={mobileH} onSelect={setMobileH} />
                                </div>
                                <div className="font-bold text-2xl mx-4 text-gray-500">:</div>
                                <div className="flex-1">
                                    <TimeScroller values={minutes} selectedValue={mobileM} onSelect={setMobileM} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    };

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
            {isMobile ? renderMobilePicker() : renderDesktopPicker()}
        </div>
    );
};


const BookingModal: React.FC<{
    isOpen: boolean; onClose: () => void;
    onRequestSave: (bookings: BookingFormData[]) => void; 
    onDeleteEntire: (bookingId: string) => void;
    onDeleteDay: (bookingId: string, day: Date) => void;
    onDeleteRange: (bookingId: string, start: Date, end: Date) => void;
    onShowConfirmation: (message: string, onConfirm: () => void) => void;
    booking: Booking | null; 
    selectedDate: Date | null;
    newBookingInfo: {resourceId: string, date: Date} | null;
    clients: Client[]; projects: Project[]; personnel: Personnel[]; resources: Resource[];
    services: TechnicalService[]; materials: Material[];
    currentUser: User | null;
    allBookings: Booking[];
}> = ({ isOpen, onClose, onRequestSave, onDeleteEntire, onDeleteDay, onDeleteRange, onShowConfirmation, booking, selectedDate, newBookingInfo, clients, projects, personnel, resources, services, materials, currentUser, allBookings }) => {
    const [formData, setFormData] = useState<Partial<Booking>>({});
    const [additionalResourceIds, setAdditionalResourceIds] = useState<string[]>([]);
    
    const [serviceToAdd, setServiceToAdd] = useState('');
    const [materialToAdd, setMaterialToAdd] = useState('');
    const [materialQuantity, setMaterialQuantity] = useState(1);
    
    const [durationOptions, setDurationOptions] = useState({
        includeFriday: false,
        includeSaturday: false,
        fullMonth: false,
    });
    
    const [showDeleteOptions, setShowDeleteOptions] = useState(false);
    
    const selectedResource = useMemo(() => resources.find(r => r.id === formData.resourceId), [formData.resourceId, resources]);
    const isTechnicalRoom = selectedResource?.type === 'Technical';

    useEffect(() => {
        setShowDeleteOptions(false); // Reset on open
        const initialData = {
            technicalServices: [],
            materials: [],
            notes: '',
            doNotChargeResource: false,
        };

        if (booking) {
          setFormData({
              ...booking,
              technicalServices: booking.technicalServices || [],
              materials: booking.materials || [],
              doNotChargeResource: booking.doNotChargeResource || false,
          });
          setAdditionalResourceIds([]);
          setDurationOptions({ includeFriday: false, includeSaturday: false, fullMonth: false });
        } else if (newBookingInfo) {
          setFormData({
            ...initialData,
            resourceId: newBookingInfo.resourceId,
            startDate: newBookingInfo.date,
            endDate: newBookingInfo.date,
          });
          setAdditionalResourceIds([]);
          setDurationOptions({ includeFriday: false, includeSaturday: false, fullMonth: false });
        }
    }, [booking, newBookingInfo, isOpen]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement> | {target: {name: string, value: string}}) => {
        const { name, value } = e.target;
        const type = (e.target as HTMLInputElement).type;

        if (type === 'checkbox') {
            setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
            return;
        }
        
        setFormData(prev => ({...prev, [name]: value}));
    }
    
    const handleDateChange = (name: 'startDate' | 'endDate', date: Date) => {
        setFormData(prev => ({ ...prev, [name]: date }));
    };

    const handleTimeChange = (name: 'startTime' | 'endTime', time: string) => {
        setFormData(prev => ({ ...prev, [name]: time }));
    };

    // Effect for date logic based on duration checkboxes
    useEffect(() => {
        // Only run if a duration option is explicitly checked.
        // This prevents overriding dates when an existing booking is loaded into the modal.
        if (!formData.startDate || !Object.values(durationOptions).some(v => v === true)) {
            return;
        }

        const newStartDate = new Date(formData.startDate);
        let newEndDate: Date;

        if (durationOptions.fullMonth) {
            const firstDay = new Date(newStartDate.getFullYear(), newStartDate.getMonth(), 1);
            const lastDay = new Date(newStartDate.getFullYear(), newStartDate.getMonth() + 1, 0);
            if (startOfDay(formData.startDate).getTime() !== startOfDay(firstDay).getTime() || (formData.endDate && startOfDay(formData.endDate).getTime() !== startOfDay(lastDay).getTime())) {
                setFormData(prev => ({ ...prev, startDate: firstDay, endDate: lastDay }));
            }
            return;
        }

        newEndDate = new Date(newStartDate);
        newEndDate.setDate(newStartDate.getDate() + 4); // Default 5 days (e.g. Sun -> Thu)

        const startDayOfWeek = newStartDate.getDay();
        if (durationOptions.includeFriday) {
            const fridayDate = new Date(newStartDate);
            // Calculate days to add to get to the next Friday
            fridayDate.setDate(newStartDate.getDate() + ((5 - startDayOfWeek + 7) % 7));
            if (fridayDate > newEndDate) newEndDate = fridayDate;
        }
        if (durationOptions.includeSaturday) {
            const saturdayDate = new Date(newStartDate);
             // Calculate days to add to get to the next Saturday
            saturdayDate.setDate(newStartDate.getDate() + ((6 - startDayOfWeek + 7) % 7));
            if (saturdayDate > newEndDate) newEndDate = saturdayDate;
        }

        if (!formData.endDate || startOfDay(formData.endDate).getTime() !== startOfDay(newEndDate).getTime()) {
            setFormData(prev => ({ ...prev, endDate: newEndDate }));
        }
    }, [formData.startDate, durationOptions]);

    // Effect for time logic defaults
    useEffect(() => {
        if (booking) return; // Only for new bookings

        const resource = resources.find(r => r.id === formData.resourceId);
        if (!resource || !formData.startDate) {
            setFormData(prev => ({ ...prev, startTime: '09:00', endTime: '18:00' }));
            return;
        };

        let newStartTime = '09:00';
        let newEndTime = '18:00';

        if (resource.type === 'Technical') {
            const bookingsOnDay = allBookings.filter(b =>
                b.resourceId === formData.resourceId &&
                isSameDay(new Date(b.startDate), new Date(formData.startDate!))
            ).sort((a,b) => (b.endTime || '00:00').localeCompare(a.endTime || '00:00'));
            
            if (bookingsOnDay.length > 0) {
                const latestEndTime = bookingsOnDay[0].endTime || '09:00';
                const [hours, minutes] = latestEndTime.split(':').map(Number);
                const newStart = new Date();
                newStart.setHours(hours, minutes, 0, 0);
                const newEnd = new Date(newStart.getTime() + 60 * 60 * 1000);
                newStartTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
                newEndTime = `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}`;
            } else {
                newStartTime = '09:00';
                newEndTime = '10:00';
            }
        }
        
        setFormData(prev => ({ ...prev, startTime: newStartTime, endTime: newEndTime }));

    }, [formData.resourceId, formData.startDate, booking, resources, allBookings]);


    if (!isOpen) return null;
    
    const handleDurationChange = (option: keyof typeof durationOptions) => {
        setDurationOptions(prev => {
            const newState = { ...prev, [option]: !prev[option] };
            if (option === 'fullMonth' && newState.fullMonth) {
                newState.includeFriday = false;
                newState.includeSaturday = false;
            }
            if ((option === 'includeFriday' || option === 'includeSaturday') && newState[option]) {
                newState.fullMonth = false;
            }
            return newState;
        });
    };


    const handleAddService = () => {
        if (serviceToAdd && !(formData.technicalServices || []).includes(serviceToAdd)) {
            const updatedServices = [...(formData.technicalServices || []), serviceToAdd];
            setFormData(prev => ({ ...prev, technicalServices: updatedServices }));
            setServiceToAdd('');
        }
    };
    
    const handleRemoveService = (serviceId: string) => {
        const updatedServices = (formData.technicalServices || []).filter(id => id !== serviceId);
        setFormData(prev => ({ ...prev, technicalServices: updatedServices }));
    };

    const handleAddMaterial = () => {
        if (materialToAdd && materialQuantity > 0 && !(formData.materials || []).some(m => m.materialId === materialToAdd)) {
            const materialInfo = materials.find(m => m.id === materialToAdd);
            if (!materialInfo) return;
            const newMaterialBooking: MaterialBooking = {
                materialId: materialToAdd,
                quantity: materialQuantity,
                sellingPrice: materialInfo.sellingPrice,
            };
            const updatedMaterials = [...(formData.materials || []), newMaterialBooking];
            setFormData(prev => ({...prev, materials: updatedMaterials}));
            setMaterialToAdd('');
            setMaterialQuantity(1);
        }
    };

    const handleRemoveMaterial = (materialIdToRemove: string) => {
        const updatedMaterials = (formData.materials || []).filter(m => m.materialId !== materialIdToRemove);
        setFormData(prev => ({...prev, materials: updatedMaterials}));
    };

    const handleMaterialQuantityChange = (materialId: string, quantity: number) => {
        if (quantity <= 0) {
            handleRemoveMaterial(materialId);
            return;
        }
        const updatedMaterials = (formData.materials || []).map(m => 
            m.materialId === materialId ? {...m, quantity} : m
        );
        setFormData(prev => ({ ...prev, materials: updatedMaterials }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const requiredFields: (keyof Booking)[] = ['clientId', 'projectId', 'startDate', 'endDate', 'resourceId'];
        if (!isTechnicalRoom) {
            requiredFields.push('startTime', 'endTime');
        }

        for (const field of requiredFields) {
            if (!formData[field]) {
                alert("אנא מלא את כל שדות החובה (לקוח, פרויקט, משאב, תאריכים ושעות).");
                return;
            }
        }
        
        if (startOfDay(new Date(formData.endDate!)) < startOfDay(new Date(formData.startDate!))) {
            alert("תאריך הסיום אינו יכול להיות לפני תאריך ההתחלה.");
            return;
        }
        if (!isTechnicalRoom && formData.startTime && formData.endTime && formData.startTime >= formData.endTime && isSameDay(new Date(formData.startDate!), new Date(formData.endDate!))) {
            alert("שעת הסיום חייבת להיות אחרי שעת ההתחלה.");
            return;
        }
        
        const finalFormData = { ...formData };
        if (isTechnicalRoom) {
            if (!finalFormData.startTime) finalFormData.startTime = undefined;
            if (!finalFormData.endTime) finalFormData.endTime = undefined;
        }

        const baseBookingData: Omit<BookingFormData, 'id' | 'resourceId' | 'startDate' | 'endDate'> = {
            projectId: finalFormData.projectId!,
            clientId: finalFormData.clientId!,
            personnelId: finalFormData.personnelId,
            technicalServices: finalFormData.technicalServices || [],
            materials: finalFormData.materials || [],
            startTime: finalFormData.startTime,
            endTime: finalFormData.endTime,
            notes: finalFormData.notes || '',
            doNotChargeResource: finalFormData.doNotChargeResource || false,
        };

        if (booking) { // If we are editing
            const bookingsToSave: BookingFormData[] = [];
            // 1. The original booking is updated.
            bookingsToSave.push({
                ...baseBookingData,
                id: booking.id, // This marks it as an update
                resourceId: finalFormData.resourceId!,
                startDate: finalFormData.startDate!,
                endDate: finalFormData.endDate!
            });
            
            // 2. New bookings are created for additional rooms (no weekend splitting on edit).
            additionalResourceIds.forEach(resId => {
                bookingsToSave.push({
                    ...baseBookingData,
                    id: undefined, // This marks it as a new booking
                    resourceId: resId,
                    startDate: finalFormData.startDate!,
                    endDate: finalFormData.endDate!,
                });
            });
            onRequestSave(bookingsToSave);

        } else { // If we are creating, handle weekend splitting
            const bookingsToSave: BookingFormData[] = [];
            const allResourceIds = [finalFormData.resourceId, ...additionalResourceIds].filter(Boolean) as string[];
            const { startDate, endDate } = finalFormData;
            if (!startDate || !endDate) return;

            let chunkStartDate: Date | null = null;
            const cursorDate = startOfDay(new Date(startDate));
            const finalEndDate = startOfDay(new Date(endDate));

            while (cursorDate <= finalEndDate) {
                const dayOfWeek = cursorDate.getDay();
                const isExcludedWeekend = (dayOfWeek === 5 && !durationOptions.includeFriday) || (dayOfWeek === 6 && !durationOptions.includeSaturday);

                if (!isExcludedWeekend) {
                    if (chunkStartDate === null) {
                        chunkStartDate = new Date(cursorDate);
                    }
                } else {
                    if (chunkStartDate !== null) {
                        const chunkEndDate = new Date(cursorDate);
                        chunkEndDate.setDate(chunkEndDate.getDate() - 1);
                        
                        allResourceIds.forEach(resId => {
                            bookingsToSave.push({
                                ...baseBookingData,
                                id: undefined,
                                resourceId: resId,
                                startDate: chunkStartDate!,
                                endDate: chunkEndDate,
                            });
                        });
                        chunkStartDate = null;
                    }
                }
                cursorDate.setDate(cursorDate.getDate() + 1);
            }
            
            if (chunkStartDate !== null) {
                allResourceIds.forEach(resId => {
                    bookingsToSave.push({
                                ...baseBookingData,
                                id: undefined,
                                resourceId: resId,
                                startDate: chunkStartDate!,
                                endDate: finalEndDate,
                            });
                });
            }

            if (bookingsToSave.length === 0) {
                alert("לא נבחרו ימים להזמנה בטווח התאריכים (ייתכן ונבחרו רק סופי שבוע).");
                return;
            }
            onRequestSave(bookingsToSave);
        }
    }
    
    const handleDeleteClick = () => {
        if (!booking) return;
        const isMultiDay = startOfDay(booking.endDate) > startOfDay(booking.startDate);
        
        if (isMultiDay) {
            setShowDeleteOptions(true);
        } else {
            onShowConfirmation(
                'האם אתה בטוח שברצונך למחוק את ההזמנה?',
                () => onDeleteEntire(booking.id)
            );
        }
    };
    
    const filteredProjects = useMemo(() => projects.filter(p => p.clientId === formData.clientId), [formData.clientId, projects]);
    const otherResources = useMemo(() => resources.filter(r => r.id !== formData.resourceId), [formData.resourceId, resources]);
    
    const availableServices = useMemo(() => services.filter(s => !(formData.technicalServices || []).includes(s.id)), [formData.technicalServices, services]);
    const availableMaterials = useMemo(() => materials.filter(m => !(formData.materials || []).some(fm => fm.materialId === m.id)), [formData.materials, materials]);

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 pb-4 border-b border-slate-200 flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-slate-800">{booking ? 'עריכת הזמנה' : 'הזמנה חדשה'}</h2>
                     <div className="flex items-center gap-3">
                        {!showDeleteOptions ? (
                            <>
                                <button type="submit" form="booking-form" className="bg-studio-blue-500 text-white font-bold py-2 px-5 rounded-lg hover:bg-studio-blue-600 transition duration-300">שמור</button>
                                <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300">ביטול</button>
                                {booking && currentUser?.role === 'admin' && 
                                    <button 
                                        type="button" 
                                        onClick={handleDeleteClick} 
                                        className="bg-red-100 text-red-700 py-2 px-5 rounded-lg hover:bg-red-200 transition duration-300"
                                    >
                                        מחק
                                    </button>
                                }
                            </>
                        ) : (
                             <button type="button" onClick={() => setShowDeleteOptions(false)} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300">חזור לעריכה</button>
                        )}
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto">
                    {showDeleteOptions && booking && selectedDate ? (
                        <DeleteOptionsView 
                            booking={booking}
                            selectedDate={selectedDate}
                            onDeleteEntire={onDeleteEntire}
                            onDeleteDay={onDeleteDay}
                            onDeleteRange={onDeleteRange}
                            onShowConfirmation={onShowConfirmation}
                        />
                    ) : (
                        <form id="booking-form" onSubmit={handleSubmit} className="p-6 space-y-6">
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <SearchableSelect label="לקוח" name="clientId" value={formData.clientId || ''} onChange={handleChange} options={clients.map(c=>({value: c.id, label: c.name}))} required />
                                    <SearchableSelect label="פרויקט" name="projectId" value={formData.projectId || ''} onChange={handleChange} options={filteredProjects.map(p=>({value: p.id, label: p.name}))} required disabled={!formData.clientId}/>
                                    <div>
                                        <SearchableSelect label="משאב" name="resourceId" value={formData.resourceId || ''} onChange={handleChange} options={resources.map(r=>({value: r.id, label: r.name}))} required />
                                        <div className="mt-2 pl-1">
                                            <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                                                <input
                                                    id="doNotChargeResource"
                                                    name="doNotChargeResource"
                                                    type="checkbox"
                                                    checked={!!formData.doNotChargeResource}
                                                    onChange={handleChange}
                                                    className="h-4 w-4 rounded border-gray-300 text-studio-blue-600 focus:ring-studio-blue-500"
                                                />
                                                <span className="mr-2">אל תחייב משאב של חדר</span>
                                            </label>
                                        </div>
                                    </div>
                                    <SearchableSelect label="איש צוות" name="personnelId" value={formData.personnelId || ''} onChange={handleChange} placeholder="ללא" options={[{value: '', label: 'ללא'}, ...personnel.map(e=>({value: e.id, label: e.name}))]} />
                                    
                                    <DatePicker label="תאריך התחלה" selectedDate={formData.startDate} onChange={(date) => handleDateChange('startDate', date)} required />
                                    <DatePicker label="תאריך סיום" selectedDate={formData.endDate} onChange={(date) => handleDateChange('endDate', date)} required disabled={durationOptions.fullMonth && !booking} />
                                    
                                    <div className="md:col-span-2 -mt-4">
                                        <label className="block text-sm font-bold text-gray-700 mb-2">אפשרויות משך</label>
                                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 p-3 bg-slate-100 rounded-md">
                                            <div className="flex items-center">
                                                <input id="cb-friday" type="checkbox" checked={durationOptions.includeFriday} onChange={() => handleDurationChange('includeFriday')} disabled={durationOptions.fullMonth} className="h-4 w-4 rounded border-gray-300 text-studio-blue-600 focus:ring-studio-blue-500" />
                                                <label htmlFor="cb-friday" className="mr-2 text-sm text-gray-700">שבוע כולל שישי</label>
                                            </div>
                                            <div className="flex items-center">
                                                <input id="cb-saturday" type="checkbox" checked={durationOptions.includeSaturday} onChange={() => handleDurationChange('includeSaturday')} disabled={durationOptions.fullMonth} className="h-4 w-4 rounded border-gray-300 text-studio-blue-600 focus:ring-studio-blue-500" />
                                                <label htmlFor="cb-saturday" className="mr-2 text-sm text-gray-700">שבוע כולל שבת</label>
                                            </div>
                                            <div className="flex items-center">
                                                <input id="cb-month" type="checkbox" checked={durationOptions.fullMonth} onChange={() => handleDurationChange('fullMonth')} className="h-4 w-4 rounded border-gray-300 text-studio-blue-600 focus:ring-studio-blue-500" />
                                                <label htmlFor="cb-month" className="mr-2 text-sm text-gray-700">חודש שלם</label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <TimePicker label={`שעת התחלה ${isTechnicalRoom ? '(אופציונלי)' : ''}`} value={formData.startTime} onChange={(time) => handleTimeChange('startTime', time)} required={!isTechnicalRoom} />
                                    <TimePicker label={`שעת סיום ${isTechnicalRoom ? '(אופציונלי)' : ''}`} value={formData.endTime} onChange={(time) => handleTimeChange('endTime', time)} required={!isTechnicalRoom} />
                                </div>
                                
                                {formData.resourceId && (
                                    <div>
                                        <label className="block text-sm font-bold text-gray-700 mb-2">הוסף חדרים נוספים לאותה הזמנה</label>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 p-4 bg-slate-100 rounded-md max-h-32 overflow-y-auto">
                                            {otherResources.map(resource => (
                                                <div key={resource.id} className="flex items-center">
                                                    <input type="checkbox" id={`add-res-${resource.id}`} checked={additionalResourceIds.includes(resource.id)} onChange={() => setAdditionalResourceIds(prev => prev.includes(resource.id) ? prev.filter(id => id !== resource.id) : [...prev, resource.id])} className="h-4 w-4 rounded border-gray-300 text-studio-blue-600 focus:ring-studio-blue-500" />
                                                    <label htmlFor={`add-res-${resource.id}`} className="mr-2 text-sm text-gray-700">{resource.name}</label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <hr className="border-slate-200" />

                                <div>
                                    <h3 className="text-lg font-medium text-gray-800 mb-2">שירותים טכניים</h3>
                                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto p-2 bg-slate-100 rounded">
                                        {(formData.technicalServices || []).length === 0 && <p className="text-sm text-gray-500 text-center p-2">אין שירותים משויכים</p>}
                                        {(formData.technicalServices || []).map(serviceId => {
                                            const service = services.find(s => s.id === serviceId);
                                            return (
                                                <div key={serviceId} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                                                    <span className="text-sm text-gray-800">{service?.name} (₪{service?.price})</span>
                                                    <button type="button" onClick={() => handleRemoveService(serviceId)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {availableServices.length > 0 && <div className="flex gap-2 items-end">
                                        <div className="flex-grow"><SearchableSelect label="" name="serviceToAdd" value={serviceToAdd} onChange={(e) => setServiceToAdd(e.target.value)} options={availableServices.map(s => ({ value: s.id, label: `${s.name} - ₪${s.price}`}))} placeholder="בחר שירות להוספה..." /></div>
                                        <button type="button" onClick={handleAddService} className="bg-studio-blue-500 text-white py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition h-[42px]">הוסף</button>
                                    </div>}
                                </div>

                                <hr className="border-slate-200" />

                                <div>
                                    <h3 className="text-lg font-medium text-gray-800 mb-2">חומרי גלם</h3>
                                     <div className="space-y-2 mb-3 max-h-40 overflow-y-auto p-2 bg-slate-100 rounded">
                                        {(formData.materials || []).length === 0 && <p className="text-sm text-gray-500 text-center p-2">אין חומרים משויכים</p>}
                                        {(formData.materials || []).map(matBooking => {
                                             const material = materials.find(m => m.id === matBooking.materialId);
                                             return (
                                                 <div key={matBooking.materialId} className="flex justify-between items-center bg-white p-2 rounded shadow-sm gap-2">
                                                     <span className="text-sm text-gray-800 flex-1">{material?.name} (₪{material?.sellingPrice})</span>
                                                     <div className="flex items-center gap-2">
                                                        <label className="text-sm">כמות:</label>
                                                        <input type="number" value={matBooking.quantity} onChange={(e) => handleMaterialQuantityChange(matBooking.materialId, parseInt(e.target.value))} min="1" className="w-16 p-1 border border-gray-300 rounded-md bg-white text-gray-900"/>
                                                     </div>
                                                     <button type="button" onClick={() => handleRemoveMaterial(matBooking.materialId)} className="text-red-500 hover:text-red-700"><i className="fas fa-trash-alt"></i></button>
                                                 </div>
                                             );
                                        })}
                                    </div>
                                     {availableMaterials.length > 0 && <div className="flex gap-2 items-end">
                                        <div className="flex-grow"><SearchableSelect label="" name="materialToAdd" value={materialToAdd} onChange={e => setMaterialToAdd(e.target.value)} options={availableMaterials.map(m => ({ value: m.id, label: `${m.name} - ₪${m.sellingPrice}` }))} placeholder="בחר חומר גלם..."/></div>
                                        <div className="w-24"><InputGroup label="כמות" type="number" name="materialQuantity" value={materialQuantity} onChange={e => setMaterialQuantity(parseInt(e.target.value))} /></div>
                                        <button type="button" onClick={handleAddMaterial} className="bg-studio-blue-500 text-white py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition h-[42px]">הוסף</button>
                                    </div>}
                                </div>
                                
                                 <hr className="border-slate-200" />
                                
                                 <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">הערות</label>
                                    <textarea name="notes" value={formData.notes || ''} onChange={handleChange} rows={3} className="mt-1 block w-full bg-white border border-gray-300 text-gray-900 rounded-md shadow-sm p-2.5 placeholder-gray-400 focus:ring-2 focus:ring-studio-blue-500 focus:border-studio-blue-500 transition duration-150 ease-in-out"></textarea>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

// Generic Modal and Forms for CRUD
const CrudModal: React.FC<{
    modal: { type: string | null; data: any | null };
    onSave: (type: string, data: any) => void;
    onClose: () => void;
    clients?: Client[];
}> = ({ modal, onSave, onClose, clients }) => {
    const { type, data } = modal;
    if (!type) return null;

    const [formData, setFormData] = useState(data || {});
    const [passwordConfirm, setPasswordConfirm] = useState('');

  useEffect(() => {
    
    if (type === 'project' && !data) {
        setFormData({ status: 'In Progress' });
    } else if (type === 'user' && !data) {
        setFormData({ role: 'admin' });
    } else {
        setFormData(data || {});
    }
    setPasswordConfirm('');
}, [data, type]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (type === 'user') {
            if (formData.password && formData.password !== passwordConfirm) {
                alert('הסיסמאות אינן תואמות.');
                return;
            }
        }
        onSave(type, formData);
    };

    const titleMap: Record<string, string> = {
        client: data ? "עריכת לקוח" : "לקוח חדש",
        project: data ? "עריכת פרויקט" : "פרויקט חדש",
        resource: data ? "עריכת משאב" : "משאב חדש",
        personnel: data ? "עריכת איש צוות" : "איש צוות חדש",
        service: data ? "עריכת שירות" : "שירות חדש",
        material: data ? "עריכת חומר גלם" : "חומר גלם חדש",
        user: data ? "עריכת משתמש" : "משתמש חדש",
    };

    const renderForm = () => {
        switch (type) {
            case 'client':
                return <>
                    <InputGroup label="שם לקוח" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="ח.פ/ע.מ" name="businessId" value={formData.businessId || ''} onChange={handleChange} required />
                    <InputGroup label="אימייל" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                    <InputGroup label="כתובת" name="address" value={formData.address || ''} onChange={handleChange} />
                </>;
            case 'project':
                return <>
                    <InputGroup label="שם פרויקט" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="לקוח" type="select" name="clientId" value={formData.clientId || ''} onChange={handleChange} options={clients?.map(c=>({value: c.id, label: c.name}))} required />
                    <InputGroup label="סטטוס" type="select" name="status" value={formData.status || 'In Progress'} onChange={handleChange} options={[{value: 'In Progress', label: 'בתהליך'}, {value: 'Completed', label: 'הושלם'}, {value: 'On Hold', label: 'בהמתנה'}]} required />
                </>;
            case 'resource':
                 return <>
                    <InputGroup label="שם משאב" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="מחיר מחירון" name="listPrice" type="number" value={formData.listPrice || ''} onChange={handleChange} required />
                    <InputGroup label="סוג" type="select" name="type" value={formData.type || 'Offline'} onChange={handleChange} options={[{value: 'Offline', label: 'Offline'}, {value: 'Online', label: 'Online'}, {value: 'Cinema', label: 'Cinema'}, {value: 'Technical', label: 'טכני'}]} required />
                    <InputGroup label="צבע" type="select" name="color" value={formData.color || ''} onChange={handleChange} options={[
                        {value: 'bg-blue-200 border-blue-400 text-blue-800', label: 'כחול'},
                        {value: 'bg-green-200 border-green-400 text-green-800', label: 'ירוק'},
                        {value: 'bg-purple-200 border-purple-400 text-purple-800', label: 'סגול'},
                        {value: 'bg-yellow-200 border-yellow-400 text-yellow-800', label: 'צהוב'},
                        {value: 'bg-red-200 border-red-400 text-red-800', label: 'אדום'},
                        {value: 'bg-gray-200 border-gray-400 text-gray-800', label: 'אפור'},
                    ]} required />
                </>;
            case 'personnel':
                 return <>
                    <InputGroup label="שם" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="תפקיד" name="role" value={formData.role || ''} onChange={handleChange} required />
                    <InputGroup label="תעריף" name="rate" type="number" value={formData.rate || ''} onChange={handleChange} required />
                </>;
            case 'service':
                 return <>
                    <InputGroup label="שם השירות" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="מחיר" name="price" type="number" value={formData.price || ''} onChange={handleChange} required />
                </>;
            case 'material':
                 return <>
                    <InputGroup label="שם חומר הגלם" name="name" value={formData.name || ''} onChange={handleChange} required />
                    <InputGroup label="מחיר קנייה" name="purchasePrice" type="number" value={formData.purchasePrice || ''} onChange={handleChange} required />
                    <InputGroup label="מחיר מכירה" name="sellingPrice" type="number" value={formData.sellingPrice || ''} onChange={handleChange} required />
                </>;
            case 'user':
                return <>
                    <InputGroup label="שם משתמש" name="username" value={formData.username || ''} onChange={handleChange} required />
                    <InputGroup label="אימייל" name="email" type="email" value={formData.email || ''} onChange={handleChange} required />
                    <PasswordInputGroup label="סיסמה" name="password" value={formData.password || ''} onChange={handleChange} required={!data} placeholder={data ? "השאר ריק כדי לא לשנות" : ""} />
                    <PasswordInputGroup label="אישור סיסמה" name="passwordConfirm" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} required={!data || !!formData.password} />
                    <InputGroup label="תפקיד" type="select" name="role" value={formData.role || 'technician'} onChange={handleChange} options={[{value: 'admin', label: 'מנהל'}, {value: 'technician', label: 'טכנאי'}]} required />
                </>;
            default: return null;
        }
    }

    return (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-8" onClick={e => e.stopPropagation()}>
                <div className="pb-4 mb-6 border-b border-slate-200">
                    <h2 className="text-3xl font-bold text-slate-800">{titleMap[type]}</h2>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {renderForm()}
                    <div className="pt-4 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition duration-300">ביטול</button>
                        <button type="submit" className="bg-studio-blue-500 text-white py-2 px-5 rounded-lg hover:bg-studio-blue-600 transition duration-300">שמור</button>
                    </div>
                </form>
            </div>
        </div>
    )
};


const InputGroup: React.FC<{
    label: string; name: string; value: string | number; onChange: (e: React.ChangeEvent<any>) => void;
    type?: string; required?: boolean; disabled?: boolean; placeholder?: string;
    options?: { value: string; label: string }[];
}> = ({ label, name, value, onChange, type = 'text', required = false, disabled = false, placeholder, options = [] }) => {
    const commonClasses = "mt-1 block w-full bg-white border border-gray-300 text-gray-900 rounded-md shadow-sm p-2.5 placeholder-gray-400 focus:ring-2 focus:ring-studio-blue-500 focus:border-studio-blue-500 transition duration-150 ease-in-out";
    const disabledClasses = "disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed";
    
    return (
    <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
        {type === 'select' ? (
            <select name={name} value={value} onChange={onChange} required={required} disabled={disabled} className={`${commonClasses} ${disabledClasses}`}>
                <option value="" disabled>{`בחר ${label}`}</option>
                {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
        ) : (
            <input type={type} name={name} value={value} onChange={onChange} required={required} disabled={disabled} className={`${commonClasses} ${disabledClasses}`} placeholder={placeholder}/>
        )}
    </div>
)};

const PasswordInputGroup: React.FC<{
    label: string; name: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    required?: boolean; placeholder?: string;
}> = ({ label, name, value, onChange, required = false, placeholder }) => {
    const [showPassword, setShowPassword] = useState(false);
    const commonClasses = "block w-full bg-white border border-gray-300 text-gray-900 rounded-md shadow-sm p-2.5 placeholder-gray-400 focus:ring-2 focus:ring-studio-blue-500 focus:border-studio-blue-500 transition duration-150 ease-in-out";

    return (
        <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{label}{required && <span className="text-red-500">*</span>}</label>
            <div className="relative mt-1">
                <input
                    type={showPassword ? 'text' : 'password'}
                    name={name}
                    value={value}
                    onChange={onChange}
                    required={required}
                    className={commonClasses}
                    placeholder={placeholder}
                />
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 hover:text-gray-700"
                    aria-label={showPassword ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
            </div>
        </div>
    );
};


// --- REPORTS VIEW ---
interface ReportLineItem {
    id: string;
    bookingId: string;
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

const ReportsView: React.FC<{
    bookings: Booking[], clients: Client[], projects: Project[], resources: Resource[], personnel: Personnel[], services: TechnicalService[], materials: Material[],
    onCloseBilling: (bookingIds: string[]) => void;
    onOpenBilling: (bookingIds: string[]) => void;
    canUndo: boolean;
    onUndo: () => void;
}> = ({ bookings, clients, projects, resources, personnel, services, materials, onCloseBilling, onOpenBilling, canUndo, onUndo }) => {
    const [filters, setFilters] = useState({ clientId: '', projectId: '', datePreset: 'thisMonth', startDate: '', endDate: '', status: 'all' });
    const [reportType, setReportType] = useState<'general' | 'detailed'>('general');
    const [reportData, setReportData] = useState<ReportLineItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [showCloseConfirmation, setShowCloseConfirmation] = useState(false);
    const [showOpenConfirmation, setShowOpenConfirmation] = useState(false);
    
    type SortDirection = 'ascending' | 'descending';
    type SortKey = 'date' | 'clientName' | 'projectName' | 'notes';
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection } | null>({ key: 'date', direction: 'ascending' });

    const handleFilterChange = (e: { target: { name: string; value: string; } }) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
        if (name === 'clientId') setFilters(prev => ({...prev, projectId: ''})); // Reset project on client change
    };
    
    useEffect(() => {
        const setDatesFromPreset = () => {
            const now = new Date();
            let start = new Date(), end = new Date();
            if (filters.datePreset === 'thisMonth') {
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            } else if (filters.datePreset === 'lastMonth') {
                start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                end = new Date(now.getFullYear(), now.getMonth(), 0);
            } else if (filters.datePreset === 'thisYear') {
                start = new Date(now.getFullYear(), 0, 1);
                end = new Date(now.getFullYear(), 11, 31);
            }
            setFilters(f => ({ ...f, startDate: formatDateForInput(start), endDate: formatDateForInput(end) }));
        }
        if (filters.datePreset !== 'custom') {
            setDatesFromPreset();
        }
    }, [filters.datePreset]);
    
    // Generate report logic wrapped in useCallback to be accessible in useEffect
    const generateReport = useCallback(() => {
        if(!filters.startDate || !filters.endDate) {
            // Avoid alerting on initial load if dates aren't set, but usually they are via preset
            if (filters.datePreset === 'custom' && (!filters.startDate || !filters.endDate)) return; 
        }

        const start = startOfDay(new Date(filters.startDate));
        const end = startOfDay(new Date(filters.endDate));
        
        const filteredBookings = bookings.filter(b => {
            const bookingStart = startOfDay(new Date(b.startDate));
            const bookingEnd = startOfDay(new Date(b.endDate));
            if (filters.clientId && b.clientId !== filters.clientId) return false;
            if (filters.projectId && b.projectId !== filters.projectId) return false;
            
            // Status Filter Logic
            if (filters.status === 'open' && b.billed) return false;
            if (filters.status === 'closed' && !b.billed) return false;

            return bookingStart <= end && bookingEnd >= start;
        });

        const newReportData: ReportLineItem[] = [];
        filteredBookings.forEach(b => {
            const resource = resources.find(r => r.id === b.resourceId);
            const person = personnel.find(p => p.id === b.personnelId);
            const client = clients.find(c => c.id === b.clientId);
            const project = projects.find(p => p.id === b.projectId);

            const isSingleDay = isSameDay(b.startDate, b.endDate);
            let durationHours = 0;
            if (isSingleDay && b.startTime && b.endTime) {
                const startTime = new Date(`1970-01-01T${b.startTime}:00`);
                const endTime = new Date(`1970-01-01T${b.endTime}:00`);
                if (endTime > startTime) {
                    durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                }
            }
            
            const durationDays = Math.round((startOfDay(b.endDate).getTime() - startOfDay(b.startDate).getTime()) / (1000 * 3600 * 24)) + 1;
            const billed = !!b.billed;

            if (reportType === 'detailed') {
                // DETAILED REPORT
                // Resource
                if (resource) {
                    const price = b.doNotChargeResource ? 0 : resource.listPrice;
                    const isHourly = resource.type !== 'Offline' && isSingleDay && durationHours > 0 && durationHours < 9;
                    if (isHourly) {
                        const hourlyRate = price / 9;
                        newReportData.push({
                            id: `${b.id}-resource-hourly`,
                            bookingId: b.id,
                            date: formatDate(b.startDate),
                            clientName: client?.name || '',
                            projectName: project?.name || '',
                            description: `חדר עריכה: ${resource.name}`,
                            notes: b.notes || '',
                            quantity: parseFloat(durationHours.toFixed(2)),
                            unit: 'שעות',
                            price: parseFloat(hourlyRate.toFixed(2)),
                            total: parseFloat((durationHours * hourlyRate).toFixed(2)),
                            billed
                        });
                    } else {
                        let currentDay = startOfDay(new Date(b.startDate));
                        const endDay = startOfDay(new Date(b.endDate));
                        while (currentDay <= endDay) {
                            if (currentDay >= start && currentDay <= end) {
                                newReportData.push({
                                    id: `${b.id}-resource-${formatDateForInput(currentDay)}`,
                                    bookingId: b.id,
                                    date: formatDate(currentDay),
                                    clientName: client?.name || '',
                                    projectName: project?.name || '',
                                    description: `חדר עריכה: ${resource.name}`,
                                    notes: b.notes || '',
                                    quantity: 1,
                                    unit: 'יום',
                                    price: price,
                                    total: price,
                                    billed
                                });
                            }
                            currentDay.setDate(currentDay.getDate() + 1);
                        }
                    }
                }
                // Personnel
                if (person) {
                    const isHourly = isSingleDay && durationHours > 0 && durationHours < 9;
                    if (isHourly) {
                        const hourlyRate = person.rate / 9;
                         newReportData.push({
                            id: `${b.id}-person-hourly`,
                            bookingId: b.id,
                            date: formatDate(b.startDate),
                            clientName: client?.name || '',
                            projectName: project?.name || '',
                            description: `איש צוות: ${person.name}`,
                            notes: b.notes || '',
                            quantity: parseFloat(durationHours.toFixed(2)),
                            unit: 'שעות',
                            price: parseFloat(hourlyRate.toFixed(2)),
                            total: parseFloat((durationHours * hourlyRate).toFixed(2)),
                            billed
                        });
                    } else {
                        let currentDay = startOfDay(new Date(b.startDate));
                        const endDay = startOfDay(new Date(b.endDate));
                        while (currentDay <= endDay) {
                           if (currentDay >= start && currentDay <= end) {
                                newReportData.push({
                                    id: `${b.id}-person-${formatDateForInput(currentDay)}`,
                                    bookingId: b.id,
                                    date: formatDate(currentDay),
                                    clientName: client?.name || '',
                                    projectName: project?.name || '',
                                    description: `איש צוות: ${person.name}`,
                                    notes: b.notes || '',
                                    quantity: 1,
                                    unit: 'יום',
                                    price: person.rate,
                                    total: person.rate,
                                    billed
                                });
                            }
                            currentDay.setDate(currentDay.getDate() + 1);
                        }
                    }
                }

            } else {
                // GENERAL REPORT
                // Resource
                if (resource) {
                    const price = b.doNotChargeResource ? 0 : resource.listPrice;
                    const isHourly = resource.type !== 'Offline' && isSingleDay && durationHours > 0 && durationHours < 9;
                    if (isHourly) {
                        const hourlyRate = price / 9;
                        newReportData.push({
                            id: `${b.id}-resource`,
                            bookingId: b.id,
                            date: formatDate(b.startDate),
                            clientName: client?.name || '',
                            projectName: project?.name || '',
                            description: `חדר עריכה: ${resource.name}`,
                            notes: b.notes || '',
                            quantity: parseFloat(durationHours.toFixed(2)),
                            unit: 'שעות',
                            price: parseFloat(hourlyRate.toFixed(2)),
                            total: parseFloat((durationHours * hourlyRate).toFixed(2)),
                            billed
                        });
                    } else {
                        newReportData.push({
                            id: `${b.id}-resource`,
                            bookingId: b.id,
                            date: formatDate(b.startDate),
                            clientName: client?.name || '',
                            projectName: project?.name || '',
                            description: `חדר עריכה: ${resource.name}`,
                            notes: b.notes || '',
                            quantity: durationDays, unit: 'ימים', price: price, total: durationDays * price,
                            billed
                        });
                    }
                }
                // Personnel
                if (person) {
                    const isHourly = isSingleDay && durationHours > 0 && durationHours < 9;
                     if (isHourly) {
                         const hourlyRate = person.rate / 9;
                         newReportData.push({
                             id: `${b.id}-person`,
                             bookingId: b.id,
                             date: formatDate(b.startDate),
                             clientName: client?.name || '',
                            projectName: project?.name || '',
                             description: `איש צוות: ${person.name}`,
                             notes: b.notes || '',
                             quantity: parseFloat(durationHours.toFixed(2)),
                             unit: 'שעות',
                             price: parseFloat(hourlyRate.toFixed(2)),
                             total: parseFloat((durationHours * hourlyRate).toFixed(2)),
                             billed
                         });
                     } else {
                         newReportData.push({ 
                            id: `${b.id}-person`,
                            bookingId: b.id, 
                            date: formatDate(b.startDate), 
                            clientName: client?.name || '',
                            projectName: project?.name || '',
                            description: `איש צוות: ${person.name}`, 
                            notes: b.notes || '', 
                            quantity: durationDays, 
                            unit: 'ימים', 
                            price: person.rate, 
                            total: durationDays * person.rate,
                            billed
                        });
                     }
                }
            }

             // Handle one-time charges (services, materials) - same for both modes
            (b.technicalServices || []).forEach(serviceId => {
                const service = services.find(s => s.id === serviceId);
                if(service) newReportData.push({ id: `${b.id}-service-${serviceId}`, bookingId: b.id, date: formatDate(b.startDate), clientName: client?.name || '', projectName: project?.name || '', description: `שירות: ${service.name}`, notes: b.notes || '', quantity: 1, unit: 'יחידה', price: service.price, total: service.price, billed });
            });
            (b.materials || []).forEach(matBooking => {
                const materialInfo = materials.find(m => m.id === matBooking.materialId);
                if (materialInfo) {
                     newReportData.push({
                         id: `${b.id}-material-${matBooking.materialId}`,
                         bookingId: b.id,
                         date: formatDate(b.startDate),
                         clientName: client?.name || '',
                         projectName: project?.name || '',
                         description: `חומר גלם: ${materialInfo.name}`,
                         notes: b.notes || '',
                         quantity: matBooking.quantity,
                         unit: 'יחידות',
                         price: matBooking.sellingPrice,
                         total: matBooking.quantity * matBooking.sellingPrice,
                         billed
                     });
                }
            });
        });

        setReportData(newReportData);
        setSelectedItems(new Set()); // Clear selection when report regenerates
    }, [bookings, filters, reportType, clients, projects, resources, personnel, services, materials]);


    // Automatically refresh report when data or filters change
    useEffect(() => {
        // We check if we have minimal criteria to run
        if (filters.startDate && filters.endDate) {
            generateReport();
        }
    }, [generateReport]);


    const sortedReportData = useMemo(() => {
        let sortableItems = [...reportData];
        if (sortConfig !== null) {
            sortableItems.sort((a, b) => {
                let aValue: any, bValue: any;
                if (sortConfig.key === 'date') {
                    const [dayA, monthA, yearA] = a.date.split('/').map(Number);
                    const dateA = new Date(yearA, monthA - 1, dayA);
                    const [dayB, monthB, yearB] = b.date.split('/').map(Number);
                    const dateB = new Date(yearB, monthB - 1, dayB);
                    aValue = dateA.getTime();
                    bValue = dateB.getTime();
                } else {
                    aValue = a[sortConfig.key];
                    bValue = b[sortConfig.key];
                }

                if (aValue < bValue) {
                    return sortConfig.direction === 'ascending' ? -1 : 1;
                }
                if (aValue > bValue) {
                    return sortConfig.direction === 'ascending' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [reportData, sortConfig]);

    const requestSort = (key: SortKey) => {
        let direction: SortDirection = 'ascending';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
            direction = 'descending';
        }
        setSortConfig({ key, direction });
    };

    const handlePriceChange = (id: string, newPrice: number) => {
        setReportData(prev => prev.map(item => item.id === id ? {...item, price: newPrice, total: newPrice * item.quantity} : item));
    }
    
    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            const allIds = sortedReportData.map(i => i.id);
            setSelectedItems(new Set(allIds));
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleSelectItem = (id: string) => {
        const newSelected = new Set(selectedItems);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedItems(newSelected);
    };


    const handleClosePeriod = () => {
        if (selectedItems.size === 0) return;
        setShowCloseConfirmation(true);
    };
    
    const handleOpenPeriod = () => {
        if (selectedItems.size === 0) return;
        setShowOpenConfirmation(true);
    };

    const performCloseBilling = () => {
        const selectedRows = reportData.filter(r => selectedItems.has(r.id) && !r.billed);
        // Map selected report rows to unique booking IDs
        const uniqueBookingIds = Array.from(new Set(selectedRows.map(i => i.bookingId)));
        onCloseBilling(uniqueBookingIds);
        setShowCloseConfirmation(false);
    };

    const performOpenBilling = () => {
        const selectedRows = reportData.filter(r => selectedItems.has(r.id) && r.billed);
        // Map selected report rows to unique booking IDs
        const uniqueBookingIds = Array.from(new Set(selectedRows.map(i => i.bookingId)));
        onOpenBilling(uniqueBookingIds);
        setShowOpenConfirmation(false);
    };
    
    
    const exportToCsv = () => {
        if (sortedReportData.length === 0) return;
        const isGeneralView = !filters.projectId;
        
        const headers = isGeneralView
            ? ['תאריך', 'שם לקוח', 'שם פרויקט', 'תיאור', 'הערות', 'כמות', 'יחידה', 'מחיר ליחידה', 'סה"כ', 'סטטוס']
            : ['תאריך', 'תיאור', 'הערות', 'כמות', 'יחידה', 'מחיר ליחידה', 'סה"כ', 'סטטוס'];
        
        const csvRows = sortedReportData.map(item => {
            const row = [
                item.date,
                isGeneralView ? `"${item.clientName.replace(/"/g, '""')}"` : null,
                isGeneralView ? `"${item.projectName.replace(/"/g, '""')}"` : null,
                `"${item.description.replace(/"/g, '""')}"`,
                `"${(item.notes || '').replace(/"/g, '""')}"`,
                item.quantity,
                item.unit,
                item.price,
                item.total,
                item.billed ? 'סגור' : 'פתוח'
            ].filter(val => val !== null); // Filter out nulls for specific view
            return row.join(',');
        });
        
        const csvString = [headers.join(','), ...csvRows].join('\n');
        const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
        
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        const selectedProject = projects.find(p => p.id === filters.projectId);
        const fileName = selectedProject ? `Report_${selectedProject.name.replace(/\s/g, '_')}.csv` : "Studio_Report.csv";
        
        link.setAttribute("href", url);
        link.setAttribute("download", fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handlePrintToPdf = () => {
        if (sortedReportData.length === 0) return;
    
        const printArea = document.querySelector('.print-area');
        if (!printArea) {
            alert('שגיאה: אזור ההדפסה לא נמצא.');
            return;
        }
        const contentToPrint = printArea.innerHTML;
    
        const printWindow = window.open('', '_blank');
    
        if (!printWindow) {
            alert('לא ניתן לפתוח חלון הדפסה. ייתכן שחוסם החלונות הקופצים מונע זאת.');
            return;
        }
    
        const htmlContent = `
            <!DOCTYPE html>
            <html lang="he" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>דוח StudioFlow</title>
                <link href="https://fonts.googleapis.com/css2?family=Assistant:wght@300;400;600;700&display=swap" rel="stylesheet">
                <style>
                    body { 
                        font-family: 'Assistant', sans-serif; 
                        margin: 20px;
                        -webkit-print-color-adjust: exact !important; 
                        print-color-adjust: exact !important;
                    }
                    table { 
                        width: 100%; 
                        border-collapse: collapse; 
                    }
                    th, td { 
                        border: 1px solid #ccc; 
                        padding: 8px; 
                        text-align: right; 
                    }
                    thead { 
                        background-color: #f2f2f2 !important; 
                    }
                    h1, h2, p { 
                        text-align: right; 
                    }
                    tfoot { 
                        font-weight: bold; 
                    }
                    .closed-row {
                        background-color: #fce7f3 !important; /* Pink-100 */
                    }
                    @page { 
                        size: A4; 
                        margin: 20mm; 
                    }
                </style>
            </head>
            <body>
                ${contentToPrint}
            </body>
            </html>
        `;
    
        printWindow.document.write(htmlContent);
        printWindow.document.close();
    
        // Use setTimeout to ensure the content and styles (especially fonts) are loaded
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
        }, 500);
    };

    const handleSendEmail = () => {
        if (sortedReportData.length === 0) {
            alert("יש להפיק דוח תחילה.");
            return;
        }
    
        const selectedClient = clients.find(c => c.id === filters.clientId);
        if (!selectedClient) {
            alert("יש לבחור לקוח על מנת לשלוח מייל.");
            return;
        }
        if (!selectedClient.email) {
            alert(`ללקוח "${selectedClient.name}" אין כתובת מייל שמורה במערכת.`);
            return;
        }
    
        const selectedProject = projects.find(p => p.id === filters.projectId);
        const subject = selectedProject 
            ? `StudioFlow - דוח עבור פרויקט: ${selectedProject.name}` 
            : `StudioFlow - דוח כללי`;
    
        const bodyHeader = `שלום ${selectedClient.name},\n\nמצורף סיכום הדוח עבור ${selectedProject ? `פרויקט "${selectedProject.name}"` : 'התקופה המבוקשת'}.\nלתשומת לבך, מומלץ לצרף למייל זה את קובץ ה-PDF או ה-CSV המפורט מהמערכת.\n\n--------------------------------\n`;
        
        const isGeneralView = !filters.projectId;
        const reportLines = sortedReportData.map(item => {
            if (isGeneralView) {
                return `${item.date} | ${item.projectName} | ${item.description} | ${item.quantity} ${item.unit} | ₪${item.total.toLocaleString()} ${item.billed ? '(סגור)' : ''}`;
            }
            return `${item.date} | ${item.description} | ${item.quantity} ${item.unit} | ₪${item.total.toLocaleString()} ${item.billed ? '(סגור)' : ''}`;
        }).join('\n');
        
        const bodyFooter = `\n--------------------------------\nסה"כ: ₪${total.toLocaleString()}\n\nבברכה,\nצוות StudioFlow`;
        
        const fullBody = bodyHeader + reportLines + bodyFooter;
        
        const mailtoLink = `mailto:${selectedClient.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
        
        const link = document.createElement('a');
        link.href = mailtoLink;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const total = useMemo(() => sortedReportData.reduce((acc, item) => acc + item.total, 0), [sortedReportData]);
    const filteredProjects = useMemo(() => projects.filter(p => p.clientId === filters.clientId), [filters.clientId, projects]);
    const isGeneralView = !filters.projectId;
    
    const SortableHeader: React.FC<{ sortKey: SortKey; label: string }> = ({ sortKey, label }) => (
         <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
             <button type="button" onClick={() => requestSort(sortKey)} className="flex items-center gap-1 hover:text-gray-700">
                {label}
                {sortConfig?.key === sortKey && (sortConfig.direction === 'ascending' ? '▲' : '▼')}
            </button>
         </th>
    );
    
    const selectedOpenCount = sortedReportData.filter(i => selectedItems.has(i.id) && !i.billed).length;
    const selectedClosedCount = sortedReportData.filter(i => selectedItems.has(i.id) && i.billed).length;

    return (
        <div className="p-4 md:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">הפקת דוחות</h1>
                <button 
                    onClick={onUndo} 
                    disabled={!canUndo} 
                    className="p-2 px-4 bg-gray-100 text-gray-700 font-semibold border rounded-md hover:bg-gray-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <i className="fas fa-undo"></i> בטל פעולה אחרונה
                </button>
            </div>
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                <SearchableSelect label="לקוח" name="clientId" value={filters.clientId} onChange={handleFilterChange} options={[{ value: '', label: 'כל הלקוחות' }, ...clients.map(c => ({ value: c.id, label: c.name }))]} placeholder="בחר לקוח..." />
                <SearchableSelect label="פרויקט" name="projectId" value={filters.projectId} onChange={handleFilterChange} disabled={!filters.clientId} options={[{ value: '', label: 'כל הפרויקטים' }, ...filteredProjects.map(p => ({ value: p.id, label: p.name }))]} placeholder="בחר פרויקט..."/>
                <InputGroup label="טווח תאריכים" type="select" name="datePreset" value={filters.datePreset} onChange={e => handleFilterChange({target: {name: e.target.name, value: e.target.value}})} options={[
                    { value: 'thisMonth', label: 'החודש הנוכחי' },
                    { value: 'lastMonth', label: 'החודש שעבר' },
                    { value: 'thisYear', label: 'השנה הנוכחית' },
                    { value: 'custom', label: 'טווח מותאם אישית' },
                ]} />
                <div className="flex gap-2">
                    <InputGroup label="מתאריך" type="date" name="startDate" value={filters.startDate} onChange={e => handleFilterChange({target: {name: e.target.name, value: e.target.value}})} disabled={filters.datePreset !== 'custom'} />
                    <InputGroup label="עד תאריך" type="date" name="endDate" value={filters.endDate} onChange={e => handleFilterChange({target: {name: e.target.name, value: e.target.value}})} disabled={filters.datePreset !== 'custom'} />
                </div>
                
                <div className="md:col-span-2 lg:col-span-1">
                     <InputGroup label="סטטוס חיוב" type="select" name="status" value={filters.status} onChange={e => handleFilterChange({target: {name: e.target.name, value: e.target.value}})} options={[
                        { value: 'all', label: 'הכל' },
                        { value: 'open', label: 'פתוח' },
                        { value: 'closed', label: 'סגור' },
                    ]} />
                </div>

                 <div className="lg:col-span-3 flex justify-between items-center mt-4">
                    <div>
                        <span className="text-sm font-bold text-gray-700 mr-4">סוג דוח:</span>
                         <label className="mr-4"><input type="radio" name="reportType" value="general" checked={reportType === 'general'} onChange={() => setReportType('general')} className="ml-1" /> כללי</label>
                        <label><input type="radio" name="reportType" value="detailed" checked={reportType === 'detailed'} onChange={() => setReportType('detailed')} className="ml-1" /> מפורט</label>
                    </div>
                     <button onClick={generateReport} className="bg-studio-blue-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-studio-blue-600 transition">הפק דוח</button>
                 </div>
            </div>
            
            {/* Report Table */}
            {sortedReportData.length > 0 && (
                <>
                <div className="bg-white shadow-md rounded-lg overflow-hidden">
                     <div className="p-4 flex justify-between items-center border-b">
                        <h2 className="text-xl font-bold">תוצאות הדוח</h2>
                        <div className="flex items-center gap-4">
                            {selectedOpenCount > 0 && (
                                <button 
                                    onClick={handleClosePeriod}
                                    className="bg-pink-500 text-white hover:bg-pink-600 font-bold py-2 px-4 rounded shadow transition"
                                >
                                    <i className="fas fa-lock"></i> סגור חיובים נבחרים ({selectedOpenCount})
                                </button>
                            )}
                            {selectedClosedCount > 0 && (
                                <button 
                                    onClick={handleOpenPeriod}
                                    className="bg-teal-500 text-white hover:bg-teal-600 font-bold py-2 px-4 rounded shadow transition"
                                >
                                    <i className="fas fa-lock-open"></i> פתח חיובים נבחרים ({selectedClosedCount})
                                </button>
                            )}
                            <button 
                                onClick={handleSendEmail} 
                                disabled={!filters.clientId}
                                className="text-studio-blue-600 hover:text-studio-blue-800 font-semibold flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                title={!filters.clientId ? "יש לבחור לקוח" : "שלח דוח במייל"}
                            >
                                <i className="fas fa-paper-plane"></i> שלח במייל
                            </button>
                            <button onClick={handlePrintToPdf} className="text-studio-blue-600 hover:text-studio-blue-800 font-semibold flex items-center gap-2">
                                <i className="fas fa-file-pdf"></i> יצא ל-PDF
                            </button>
                            <button onClick={exportToCsv} className="text-studio-blue-600 hover:text-studio-blue-800 font-semibold flex items-center gap-2">
                                <i className="fas fa-file-csv"></i> יצא ל-CSV
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                         <input 
                                            type="checkbox" 
                                            className="form-checkbox h-4 w-4 text-studio-blue-600 border-gray-300 rounded focus:ring-studio-blue-500"
                                            onChange={handleSelectAll}
                                            checked={sortedReportData.length > 0 && selectedItems.size === sortedReportData.length}
                                        />
                                    </th>
                                    <SortableHeader sortKey="date" label="תאריך" />
                                    {isGeneralView && <SortableHeader sortKey="clientName" label="שם לקוח" />}
                                    {isGeneralView && <SortableHeader sortKey="projectName" label="שם פרויקט" />}
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase w-2/5">תיאור</th>
                                    <SortableHeader sortKey="notes" label="הערות" />
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">כמות</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">יחידה</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">מחיר ליחידה</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">סה"כ</th>
                                </tr>
                            </thead>
                             <tbody className="bg-white divide-y divide-gray-200">
                                {sortedReportData.map(item => (
                                    <tr key={item.id} className={item.billed ? 'bg-pink-200 hover:bg-pink-300' : 'hover:bg-gray-50'}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <input 
                                                type="checkbox" 
                                                className="form-checkbox h-4 w-4 text-studio-blue-600 border-gray-300 rounded focus:ring-studio-blue-500"
                                                checked={selectedItems.has(item.id)}
                                                onChange={() => handleSelectItem(item.id)}
                                            />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.date}</td>
                                        {isGeneralView && <td className="px-6 py-4 whitespace-nowrap text-sm">{item.clientName}</td>}
                                        {isGeneralView && <td className="px-6 py-4 whitespace-nowrap text-sm">{item.projectName}</td>}
                                        <td className="px-6 py-4 text-sm">{item.description}</td>
                                        <td className="px-6 py-4 text-sm">{item.notes}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.quantity}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">{item.unit}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <input type="number" value={item.price} onChange={e => handlePriceChange(item.id, parseFloat(e.target.value))} className="w-24 p-1 border rounded bg-transparent" />
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold">₪{item.total.toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="p-4 bg-gray-50 text-right font-bold text-lg">
                        סה"כ: ₪{total.toLocaleString()}
                    </div>
                </div>
                {showCloseConfirmation && (
                    <ConfirmationModal
                        title="סגירת חיובים"
                        message={`האם אתה בטוח שברצונך לסגור חיובים עבור ${selectedOpenCount} שורות נבחרות?`}
                        onConfirm={performCloseBilling}
                        onCancel={() => setShowCloseConfirmation(false)}
                        confirmButtonText="סגור חיובים"
                        isDestructive={false}
                    />
                )}
                {showOpenConfirmation && (
                    <ConfirmationModal
                        title="פתיחת חיובים מחדש"
                        message={`האם אתה בטוח שברצונך לפתוח מחדש ${selectedClosedCount} שורות נבחרות לחיוב?`}
                        onConfirm={performOpenBilling}
                        onCancel={() => setShowOpenConfirmation(false)}
                        confirmButtonText="פתח חיובים"
                        isDestructive={false}
                    />
                )}

                {/* Printable version (hidden from screen) */}
                <div className="print-area hidden">
                    {(() => {
                        const selectedProject = projects.find(p => p.id === filters.projectId);
                        const reportTitle = selectedProject ? `דוח עבור: ${selectedProject.name}` : "דוח כללי";
                        const clientName = clients.find(c => c.id === filters.clientId)?.name || '';
                        return (
                            <div>
                                <h1 style={{fontSize: '1.5rem', fontWeight: 'bold'}}>{reportTitle}</h1>
                                {clientName && <h2 style={{fontSize: '1.2rem'}}>לקוח: {clientName}</h2>}
                                <p>תאריכים: {formatDate(new Date(filters.startDate))} - {formatDate(new Date(filters.endDate))}</p>
                                <br />
                                <table>
                                    <thead>
                                        <tr>
                                            <th>תאריך</th>
                                            {isGeneralView && <th>שם לקוח</th>}
                                            {isGeneralView && <th>שם פרויקט</th>}
                                            <th style={{width: '40%'}}>תיאור</th>
                                            <th>הערות</th>
                                            <th>כמות</th>
                                            <th>יחידה</th>
                                            <th>מחיר ליחידה</th>
                                            <th>סה"כ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sortedReportData.map(item => (
                                            <tr key={`print-${item.id}`} className={item.billed ? 'closed-row' : ''}>
                                                <td>{item.date}</td>
                                                {isGeneralView && <td>{item.clientName}</td>}
                                                {isGeneralView && <td>{item.projectName}</td>}
                                                <td>{item.description}</td>
                                                <td>{item.notes}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.unit}</td>
                                                <td>₪{item.price.toLocaleString()}</td>
                                                <td>₪{item.total.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={isGeneralView ? 8 : 6} style={{textAlign: 'left', fontWeight: 'bold', fontSize: '1.1rem'}}>סה"כ</td>
                                            <td style={{fontWeight: 'bold', fontSize: '1.1rem'}}>₪{total.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        );
                    })()}
                </div>
                </>
            )}
        </div>
    );
};


const SearchModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    bookings: Booking[];
    projects: Project[];
    clients: Client[];
    onSelectBookingDate: (date: Date) => void;
}> = ({ isOpen, onClose, bookings, projects, clients, onSelectBookingDate }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredBookings = useMemo(() => {
        if (!searchTerm.trim()) return [];
        const lowerSearchTerm = searchTerm.toLowerCase();
        return bookings
            .map(b => {
                const project = projects.find(p => p.id === b.projectId);
                const client = clients.find(c => c.id === b.clientId);
                return { ...b, projectName: project?.name, clientName: client?.name };
            })
            .filter(b => 
                b.projectName?.toLowerCase().includes(lowerSearchTerm) ||
                b.clientName?.toLowerCase().includes(lowerSearchTerm) ||
                b.notes.toLowerCase().includes(lowerSearchTerm)
            )
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
    }, [searchTerm, bookings, projects, clients]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col" style={{height: '70vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b">
                    <div className="relative">
                        <input 
                            type="text" 
                            placeholder="חיפוש לפי שם פרויקט, לקוח או הערה..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-100 border-gray-300 rounded-md p-3 pr-10 focus:ring-studio-blue-500 focus:border-studio-blue-500" 
                            autoFocus
                        />
                         <i className="fas fa-search absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {filteredBookings.length > 0 ? (
                        <ul>
                            {filteredBookings.map(booking => (
                                <li key={booking.id} onClick={() => onSelectBookingDate(new Date(booking.startDate))} className="p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors">
                                    <div className="font-bold">{booking.projectName} <span className="font-normal text-gray-600">({booking.clientName})</span></div>
                                    <div className="text-sm text-gray-500">{formatDate(new Date(booking.startDate))} - {formatDate(new Date(booking.endDate))}</div>
                                    {booking.notes && <p className="text-sm text-gray-700 mt-1">"{booking.notes}"</p>}
                                </li>
                            ))}
                        </ul>
                    ) : (
                       <div className="p-8 text-center text-gray-500">
                           {searchTerm ? 'לא נמצאו תוצאות.' : 'התחל להקליד כדי לחפש...'}
                       </div> 
                    )}
                </div>
            </div>
        </div>
    );
};

// --- BOTTOM NAV BAR FOR MOBILE ---
const BottomNavBar: React.FC<{
    currentView: AppView;
    setCurrentView: (view: AppView) => void;
    onSearchClick: () => void;
    currentUser: User;
    onLogout: () => void;
}> = ({ currentView, setCurrentView, onSearchClick, currentUser, onLogout }) => {
    const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

    const mainNavItems = useMemo(() => [
        { id: 'calendar', label: 'לוח שנה', icon: 'fa-calendar-days', role: ['admin', 'technician'], action: () => setCurrentView('calendar') },
        { id: 'reports', label: 'דוחות', icon: 'fa-chart-pie', role: ['admin'], action: () => setCurrentView('reports') },
        { id: 'search', label: 'חיפוש', icon: 'fa-search', role: ['admin', 'technician'], action: onSearchClick },
        { id: 'logout', label: 'התנתקות', icon: 'fa-sign-out-alt', role: ['admin', 'technician'], action: onLogout },
    ], [setCurrentView, onSearchClick, onLogout]);

    const moreNavItems = useMemo(() => [
        { id: 'projects', label: 'פרויקטים', icon: 'fa-folder-open', role: ['admin'], action: () => setCurrentView('projects') },
        { id: 'clients', label: 'לקוחות', icon: 'fa-users', role: ['admin'], action: () => setCurrentView('clients') },
        { id: 'resources', label: 'חדרי עריכה', icon: 'fa-desktop', role: ['admin'], action: () => setCurrentView('resources') },
        { id: 'personnel', label: 'משאבי אנוש', icon: 'fa-user-tie', role: ['admin'], action: () => setCurrentView('personnel') },
        { id: 'services', label: 'שירותים', icon: 'fa-concierge-bell', role: ['admin'], action: () => setCurrentView('services') },
        { id: 'materials', label: 'חומרי גלם', icon: 'fa-box', role: ['admin'], action: () => setCurrentView('materials') },
        { id: 'users', label: 'ניהול משתמשים', icon: 'fa-user-cog', role: ['admin'], action: () => setCurrentView('users') },
    ], [setCurrentView]);

    const filteredMainItems = useMemo(() => mainNavItems.filter(item => item.role.includes(currentUser.role)), [mainNavItems, currentUser.role]);
    const filteredMoreItems = useMemo(() => moreNavItems.filter(item => item.role.includes(currentUser.role)), [moreNavItems, currentUser.role]);

    const handleMenuClick = (itemAction: () => void) => {
        itemAction();
        setIsMoreMenuOpen(false);
    };

    const isMobile = useIsMobile();
    if (!isMobile) return null;

    return (
        <>
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] flex justify-around items-center h-16 z-40">
                {filteredMainItems.map(item => {
                    const isActive = currentView === item.id;
                    return (
                         <button 
                            key={item.id}
                            onClick={item.action}
                            className={`flex flex-col items-center justify-center p-2 w-full text-xs transition-colors ${isActive && item.id !== 'logout' ? 'text-studio-blue-600 font-bold' : 'text-gray-500 hover:text-studio-blue-500'}`}
                            aria-current={isActive && item.id !== 'logout' ? 'page' : undefined}
                        >
                            <i className={`fas ${item.icon} text-xl mb-1`}></i>
                            <span>{item.label}</span>
                        </button>
                    )
                })}
                {filteredMoreItems.length > 0 && (
                     <button
                        onClick={() => setIsMoreMenuOpen(true)}
                        className={`flex flex-col items-center justify-center p-2 w-full text-xs text-gray-500 hover:text-studio-blue-500`}
                    >
                        <i className="fas fa-bars text-xl mb-1"></i>
                        <span>עוד</span>
                    </button>
                )}
            </nav>

            {isMoreMenuOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end" onClick={() => setIsMoreMenuOpen(false)}>
                    <div 
                        className="w-full bg-white rounded-t-2xl p-4 shadow-lg"
                        style={{animation: 'slide-up 0.3s ease-out forwards', position: 'absolute', bottom: '4rem', left: 0, right: 0}}
                        onClick={e => e.stopPropagation()}
                    >
                         <style>{`
                            @keyframes slide-up {
                                from { transform: translateY(100%); }
                                to { transform: translateY(0); }
                            }
                        `}</style>
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 text-center mb-4">
                            {filteredMoreItems.map(item => (
                                 <button
                                    key={item.id}
                                    onClick={() => handleMenuClick(item.action)}
                                    className="flex flex-col items-center justify-center p-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                                 >
                                    <i className={`fas ${item.icon} text-2xl mb-2 text-studio-blue-600`}></i>
                                    <span className="text-xs">{item.label}</span>
                                 </button>
                            ))}
                        </div>
                        <div className="border-t pt-4">
                             <div className="text-sm text-gray-500 mb-2 text-center">מחובר/ת כ: <strong>{currentUser.username}</strong> ({currentUser.role === 'admin' ? 'מנהל' : 'טכנאי'})</div>
                        </div>
                        <button onClick={() => setIsMoreMenuOpen(false)} className="absolute top-2 left-2 w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-300">
                           &times;
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

const ClientImportModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onImport: (clients: Client[]) => void;
}> = ({ isOpen, onClose, onImport }) => {
    const [previewData, setPreviewData] = useState<Record<string, string>[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetState = () => {
        setPreviewData([]);
        setError(null);
        setFileName(null);
        if(fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    const handleClose = () => {
        resetState();
        onClose();
    }
    
    const parseCSV = (csvText: string): Record<string, string>[] => {
        const lines = csvText.trim().replace(/\r/g, '').split('\n');
        const headerLine = lines.shift();
        if (!headerLine) return [];

        const headers = headerLine.split(',').map(h => h.trim());
        const requiredHeaders = ['name', 'businessId'];
        const missingHeaders = requiredHeaders.filter(rh => !headers.includes(rh));
        if (missingHeaders.length > 0) {
            throw new Error(`הקובץ חסר את הכותרות הנדרשות: ${missingHeaders.join(', ')}`);
        }

        return lines.map(line => {
            // Regex to handle quoted strings with commas
            const values = line.match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g) || [];
            const sanitizedValues = values.map(value => {
                if (value.startsWith('"') && value.endsWith('"')) {
                    // Remove quotes and handle escaped quotes ("")
                    return value.substring(1, value.length - 1).replace(/""/g, '"');
                }
                return value.trim();
            });

            const obj: Record<string, string> = {};
            headers.forEach((header, i) => {
                obj[header] = sanitizedValues[i] || '';
            });
            return obj;
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        resetState();
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const data = parseCSV(text);
                setPreviewData(data);
            } catch (err: any) {
                setError(err.message || 'שגיאה בניתוח קובץ ה-CSV.');
            }
        };
        reader.onerror = () => {
            setError('שגיאה בקריאת הקובץ.');
        };
        reader.readAsText(file, 'UTF-8');
    };

    const handleDownloadTemplate = () => {
        const csvContent = "name,businessId,email,address,contactName,contactPhone\n";
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "clients_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = () => {
        const newClients: Client[] = previewData.map(row => {
            if (!row.name || !row.businessId) {
                // This should be caught earlier, but as a safeguard.
                return null;
            }
            const contact: Contact | null = (row.contactName || row.contactPhone) ? {
                id: generateId(),
                name: row.contactName || 'איש קשר ראשי',
                phone: row.contactPhone || ''
            } : null;

            return {
                id: generateId(),
                name: row.name,
                businessId: row.businessId,
                email: row.email || '',
                address: row.address || '',
                contacts: contact ? [contact] : []
            };
        }).filter((c): c is Client => c !== null);

        if(newClients.length !== previewData.length) {
            setError("חלק מהשורות בקובץ חסרות שם לקוח או ח.פ. ולא יובאו.");
            // We can still import the valid ones
        }
        onImport(newClients);
        handleClose();
    };

    if(!isOpen) return null;

    const previewHeaders = previewData.length > 0 ? Object.keys(previewData[0]) : [];

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={handleClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col" style={{maxHeight: '90vh'}} onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">ייבוא לקוחות מ-CSV</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">&times;</button>
                </div>
                <div className="flex-1 p-6 overflow-y-auto space-y-6">
                    <div>
                        <h3 className="font-bold text-lg mb-2">שלב 1: הכנת הקובץ</h3>
                        <p className="text-sm text-gray-600">
                            ודא שקובץ ה-CSV שלך מכיל את הכותרות הנדרשות: `name` ו-`businessId`.
                            עמודות נוספות נתמכות הן: `email`, `address`, `contactName`, `contactPhone`.
                        </p>
                        <button onClick={handleDownloadTemplate} className="mt-2 text-sm text-studio-blue-600 hover:underline font-semibold">
                            <i className="fas fa-download ml-1"></i> הורד קובץ תבנית
                        </button>
                    </div>
                     <div>
                        <h3 className="font-bold text-lg mb-2">שלב 2: העלאת הקובץ</h3>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <i className="fas fa-file-csv mx-auto h-12 w-12 text-gray-400 text-4xl"></i>
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-studio-blue-600 hover:text-studio-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-studio-blue-500">
                                        <span>בחר קובץ</span>
                                        <input ref={fileInputRef} id="file-upload" name="file-upload" type="file" className="sr-only" accept=".csv" onChange={handleFileChange} />
                                    </label>
                                    <p className="pr-1">או גרור אותו לכאן</p>
                                </div>
                                <p className="text-xs text-gray-500">{fileName || 'קובץ CSV בלבד'}</p>
                            </div>
                        </div>
                    </div>
                     {error && (
                        <div className="p-4 bg-red-100 border border-red-300 text-red-800 rounded-md">
                            <h4 className="font-bold">שגיאה בקובץ</h4>
                            <p className="text-sm">{error}</p>
                        </div>
                     )}
                     {previewData.length > 0 && (
                        <div>
                             <h3 className="font-bold text-lg mb-2">שלב 3: תצוגה מקדימה ואישור</h3>
                             <p className="text-sm text-gray-600 mb-2">נמצאו {previewData.length} רשומות. בדוק שהנתונים נראים תקינים לפני הייבוא.</p>
                             <div className="max-h-64 overflow-y-auto border rounded-lg">
                                 <table className="min-w-full divide-y divide-gray-200 text-sm">
                                     <thead className="bg-gray-50 sticky top-0">
                                         <tr>
                                             {previewHeaders.map(h => <th key={h} className="px-4 py-2 text-right font-medium text-gray-500 uppercase">{h}</th>)}
                                         </tr>
                                     </thead>
                                     <tbody className="bg-white divide-y divide-gray-200">
                                         {previewData.slice(0, 10).map((row, i) => ( // Show first 10 rows for preview
                                             <tr key={i}>
                                                 {previewHeaders.map(h => <td key={h} className="px-4 py-2 whitespace-nowrap">{row[h]}</td>)}
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             </div>
                             {previewData.length > 10 && <p className="text-xs text-gray-500 mt-1 text-center">מוצגות 10 הרשומות הראשונות...</p>}
                        </div>
                     )}
                </div>
                <div className="p-4 bg-gray-50 border-t flex justify-end gap-3">
                    <button onClick={handleClose} className="bg-slate-200 text-slate-800 py-2 px-5 rounded-lg hover:bg-slate-300 transition">ביטול</button>
                    <button onClick={handleImport} disabled={previewData.length === 0 || !!error} className="bg-green-600 text-white py-2 px-5 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed">
                        ייבא {previewData.length > 0 ? `${previewData.length} לקוחות` : ''}
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- APP COMPONENT ---
const App: React.FC = () => {
    // Auth State
    const [users, setUsers] = useState<User[]>([]);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [userForPasswordReset, setUserForPasswordReset] = useState<User | null>(null);

    // Main App State
    const [currentView, setCurrentView] = useState<AppView>('calendar');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<ViewMode>('week');
    const [viewFilters, setViewFilters] = useState({
        offline: true,
        onlineCinema: true,
        technical: true,
      });
    
    // Data State
    const [clients, setClients] = useState<Client[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [resources, setResources] = useState<Resource[]>([]);
    const [personnel, setPersonnel] = useState<Personnel[]>([]);
    const [services, setServices] = useState<TechnicalService[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);


    // Load resources from Supabase on mount
    useEffect(() => {
    loadResourcesFromSupabase();
    }, []);

    async function loadResourcesFromSupabase() {
    const { data, error } = await supabase.from('resources').select('*');
    if (error) {
        console.error('Error loading resources:', error);
        return;
    }
    if (data) {
        const converted = data.map(convertResourceFromDB);
        setResources(converted);
    }
    }

    // Load bookings from Supabase on mount
    useEffect(() => {
    loadBookingsFromSupabase();
    }, []);

   async function loadBookingsFromSupabase() {
    const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .is('deleted_at', null);
    
    if (error) {
        console.error('Error loading bookings:', error);
        return;
    }
    if (data) {
        console.log('Raw data from Supabase:', data);
        const converted = data.map(convertBookingFromDB);
        
        // Load technical services for each booking
        for (const booking of converted) {
            const { data: servicesData, error: servicesError } = await supabase
                .from('booking_technical_services')
                .select('technical_service_id')
                .eq('booking_id', booking.id);
            
            if (servicesError) {
                console.error(`Error loading technical services for booking ${booking.id}:`, servicesError);
                booking.technicalServices = [];
            } else if (servicesData) {
                booking.technicalServices = servicesData.map(s => s.technical_service_id);
            } else {
                booking.technicalServices = [];
            }
        }
        
        console.log('Converted bookings:', converted);
        setBookings(converted);
    }
}

    // Load clients from Supabase on mount
    useEffect(() => {
    loadClientsFromSupabase();
    }, []);

  async function loadClientsFromSupabase() {
    const { data, error } = await supabase
        .from('clients')
        .select('*');
    
    if (error) {
        console.error('Error loading clients:', error);
        return;
    }
    if (data) {
        console.log('Raw clients from Supabase:', data);
        const converted = data.map(convertClientFromDB);
        
        // Load contacts for each client
        for (const client of converted) {
            const { data: contactsData, error: contactsError } = await supabase
                .from('client_contacts')
                .select('*')
                .eq('client_id', client.id);
            
            if (contactsError) {
                console.error(`Error loading contacts for client ${client.id}:`, contactsError);
                client.contacts = [];
            } else if (contactsData) {
                client.contacts = contactsData.map(convertContactFromDB);
            } else {
                client.contacts = [];
            }
        }
        
        console.log('Converted clients with contacts:', converted);
        setClients(converted);
    }
    }

        // Load projects from Supabase on mount
    useEffect(() => {
    loadProjectsFromSupabase();
    }, []);

    async function loadProjectsFromSupabase() {
    const { data, error } = await supabase
        .from('projects')
        .select('*');
    
    if (error) {
        console.error('Error loading projects:', error);
        return;
    }
    if (data) {
        console.log('Raw projects from Supabase:', data);
        const converted = data.map(convertProjectFromDB);
        console.log('Converted projects:', converted);
        setProjects(converted);
    }
    }

    // Load personnel from Supabase on mount
    useEffect(() => {
    loadPersonnelFromSupabase();
    }, []);

    async function loadPersonnelFromSupabase() {
    const { data, error } = await supabase
        .from('personnel')
        .select('*');
    
    if (error) {
        console.error('Error loading personnel:', error);
        return;
    }
    if (data) {
        console.log('Raw personnel from Supabase:', data);
        const converted = data.map(convertPersonnelFromDB);
        console.log('Converted personnel:', converted);
        setPersonnel(converted);
    }
    }

    // Load technical services from Supabase on mount
    useEffect(() => {
    loadServicesFromSupabase();
    }, []);

    async function loadServicesFromSupabase() {
    const { data, error } = await supabase
        .from('technical_services')
        .select('*');
    
    if (error) {
        console.error('Error loading technical services:', error);
        return;
    }
    if (data) {
        console.log('Raw technical services from Supabase:', data);
        const converted = data.map(convertTechnicalServiceFromDB);
        console.log('Converted technical services:', converted);
        setServices(converted);
    }
    }

    // Load materials from Supabase on mount
useEffect(() => {
  loadMaterialsFromSupabase();
}, []);

async function loadMaterialsFromSupabase() {
  const { data, error } = await supabase
    .from('materials')
    .select('*');
  
  if (error) {
    console.error('Error loading materials:', error);
    return;
  }
  if (data) {
    console.log('Raw materials from Supabase:', data);
    const converted = data.map(convertMaterialFromDB);
    console.log('Converted materials:', converted);
    setMaterials(converted);
  }
}

// Load users from Supabase on mount
useEffect(() => {
  loadUsersFromSupabase();
}, []);

async function loadUsersFromSupabase() {
  const { data, error } = await supabase
    .from('users')
    .select('*');
  
  if (error) {
    console.error('Error loading users:', error);
    return;
  }
  if (data) {
    console.log('Raw users from Supabase:', data);
    const converted = data.map(convertUserFromDB);
    console.log('Converted users:', converted);
    setUsers(converted);
  }
}



    // Undo State
    const [previousBookingsState, setPreviousBookingsState] = useState<Booking[] | null>(null);
    const [canUndo, setCanUndo] = useState(false);


    // Modal State
    const [modal, setModal] = useState<{ type: string | null, data: any | null }>({ type: null, data: null });
    const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
    const [isClientImportModalOpen, setClientImportModalOpen] = useState(false);
    const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
    const [selectedBookingInfo, setSelectedBookingInfo] = useState<{booking: Booking, date: Date} | null>(null);
    const [newBookingInfo, setNewBookingInfo] = useState<{resourceId: string, date: Date} | null>(null);
    const [collisionDetails, setCollisionDetails] = useState<CollisionDetails | null>(null);
    const [updateConfirmation, setUpdateConfirmation] = useState<{ onConfirm: () => void } | null>(null);
    const [deleteConfirmation, setDeleteConfirmation] = useState<{ message: string; onConfirm: () => void; } | null>(null);
    const [updateSeriesDetails, setUpdateSeriesDetails] = useState<{
        draggedBooking: Booking;
        newResourceId: string;
        newDate: Date;
        futureBookings: Booking[];
    } | null>(null);
    const [multiDayMoveDetails, setMultiDayMoveDetails] = useState<{
        draggedBooking: Booking;
        newResourceId: string;
        newDate: Date;
        dayDragged: Date;
    } | null>(null);

    // Drag & Drop State
    const [draggedBookingInfo, setDraggedBookingInfo] = useState<{ bookingId: string; dayDragged: Date } | null>(null);

    // Mobile state
    const isMobile = useIsMobile();
    
    useEffect(() => {
        if (isMobile && currentView === 'calendar') {
            setViewMode('day');
        } else if (!isMobile && viewMode === 'day') {
             setViewMode('week');
        }
    }, [isMobile, currentView]);

    // --- Undo Logic ---
    const handleUndo = () => {
        if (canUndo && previousBookingsState) {
            setBookings(previousBookingsState);
            setCanUndo(false);
            setPreviousBookingsState(null);
        }
    };

    const commitBookingsChange = (updater: React.SetStateAction<Booking[]>) => {
        setPreviousBookingsState(bookings); // Capture state *before* update
        setBookings(updater);
        setCanUndo(true);
    };

const handleSave = async (type: string, data: any) => {
    const stateUpdater: Record<string, React.Dispatch<React.SetStateAction<any[]>>> = {
        client: setClients,
        project: setProjects,
        resource: setResources,
        personnel: setPersonnel,
        service: setServices,
        material: setMaterials,
        user: setUsers,
    };
    
    const updater = stateUpdater[type];
    
    // Prepare data with ID
    const finalData = data.id ? data : { ...data, id: generateId() };
    if (type === 'client' && !finalData.contacts) {
        finalData.contacts = [];
    }
    
    // Save to Supabase for clients
   // Save to Supabase for clients
if (type === 'client') {
    const isUpdate = data.id;
    
    if (isUpdate) {
        // UPDATE existing client
        const { error } = await supabase
            .from('clients')
            .update(convertClientToDB(finalData))
            .eq('id', finalData.id);
        
        if (error) {
            console.error('Error updating client:', error);
            return;
        }
        
        // Delete old contacts
        const { error: deleteError } = await supabase
            .from('client_contacts')
            .delete()
            .eq('client_id', finalData.id);
        
        if (deleteError) {
            console.error('Error deleting old contacts:', deleteError);
            return;
        }
    } else {
        // INSERT new client
        const { error } = await supabase
            .from('clients')
            .insert([convertClientToDB(finalData)]);
        
        if (error) {
            console.error('Error inserting client:', error);
            return;
        }
    }
    
    // Insert new contacts (for both UPDATE and INSERT)
    if (finalData.contacts && finalData.contacts.length > 0) {
        const contactsToInsert = finalData.contacts.map((contact: Contact) => ({
            ...convertContactToDB(contact),
            client_id: finalData.id
        }));
        
        const { error: contactsError } = await supabase
            .from('client_contacts')
            .insert(contactsToInsert);
        
        if (contactsError) {
            console.error('Error inserting contacts:', contactsError);
            return;
        }
    }
}
    
    // Save to Supabase for projects
    if (type === 'project') {
        const isUpdate = data.id;
        
        if (isUpdate) {
            // UPDATE existing project
            const { error } = await supabase
                .from('projects')
                .update(convertProjectToDB(finalData))
                .eq('id', finalData.id);
            
            if (error) {
                console.error('Error updating project:', error);
                return;
            }
        } else {
            // INSERT new project
            const { error } = await supabase
                .from('projects')
                .insert([convertProjectToDB(finalData)]);
            
            if (error) {
                console.error('Error inserting project:', error);
                return;
            }
        }
    }
    
    // Save to Supabase for personnel
    if (type === 'personnel') {
        const isUpdate = data.id;
        
        if (isUpdate) {
            // UPDATE existing personnel
            const { error } = await supabase
                .from('personnel')
                .update(convertPersonnelToDB(finalData))
                .eq('id', finalData.id);
            
            if (error) {
                console.error('Error updating personnel:', error);
                return;
            }
        } else {
            // INSERT new personnel
            const { error } = await supabase
                .from('personnel')
                .insert([convertPersonnelToDB(finalData)]);
            
            if (error) {
                console.error('Error inserting personnel:', error);
                return;
            }
        }
    }
    
    // Save to Supabase for technical services
    if (type === 'service') {
        const isUpdate = data.id;
        
        if (isUpdate) {
            // UPDATE existing service
            const { error } = await supabase
                .from('technical_services')
                .update(convertTechnicalServiceToDB(finalData))
                .eq('id', finalData.id);
            
            if (error) {
                console.error('Error updating service:', error);
                return;
            }
        } else {
            // INSERT new service
            const { error } = await supabase
                .from('technical_services')
                .insert([convertTechnicalServiceToDB(finalData)]);
            
            if (error) {
                console.error('Error inserting service:', error);
                return;
            }
        }
    }
    
    // Save to Supabase for materials
    if (type === 'material') {
        const isUpdate = data.id;
        
        if (isUpdate) {
            // UPDATE existing material
            const { error } = await supabase
                .from('materials')
                .update(convertMaterialToDB(finalData))
                .eq('id', finalData.id);
            
            if (error) {
                console.error('Error updating material:', error);
                return;
            }
        } else {
            // INSERT new material
            const { error } = await supabase
                .from('materials')
                .insert([convertMaterialToDB(finalData)]);
            
            if (error) {
                console.error('Error inserting material:', error);
                return;
            }
        }
    }
    
    // Save to Supabase for users
if (type === 'user') {
    const isUpdate = data.id;
    
    // For new users, make sure password is provided
    if (!isUpdate && !finalData.password) {
        console.error('Error: Password is required for new users');
        alert('נא להזין סיסמה');
        return;
    }
    
    if (isUpdate) {
        // UPDATE existing user
        // If no new password provided, don't update it
        const userDataToUpdate = finalData.password 
            ? convertUserToDB(finalData)
            : (() => {
                const { password, ...dataWithoutPassword } = convertUserToDB(finalData);
                return dataWithoutPassword;
            })();
        
        const { error } = await supabase
            .from('users')
            .update(userDataToUpdate)
            .eq('id', finalData.id);
        
        if (error) {
            console.error('Error updating user:', error);
            return;
        }
    } else {
        // INSERT new user
        const { error } = await supabase
            .from('users')
            .insert([convertUserToDB(finalData)]);
        
        if (error) {
            console.error('Error inserting user:', error);
            return;
        }
    }
}
    
    // Update local state
    if (data.id) { // Update
        updater(prev => prev.map(item => {
            if (item.id !== data.id) return item;
            // For users, don't overwrite password if it's not provided
            if (type === 'user' && !data.password) {
                const { password, ...restData } = data;
                return { ...item, ...restData };
            }
            return finalData;
        }));
    } else { // Create
        updater(prev => [...prev, finalData]);
    }
    setModal({ type: null, data: null });
};

const handleDelete = async (type: string, id: string) => {
    const stateUpdater: Record<string, React.Dispatch<React.SetStateAction<any[]>>> = {
        client: setClients,
        project: setProjects,
        resource: setResources,
        personnel: setPersonnel,
        service: setServices,
        material: setMaterials,
        user: setUsers,
    };
    
    // Delete from Supabase for clients
    if (type === 'client') {
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting client:', error);
            return;
        }
    }
    
    // Delete from Supabase for projects
    if (type === 'project') {
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting project:', error);
            return;
        }
    }
    
    // Delete from Supabase for personnel
    if (type === 'personnel') {
        const { error } = await supabase
            .from('personnel')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting personnel:', error);
            return;
        }
    }
    
    // Delete from Supabase for technical services
    if (type === 'service') {
        const { error } = await supabase
            .from('technical_services')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting service:', error);
            return;
        }
    }
    
    // Delete from Supabase for materials
    if (type === 'material') {
        const { error } = await supabase
            .from('materials')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting material:', error);
            return;
        }
    }
    
    // Delete from Supabase for users
    if (type === 'user') {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);
        
        if (error) {
            console.error('Error deleting user:', error);
            return;
        }
    }
    
    // Update local state
    stateUpdater[type](prev => prev.filter(item => item.id !== id));
};
        
        // Booking Modal Handlers
        const handleNewBooking = (resourceId?: string, date?: Date) => {
        setSelectedBookingInfo(null);
        setNewBookingInfo(resourceId && date ? { resourceId, date } : null);
        setIsBookingModalOpen(true);
        };
        
        const handleSelectBooking = (booking: Booking, date: Date) => {
        setSelectedBookingInfo({ booking, date });
        setNewBookingInfo(null);
        setIsBookingModalOpen(true);
        };
        
   const saveBookingsToState = async (bookingsToSave: BookingFormData[]) => {
    // Step 1: Prepare bookings with IDs
    const finalBookingsToAdd = bookingsToSave.map(b => 
        b.id ? (b as Booking) : ({ ...b, id: generateId() } as Booking)
    );
    
    // Step 2: Save to Supabase
    for (const booking of finalBookingsToAdd) {
        const isUpdate = bookingsToSave.find(b => b.id === booking.id);
        
        if (isUpdate) {
            // UPDATE existing booking
            await supabase
                .from('bookings')
                .update(convertBookingToDB(booking))
                .eq('id', booking.id);
            
            // Delete old technical services
            const { error: deleteError } = await supabase
                .from('booking_technical_services')
                .delete()
                .eq('booking_id', booking.id);
            
            if (deleteError) {
                console.error('Error deleting old technical services:', deleteError);
            }
        } else {
            // INSERT new booking
            await supabase
                .from('bookings')
                .insert([convertBookingToDB(booking)]);
        }
        
        // Insert new technical services (for both UPDATE and INSERT)
        if (booking.technicalServices && booking.technicalServices.length > 0) {
            const services = booking.technicalServices.map(serviceId => {
                const id = `bts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                return {
                    id: id,
                    booking_id: booking.id,
                    technical_service_id: serviceId,
                    quantity: 1
                };
            });
            
            const { error: servicesError } = await supabase
                .from('booking_technical_services')
                .insert(services);
            
            if (servicesError) {
                console.error('Error inserting technical services:', servicesError);
            }
        }
    }
    
    // Step 3: Update local state
    commitBookingsChange(prev => {
        const editedIds = new Set(finalBookingsToAdd.map(b => b.id));
        const baseBookings = prev.filter(b => !editedIds.has(b.id));
        return [...baseBookings, ...finalBookingsToAdd];
    });
};
    
    const handleConfirmedSaveBooking = (bookingsToSave: BookingFormData[]) => {
        if (bookingsToSave.length === 1) {
            const bookingToSave = bookingsToSave[0];
            const collidingBookings = findCollisions(bookingToSave, bookings, resources);
            if (collidingBookings.length > 0) {
                setCollisionDetails({ bookingToSave, collidingBookings });
                return;
            }
        } 
        else if (bookingsToSave.length > 1) {
            const conflicts: { roomName: string, conflictingBookings: Booking[] }[] = [];
            bookingsToSave.forEach(b => {
                const colliding = findCollisions(b, bookings, resources);
                if (colliding.length > 0) {
                    conflicts.push({
                        roomName: resources.find(r => r.id === b.resourceId)?.name || 'Unknown Room',
                        conflictingBookings: colliding
                    });
                }
            });
            
            if (conflicts.length > 0) {
                const conflictMessages = conflicts.map(c => c.roomName).join(', ');
                alert(`ההזמנה נכשלה. החדרים הבאים תפוסים בתאריכים ובשעות שנבחרו: ${conflictMessages}. אנא בדוק את היומן ונסה שוב.`);
                return;
            }
        }
        
        saveBookingsToState(bookingsToSave);
        setIsBookingModalOpen(false);
        setCollisionDetails(null);
    };

    const handleRequestSaveBooking = (bookingsToSave: BookingFormData[]) => {
        const isUpdate = bookingsToSave.length === 1 && !!bookingsToSave[0].id;
        
        if (isUpdate) {
            setUpdateConfirmation({
                onConfirm: () => {
                    handleConfirmedSaveBooking(bookingsToSave);
                    setUpdateConfirmation(null);
                }
            });
        } else {
            handleConfirmedSaveBooking(bookingsToSave);
        }
    };

    
   const handleDeleteEntireBooking = async (bookingId: string) => {
    // Soft delete in Supabase - set deleted_at to current timestamp
    const { error } = await supabase
        .from('bookings')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', bookingId);
    
    if (error) {
        console.error('Error deleting booking:', error);
        return;
    }
    
    // Remove from local state
    commitBookingsChange(prev => prev.filter(b => b.id !== bookingId));
    setIsBookingModalOpen(false);
};
    
    const handleSplitAndDeleteRange = async (bookingId: string, rangeStart: Date, rangeEnd: Date) => {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const originalStart = startOfDay(new Date(booking.startDate));
    const originalEnd = startOfDay(new Date(booking.endDate));
    const deleteStart = startOfDay(rangeStart);
    const deleteEnd = startOfDay(rangeEnd);

    if (deleteStart > originalEnd || deleteEnd < originalStart) return; // No overlap

    const effectiveDeleteStart = new Date(Math.max(originalStart.getTime(), deleteStart.getTime()));
    const effectiveDeleteEnd = new Date(Math.min(originalEnd.getTime(), deleteEnd.getTime()));

    // Check which case we're in
    const isFullDeletion = effectiveDeleteStart <= originalStart && effectiveDeleteEnd >= originalEnd;
    
    const part1End = new Date(effectiveDeleteStart);
    part1End.setDate(part1End.getDate() - 1);
    const hasPart1 = originalStart <= part1End;

    const part2Start = new Date(effectiveDeleteEnd);
    part2Start.setDate(part2Start.getDate() + 1);
    const hasPart2 = part2Start <= originalEnd;

    // --- CASE 1: Full deletion (Soft Delete) ---
    if (isFullDeletion) {
        const { error } = await supabase
            .from('bookings')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', bookingId);
        
        if (error) {
            console.error('Error deleting booking:', error);
            alert('שגיאה במחיקת ההזמנה');
            return;
        }

        // Update local state
        commitBookingsChange(prev => prev.filter(b => b.id !== bookingId));
        setIsBookingModalOpen(false);
        return;
    }

    // --- CASE 2: Split in the middle (UPDATE + INSERT) ---
    if (hasPart1 && hasPart2) {
        const updatedBooking = { ...booking, endDate: part1End };
        const newBooking = { ...booking, id: generateId(), startDate: part2Start, endDate: originalEnd };

        // UPDATE the original booking in Supabase
        const { error: updateError } = await supabase
            .from('bookings')
            .update(convertBookingToDB(updatedBooking))
            .eq('id', bookingId);

        if (updateError) {
            console.error('Error updating booking:', updateError);
            alert('שגיאה בעדכון ההזמנה');
            return;
        }

        // INSERT the new booking in Supabase
        const { error: insertError } = await supabase
            .from('bookings')
            .insert([convertBookingToDB(newBooking)]);

        if (insertError) {
            console.error('Error inserting new booking:', insertError);
            alert('שגיאה ביצירת הזמנה חדשה');
            return;
        }

        // Update local state
        commitBookingsChange(prev => {
            const index = prev.findIndex(b => b.id === bookingId);
            if (index === -1) return prev;
            const newBookings = [...prev];
            newBookings[index] = updatedBooking;
            newBookings.push(newBooking);
            return newBookings;
        });

        setIsBookingModalOpen(false);
        return;
    }

    // --- CASE 3: Shorten from start or end (UPDATE only) ---
    let updatedBooking: Booking;
    
    if (hasPart1) {
        // Shorten from end
        updatedBooking = { ...booking, endDate: part1End };
    } else if (hasPart2) {
        // Shorten from start
        updatedBooking = { ...booking, startDate: part2Start };
    } else {
        // This shouldn't happen (covered by Case 1), but just in case - soft delete
        const { error } = await supabase
            .from('bookings')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', bookingId);
        
        if (error) {
            console.error('Error deleting booking:', error);
            alert('שגיאה במחיקת ההזמנה');
            return;
        }

        commitBookingsChange(prev => prev.filter(b => b.id !== bookingId));
        setIsBookingModalOpen(false);
        return;
    }

    // UPDATE in Supabase
    const { error } = await supabase
        .from('bookings')
        .update(convertBookingToDB(updatedBooking))
        .eq('id', bookingId);

    if (error) {
        console.error('Error updating booking:', error);
        alert('שגיאה בעדכון ההזמנה');
        return;
    }

    // Update local state
    commitBookingsChange(prev => prev.map(b => b.id === bookingId ? updatedBooking : b));
    setIsBookingModalOpen(false);
};
    
    const handleSplitAndDeleteDay = (bookingId: string, day: Date) => {
        handleSplitAndDeleteRange(bookingId, day, day);
    };

    // Collision Modal Handlers
    const handleForceBook = () => {
        if (!collisionDetails) return;
        const { bookingToSave } = collisionDetails;
        commitBookingsChange(prev => {
            const existing = prev.find(b => b.id === bookingToSave.id);
            if (existing) { // It's an update
                return prev.map(b => b.id === bookingToSave.id ? (bookingToSave as Booking) : b);
            } else { // It's a new booking
                return [...prev, { ...bookingToSave, id: generateId() } as Booking];
            }
        });
        setIsBookingModalOpen(false);
        setCollisionDetails(null);
    };

    const handleBookAvailable = () => {
        if (!collisionDetails) return;
        const { bookingToSave, collidingBookings } = collisionDetails;
        const { startDate, endDate } = bookingToSave;

        if (!startDate || !endDate) return;

        // Create a set of blocked dates for quick lookup
        const blockedDays = new Set<string>();
        collidingBookings.forEach(cb => {
            let current = startOfDay(new Date(cb.startDate));
            const end = startOfDay(new Date(cb.endDate));
            while (current <= end) {
                blockedDays.add(current.toISOString().split('T')[0]);
                current.setDate(current.getDate() + 1);
            }
        });

        const newBookings: BookingFormData[] = [];
        let currentChunkStart: Date | null = null;
        
        const cursor = startOfDay(new Date(startDate));
        const finalEnd = startOfDay(new Date(endDate));

        while (cursor <= finalEnd) {
            const dayKey = cursor.toISOString().split('T')[0];
            const isBlocked = blockedDays.has(dayKey);

            if (!isBlocked) {
                // If it's an available day, start a new chunk if we aren't in one
                if (currentChunkStart === null) {
                    currentChunkStart = new Date(cursor);
                }
            } else {
                // If it's a blocked day and we were in a chunk, end the chunk
                if (currentChunkStart !== null) {
                    const chunkEndDate = new Date(cursor);
                    chunkEndDate.setDate(chunkEndDate.getDate() - 1);
                    newBookings.push({
                        ...bookingToSave,
                        id: undefined, // new booking
                        startDate: currentChunkStart,
                        endDate: chunkEndDate,
                    });
                    currentChunkStart = null;
                }
            }
            cursor.setDate(cursor.getDate() + 1);
        }

        // After the loop, if we're still in a chunk, close it
        if (currentChunkStart !== null) {
            newBookings.push({
                ...bookingToSave,
                id: undefined,
                startDate: currentChunkStart,
                endDate: finalEnd,
            });
        }
        
        if (newBookings.length > 0) {
            saveBookingsToState(newBookings);
            setIsBookingModalOpen(false); // Close the main booking modal on success
        } else {
            alert("לא נמצאו ימים פנויים בטווח המבוקש.");
        }

        setCollisionDetails(null);
    };

    // Client import handler
    const handleImportClients = (newClients: Client[]) => {
        setClients(prev => [...prev, ...newClients]);
    };


    // Drag & Drop Handlers
    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, bookingId: string, dayDragged: Date) => {
        e.dataTransfer.effectAllowed = 'move';
        setDraggedBookingInfo({ bookingId, dayDragged });
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, resourceId: string, date: Date) => {
        e.preventDefault();
        if (!draggedBookingInfo) return;
        const { bookingId: draggedBookingId, dayDragged } = draggedBookingInfo;
        
        const draggedBooking = bookings.find(booking => booking.id === draggedBookingId);
        if (!draggedBooking) {
            setDraggedBookingInfo(null);
            return;
        }
    
        const isResourceChange = draggedBooking.resourceId !== resourceId;
        const futureBookings = bookings.filter(b =>
            b.id !== draggedBooking.id &&
            b.projectId === draggedBooking.projectId &&
            b.resourceId === draggedBooking.resourceId &&
            startOfDay(new Date(b.startDate)) > startOfDay(new Date(draggedBooking.startDate))
        );
    
        if (isResourceChange && futureBookings.length > 0) {
            setUpdateSeriesDetails({
                draggedBooking,
                newResourceId: resourceId,
                newDate: date,
                futureBookings,
            });
        } else {
            const duration = startOfDay(draggedBooking.endDate).getTime() - startOfDay(draggedBooking.startDate).getTime();
            const isMultiDay = duration > 0;
    
            if (isMultiDay) {
                setMultiDayMoveDetails({
                    draggedBooking,
                    newResourceId: resourceId,
                    newDate: date,
                    dayDragged,
                });
            } else { // Single day booking
                const updatedBooking = {
                    ...draggedBooking,
                    resourceId: resourceId,
                    startDate: date,
                    endDate: date,
                };
    
                const collisions = findCollisions(updatedBooking, bookings, resources);
                if (collisions.length > 0) {
                    setCollisionDetails({ bookingToSave: updatedBooking, collidingBookings: collisions });
                } else {
                    commitBookingsChange(prevBookings => prevBookings.map(b => b.id === updatedBooking.id ? updatedBooking : b));
                }
            }
        }
        
        setDraggedBookingInfo(null);
    };
    
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
    
    // Update Series Handlers
    const handleUpdateSeriesSingle = () => {
        if (!updateSeriesDetails) return;
        const { draggedBooking, newResourceId, newDate } = updateSeriesDetails;
        
        const duration = startOfDay(draggedBooking.endDate).getTime() - startOfDay(draggedBooking.startDate).getTime();
        const newEndDate = new Date(newDate.getTime() + duration);
        
        const updatedBooking = {
            ...draggedBooking,
            resourceId: newResourceId,
            startDate: newDate,
            endDate: newEndDate,
        };

        const collisions = findCollisions(updatedBooking, bookings, resources);
        if (collisions.length > 0) {
            setCollisionDetails({ bookingToSave: updatedBooking, collidingBookings: collisions });
        } else {
            commitBookingsChange(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
        }
        setUpdateSeriesDetails(null);
    };

    const handleUpdateSeriesAll = () => {
        if (!updateSeriesDetails) return;
        const { draggedBooking, newResourceId, newDate, futureBookings } = updateSeriesDetails;
        
        const duration = startOfDay(draggedBooking.endDate).getTime() - startOfDay(draggedBooking.startDate).getTime();
        const newEndDate = new Date(newDate.getTime() + duration);

        const updatedDraggedBooking: Booking = {
            ...draggedBooking,
            resourceId: newResourceId,
            startDate: newDate,
            endDate: newEndDate,
        };

        const updatedFutureBookings: Booking[] = futureBookings.map(b => ({
            ...b,
            resourceId: newResourceId,
        }));
        
        const allChanges = [updatedDraggedBooking, ...updatedFutureBookings];
        const allChangeIds = new Set(allChanges.map(b => b.id));

        // Collision Check
        const conflicts: { bookingName: string, collisions: Booking[] }[] = [];
        for (const bookingToTest of allChanges) {
            // Check against bookings *not* part of this bulk update
            const otherBookings = bookings.filter(b => !allChangeIds.has(b.id));
            const collisions = findCollisions(bookingToTest, otherBookings, resources);
            if (collisions.length > 0) {
                const project = projects.find(p => p.id === bookingToTest.projectId);
                conflicts.push({
                    bookingName: `${project?.name} ב-${formatDate(bookingToTest.startDate)}`,
                    collisions: collisions,
                });
            }
        }

        if (conflicts.length > 0) {
            const conflictMessages = conflicts.map(c => `ההזמנה "${c.bookingName}" מתנגשת`).join('\n');
            alert(`לא ניתן להעביר את כל הסדרה. נמצאו התנגשויות:\n${conflictMessages}`);
            setUpdateSeriesDetails(null);
            return;
        }

        // No collisions, perform update
        commitBookingsChange(prevBookings => {
            const changesMap = new Map(allChanges.map(b => [b.id, b]));
            return prevBookings.map(b => changesMap.get(b.id) || b);
        });

        setUpdateSeriesDetails(null);
    };

    const handleCancelUpdateSeries = () => {
        setUpdateSeriesDetails(null);
    };

    // Multi-Day Move Handlers
    const handleMoveMultiDaySingle = () => {
        if (!multiDayMoveDetails) return;
        const { draggedBooking, newResourceId, newDate, dayDragged } = multiDayMoveDetails;

        // 1. Create the new single-day booking for the dragged day at the new location.
        const newSingleDayBookingData: BookingFormData = {
            ...draggedBooking,
            id: undefined, // It will be a new booking with a new ID
            resourceId: newResourceId,
            startDate: newDate,
            endDate: newDate,
        };

        // 2. Check for collisions for the new part before making any changes.
        const collisions = findCollisions(newSingleDayBookingData, bookings, resources);
        if (collisions.length > 0) {
            const project = projects.find(p => p.id === newSingleDayBookingData.projectId);
            alert(`לא ניתן להעביר את היום. המיקום החדש עבור "${project?.name}" תפוס.`);
            setMultiDayMoveDetails(null);
            return;
        }
        
        handleSplitAndDeleteDay(draggedBooking.id, dayDragged);
        saveBookingsToState([newSingleDayBookingData]);
        
        setMultiDayMoveDetails(null);
    };

    const handleMoveMultiDayAll = () => {
        if (!multiDayMoveDetails) return;
        const { draggedBooking, newResourceId, newDate } = multiDayMoveDetails;

        const duration = startOfDay(draggedBooking.endDate).getTime() - startOfDay(draggedBooking.startDate).getTime();
        const newEndDate = new Date(newDate.getTime() + duration);

        const updatedBooking = {
            ...draggedBooking,
            resourceId: newResourceId,
            startDate: newDate,
            endDate: newEndDate,
        };
        
        const collisions = findCollisions(updatedBooking, bookings, resources);
        if (collisions.length > 0) {
            setCollisionDetails({ bookingToSave: updatedBooking, collidingBookings: collisions });
        } else {
            commitBookingsChange(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
        }
        setMultiDayMoveDetails(null);
    };

    const handleCancelMultiDayMove = () => {
        setMultiDayMoveDetails(null);
    };

    // Auth Handlers
    const handleForgotPasswordRequest = (email: string) => {
        const adminUser = users.find(u => u.role === 'admin' && u.email === email);
        if (adminUser) {
            setUserForPasswordReset(adminUser);
        } else {
            alert('אם קיים משתמש מנהל עם כתובת מייל זו, תועבר למסך איפוס סיסמה. (במערכת אמיתית יישלח מייל).');
        }
    };
    
    const handlePasswordReset = (userId: string, newPassword: string) => {
        setUsers(prevUsers => prevUsers.map(user => user.id === userId ? { ...user, password: newPassword } : user));
        alert('הסיסמה אופסה בהצלחה. כעת תוכל להתחבר עם הסיסמה החדשה.');
        setUserForPasswordReset(null);
    };

    const showDeleteConfirmation = (message: string, onConfirm: () => void) => {
        setDeleteConfirmation({ message, onConfirm });
    };

    const handleCloseBilling = (bookingIds: string[]) => {
        commitBookingsChange(prev => prev.map(b => bookingIds.includes(b.id) ? { ...b, billed: true, billedDate: new Date() } : b));
    };
    
    const handleOpenBilling = (bookingIds: string[]) => {
        commitBookingsChange(prev => prev.map(b => bookingIds.includes(b.id) ? { ...b, billed: false, billedDate: undefined } : b));
    };

    const renderView = () => {
        const filteredResources = resources.filter(r => {
            if (r.type === 'Offline' && viewFilters.offline) return true;
            if ((r.type === 'Online' || r.type === 'Cinema') && viewFilters.onlineCinema) return true;
            if (r.type === 'Technical' && viewFilters.technical) return true;
            
            // For any other resource type not explicitly handled by filters, show it by default.
            if (['Offline', 'Online', 'Cinema', 'Technical'].includes(r.type)) {
                return false; // It was a known type, but its filter is off.
            }
            return true; // It's a new, unknown type, so show it.
        });

        const calendarComponent = <CalendarContainer 
            isMobile={isMobile}
            viewMode={viewMode} currentDate={currentDate} bookings={bookings} projects={projects} personnel={personnel} resources={filteredResources} clients={clients}
            onSelectBooking={handleSelectBooking} onNewBooking={handleNewBooking}
            onDragStart={handleDragStart} onDrop={handleDrop} onDragOver={handleDragOver}
            draggedBookingId={draggedBookingInfo?.bookingId ?? null}
            setCurrentDate={setCurrentDate}
        />;

        if (currentUser?.role === 'technician' && currentView !== 'calendar') {
             return calendarComponent;
        }

        switch (currentView) {
            case 'calendar':
                return calendarComponent;
            case 'projects':
                return <div className="p-4 md:p-8"><CrudListView<Project>
                    title="ניהול פרויקטים"
                    items={projects}
                    columns={[
                        { header: 'שם פרויקט', accessor: item => item.name },
                        { header: 'לקוח', accessor: item => clients.find(c => c.id === item.clientId)?.name || 'N/A' },
                        { header: 'סטטוס', accessor: item => item.status },
                    ]}
                    onAddItem={() => setModal({ type: 'project', data: null })}
                    onEditItem={item => setModal({ type: 'project', data: item })}
                    onDeleteItem={id => handleDelete('project', id)}
                /></div>;
            case 'clients':
                 return <div className="p-4 md:p-8">
                    <div className="flex justify-between items-center mb-6">
                        <h1 className="text-3xl font-bold text-gray-800">ניהול לקוחות</h1>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setClientImportModalOpen(true)}
                                className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600 transition duration-300 flex items-center gap-2"
                            >
                                <i className="fas fa-file-csv"></i> ייבוא מ-CSV
                            </button>
                             <button
                                onClick={() => setModal({ type: 'client', data: null })}
                                className="bg-studio-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-studio-blue-600 transition duration-300 flex items-center gap-2"
                            >
                                <i className="fas fa-plus"></i> הוסף חדש
                            </button>
                        </div>
                    </div>
                     <CrudListView<Client>
                        items={clients}
                        columns={[
                            { header: 'שם לקוח', accessor: item => item.name },
                            { header: 'ח.פ/ע.מ', accessor: item => item.businessId },
                            { header: 'אימייל', accessor: item => item.email },
                            { header: 'איש קשר ראשי', accessor: item => item.contacts[0]?.name || 'N/A' },
                        ]}
                        onEditItem={item => setModal({ type: 'client', data: item })}
                        onDeleteItem={id => handleDelete('client', id)}
                    />
                 </div>;
            case 'resources':
                 return <div className="p-4 md:p-8"><CrudListView<Resource>
                    title="ניהול משאבים"
                    items={resources}
                    columns={[
                        { header: 'שם משאב', accessor: item => item.name },
                        { header: 'סוג', accessor: item => item.type },
                        { header: 'מחיר מחירון', accessor: item => `₪${item.listPrice.toLocaleString()}` },
                    ]}
                    onAddItem={() => setModal({ type: 'resource', data: null })}
                    onEditItem={item => setModal({ type: 'resource', data: item })}
                    onDeleteItem={id => handleDelete('resource', id)}
                /></div>;
            case 'personnel':
                 return <div className="p-4 md:p-8"><CrudListView<Personnel>
                    title="ניהול משאבי אנוש"
                    items={personnel}
                    columns={[
                        { header: 'שם', accessor: item => item.name },
                        { header: 'תפקיד', accessor: item => item.role },
                        { header: 'תעריף', accessor: item => `₪${item.rate.toLocaleString()}` },
                    ]}
                    onAddItem={() => setModal({ type: 'personnel', data: null })}
                    onEditItem={item => setModal({ type: 'personnel', data: item })}
                    onDeleteItem={id => handleDelete('personnel', id)}
                /></div>;
             case 'services':
                 return <div className="p-4 md:p-8"><CrudListView<TechnicalService>
                    title="ניהול שירותים"
                    items={services}
                    columns={[
                        { header: 'שם השירות', accessor: item => item.name },
                        { header: 'מחיר', accessor: item => `₪${item.price.toLocaleString()}` },
                    ]}
                    onAddItem={() => setModal({ type: 'service', data: null })}
                    onEditItem={item => setModal({ type: 'service', data: item })}
                    onDeleteItem={id => handleDelete('service', id)}
                /></div>;
             case 'materials':
                 return <div className="p-4 md:p-8"><CrudListView<Material>
                    title="ניהול חומרי גלם"
                    items={materials}
                    columns={[
                        { header: 'שם חומר הגלם', accessor: item => item.name },
                        { header: 'מחיר קנייה', accessor: item => `₪${item.purchasePrice.toLocaleString()}` },
                        { header: 'מחיר מכירה', accessor: item => `₪${item.sellingPrice.toLocaleString()}` },
                        { header: 'רווח', accessor: item => `₪${(item.sellingPrice - item.purchasePrice).toLocaleString()}` },
                    ]}
                    onAddItem={() => setModal({ type: 'material', data: null })}
                    onEditItem={item => setModal({ type: 'material', data: item })}
                    onDeleteItem={id => handleDelete('material', id)}
                /></div>;
            case 'users':
                 return <div className="p-4 md:p-8"><CrudListView<User>
                    title="ניהול משתמשים"
                    items={users}
                    columns={[
                        { header: 'שם משתמש', accessor: item => item.username },
                        { header: 'אימייל', accessor: item => item.email },
                        { header: 'תפקיד', accessor: item => item.role === 'admin' ? 'מנהל' : 'טכנאי' },
                    ]}
                    onAddItem={() => setModal({ type: 'user', data: null })}
                    onEditItem={item => setModal({ type: 'user', data: item })}
                    onDeleteItem={id => handleDelete('user', id)}
                /></div>;
            case 'reports': return <ReportsView {...{bookings, clients, projects, resources, personnel, services, materials, onCloseBilling: handleCloseBilling, onOpenBilling: handleOpenBilling, canUndo, onUndo: handleUndo}} />;
            default: return null;
        }
    };

    if (userForPasswordReset) {
        return <PasswordResetScreen
            user={userForPasswordReset}
            onReset={handlePasswordReset}
            onCancel={() => setUserForPasswordReset(null)}
        />
    }

    if (!currentUser) {
        return <LoginScreen users={users} onLogin={setCurrentUser} onForgotPasswordRequest={handleForgotPasswordRequest} />;
    }

    return (
        <div className="h-screen w-screen flex bg-gray-50 overflow-hidden" dir="rtl">
            <Sidebar 
                currentView={currentView} 
                setCurrentView={setCurrentView} 
                onNewBooking={() => handleNewBooking()} 
                currentUser={currentUser}
                onLogout={() => setCurrentUser(null)}
            />
            <main className="w-full md:flex-1 flex flex-col">
                {(currentView === 'calendar' || isMobile) && 
                    <CalendarHeader 
                        isMobile={isMobile}
                        currentDate={currentDate} 
                        setCurrentDate={setCurrentDate}
                        viewMode={viewMode}
                        setViewMode={setViewMode}
                        viewFilters={viewFilters}
                        setViewFilters={setViewFilters}
                        onSearchClick={() => setIsSearchModalOpen(true)}
                        canUndo={canUndo}
                        onUndo={handleUndo}
                        onNewBooking={handleNewBooking}
                    />}
                <div className="flex-1 overflow-auto pb-16 md:pb-0">
                    {renderView()}
                </div>
            </main>
            {isBookingModalOpen && <BookingModal 
                isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)}
                onRequestSave={handleRequestSaveBooking} 
                onDeleteEntire={handleDeleteEntireBooking}
                onDeleteDay={handleSplitAndDeleteDay}
                onDeleteRange={handleSplitAndDeleteRange}
                onShowConfirmation={showDeleteConfirmation}
                booking={selectedBookingInfo?.booking ?? null} 
                selectedDate={selectedBookingInfo?.date ?? null}
                newBookingInfo={newBookingInfo}
                clients={clients} projects={projects} personnel={personnel} resources={resources}
                services={services} materials={materials}
                currentUser={currentUser}
                allBookings={bookings}
            />}
            {isClientImportModalOpen && <ClientImportModal
                isOpen={isClientImportModalOpen}
                onClose={() => setClientImportModalOpen(false)}
                onImport={handleImportClients}
            />}
            {isSearchModalOpen && <SearchModal
                isOpen={isSearchModalOpen}
                onClose={() => setIsSearchModalOpen(false)}
                bookings={bookings}
                projects={projects}
                clients={clients}
                onSelectBookingDate={(date) => {
                    setCurrentView('calendar');
                    setCurrentDate(date);
                    setViewMode(isMobile ? 'day' : 'week');
                    setIsSearchModalOpen(false);
                }}
            />}
            {modal.type && <CrudModal modal={modal} onSave={handleSave} onClose={() => setModal({type: null, data: null})} clients={clients} />}
            {collisionDetails && <CollisionModal 
                details={collisionDetails}
                onClose={() => setCollisionDetails(null)}
                onForceBook={handleForceBook}
                onBookAvailable={handleBookAvailable}
                clients={clients}
                projects={projects}
            />}
            {updateConfirmation && <ConfirmationModal 
                title="אישור עדכון"
                message="האם לעדכן את ההזמנה הקיימת?"
                onConfirm={updateConfirmation.onConfirm}
                onCancel={() => setUpdateConfirmation(null)}
                confirmButtonText="עדכן"
            />}
            {deleteConfirmation && <ConfirmationModal
                title="אישור מחיקה"
                message={deleteConfirmation.message}
                onConfirm={() => {
                    deleteConfirmation.onConfirm();
                    setDeleteConfirmation(null);
                }}
                onCancel={() => setDeleteConfirmation(null)}
                confirmButtonText="מחק"
                isDestructive={true}
            />}
            {updateSeriesDetails && <UpdateSeriesModal 
                onConfirmSingle={handleUpdateSeriesSingle}
                onConfirmAll={handleUpdateSeriesAll}
                onCancel={handleCancelUpdateSeries}
            />}
             {multiDayMoveDetails && <UpdateMultiDayMoveModal 
                onConfirmSingle={handleMoveMultiDaySingle}
                onConfirmAll={handleMoveMultiDayAll}
                onCancel={handleCancelMultiDayMove}
            />}
            <BottomNavBar 
                currentView={currentView}
                setCurrentView={setCurrentView}
                onSearchClick={() => setIsSearchModalOpen(true)}
                currentUser={currentUser}
                onLogout={() => setCurrentUser(null)}
            />
        </div>
    );
};

export default App;
