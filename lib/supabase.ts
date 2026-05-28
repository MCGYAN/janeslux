import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase browser client — must NEVER throw on import (Vercel builds without env
 * at compile time still ship this module to the client).
 */

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

function readPublicEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const v = process.env[name];
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return '';
}

export function getSupabaseConfig() {
  const url = readPublicEnv('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = readPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  return {
    url: url || PLACEHOLDER_URL,
    anonKey: anonKey || PLACEHOLDER_ANON_KEY,
    isConfigured: Boolean(url && anonKey),
  };
}

/** True when real Supabase keys are set in the environment. */
export const isSupabaseConfigured = getSupabaseConfig().isConfigured;

let clientInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (clientInstance) return clientInstance;
  const { url, anonKey, isConfigured } = getSupabaseConfig();
  if (!isConfigured && typeof window !== 'undefined') {
    console.warn(
      "[Jane's Luxe] Supabase not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel → Environment Variables (all environments), then redeploy."
    );
  }
  clientInstance = createClient(url, anonKey);
  return clientInstance;
}

/** @deprecated Prefer getSupabaseClient() — proxy keeps legacy imports working without eager init throws */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
