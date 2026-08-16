import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRequestOrigin } from '@/lib/auth/redirects'

// POST so a crawler prefetching links can never sign a member out.
export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', getRequestOrigin(request)), 303)
}
