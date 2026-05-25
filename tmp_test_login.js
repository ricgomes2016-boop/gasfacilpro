import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@gasfacil.com',
        password: '123456',
    });
    
    if (error) {
        console.error("ERRO de Login:", error.message);
    } else {
        console.log("SUCESSO! O usuario", data.user.email, "esta perfeitamente funcional no banco.");
    }
}
testLogin();
