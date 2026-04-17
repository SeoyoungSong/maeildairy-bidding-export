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


function ensureObject(value) {
  if (!value) return {};
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return {}; }
  }
  if (typeof value === 'object') return value;
  return {};
}

const ADMIN_PW = process.env.ADMIN_PASSWORD;
const DEFAULT_FW_PW = process.env.FW_PASSWORD;

if (!ADMIN_PW) throw new Error('ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 600;

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // body가 string으로 올 수도 있어서 파싱 처리
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    if (!body) body = {};

    const { role, fw, password } = body;
    const ip = req.headers['x-forwarded-for'] || 'unknown';
    const lockKey = `auth_lock:${ip}`;
    const attemptsKey = `auth_attempts:${ip}`;

    const locked = await redis.get(lockKey);
    if (locked) {
      const ttl = await redis.ttl(lockKey);
      return res.status(429).json({ error: `${Math.ceil(ttl)}초 후 다시 시도하세요.`, locked: true });
    }

    let isValid = false;
    if (role === 'admin') {
      isValid = (password === ADMIN_PW);
    } else if (role === 'forwarder' && fw) {
      const cfgPw = await redis.get('bidding:cfg_fw_passwords');
      const passwords = ensureObject(cfgPw);
      const validPw = passwords[fw] || DEFAULT_FW_PW;
      isValid = (password === validPw);
    }

    if (!isValid) {
      const attempts = await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, LOCKOUT_SECONDS);
      if (attempts >= MAX_ATTEMPTS) {
        await redis.set(lockKey, '1', { ex: LOCKOUT_SECONDS });
        await redis.del(attemptsKey);
        return res.status(429).json({ error: `5회 실패. 10분간 잠깁니다.`, locked: true });
      }
      return res.status(401).json({ error: `비밀번호가 올바르지 않습니다. (${MAX_ATTEMPTS - attempts}회 남음)` });
    }

    await redis.del(attemptsKey);
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await redis.set(`session:${token}`, JSON.stringify({ role, fw: fw || null }), { ex: 86400 });

    if (role === 'admin') {
      res.setHeader('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    }

    return res.status(200).json({ ok: true, token, role, fw: fw || null });
  } catch (e) {
    console.error('auth error:', e);
    return res.status(500).json({ error: e.message });
  }
}
