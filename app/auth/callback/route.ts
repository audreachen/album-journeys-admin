import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error');

  if (!code) {
    const reason = oauthError ? 'provider' : 'missing_code';
    return NextResponse.redirect(new URL('/login?error=' + reason, url.origin));
  }

  const db = await supabaseServer();
  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) {
    console.error('Fruit Stand OAuth code exchange failed:', {
      name: error.name,
      message: error.message,
      status: error.status,
      code: error.code,
    });
    return NextResponse.redirect(new URL('/login?error=exchange', url.origin));
  }

  return NextResponse.redirect(new URL('/', url.origin));
}
