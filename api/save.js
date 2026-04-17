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

// 관리자 전용 키 패턴
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

// 포워더가 본인 키만 쓸 수 있는 패턴 (fw 이름 포함)
const FORWARDER_KEY_PATTERNS = [
  (key, fw) => key === `fw_data_${fw}`,
  (key, fw) => key === `submission_${fw}`,
];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

    const { key, value, token } = body || {};
    if (!key) return res.status(400).json({ error: 'key required' });
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

    // 세션 검증
    const rawSession = await redis.get(`session:${token}`);
    if (!rawSession) return res.status(401).json({ error: '세션이 만료됐습니다.' });
    const session = ensureObject(rawSession) || JSON.parse(rawSession);
    const { role, fw } = session;

    // 권한 체크
    const isAdmin = role === 'admin';
    const isForwarder = role === 'forwarder';

    if (isAdmin) {
      // 관리자는 모든 키 허용
    } else if (isForwarder && fw) {
      // 포워더는 본인 키만 허용
      const allowed = FORWARDER_KEY_PATTERNS.some(fn => fn(key, fw));
      if (!allowed) {
        return res.status(403).json({ error: '접근 권한이 없습니다.' });
      }
      // 관리자 전용 키 접근 차단
      const isAdminKey = ADMIN_ONLY_KEYS.some(pattern => pattern.test(key));
      if (isAdminKey) {
        return res.status(403).json({ error: '관리자 전용 키입니다.' });
      }
    } else {
      return res.status(403).json({ error: '접근 권한이 없습니다.' });
    }

    if (value === null || value === undefined) {
      await redis.del(`bidding:${key}`);
    } else {
      await redis.set(`bidding:${key}`, JSON.stringify(value));
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('save error:', e);
    return res.status(500).json({ error: e.message });
  }
}
