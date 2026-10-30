// No front, só a anon key (CLAUDE.md, Segurança). A service role nunca chega aqui.
import type { Database } from '@mel/db';
import { createClient } from '@supabase/supabase-js';

// Supabase local (supabase start): URL e anon key de demonstração, iguais em toda máquina.
const LOCAL_URL = 'http://127.0.0.1:54321';
const LOCAL_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const url = import.meta.env.VITE_SUPABASE_URL || (import.meta.env.DEV ? LOCAL_URL : '');
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || (import.meta.env.DEV ? LOCAL_ANON : '');

if (!url || !anonKey) throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build.');

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mel-sessao' },
});
