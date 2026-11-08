import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const envFile = await readFile(path.join(rootDir, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch {}

const port = Number(process.env.GEMINI_PROXY_PORT || 5001);
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const allowedOrigins = new Set([allowedOrigin, 'http://127.0.0.1:5173']);
const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const requestsByIp = new Map();
const RATE_LIMIT = 12;
const WINDOW_MS = 60_000;
const MAX_BODY_BYTES = 40_000;

function sendJson(response, status, payload, origin) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : allowedOrigin,
    'Vary': 'Origin',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Request body is too large.'), { statusCode: 413 }));
        request.destroy();
      }
    });
    request.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('Request must contain valid JSON.'), { statusCode: 400 })); }
    });
    request.on('error', reject);
  });
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    });
    response.end();
    return;
  }

  if (request.method !== 'POST' || request.url !== '/api/reviews/analyze') {
    sendJson(response, 404, { error: 'Route not found.' }, origin);
    return;
  }
  if (origin && !allowedOrigins.has(origin)) {
    sendJson(response, 403, { error: 'Origin is not allowed.' }, origin);
    return;
  }

  const now = Date.now();
  const ip = request.socket.remoteAddress || 'unknown';
  const recent = (requestsByIp.get(ip) || []).filter(time => now - time < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) {
    sendJson(response, 429, { error: 'Analysis limit reached. Try again in a minute.' }, origin);
    return;
  }
  requestsByIp.set(ip, [...recent, now]);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    sendJson(response, 503, { error: 'Gemini is not configured. Add GEMINI_API_KEY to the local .env file and restart the AI server.' }, origin);
    return;
  }

  try {
    const body = await readRequestBody(request);
    if (!Array.isArray(body.reviews) || body.reviews.length === 0 || body.reviews.length > 50) {
      sendJson(response, 400, { error: 'Provide between 1 and 50 reviews to analyze.' }, origin);
      return;
    }
    const normalizedReviews = body.reviews.map((review, index) => ({
      product: String(review.product || 'Product').slice(0, 120),
      rating: Math.min(5, Math.max(1, Number(review.rating) || 1)),
      comment: String(review.comment || '').slice(0, 600),
      verifiedPurchase: Boolean(review.verifiedPurchase),
      reviewNumber: index + 1,
    })).filter(review => review.comment.trim());
    if (!normalizedReviews.length) {
      sendJson(response, 400, { error: 'The selected reviews do not contain comments to analyze.' }, origin);
      return;
    }

    const productInfo = body.productTitle || (normalizedReviews[0] && normalizedReviews[0].product) || 'this product';
    const prompt = [
      `You are summarizing customer reviews for "${productInfo}".`,
      'Write a clear, concise 2-3 sentence summary focusing directly on what customers experienced and reported in their actual reviews.',
      'Highlight what users praised most about this product and any specific observations or concerns they reported.',
      'Ground every statement strictly in the provided review comments.',
      JSON.stringify(normalizedReviews),
    ].join('\n\n');
    const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
          thinkingConfig: {
            thinkingLevel: 'low',
          },
        },
      }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const upstreamStatus = geminiResponse.status;
      const upstreamMessage = result.error?.message || 'No error details returned.';
      console.error(`Gemini API returned ${upstreamStatus}: ${upstreamMessage}`);

      let status = 502;
      let message = 'Gemini could not analyze these reviews. Check the AI server terminal for the Gemini API error.';
      if (upstreamStatus === 401 || upstreamStatus === 403) {
        message = 'Gemini rejected the API key. Check that it is valid, has Gemini API access, and is not restricted from this server.';
      } else if (upstreamStatus === 404) {
        message = `The configured Gemini model "${model}" is unavailable or retired by Google. (${upstreamMessage}) Check GEMINI_MODEL in .env.`;
      } else if (upstreamStatus === 429) {
        status = 429;
        message = 'Gemini free-tier quota is temporarily exhausted. Try again later or check the project quota.';
      } else if (upstreamStatus === 503) {
        status = 503;
        message = `Gemini model "${model}" is experiencing high demand. Please try again shortly or switch GEMINI_MODEL in .env.`;
      } else if (upstreamStatus === 400) {
        message = `Gemini rejected the analysis request: ${upstreamMessage}`;
      }
      sendJson(response, status, { error: message }, origin);
      return;
    }
    const analysis = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!analysis) {
      sendJson(response, 502, { error: 'Gemini returned an empty analysis. Please try again.' }, origin);
      return;
    }
    sendJson(response, 200, { analysis, model, reviewCount: normalizedReviews.length }, origin);
  } catch (error) {
    const status = error.statusCode || (error.name === 'TimeoutError' ? 504 : 500);
    sendJson(response, status, { error: error.name === 'TimeoutError' ? 'Gemini timed out. Please try again.' : error.message || 'Review analysis failed.' }, origin);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Gemini review analysis server listening at http://localhost:${port}`);
});
