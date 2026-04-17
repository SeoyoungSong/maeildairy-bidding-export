import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://maeildairy-bidding-export.vercel.app';

function setCors(req, res) {
  const origin = req.headers.origin || '';
  if (origin === ALLOWED_ORIGIN || origin.endsWith('.vercel.app')) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}


function ensureObject(v) {
  if (!v) return null;
  if (typeof v === 'string') { try { return JSON.parse(v); } catch { return null; } }
  return typeof v === 'object' ? v : null;
}

// 관리자 전용 키
const ADMIN_ONLY_KEYS = [
  /^cfg_forwarders$/,
  /^cfg_routes$/,
  /^cfg_basic$/,
  /^cfg_fw_passwords$/,
  /^cfg_worksites$/,
  /^selected_fw$/,
  /^bidding_status$/,
  /^eval_scores$/,
];

// 포워더가 읽을 수 있는 키 패턴
const FORWARDER_READ_PATTERNS = [
  (key, fw) => key === `fw_data_${fw}`,
  (key, fw) => key === `submission_${fw}`,
  (key)     => key === 'bidding_status', // 마감 여부는 포워더도 읽어야 함
];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    // GET: ?key=xxx&token=xxx 또는 POST: { key, token }
    let key, token;
    if (req.method === 'GET') {
      key = req.query.key;
      token = req.query.token || req.headers['authorization']?.replace('Bearer ', '');
    } else if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
      key = body.key;
      token = body.token;
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!key) return res.status(400).json({ error: 'key required' });
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

    // 세션 검증
    const rawSession = await redis.get(`session:${token}`);
    if (!rawSession) return res.status(401).json({ error: '세션이 만료됐습니다.' });
    const session = typeof rawSession === 'string'
      ? JSON.parse(rawSession)
      : rawSession;
    if (!session || !session.role) return res.status(401).json({ error: '세션 오류' });
    const { role, fw } = session;

    // 권한 체크
    if (role === 'admin') {
      // 관리자는 모든 키 읽기 허용
    } else if (role === 'forwarder' && fw) {
      const allowed = FORWARDER_READ_PATTERNS.some(fn => fn(key, fw));
      if (!allowed) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
    } else {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    const raw = await redis.get(`bidding:${key}`);
    if (raw === null) return res.status(200).json({ value: null });
    const value = ensureObject(raw) ?? raw;
    return res.status(200).json({ value });
  } catch (e) {
    console.error('load error:', e);
    return res.status(500).json({ error: e.message });
  }
}
