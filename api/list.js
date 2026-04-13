import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prefix } = req.query;
    const pattern = prefix ? `bidding:${prefix}*` : 'bidding:*';
    const keys = await kv.keys(pattern);
    // strip 'bidding:' prefix from keys
    const cleaned = keys.map(k => k.replace(/^bidding:/, ''));
    return res.status(200).json({ keys: cleaned });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
