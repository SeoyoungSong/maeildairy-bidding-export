import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    return res.status(200).end();
  }

  // 쿠키에서 admin_token 읽기
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent))
  );
  const token = cookies['admin_token'];

  if (!token) {
    return res.status(401).json({ ok: false, error: 'No token' });
  }

  try {
    const session = await redis.get(`session:${token}`);
    if (!session) {
      return res.status(401).json({ ok: false, error: 'Invalid session' });
    }
    const data = JSON.parse(session);
    if (data.role !== 'admin') {
      return res.status(403).json({ ok: false, error: 'Not admin' });
    }
    // 세션 갱신
    await redis.expire(`session:${token}`, 86400);
    return res.status(200).json({ ok: true, role: 'admin' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
