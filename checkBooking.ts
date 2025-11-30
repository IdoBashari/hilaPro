import { supabase } from './supabaseClient' 
 
async function check() { 
  const { data } = await supabase.from('bookings').select('*') 
  console.log('All bookings in Supabase:') 
  console.log(data) 
} 
 
check() 
