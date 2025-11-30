import { supabase } from './supabaseClient' 
 
async function addBooking() { 
  console.log('Adding test booking...') 
  const { data, error } = await supabase 
    .from('test_bookings') 
    .insert([ 
      { id: 1 } 
    ]) 
    .select() 
 
  if (error) { 
    console.error('Error adding booking:', error) 
  } else { 
    console.log('Success! Booking added:') 
    console.log(data) 
  } 
} 
 
addBooking() 
