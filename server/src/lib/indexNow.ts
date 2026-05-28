import https from 'https';

const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '';
const HOST = 'www.tarmeer.com';
const BASE_URL = `https://${HOST}`;

/**
 * Ping IndexNow API to notify Google + Bing of new/updated URLs.
 * Silently swallows errors — IndexNow is best-effort, not critical.
 */
export async function notifyIndexNow(urlPaths: string[]): Promise<void> {
  if (!INDEXNOW_KEY || urlPaths.length === 0) return;

  const urls = urlPaths.map(p => `${BASE_URL}${p}`);

  const body = JSON.stringify({
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: urls,
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.indexnow.org',
        path: '/indexnow',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume(); // drain
        console.log(`[IndexNow] Pinged ${urls.length} URL(s), status: ${res.statusCode}`);
        resolve();
      }
    );
    req.on('error', (err) => {
      console.warn(`[IndexNow] Error: ${err.message}`);
      resolve(); // silent fail
    });
    req.write(body);
    req.end();
  });
}
