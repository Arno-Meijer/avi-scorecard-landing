// Vercel Serverless Function — proxies landing page data to Google Apps Script
// This avoids CORS issues on mobile browsers (Safari ITP, Brave, Chrome)

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJ_l9Icvc_oWiJ2a8IF9o2B_9Y9EfUmz5oXPN3EkwZKHN1ELWitTA3QFNzHiDiQRTE/exec';

export default async function handler(req, res) {
  // Allow POST only
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers (same-origin calls don't need these, but just in case)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const payload = req.body;

    if (!payload || !payload.action) {
      return res.status(400).json({ error: 'Missing payload or action' });
    }

    // Forward to Google Apps Script as POST with JSON body
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    // Google Apps Script returns JSON on success
    let result;
    try {
      result = await response.json();
    } catch {
      result = { status: 'success', message: 'Data forwarded' };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Failed to forward data' });
  }
}
