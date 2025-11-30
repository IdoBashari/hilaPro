import { createClient } from '@supabase/supabase-js' 
 
const supabaseUrl = 'https://eiytazetvhxckilekmpo.supabase.co' 
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpeXRhemV0dmh4Y2tpbGVrbXBvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxNTI1MjIsImV4cCI6MjA3OTcyODUyMn0.Zzoqb8MKsm9pEr3j9dwZtTRijnZhxQluAjMtDoUtbQ0' 
 
export const supabase = createClient(supabaseUrl, supabaseAnonKey) 
