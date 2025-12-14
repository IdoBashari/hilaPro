# הצעת סכמת מסד נתונים - RGB Studio Calendar

## מבנה מסד הנתונים - 11 טבלאות

---

## 1. resources (משאבים - חדרי עריכה)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם המשאב |
| type | VARCHAR(50) | NOT NULL, CHECK (type IN ('Offline', 'Online', 'Cinema', 'Technical')) | סוג חדר |
| color | VARCHAR(100) | NOT NULL | קוד צבע Tailwind CSS |
| list_price | DECIMAL(10,2) | NOT NULL | מחיר מחירון ליום |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**אינדקסים מומלצים:**
- INDEX על type (לסינון לפי סוג חדר)

**דוגמאות:**
```
id: 'offline-1', name: 'חדר עריכה Offline 1', type: 'Offline', color: 'bg-blue-200 border-blue-400 text-blue-800', list_price: 1200.00
id: 'online-1', name: 'חדר עריכה Online 1', type: 'Online', color: 'bg-green-200 border-green-400 text-green-800', list_price: 2500.00
id: 'cinema-1', name: 'חדר עריכה קולנוע', type: 'Cinema', color: 'bg-purple-200 border-purple-400 text-purple-800', list_price: 4000.00
id: 'tech-room-1', name: 'חדר טכני', type: 'Technical', color: 'bg-gray-200 border-gray-400 text-gray-800', list_price: 500.00
```

**סה"כ רשומות בדוגמה: 14** (10 Offline + 3 Online + 1 Cinema + 1 Technical)

---

