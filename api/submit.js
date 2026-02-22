// Vercel Serverless Function — secure proxy to Google Apps Script
// Security layers:
//   1. Cloudflare Turnstile verification (bot protection) — landing page only
//   2. In-memory rate limiting per IP (10 requests per minute)
//   3. Input validation (email format, field lengths, allowed values)
//   4. Duplicate prevention (submission_id)
//   5. No PII in logs

const https = require('https');

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzRJpFmaVAu3a37W-wYlZUt7W5QA7_VLq37P5XyFucNN-EWOJW43ovxrsDx5poYPayY/exec';

// Turnstile secret key — set as Vercel environment variable
// Get yours at: https://dash.cloudflare.com → Turnstile → Add site
const TURNSTILE_SECRET = process.env.TURNSTILE_SECRET_KEY || '';

// --- RATE LIMITING (in-memory, per serverless instance) ---
// Note: Vercel serverless functions can have multiple instances,
// so this is approximate. For stricter limits, use Upstash Redis.
var rateLimitMap = {};
var RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
var RATE_LIMIT_MAX = 10; // max requests per IP per minute

function checkRateLimit(ip) {
  var now = Date.now();
  if (!rateLimitMap[ip]) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    return true;
  }
  if (now > rateLimitMap[ip].resetAt) {
    rateLimitMap[ip] = { count: 1, resetAt: now + RATE_LIMIT_WINDOW };
    return true;
  }
  rateLimitMap[ip].count++;
  return rateLimitMap[ip].count <= RATE_LIMIT_MAX;
}

// Clean up stale entries every 5 minutes
setInterval(function() {
  var now = Date.now();
  Object.keys(rateLimitMap).forEach(function(ip) {
    if (now > rateLimitMap[ip].resetAt) delete rateLimitMap[ip];
  });
}, 5 * 60 * 1000);

// --- DUPLICATE PREVENTION (in-memory, recent submission IDs) ---
var recentSubmissions = {};
var DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

function isDuplicate(id) {
  if (!id) return false; // no ID = can't check
  var now = Date.now();
  // Clean old entries
  Object.keys(recentSubmissions).forEach(function(key) {
    if (now - recentSubmissions[key] > DEDUP_WINDOW) delete recentSubmissions[key];
  });
  if (recentSubmissions[id]) return true;
  recentSubmissions[id] = now;
  return false;
}

// --- TURNSTILE VERIFICATION ---
function verifyTurnstile(token, ip) {
  return new Promise(function(resolve, reject) {
    if (!TURNSTILE_SECRET) {
      // If no secret configured, skip verification (dev mode)
      console.log('TURNSTILE_SECRET not set — skipping verification');
      resolve({ success: true });
      return;
    }

    var postData = 'secret=' + encodeURIComponent(TURNSTILE_SECRET) +
      '&response=' + encodeURIComponent(token);
    if (ip) postData += '&remoteip=' + encodeURIComponent(ip);

    var options = {
      hostname: 'challenges.cloudflare.com',
      path: '/turnstile/v0/siteverify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ success: false, error: 'parse_error' });
        }
      });
    });
    req.on('error', function(err) { resolve({ success: false, error: err.message }); });
    req.setTimeout(5000, function() { req.destroy(); resolve({ success: false, error: 'timeout' }); });
    req.write(postData);
    req.end();
  });
}

// --- INPUT VALIDATION ---
function validateLandingPayload(payload) {
  var errors = [];
  if (!payload.email || typeof payload.email !== 'string') errors.push('missing email');
  else if (payload.email.length > 254) errors.push('email too long');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) errors.push('invalid email format');

  // Limit string field lengths (anti mega-payload)
  var stringFields = ['source', 'landing_url', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  stringFields.forEach(function(field) {
    if (payload[field] && typeof payload[field] === 'string' && payload[field].length > 500) {
      errors.push(field + ' too long');
    }
  });
  return errors;
}

