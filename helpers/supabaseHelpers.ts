// ================================================================
// Supabase Helpers - Data Conversion Functions
// Converts between JavaScript camelCase and SQL snake_case
// ================================================================

import { Resource } from '../types';

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