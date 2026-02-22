// Vercel Serverless Function — proxies landing page data to Google Apps Script
// This avoids CORS issues on mobile browsers (Safari ITP, Brave, Chrome)
//
// Google Apps Script redirect chain:
//   1. script.google.com/macros/s/.../exec → 302 to script.googleusercontent.com
//   2. script.googleusercontent.com → executes the script, returns response
//
// Problem: Node.js fetch with redirect:'follow' ends up at Google Sign-In page
// because Google checks cookies during the redirect chain.
//
// Solution: Use https module to manually follow the redirect chain,
// sending browser-like headers so Google recognizes it as a valid request.

const https = require('https');
const url = require('url');

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzJ_l9Icvc_oWiJ2a8IF9o2B_9Y9EfUmz5oXPN3EkwZKHN1ELWitTA3QFNzHiDiQRTE/exec';

function httpsGet(targetUrl, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;

  return new Promise(function(resolve, reject) {
    var parsed = new URL(targetUrl);

    var options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      }
    };

    var req = https.request(options, function(response) {
      // Handle redirects manually
      if ((response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) && response.headers.location) {
        if (maxRedirects <= 0) {
          reject(new Error('Too many redirects'));
          return;
        }

        var redirectUrl = response.headers.location;
        // Handle relative redirects
        if (redirectUrl.startsWith('/')) {
          redirectUrl = parsed.protocol + '//' + parsed.hostname + redirectUrl;
        }

        console.log('Redirect ' + response.statusCode + ' to:', redirectUrl.substring(0, 150));

        // Follow the redirect
        httpsGet(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }

      // Collect response body
      var body = '';
      response.on('data', function(chunk) { body += chunk; });
      response.on('end', function() {
        resolve({
          statusCode: response.statusCode,
          headers: response.headers,
          body: body
        });
      });
    });

    req.on('error', function(err) { reject(err); });
    req.setTimeout(10000, function() {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

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
    var payload = req.body;

    if (!payload || !payload.action) {
      return res.status(400).json({ error: 'Missing payload or action' });
    }

    // Forward to Google Apps Script as GET with payload in query string
    var payloadStr = JSON.stringify(payload);
    var targetUrl = GOOGLE_SCRIPT_URL + '?payload=' + encodeURIComponent(payloadStr);

    console.log('Sending to Google Script, payload action:', payload.action);

    var response = await httpsGet(targetUrl);

    console.log('Final response status:', response.statusCode);
    console.log('Final response body:', response.body.substring(0, 500));

    // Try to parse as JSON
    var result;
    try {
      result = JSON.parse(response.body);
    } catch (parseErr) {
      // Check if it's a Google Sign-In page (error case)
      if (response.body.indexOf('accounts.google.com') !== -1 || response.body.indexOf('signin') !== -1) {
        console.error('ERROR: Got Google Sign-In page instead of script response');
        result = {
          status: 'error',
          message: 'Google Apps Script returned sign-in page. Check deployment settings: must be "Anyone" access.',
          httpStatus: response.statusCode
        };
      } else {
        result = {
          status: 'forwarded',
          httpStatus: response.statusCode,
          message: 'Request forwarded to Google Apps Script'
        };
      }
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
