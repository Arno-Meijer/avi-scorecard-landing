// Vercel Serverless Function — proxies landing page data to Google Apps Script
// This avoids CORS issues on mobile browsers (Safari ITP, Brave, Chrome)
//
// Why GET instead of POST? Google Apps Script returns a 302 redirect on all
// requests. Per HTTP spec, a 302 redirect changes POST→GET and drops the body.
// By sending as GET with ?payload=... we avoid this entirely.

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJ_l9Icvc_oWiJ2a8IF9o2B_9Y9EfUmz5oXPN3EkwZKHN1ELWitTA3QFNzHiDiQRTE/exec';

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const payload = req.body;

    if (!payload || !payload.action) {
      return res.status(400).json({ error: 'Missing payload or action' });
    }

    // Forward to Google Apps Script as GET with payload in query string
    // This survives the 302 redirect that Google Apps Script always returns
    const payloadStr = JSON.stringify(payload);
    const url = GOOGLE_SCRIPT_URL + '?payload=' + encodeURIComponent(payloadStr);

    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'VercelProxy/1.0'
      }
    });

    // Log for debugging (visible in Vercel function logs)
    const text = await response.text();
    console.log('Google Script response status:', response.status);
    console.log('Google Script response body:', text.substring(0, 500));

    // Try to parse as JSON
    let result;
    try {
      result = JSON.parse(text);
    } catch (parseErr) {
      // Google Apps Script sometimes returns HTML wrapper — data is still saved
      result = {
        status: 'forwarded',
        httpStatus: response.status,
        message: 'Request forwarded to Google Apps Script'
      };
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Proxy error:', error.message, error.stack);
    return res.status(500).json({
      error: 'Failed to forward data',
      detail: error.message
    });
  }
};
