// ================================================================
// Supabase Helpers - Data Conversion Functions
// Converts between JavaScript camelCase and SQL snake_case
// ================================================================

import { Resource, Booking, Client, Project, Personnel } from '../types';

// ================================================================
// RESOURCES (Editing Rooms)
// ================================================================

/**
 * Convert Resource from Supabase format (snake_case) to JavaScript format (camelCase)
 * @param dbResource - Resource object from Supabase database
 * @returns Resource object in JavaScript format
 */
export function convertResourceFromDB(dbResource: any): Resource {
  return {
    id: dbResource.id,
    name: dbResource.name,
    type: dbResource.type,
    color: dbResource.color,
    listPrice: dbResource.list_price,
  };
}

/**
 * Convert Resource from JavaScript format (camelCase) to Supabase format (snake_case)
 * @param jsResource - Resource object in JavaScript format
 * @returns Resource object for Supabase database
 */
export function convertResourceToDB(jsResource: Resource): any {
  return {
    id: jsResource.id,
    name: jsResource.name,
    type: jsResource.type,
    color: jsResource.color,
    list_price: jsResource.listPrice,
  };
}

// ================================================================
// HELPER: Convert array of resources
// ================================================================

/**
 * Convert array of resources from Supabase to JavaScript format
 */
export function convertResourcesFromDB(dbResources: any[]): Resource[] {
  return dbResources.map(convertResourceFromDB);
}

/**
 * Convert array of resources from JavaScript to Supabase format
 */
export function convertResourcesToDB(jsResources: Resource[]): any[] {
  return jsResources.map(convertResourceToDB);
}

// ================================================================
// BOOKINGS (Room Reservations)
// ================================================================

/**
 * Convert Booking from Supabase format (snake_case) to JavaScript format (camelCase)
 * @param dbBooking - Booking object from Supabase database
 * @returns Booking object in JavaScript format
 */
export function convertBookingFromDB(dbBooking: any): Booking {
  return {
    id: dbBooking.id,
    projectId: dbBooking.project_id,
    clientId: dbBooking.client_id,
    resourceId: dbBooking.resource_id,
    personnelId: dbBooking.personnel_id || undefined,
    technicalServices: [], // Will be loaded separately from junction table
    materials: [], // Will be loaded separately from junction table
    startDate: new Date(dbBooking.start_date),
    endDate: new Date(dbBooking.end_date),
    startTime: dbBooking.start_time || undefined,
    endTime: dbBooking.end_time || undefined,
    notes: dbBooking.notes || '',
    doNotChargeResource: dbBooking.do_not_charge_resource || false,
    billed: dbBooking.billed || false,
    billedDate: dbBooking.billed_date ? new Date(dbBooking.billed_date) : undefined,
  };
}

/**
 * Convert Booking from JavaScript format (camelCase) to Supabase format (snake_case)
 * @param jsBooking - Booking object in JavaScript format
 * @returns Booking object for Supabase database
 */
export function convertBookingToDB(jsBooking: Booking): any {
  return {
    id: jsBooking.id,
    project_id: jsBooking.projectId,
    client_id: jsBooking.clientId,
    resource_id: jsBooking.resourceId,
    personnel_id: jsBooking.personnelId || null,
    start_date: jsBooking.startDate instanceof Date 
      ? jsBooking.startDate.toISOString().split('T')[0] 
      : jsBooking.startDate,
    end_date: jsBooking.endDate instanceof Date 
      ? jsBooking.endDate.toISOString().split('T')[0] 
      : jsBooking.endDate,
    start_time: jsBooking.startTime || null,
    end_time: jsBooking.endTime || null,
    notes: jsBooking.notes || null,
    do_not_charge_resource: jsBooking.doNotChargeResource || false,
    billed: jsBooking.billed || false,
    billed_date: jsBooking.billedDate 
      ? (jsBooking.billedDate instanceof Date 
          ? jsBooking.billedDate.toISOString().split('T')[0] 
          : jsBooking.billedDate)
      : null,
    billing_amount: null, // This field exists in DB but not in current types.ts
    deleted_at: null, // Always null for new/updated bookings
  };
}

// ================================================================
// HELPER: Convert array of bookings
// ================================================================

/**
 * Convert array of bookings from Supabase to JavaScript format
 */
export function convertBookingsFromDB(dbBookings: any[]): Booking[] {
  return dbBookings.map(convertBookingFromDB);
}

