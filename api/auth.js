import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

// 서버에만 존재하는 비밀번호 (클라이언트 코드에 절대 노출 안 됨)
const ADMIN_PW = process.env.ADMIN_PASSWORD || 'maeil2026!';
const DEFAULT_FW_PW = process.env.FW_PASSWORD || 'bidding2026';

// 로그인 실패 횟수 추적 (IP 기반)
const MAX_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 600; // 10분

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { role, fw, password } = req.body;
    const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
    const lockKey = `auth_lock:${ip}`;
    const attemptsKey = `auth_attempts:${ip}`;

    // 잠금 상태 확인
    const locked = await redis.get(lockKey);
    if (locked) {
      const ttl = await redis.ttl(lockKey);
      return res.status(429).json({ 
        error: `로그인 시도가 너무 많습니다. ${Math.ceil(ttl)}초 후 다시 시도하세요.`,
        locked: true
      });
    }

    let isValid = false;

    if (role === 'admin') {
      isValid = (password === ADMIN_PW);
    } else if (role === 'forwarder' && fw) {
      // 포워더별 개별 비밀번호 확인 (Redis에서)
      const cfgPw = await redis.get('bidding:cfg_fw_passwords');
      const passwords = cfgPw ? JSON.parse(cfgPw) : {};
      const validPw = passwords[fw] || DEFAULT_FW_PW;
      isValid = (password === validPw);
    }

    if (!isValid) {
      // 실패 횟수 증가
      const attempts = await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, LOCKOUT_SECONDS);
      
      if (attempts >= MAX_ATTEMPTS) {
        await redis.set(lockKey, '1', { ex: LOCKOUT_SECONDS });
        await redis.del(attemptsKey);
        return res.status(429).json({ 
          error: `${MAX_ATTEMPTS}회 실패. ${LOCKOUT_SECONDS/60}분간 로그인이 잠깁니다.`,
          locked: true
        });
      }
      
      const remaining = MAX_ATTEMPTS - attempts;
      return res.status(401).json({ 
        error: `비밀번호가 올바르지 않습니다. (${remaining}회 남음)`,
        attempts
      });
    }

    // 성공: 실패 카운트 초기화, 세션 토큰 발급
    await redis.del(attemptsKey);
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const sessionKey = `session:${token}`;
    await redis.set(sessionKey, JSON.stringify({ role, fw: fw || null }), { ex: 86400 }); // 24시간

    return res.status(200).json({ ok: true, token, role, fw: fw || null });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
