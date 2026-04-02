import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scqenurznkatvrqxqjmt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjcWVudXJ6bmthdHZycXhxam10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNzIxMDMsImV4cCI6MjA4NTk0ODEwM30.JfjppsJiUB4AbL4NqImbvZtp65taUQmeQ3Ikzkz6mGk';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase
    .from('integracoes_whatsapp')
    .select('*')
    .eq('provedor', 'meta');
    
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Data:', JSON.stringify(data, null, 2));
  }
}

main();
