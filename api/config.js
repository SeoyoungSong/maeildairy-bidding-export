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
  if (!value) return null;
  if (typeof value === 'string') { try { return JSON.parse(value); } catch { return null; } }
  if (typeof value === 'object') return value;
  return null;
}

// 기본 노선 데이터 (Redis에 없을 때만 사용)
const DEFAULT_ROUTES = [
  {no:1,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'상해',ctnr:'20DRY'},
  {no:2,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'상해',ctnr:'40DRY'},
  {no:3,nation:'중국',site:'도곡',port_o:'인천(경인)',port_i:'상해',ctnr:'40RF'},
  {no:4,nation:'중국',site:'도곡',port_o:'평택',port_i:'상해',ctnr:'40RF'},
  {no:5,nation:'중국',site:'도곡',port_o:'인천(경인)',port_i:'천진',ctnr:'40RF'},
  {no:6,nation:'중국',site:'도곡',port_o:'인천(경인)',port_i:'심천',ctnr:'40RF'},
  {no:7,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'닝보',ctnr:'20DRY'},
  {no:8,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'닝보',ctnr:'40DRY'},
  {no:9,nation:'중국',site:'켄달',port_o:'평택',port_i:'닝보',ctnr:'20DRY'},
  {no:10,nation:'중국',site:'켄달',port_o:'평택',port_i:'닝보',ctnr:'40DRY'},
  {no:11,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'심양',ctnr:'20DRY'},
  {no:12,nation:'중국',site:'켄달',port_o:'인천(경인)',port_i:'심양',ctnr:'40DRY'},
  {no:13,nation:'중국',site:'도곡',port_o:'인천(경인)',port_i:'청도',ctnr:'20RF'},
  {no:14,nation:'중국',site:'도곡',port_o:'인천(경인)',port_i:'청도',ctnr:'40RF'},
  {no:15,nation:'대만',site:'켄달',port_o:'인천(경인)',port_i:'타이중',ctnr:'20DRY'},
  {no:16,nation:'대만',site:'켄달',port_o:'인천(경인)',port_i:'타이중',ctnr:'40DRY'},
  {no:17,nation:'미국',site:'경산/우성',port_o:'부산',port_i:'LA',ctnr:'40RF'},
  {no:18,nation:'미국',site:'도곡',port_o:'부산',port_i:'LA',ctnr:'40RF'},
  {no:19,nation:'미국',site:'경산/우성',port_o:'부산',port_i:'NY',ctnr:'40RF'},
  {no:20,nation:'미국',site:'도곡',port_o:'부산',port_i:'NY',ctnr:'40RF'},
  {no:21,nation:'싱가폴',site:'켄달',port_o:'부산',port_i:'싱가폴',ctnr:'20DRY'},
  {no:22,nation:'싱가폴',site:'켄달',port_o:'부산',port_i:'싱가폴',ctnr:'40DRY'},
  {no:23,nation:'싱가폴',site:'도곡',port_o:'부산',port_i:'싱가폴',ctnr:'20RF'},
  {no:24,nation:'싱가폴',site:'도곡',port_o:'부산',port_i:'싱가폴',ctnr:'40RF'},
  {no:25,nation:'싱가폴',site:'도곡',port_o:'인천',port_i:'싱가폴',ctnr:'20RF'},
  {no:26,nation:'싱가폴',site:'도곡',port_o:'인천',port_i:'싱가폴',ctnr:'40RF'},
  {no:27,nation:'말레이시아',site:'도곡',port_o:'부산',port_i:'포트켈랑(W)',ctnr:'20DRY'},
  {no:28,nation:'말레이시아',site:'도곡',port_o:'부산',port_i:'포트켈랑(W)',ctnr:'40DRY'},
  {no:29,nation:'홍콩',site:'경산/우성',port_o:'부산',port_i:'홍콩',ctnr:'20RF'},
  {no:30,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:31,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:32,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:33,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:34,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:35,nation:'',site:'',port_o:'',port_i:'',ctnr:''},
  {no:36,nation:'국내',site:'경산/우성',port_o:'부산',port_i:'국내',ctnr:'20RF'},
  {no:37,nation:'국내',site:'경산/우성',port_o:'부산',port_i:'국내',ctnr:'40RF'},
  {no:38,nation:'국내',site:'도곡',port_o:'부산',port_i:'국내',ctnr:'20RF'},
  {no:39,nation:'국내',site:'도곡',port_o:'부산',port_i:'국내',ctnr:'40RF'},
  {no:40,nation:'국내',site:'도곡',port_o:'인천',port_i:'국내',ctnr:'20RF'},
  {no:41,nation:'국내',site:'도곡',port_o:'인천',port_i:'국내',ctnr:'40RF'},
  {no:42,nation:'국내',site:'켄달',port_o:'부산',port_i:'국내',ctnr:'20DRY'},
  {no:43,nation:'국내',site:'켄달',port_o:'부산',port_i:'국내',ctnr:'40DRY'},
  {no:44,nation:'국내',site:'켄달',port_o:'인천',port_i:'국내',ctnr:'20DRY'},
  {no:45,nation:'국내',site:'켄달',port_o:'인천',port_i:'국내',ctnr:'40DRY'},
];

const DEFAULT_FORWARDERS = ['람세스','원스탑','판토스','태웅','JPI','솔트랜스','오리엔트'];

const DEFAULT_WORKSITES = [
  { name: '켄달', addr: '경기도 평택시 포승읍 평택항로 6 켄달스퀘어물류센터' },
  { name: '도곡', addr: '경기도 안성시 양성면 도곡리 40-6 (양성로 376-92) 지하 2층' },
  { name: '경산', addr: '경북 경산시 진량읍 대학로 1090 매일유업 경산공장' },
  { name: '우성월드', addr: '경상북도 영천시 대창면 금박로 945' },
];

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 토큰 검증 필수
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { token } = body || {};
    if (!token) return res.status(401).json({ error: '인증이 필요합니다.' });

    const rawSession = await redis.get(`session:${token}`);
    if (!rawSession) return res.status(401).json({ error: '세션이 만료됐습니다. 다시 로그인해주세요.' });
    const session = typeof rawSession === 'string' ? JSON.parse(rawSession) : rawSession;
    if (!session || !session.role) return res.status(401).json({ error: '세션 오류' });

    // Redis에서 설정 로드
    const [rawRoutes, rawForwarders, rawWorksites, rawBasic] = await Promise.all([
      redis.get('bidding:cfg_routes'),
      redis.get('bidding:cfg_forwarders'),
      redis.get('bidding:cfg_worksites'),
      redis.get('bidding:cfg_basic'),
    ]);

    const routes     = ensureObject(rawRoutes)     || DEFAULT_ROUTES;
    const forwarders = ensureObject(rawForwarders) || DEFAULT_FORWARDERS;
    const worksites  = ensureObject(rawWorksites)  || DEFAULT_WORKSITES;
    const basic      = ensureObject(rawBasic)      || {};

    return res.status(200).json({ routes, forwarders, worksites, basic });
  } catch (e) {
    console.error('config error:', e);
    return res.status(500).json({ error: e.message });
  }
}
