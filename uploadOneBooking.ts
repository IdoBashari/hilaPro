import { supabase } from './supabaseClient' 
import { INITIAL_BOOKINGS } from './constants' 
 
async function uploadOne() { 
  const booking = INITIAL_BOOKINGS[0] 
  console.log('Uploading:', booking.id) 
 
  const { data, error } = await supabase 
    .from('bookings') 
    .insert([{ 
      id: booking.id, 
      project_id: booking.projectId, 
      client_id: booking.clientId, 
      resource_id: booking.resourceId, 
      personnel_id: booking.personnelId, 
      start_date: booking.startDate.toISOString(), 
      end_date: booking.endDate.toISOString(), 
      start_time: booking.startTime, 
      end_time: booking.endTime, 
      notes: booking.notes 
    }]) 
    .select() 
 
  if (error) console.error('Error:', error) 
  else console.log('Success!', data) 
} 
 
uploadOne() 