function validateScorecardPayload(payload) {
  var errors = [];
  // Email (optional on scorecard but validate if present)
  if (payload.email && typeof payload.email === 'string' && payload.email.length > 254) errors.push('email too long');

  // Score must be a number 0-100
  if (payload.exit_score !== undefined) {
    var score = Number(payload.exit_score);
    if (isNaN(score) || score < 0 || score > 100) errors.push('invalid score');
  }

  // Pillar scores: 0-20
  ['pillar_revenue', 'pillar_moat', 'pillar_economics', 'pillar_leverage', 'pillar_governance'].forEach(function(field) {
    if (payload[field] !== undefined) {
      var val = Number(payload[field]);
      if (isNaN(val) || val < 0 || val > 20) errors.push('invalid ' + field);
    }
  });

  // Segment must be one of known values
  var validSegments = ['A', 'B', 'C', 'D', 'F'];
  if (payload.segment && validSegments.indexOf(payload.segment) === -1) errors.push('invalid segment');

  // String field length limits
  var stringFields = ['company', 'industry', 'role', 'revenue', 'exitHorizon', 'assessor', 'rating'];
  stringFields.forEach(function(field) {
    if (payload[field] && typeof payload[field] === 'string' && payload[field].length > 300) {
      errors.push(field + ' too long');
    }
  });

  return errors;
}

// --- HTTPS GET with manual redirect following ---
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
      if ((response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) && response.headers.location) {
        if (maxRedirects <= 0) { reject(new Error('Too many redirects')); return; }
        var redirectUrl = response.headers.location;
        if (redirectUrl.startsWith('/')) redirectUrl = parsed.protocol + '//' + parsed.hostname + redirectUrl;
        httpsGet(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
        return;
      }
      var body = '';
      response.on('data', function(chunk) { body += chunk; });
      response.on('end', function() {
        resolve({ statusCode: response.statusCode, body: body });
      });
    });
    req.on('error', function(err) { reject(err); });
    req.setTimeout(10000, function() { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}

// --- MAIN HANDLER ---
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get client IP
  var ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

  // 1. Rate limiting
  if (!checkRateLimit(ip)) {
    console.log('Rate limited:', ip.substring(0, 10) + '...');
    return res.status(429).json({ error: 'Too many requests. Please try again later.' });
  }

  try {
    var payload = req.body;
    if (!payload || !payload.action) {
      return res.status(400).json({ error: 'Missing payload or action' });
    }

    // 2. Duplicate check
    if (payload.submission_id && isDuplicate(payload.submission_id)) {
      return res.status(200).json({ status: 'duplicate', message: 'Already processed' });
    }

    // 3. Input validation
    var validationErrors = [];
    if (payload.action === 'landing') {
      validationErrors = validateLandingPayload(payload);
    } else if (payload.action === 'scorecard') {
      validationErrors = validateScorecardPayload(payload);
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: validationErrors });
    }

    // 4. Turnstile verification (landing page only — scorecard has no widget)
    if (payload.action === 'landing' && TURNSTILE_SECRET) {
      var turnstileResult = await verifyTurnstile(payload.turnstileToken || '', ip);
      if (!turnstileResult.success) {
        console.log('Turnstile failed for action:', payload.action);
        return res.status(403).json({ error: 'Bot verification failed. Please try again.' });
      }
    }

    // 5. Strip the turnstile token before forwarding (don't send to Google Sheets)
    delete payload.turnstileToken;

    // 6. Forward to Google Apps Script
    var payloadStr = JSON.stringify(payload);
    var targetUrl = GOOGLE_SCRIPT_URL + '?payload=' + encodeURIComponent(payloadStr);

    // Log only action type, no PII
    console.log('Forwarding:', payload.action, '| IP:', ip.substring(0, 10) + '...');

    var response = await httpsGet(targetUrl);

    var result;
    try {
      result = JSON.parse(response.body);
    } catch (parseErr) {
      if (response.body.indexOf('accounts.google.com') !== -1) {
        console.error('ERROR: Google Sign-In page returned. Check Apps Script deployment: must be "Anyone" access.');
        result = { status: 'error', message: 'Configuration error' };
      } else {
        result = { status: 'forwarded', httpStatus: response.statusCode };
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    // Log error without PII
    console.error('Proxy error:', error.message);
    return res.status(500).json({ error: 'Server error' });
  }
};
