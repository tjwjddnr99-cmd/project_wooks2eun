// Tiny proxy so the browser can read stock prices that block CORS
// (Yahoo Finance, Naver Finance) without hitting cross-origin errors.
// Server-to-server requests aren't subject to CORS, so this just relays.
export default async function handler(req, res) {
  const { kind, id } = req.query;
  if (!kind || !id) {
    res.status(400).json({ error: 'missing kind or id' });
    return;
  }
  try {
    let url;
    if (kind === 'yahoo') {
      url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(id)}`;
    } else if (kind === 'naver') {
      url = `https://polling.finance.naver.com/api/realtime/domestic/stock/${encodeURIComponent(id)}`;
    } else {
      res.status(400).json({ error: 'invalid kind' });
      return;
    }

    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const data = await r.json();

    let price = null;
    if (kind === 'yahoo') {
      price = data?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    } else {
      const raw = data?.datas?.[0]?.closePrice;
      price = raw ? parseFloat(String(raw).replace(/,/g, '')) : null;
    }

    if (price == null) {
      res.status(502).json({ error: 'no price found in upstream response' });
      return;
    }

    res.setHeader('Cache-Control', 's-maxage=60');
    res.status(200).json({ price });
  } catch (e) {
    res.status(500).json({ error: String(e && e.message || e) });
  }
}
