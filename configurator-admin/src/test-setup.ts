// Provide minimal env stubs so modules that guard on VITE_SUPABASE_URL /
// VITE_SUPABASE_ANON_KEY don't throw when imported in unit tests.
// No actual Supabase network calls are made in pure-function tests.
import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://stub.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'stub-anon-key')
