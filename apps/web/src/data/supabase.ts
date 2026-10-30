// No front, só a anon key (CLAUDE.md, Segurança). A service role nunca chega aqui.
// Nenhuma chave no código: vem do build (VITE_*). Em desenvolvimento, o vite.config.ts lê do `supabase status`.
import type { Database } from '@mel/db';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no build.');

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mel-sessao' },
});
