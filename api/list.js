import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function ensureObject(v) {
  if (!v) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return typeof v === 'object' ? v : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

    // 세션 검증 + 관리자만 허용
    const rawSession = await redis.get(`session:${token}`);
    if (!rawSession) return res.status(401).json({ error: '세션이 만료됐습니다.' });
    const session = ensureObject(rawSession);
    if (session?.role !== 'admin') {
      return res.status(403).json({ error: '관리자만 접근 가능합니다.' });
    }

    const { prefix } = req.query;
    const pattern = prefix ? `bidding:${prefix}*` : 'bidding:*';
    const keys = await redis.keys(pattern);
    const cleaned = keys.map(k => k.replace(/^bidding:/, ''));
    return res.status(200).json({ keys: cleaned });
  } catch (e) {
    console.error('list error:', e);
    return res.status(500).json({ error: e.message });
  }
}
