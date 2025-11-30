import { supabase } from './supabaseClient' 
 
async function testSupabase() { 
  const { data, error } = await supabase.from('test_bookings').select('*') 
  if (error) { 
    console.error('Error:', error) 
  } else { 
    console.log('Success! Connected to Supabase') 
    console.log('Data:', data) 
  } 
} 
 
testSupabase() 
