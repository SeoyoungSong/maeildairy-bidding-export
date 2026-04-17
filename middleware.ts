import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: ['/admin', '/admin.html'],
};

export default async function middleware(req: NextRequest) {
  const token = req.cookies.get('admin_token')?.value
    || req.headers.get('x-admin-token')
    || '';

  // 토큰 없으면 로그인 페이지로
  if (!token) {
    return NextResponse.redirect(new URL('/admin-login', req.url));
  }

  // 토큰 검증 (Vercel 내부 API 호출)
  try {
    const verifyRes = await fetch(new URL('/api/verify', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    if (!verifyRes.ok) {
      return NextResponse.redirect(new URL('/admin-login', req.url));
    }

    const data = await verifyRes.json();
    if (data.role !== 'admin') {
      return NextResponse.redirect(new URL('/', req.url));
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/admin-login', req.url));
  }
}