/**
 * Convert array of bookings from JavaScript to Supabase format
 */
export function convertBookingsToDB(jsBookings: Booking[]): any[] {
  return jsBookings.map(convertBookingToDB);
}

// ================================================================
// CLIENTS (Customers)
// ================================================================

/**
 * Convert Client from Supabase format (snake_case) to JavaScript format (camelCase)
 * Note: contacts array will be loaded separately from client_contacts table
 * @param dbClient - Client object from Supabase database
 * @returns Client object in JavaScript format
 */
export function convertClientFromDB(dbClient: any): Client {
  return {
    id: dbClient.id,
    name: dbClient.name,
    businessId: dbClient.business_id,
    contacts: [], // Will be loaded separately from client_contacts table
    email: dbClient.email,
    address: dbClient.address || '',
  };
}

/**
 * Convert Client from JavaScript format (camelCase) to Supabase format (snake_case)
 * Note: contacts are NOT saved here - they go to client_contacts table
 * @param jsClient - Client object in JavaScript format
 * @returns Client object for Supabase database
 */
export function convertClientToDB(jsClient: Client): any {
  return {
    id: jsClient.id,
    name: jsClient.name,
    business_id: jsClient.businessId,
    email: jsClient.email,
    address: jsClient.address || null,
    // contacts are NOT included - they go to client_contacts table
  };
}

// ================================================================
// HELPER: Convert array of clients
// ================================================================

/**
 * Convert array of clients from Supabase to JavaScript format
 */
export function convertClientsFromDB(dbClients: any[]): Client[] {
  return dbClients.map(convertClientFromDB);
}

/**
 * Convert array of clients from JavaScript to Supabase format
 */
export function convertClientsToDB(jsClients: Client[]): any[] {
  return jsClients.map(convertClientToDB);
}

// ================================================================
// PROJECTS
// ================================================================

/**
 * Convert Project from Supabase format (snake_case) to JavaScript format (camelCase)
 * @param dbProject - Project object from Supabase database
 * @returns Project object in JavaScript format
 */
export function convertProjectFromDB(dbProject: any): Project {
  return {
    id: dbProject.id,
    name: dbProject.name,
    clientId: dbProject.client_id,
    status: dbProject.status,
  };
}

/**
 * Convert Project from JavaScript format (camelCase) to Supabase format (snake_case)
 * @param jsProject - Project object in JavaScript format
 * @returns Project object for Supabase database
 */
export function convertProjectToDB(jsProject: Project): any {
  return {
    id: jsProject.id,
    name: jsProject.name,
    client_id: jsProject.clientId,
    status: jsProject.status,
  };
}

/**
 * Convert array of projects from Supabase to JavaScript format
 */
export function convertProjectsFromDB(dbProjects: any[]): Project[] {
  return dbProjects.map(convertProjectFromDB);
}

/**
 * Convert array of projects from JavaScript to Supabase format
 */
export function convertProjectsToDB(jsProjects: Project[]): any[] {
  return jsProjects.map(convertProjectToDB);
}
// ================================================================
// PERSONNEL (Staff Members)
// ================================================================

/**
 * Convert Personnel from Supabase format to JavaScript format
 * Note: Personnel has no snake_case fields, all fields are identical
 */
export function convertPersonnelFromDB(dbPersonnel: any): Personnel {
  return {
    id: dbPersonnel.id,
    name: dbPersonnel.name,
    role: dbPersonnel.role,
    rate: dbPersonnel.rate,
  };
}

/**
 * Convert Personnel from JavaScript format to Supabase format
 * Note: Personnel has no snake_case fields, all fields are identical
 */
export function convertPersonnelToDB(jsPersonnel: Personnel): any {
  return {
    id: jsPersonnel.id,
    name: jsPersonnel.name,
    role: jsPersonnel.role,
    rate: jsPersonnel.rate,
  };
}

/**
 * Convert array of personnel from Supabase to JavaScript format
 */
export function convertPersonnelsFromDB(dbPersonnels: any[]): Personnel[] {
  return dbPersonnels.map(convertPersonnelFromDB);
}

/**
 * Convert array of personnel from JavaScript to Supabase format
 */
export function convertPersonnelsToDB(jsPersonnels: Personnel[]): any[] {
  return jsPersonnels.map(convertPersonnelToDB);
}