## 2. personnel (איש צוות)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם מלא |
| role | VARCHAR(100) | NOT NULL | תפקיד (עורך וידאו, קולוריסט וכו') |
| rate | DECIMAL(10,2) | NOT NULL | תעריף יומי בשקלים |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**דוגמאות:**
```
id: 'p-1', name: 'ישראל ישראלי', role: 'עורך וידאו', rate: 1500.00
id: 'p-2', name: 'משה כהן', role: 'עורך וידאו', rate: 1600.00
id: 'p-3', name: 'דנה לוי', role: 'קולוריסטית', rate: 2000.00
id: 'p-4', name: 'אביגיל שמש', role: 'סאונדמן', rate: 1800.00
```

**סה"כ רשומות בדוגמה: 4**

---

## 3. technical_services (שירותים טכניים)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם השירות |
| price | DECIMAL(10,2) | NOT NULL | מחיר השירות |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**דוגמאות:**
```
id: 'tech-1', name: 'המרת פורמט', price: 150.00
id: 'tech-2', name: 'שירותי אחסון (1TB)', price: 500.00
id: 'tech-3', name: 'QC', price: 300.00
id: 'tech-4', name: 'מאסטרינג סאונד', price: 800.00
```

**סה"כ רשומות בדוגמה: 4**

---

## 4. materials (חומרי גלם)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם החומר |
| purchase_price | DECIMAL(10,2) | NOT NULL | מחיר קנייה |
| selling_price | DECIMAL(10,2) | NOT NULL | מחיר מכירה מומלץ |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**דוגמאות:**
```
id: 'mat-1', name: 'כונן קשיח SSD 1TB', purchase_price: 250.00, selling_price: 400.00
id: 'mat-2', name: 'כונן קשיח HDD 4TB', purchase_price: 300.00, selling_price: 500.00
```

**סה"כ רשומות בדוגמה: 2**

---

## 5. clients (לקוחות)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם הלקוח |
| business_id | VARCHAR(50) | NOT NULL, UNIQUE | ח.פ / ע.מ |
| email | VARCHAR(255) | NOT NULL | דוא"ל ראשי |
| address | TEXT | NULL | כתובת |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**אינדקסים מומלצים:**
- UNIQUE INDEX על business_id (קיים)
- INDEX על name (לחיפוש)

**דוגמאות:**
```
id: 'client-1', name: 'קשת 12', business_id: '514236589', email: 'contact@keshet.co.il', address: 'ראול ולנברג 12, תל אביב'
id: 'client-2', name: 'רשת 13', business_id: '514236590', email: 'contact@reshet.tv', address: 'הברזל 3, תל אביב'
id: 'client-3', name: 'כאן 11', business_id: '514236591', email: 'info@kan.org.il', address: 'ירושלים'
id: 'client-4', name: 'yes', business_id: '514236592', email: 'service@yes.co.il', address: 'כפר סבא'
```

**סה"כ רשומות בדוגמה: 4**

---

## 6. client_contacts (אנשי קשר של לקוחות)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| client_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → clients(id) ON DELETE CASCADE | מזהה הלקוח |
| name | VARCHAR(255) | NOT NULL | שם איש הקשר |
| phone | VARCHAR(50) | NOT NULL | מספר טלפון |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**אינדקסים מומלצים:**
- INDEX על client_id (לשליפה מהירה)

**יחסים:**
- מחיקת לקוח → מחיקת כל אנשי הקשר שלו (CASCADE)

**דוגמאות:**
```
id: 'c1', client_id: 'client-1', name: 'אבי כהן', phone: '050-1111111'
id: 'c2', client_id: 'client-2', name: 'מיכל לוי', phone: '050-2222222'
id: 'c3', client_id: 'client-3', name: 'דוד ישראלי', phone: '050-3333333'
id: 'c4', client_id: 'client-4', name: 'רוני שמיר', phone: '050-4444444'
```

**סה"כ רשומות בדוגמה: 4**

---

## 7. projects (פרויקטים)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| name | VARCHAR(255) | NOT NULL | שם הפרויקט |
| client_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → clients(id) ON DELETE RESTRICT | מזהה הלקוח |
| status | VARCHAR(50) | NOT NULL, DEFAULT 'In Progress', CHECK (status IN ('In Progress', 'Completed', 'On Hold')) | סטטוס הפרויקט |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**אינדקסים מומלצים:**
- INDEX על client_id
- INDEX על status

**יחסים:**
- מחיקת לקוח → חסימה אם יש פרויקטים (RESTRICT)

**דוגמאות:**
```
id: 'project-1', name: 'הכוכב הבא לאירוויזיון', client_id: 'client-1', status: 'In Progress'
id: 'project-2', name: 'האח הגדול', client_id: 'client-2', status: 'In Progress'
id: 'project-3', name: 'קופה ראשית', client_id: 'client-3', status: 'Completed'
id: 'project-4', name: 'פאודה', client_id: 'client-4', status: 'On Hold'
```

**סה"כ רשומות בדוגמה: 4**

---

## 8. bookings (הזמנות)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| project_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → projects(id) ON DELETE RESTRICT | מזהה הפרויקט |
| client_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → clients(id) ON DELETE RESTRICT | מזהה הלקוח |
| resource_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → resources(id) ON DELETE RESTRICT | מזהה המשאב (חדר) |
| personnel_id | VARCHAR(50) | NULL, FOREIGN KEY → personnel(id) ON DELETE SET NULL | מזהה איש צוות (אופציונלי) |
| start_date | DATE | NOT NULL | תאריך התחלה |
| end_date | DATE | NOT NULL, CHECK (end_date >= start_date) | תאריך סיום |
| start_time | TIME | NULL | שעת התחלה (אופציונלי - לא חובה לחדר טכני) |
| end_time | TIME | NULL | שעת סיום (אופציונלי) |
| notes | TEXT | NULL | הערות |
| do_not_charge_resource | BOOLEAN | DEFAULT FALSE | האם לא לחייב את החדר |
| billed | BOOLEAN | DEFAULT FALSE | האם חויב ללקוח |
| billed_date | DATE | NULL | תאריך החיוב |
| billing_amount | DECIMAL(10,2) | NULL | סכום שחויב בפועל |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירת ההזמנה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |
| deleted_at | TIMESTAMP | NULL | תאריך מחיקה (soft delete) |

**אינדקסים מומלצים:**
- INDEX על project_id
- INDEX על resource_id
- INDEX על start_date, end_date
- INDEX על deleted_at (לסינון רשומות פעילות)

**יחסים:**
- מחיקת פרויקט → חסימה (RESTRICT)
- מחיקת לקוח → חסימה (RESTRICT)
- מחיקת משאב → חסימה (RESTRICT)
- מחיקת איש צוות → NULL (SET NULL)

**דוגמאות (תאריכים יחסיים - יום 0 = 2025-01-01):**
```
id: 'booking-1', project_id: 'project-1', client_id: 'client-1', resource_id: 'offline-1', personnel_id: 'p-1', 
start_date: '2025-01-01', end_date: '2025-01-03', start_time: '09:00', end_time: '18:00', 
notes: 'עריכת פרק 5', do_not_charge_resource: false, billed: false

id: 'booking-2', project_id: 'project-2', client_id: 'client-2', resource_id: 'offline-2', personnel_id: 'p-2', 
start_date: '2025-01-02', end_date: '2025-01-04', start_time: '09:00', end_time: '18:00', 
notes: 'עריכת הדחה', do_not_charge_resource: false, billed: false

id: 'booking-3', project_id: 'project-3', client_id: 'client-3', resource_id: 'online-1', personnel_id: 'p-3', 
start_date: '2025-01-05', end_date: '2025-01-06', start_time: '09:00', end_time: '18:00', 
notes: 'מאסטרינג סאונד ו-QC', do_not_charge_resource: false, billed: true

id: 'booking-4', project_id: 'project-1', client_id: 'client-1', resource_id: 'offline-1', personnel_id: 'p-1', 
start_date: '2025-01-08', end_date: '2025-01-10', start_time: '09:00', end_time: '18:00', 
notes: 'עריכת פרק 6', do_not_charge_resource: false, billed: false

id: 'booking-5', project_id: 'project-4', client_id: 'client-4', resource_id: 'cinema-1', personnel_id: 'p-4', 
start_date: '2025-01-09', end_date: '2025-01-13', start_time: '09:00', end_time: '18:00', 
notes: 'עריכת סאונד לסצנת אקשן', do_not_charge_resource: false, billed: false

id: 'booking-6', project_id: 'project-2', client_id: 'client-2', resource_id: 'offline-3', personnel_id: 'p-2', 
start_date: '2025-01-15', end_date: '2025-01-19', start_time: '09:00', end_time: '18:00', 
notes: 'עריכת פרק גמר', do_not_charge_resource: false, billed: false
```

**סה"כ רשומות בדוגמה: 6**

---

## 9. booking_technical_services (קשר רב-רבים: הזמנות ↔ שירותים טכניים)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | SERIAL | PRIMARY KEY | מזהה אוטומטי |
| booking_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → bookings(id) ON DELETE CASCADE | מזהה ההזמנה |
| technical_service_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → technical_services(id) ON DELETE CASCADE | מזהה השירות |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |

**אילוצים נוספים:**
- UNIQUE (booking_id, technical_service_id) - מונע כפילויות

**יחסים:**
- מחיקת הזמנה → מחיקת כל השירותים המקושרים (CASCADE)

**דוגמאות:**
```
booking_id: 'booking-1', technical_service_id: 'tech-1'
booking_id: 'booking-3', technical_service_id: 'tech-3'
booking_id: 'booking-3', technical_service_id: 'tech-4'
booking_id: 'booking-5', technical_service_id: 'tech-4'
```

**סה"כ רשומות בדוגמה: 4**

---

## 10. booking_materials (קשר רב-רבים: הזמנות ↔ חומרי גלם)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | SERIAL | PRIMARY KEY | מזהה אוטומטי |
| booking_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → bookings(id) ON DELETE CASCADE | מזהה ההזמנה |
| material_id | VARCHAR(50) | NOT NULL, FOREIGN KEY → materials(id) ON DELETE CASCADE | מזהה החומר |
| quantity | INTEGER | NOT NULL, CHECK (quantity > 0) | כמות |
| selling_price | DECIMAL(10,2) | NOT NULL | מחיר מכירה בפועל (יכול להיות שונה מהמחירון) |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |

**אילוצים נוספים:**
- UNIQUE (booking_id, material_id) - מונע כפילויות

**יחסים:**
- מחיקת הזמנה → מחיקת כל החומרים המקושרים (CASCADE)

**הערה חשובה:**
המחיר כאן הוא המחיר שנמכר בפועל להזמנה הספציפית, ולא בהכרח המחיר מטבלת materials.

**דוגמאות:**
```
booking_id: 'booking-1', material_id: 'mat-1', quantity: 2, selling_price: 400.00
booking_id: 'booking-4', material_id: 'mat-2', quantity: 1, selling_price: 500.00
```

**סה"כ רשומות בדוגמה: 2**

---

## 11. users (משתמשי המערכת)

| עמודה | טיפוס | אילוצים | הסבר |
|-------|--------|----------|------|
| id | VARCHAR(50) | PRIMARY KEY | מזהה ייחודי |
| username | VARCHAR(100) | NOT NULL, UNIQUE | שם משתמש |
| password | VARCHAR(255) | NOT NULL | סיסמה (טקסט פשוט - ללא הצפנה כרגע) |
| email | VARCHAR(255) | NOT NULL, UNIQUE | דוא"ל |
| role | VARCHAR(50) | NOT NULL, CHECK (role IN ('admin', 'technician')) | תפקיד במערכת |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך יצירה |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP | תאריך עדכון אחרון |

**אינדקסים מומלצים:**
- UNIQUE INDEX על username (קיים)
- UNIQUE INDEX על email (קיים)

**הערה אבטחה:**
בשלב זה הסיסמאות בטקסט פשוט. בעתיד מומלץ להוסיף הצפנה (bcrypt/argon2).

**דוגמאות:**
```
id: 'user-1', username: 'admin', password: 'password123', email: 'admin@studioflow.com', role: 'admin'
id: 'user-2', username: 'tech', password: 'password123', email: 'tech@studioflow.com', role: 'technician'
```

**סה"כ רשומות בדוגמה: 2**

---

## תרשים יחסים (ERD)

```
┌──────────────┐
│   clients    │
│ (לקוחות)     │
└──────┬───────┘
       │ 1
       │
       ├───────→ N ┌────────────────────┐
       │          │  client_contacts   │
       │          │  (אנשי קשר)        │
       │          └────────────────────┘
       │
       ├───────→ N ┌──────────────┐
       │          │   projects   │
       │          │  (פרויקטים)  │
       │          └──────┬───────┘
       │                 │ 1
       │                 │
       ├─────────────────┴───→ N ┌──────────────┐
       │                         │   bookings   │
       │                         │   (הזמנות)   │
       │                         └──────┬───────┘
       │                                │
       └────────────────────────────────┘
                                        │
                       ┌────────────────┼────────────────┐
                       │                │                │
                    N  │             N  │             N  │
                       ↓                ↓                ↓
              ┌────────────────┐ ┌─────────────┐ ┌──────────────┐
              │   resources    │ │  personnel  │ │booking_tech_ │
              │    (חדרים)    │ │ (איש צוות) │ │  services    │
              └────────────────┘ └─────────────┘ └──────┬───────┘
                                                        │ N
                                                        │
                                                        ↓
                                                 ┌──────────────────┐
                                                 │technical_services│
                                                 │  (שירותים)      │
                                                 └──────────────────┘
                                        
                                        ┌──────────────────┐
                                        │booking_materials │
                                        └──────┬───────────┘
                                               │ N
                                               │
                                               ↓
                                        ┌──────────────┐
                                        │  materials   │
                                        │ (חומרי גלם) │
                                        └──────────────┘

┌──────────────┐
│    users     │
│  (משתמשים)   │
│  (עצמאית)    │
└──────────────┘
```

---

## סיכום מפתחות זרים (Foreign Keys)

| טבלה | עמודה | מצביע ל | פעולת מחיקה |
|------|-------|---------|-------------|
| client_contacts | client_id | clients(id) | CASCADE |
| projects | client_id | clients(id) | RESTRICT |
| bookings | project_id | projects(id) | RESTRICT |
| bookings | client_id | clients(id) | RESTRICT |
| bookings | resource_id | resources(id) | RESTRICT |
| bookings | personnel_id | personnel(id) | SET NULL |
| booking_technical_services | booking_id | bookings(id) | CASCADE |
| booking_technical_services | technical_service_id | technical_services(id) | CASCADE |
| booking_materials | booking_id | bookings(id) | CASCADE |
| booking_materials | material_id | materials(id) | CASCADE |

**הסבר פעולות מחיקה:**
- **CASCADE**: מחיקת רשומה אב תמחק אוטומטית את כל הרשומות הקשורות
- **RESTRICT**: מחיקת רשומה אב תיחסם אם יש רשומות קשורות
- **SET NULL**: מחיקת רשומה אב תשנה את הערך ל-NULL

---

## אינדקסים מומלצים (לביצועים)

```sql
-- טבלת resources
CREATE INDEX idx_resources_type ON resources(type);

-- טבלת clients
CREATE INDEX idx_clients_name ON clients(name);

-- טבלת client_contacts
CREATE INDEX idx_client_contacts_client_id ON client_contacts(client_id);

-- טבלת projects
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);

-- טבלת bookings (הכי חשוב!)
CREATE INDEX idx_bookings_project_id ON bookings(project_id);
CREATE INDEX idx_bookings_resource_id ON bookings(resource_id);
CREATE INDEX idx_bookings_dates ON bookings(start_date, end_date);
CREATE INDEX idx_bookings_deleted_at ON bookings(deleted_at);
CREATE INDEX idx_bookings_billed ON bookings(billed);
```

---

## סטטיסטיקת נתונים

| טבלה | מספר רשומות | גודל משוער |
|------|-------------|------------|
| resources | 14 | קטן |
| personnel | 4 | קטן |
| technical_services | 4 | קטן |
| materials | 2 | קטן |
| clients | 4 | קטן |
| client_contacts | 4 | קטן |
| projects | 4 | קטן |
| bookings | 6 (בדוגמה) | יגדל במהירות |
| booking_technical_services | 4 | יגדל במהירות |
| booking_materials | 2 | בינוני |
| users | 2 | קטן |

**סה"כ: 50 רשומות בדוגמה**

---

## הערות חשובות

### 1. שמות עמודות
כל שמות העמודות ב-`snake_case` (קו תחתון בין מילים).

### 2. CHECK Constraints
הוספנו בדיקות לוגיות:
- `resources.type` - רק 4 ערכים אפשריים: Offline, Online, Cinema, Technical
- `projects.status` - רק 3 ערכים אפשריים: In Progress, Completed, On Hold
- `users.role` - רק 2 ערכים אפשריים: admin, technician
- `bookings.end_date >= start_date` - תאריך סיום לא יכול להיות לפני תאריך התחלה
- `booking_materials.quantity >= 0` - כמות חייבת להיות אפס או חיובית

### 3. ברירות מחדל (Defaults)
- `projects.status` → 'In Progress'
- `bookings.do_not_charge_resource` → FALSE
- `bookings.billed` → FALSE
- כל עמודות `created_at`, `updated_at` → CURRENT_TIMESTAMP

### 4. Soft Delete
רק בטבלת `bookings` יש `deleted_at` למחיקה רכה (לא מוחקים מהמערכת אלא מסמנים כמחוקים).

### 5. סיסמאות
כרגע הסיסמאות בטקסט פשוט. בעתיד מומלץ מאוד להוסיף הצפנה (bcrypt או argon2).

### 6. תאריכים בדוגמה
כל התאריכים מתחילים מ-2025-01-01 (יום 0) לצורך הדגמה.

### 7. מזהים
כל המזהים הם VARCHAR(50) ולא SERIAL/UUID, כך שניתן לשמור את המזהים הקיימים מהקוד.

### 8. יחסים
- **1:N** (אחד לרבים): לקוח → פרויקטים, לקוח → אנשי קשר, פרויקט → הזמנות
- **N:N** (רבים לרבים): הזמנות ↔ שירותים טכניים, הזמנות ↔ חומרי גלם

---

## השלבים הבאים (לאחר אישור)

1. **schema.sql** - סקריפט SQL מלא ליצירת כל הטבלאות והאינדקסים
2. **upload script** - סקריפט Node.js/TypeScript להעלאת כל הנתונים ל-Supabase
3. **קבצי JSON** - קובץ JSON נפרד לכל טבלה עם הנתונים המנוקים
4. **README.md** - תיעוד מלא באנגלית עם הוראות הפעלה

---

## שאלות לאישור

1. האם מבנה הטבלאות נכון ומקיף?
2. האם יחסי המפתחות הזרים (CASCADE/RESTRICT/SET NULL) הגיוניים?
3. האם צריך להוסיף/להסיר שדות?
4. האם שמות העמודות ברורים?
5. האם הסכמה מאושרת למעבר לשלב 3 (יצירת קבצים)?

---

**מסמך זה הוכן עבור: RGB Studio Calendar Project**  
**תאריך: נובמבר 2025**  
**גרסה: 1.0**
