# RGB Studio Calendar - Database Migration Guide

This guide will help you migrate your data from the static constants to Supabase PostgreSQL.

---

## 📋 Prerequisites

Before you begin, make sure you have:

1. **Node.js** installed (version 16 or higher)
   - Check: `node --version`
   - Download: https://nodejs.org/

2. **Supabase Account** with a project created
   - Sign up at: https://supabase.com
   - Create a new project

3. **Supabase Credentials**
   - Project URL
   - Anon/Public API Key

---

## 📁 Files Overview

```
migration/
├── schema.sql                          # Database schema (run first)
├── upload.js                           # Upload script
├── package.json                        # Node dependencies
├── .env.example                        # Environment variables template
├── resources.json                      # 14 editing rooms
├── personnel.json                      # 4 staff members
├── technical_services.json             # 4 technical services
├── materials.json                      # 2 materials
├── clients.json                        # 4 clients
├── client_contacts.json                # 4 contact persons
├── projects.json                       # 4 projects
├── bookings.json                       # 6 bookings
├── booking_technical_services.json     # Service-booking links
├── booking_materials.json              # Material-booking links
└── users.json                          # 2 system users
```

---

## 🚀 Step-by-Step Instructions

### Step 1: Create the Database Schema

1. Open your **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open the file `schema.sql`
4. Copy all the SQL code
5. Paste it into the SQL Editor
6. Click **Run**

✓ This creates all 11 tables with proper relationships.

---

### Step 2: Prepare the Upload Script

1. **Create a new folder** on your computer (e.g., `supabase-migration`)

2. **Copy all files** to this folder:
   - `upload.js`
   - `package.json`
   - `.env.example`
   - All 11 JSON files

3. **Open terminal/command prompt** in this folder

4. **Install dependencies:**
   ```bash
   npm install
   ```

---

### Step 3: Configure Credentials

#### Option A: Using .env file (Recommended)

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and fill in your credentials:
   ```
   SUPABASE_URL=https://eiytazetvhxckilekmpo.supabase.co
   SUPABASE_ANON_KEY=your_actual_anon_key_here
   ```

#### Option B: Edit upload.js directly

Open `upload.js` and replace:
```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL_HERE';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY_HERE';
```

With your actual credentials:
```javascript
const SUPABASE_URL = 'https://eiytazetvhxckilekmpo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

---

### Step 4: Run the Upload Script

```bash
npm run upload
```

Or:
```bash
node upload.js
```

---

## 📊 Expected Output

```
════════════════════════════════════════════════════════════
  RGB Studio Calendar - Data Upload to Supabase
════════════════════════════════════════════════════════════

Configuration:
  Supabase URL: https://eiytazetvhxckilekmpo.supabase.co

STEP 1: Uploading independent tables...
─────────────────────────────────────────────────────────
↑ Uploading Resources (editing rooms)...
✓ Resources (editing rooms): 14 records uploaded successfully
↑ Uploading Personnel (staff members)...
✓ Personnel (staff members): 4 records uploaded successfully
...

════════════════════════════════════════════════════════════
  UPLOAD SUMMARY
════════════════════════════════════════════════════════════

✓ Successful: 11 tables
  - resources
  - personnel
  - technical_services
  - materials
  - users
  - clients
  - client_contacts
  - projects
  - bookings
  - booking_technical_services
  - booking_materials

🎉 All data uploaded successfully!

Next steps:
  1. Verify data in Supabase dashboard
  2. Update your frontend code to use Supabase client
  3. Test the application
```

---

## ✅ Verify the Upload

1. Go to your **Supabase Dashboard**
2. Click on **Table Editor**
3. Check each table:
   - `resources` should have 14 records
   - `personnel` should have 4 records
   - `clients` should have 4 records
   - `bookings` should have 6 records
   - etc.

---

## ❌ Troubleshooting

### Error: "Cannot find module '@supabase/supabase-js'"
**Solution:** Run `npm install` first

### Error: "Please configure your Supabase credentials"
**Solution:** Check that you've set your URL and API key correctly

### Error: "violates foreign key constraint"
**Solution:** Make sure you ran `schema.sql` first to create all tables

### Error: "duplicate key value"
**Solution:** The data already exists. You can either:
- Delete all data from tables (in reverse order)
- Or skip this error if intentional

---

## 🔐 Security Notes

1. **Never commit** your `.env` file to Git
2. **Keep your API keys secret**
3. The passwords in `users.json` are plain text - you should encrypt them in production

---

## 📝 Database Schema Summary

### Tables:
1. **resources** - Editing rooms (14 records)
2. **personnel** - Staff members (4 records)
3. **technical_services** - Services offered (4 records)
4. **materials** - Hardware inventory (2 records)
5. **clients** - Customer companies (4 records)
6. **client_contacts** - Contact persons (4 records)
7. **projects** - Client projects (4 records)
8. **bookings** - Room reservations (6 records)
9. **booking_technical_services** - Services per booking (5 links)
10. **booking_materials** - Materials per booking (0 records - empty)
11. **users** - System users (2 records)

### Relationships:
- Clients → Projects (1:N)
- Clients → Contacts (1:N)
- Projects → Bookings (1:N)
- Bookings → Resources (N:1)
- Bookings → Personnel (N:1)
- Bookings ↔ Technical Services (N:N)
- Bookings ↔ Materials (N:N)

---

## 📞 Support

If you encounter any issues:
1. Check the error message carefully
2. Verify your Supabase credentials
3. Ensure all JSON files are in the same folder as `upload.js`
4. Make sure Node.js is installed correctly

---

**Created:** December 2024  
**Version:** 1.0  
**Project:** RGB Studio Calendar
