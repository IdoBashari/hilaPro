// ================================================================
// RGB Studio Calendar - Data Upload Script
// Upload all JSON data to Supabase PostgreSQL
// ================================================================

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ================================================================
// CONFIGURATION
// ================================================================

const SUPABASE_URL = 'https://eiytazetvhxckilekmpo.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpeXRhemV0dmh4Y2tpbGVrbXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTI1MjIsImV4cCI6MjA3OTcyODUyMn0.Zzoqb8MKsm9pEr3j9dwZtTRijnZhxQluAjMtDoUtbQ0';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function readJsonFile(filename) {
  const filePath = path.join(__dirname, filename);
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
}

async function uploadToTable(tableName, data, description) {
  if (!data || data.length === 0) {
    console.log(`⊘ ${description}: No data to upload (empty array)`);
    return { success: true, count: 0 };
  }

  console.log(`↑ Uploading ${description}...`);
  
  const { data: result, error } = await supabase
    .from(tableName)
    .insert(data)
    .select();

  if (error) {
    console.error(`✗ Error uploading ${description}:`, error.message);
    return { success: false, error };
  }

  console.log(`✓ ${description}: ${result.length} records uploaded successfully`);
  return { success: true, count: result.length };
}

// ================================================================
// MAIN UPLOAD FUNCTION
// ================================================================

async function uploadAllData() {
  console.log('');
  console.log('════════════════════════════════════════════════════════════');
  console.log('  RGB Studio Calendar - Data Upload to Supabase');
  console.log('════════════════════════════════════════════════════════════');
  console.log('');

  // Check configuration
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    console.error('✗ Error: Please configure your Supabase credentials first!');
    console.error('  Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables');
    console.error('  or edit them directly in this script.');
    process.exit(1);
  }

  console.log('Configuration:');
  console.log(`  Supabase URL: ${SUPABASE_URL}`);
  console.log('');

  const results = {
    success: [],
    failed: []
  };

  try {
    // ================================================================
    // STEP 1: Upload independent tables (no foreign keys)
    // ================================================================
    console.log('STEP 1: Uploading independent tables...');
    console.log('─────────────────────────────────────────────────────────');

    const resources = readJsonFile('resources.json');
    const resourcesResult = await uploadToTable('resources', resources, 'Resources (editing rooms)');
    resourcesResult.success ? results.success.push('resources') : results.failed.push('resources');

    const personnel = readJsonFile('personnel.json');
    const personnelResult = await uploadToTable('personnel', personnel, 'Personnel (staff members)');
    personnelResult.success ? results.success.push('personnel') : results.failed.push('personnel');

    const technicalServices = readJsonFile('technical_services.json');
    const servicesResult = await uploadToTable('technical_services', technicalServices, 'Technical Services');
    servicesResult.success ? results.success.push('technical_services') : results.failed.push('technical_services');

    const materials = readJsonFile('materials.json');
    const materialsResult = await uploadToTable('materials', materials, 'Materials');
    materialsResult.success ? results.success.push('materials') : results.failed.push('materials');

    const users = readJsonFile('users.json');
    const usersResult = await uploadToTable('users', users, 'Users (system users)');
    usersResult.success ? results.success.push('users') : results.failed.push('users');

    console.log('');

    // ================================================================
    // STEP 2: Upload clients and contacts
    // ================================================================
    console.log('STEP 2: Uploading clients and contacts...');
    console.log('─────────────────────────────────────────────────────────');

    const clients = readJsonFile('clients.json');
    const clientsResult = await uploadToTable('clients', clients, 'Clients');
    clientsResult.success ? results.success.push('clients') : results.failed.push('clients');

    const clientContacts = readJsonFile('client_contacts.json');
    const contactsResult = await uploadToTable('client_contacts', clientContacts, 'Client Contacts');
    contactsResult.success ? results.success.push('client_contacts') : results.failed.push('client_contacts');

    console.log('');

    // ================================================================
    // STEP 3: Upload projects
    // ================================================================
    console.log('STEP 3: Uploading projects...');
    console.log('─────────────────────────────────────────────────────────');

    const projects = readJsonFile('projects.json');
    const projectsResult = await uploadToTable('projects', projects, 'Projects');
    projectsResult.success ? results.success.push('projects') : results.failed.push('projects');

    console.log('');

    // ================================================================
    // STEP 4: Upload bookings
    // ================================================================
    console.log('STEP 4: Uploading bookings...');
    console.log('─────────────────────────────────────────────────────────');

    const bookings = readJsonFile('bookings.json');
    const bookingsResult = await uploadToTable('bookings', bookings, 'Bookings');
    bookingsResult.success ? results.success.push('bookings') : results.failed.push('bookings');

    console.log('');

    // ================================================================
    // STEP 5: Upload junction tables (many-to-many relationships)
    // ================================================================
    console.log('STEP 5: Uploading junction tables...');
    console.log('─────────────────────────────────────────────────────────');

    const bookingTechServices = readJsonFile('booking_technical_services.json');
    const techServicesResult = await uploadToTable('booking_technical_services', bookingTechServices, 'Booking Technical Services');
    techServicesResult.success ? results.success.push('booking_technical_services') : results.failed.push('booking_technical_services');

    const bookingMaterials = readJsonFile('booking_materials.json');
    const bookingMatResult = await uploadToTable('booking_materials', bookingMaterials, 'Booking Materials');
    bookingMatResult.success ? results.success.push('booking_materials') : results.failed.push('booking_materials');

    console.log('');

    // ================================================================
    // SUMMARY
    // ================================================================
    console.log('════════════════════════════════════════════════════════════');
    console.log('  UPLOAD SUMMARY');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✓ Successful: ${results.success.length} tables`);
    if (results.success.length > 0) {
      results.success.forEach(table => console.log(`  - ${table}`));
    }
    console.log('');

    if (results.failed.length > 0) {
      console.log(`✗ Failed: ${results.failed.length} tables`);
      results.failed.forEach(table => console.log(`  - ${table}`));
      console.log('');
      console.log('Please check the error messages above and try again.');
      process.exit(1);
    } else {
      console.log('🎉 All data uploaded successfully!');
      console.log('');
      console.log('Next steps:');
      console.log('  1. Verify data in Supabase dashboard');
      console.log('  2. Update your frontend code to use Supabase client');
      console.log('  3. Test the application');
      console.log('');
    }

  } catch (error) {
    console.error('');
    console.error('✗ Unexpected error during upload:');
    console.error(error);
    process.exit(1);
  }
}

// ================================================================
// RUN THE SCRIPT
// ================================================================

uploadAllData();
