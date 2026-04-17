import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { token } = req.body;
    if (!token) return res.status(401).json({ error: 'No token' });

    const session = await redis.get(`session:${token}`);
    if (!session) return res.status(401).json({ error: 'Invalid or expired session' });

    const data = JSON.parse(session);
    // 세션 갱신 (24시간 연장)
    await redis.expire(`session:${token}`, 86400);
    return res.status(200).json({ ok: true, ...data });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
