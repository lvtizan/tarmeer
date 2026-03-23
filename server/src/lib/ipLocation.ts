const UAE_CITY_CN_MAP: Record<string, string> = {
  dubai: '迪拜',
  sharjah: '沙迦',
  'abu dhabi': '阿布扎比',
  ajman: '阿治曼',
  ras: '哈伊马角',
  'ras al khaimah': '哈伊马角',
  fujairah: '富查伊拉',
  umm: '乌姆盖万',
  'umm al quwain': '乌姆盖万',
  alain: '艾因',
  'al ain': '艾因',
};

let ensureIpGeoCacheTablePromise: Promise<void> | null = null;
let cachedPool: { execute: (...args: any[]) => Promise<any> } | null = null;

async function getPool() {
  if (cachedPool) return cachedPool;
  const mod = await import('../config/database');
  cachedPool = mod.default as unknown as { execute: (...args: any[]) => Promise<any> };
  return cachedPool;
}

function normalize(value: string | null | undefined): string {
  return (value || '').trim();
}

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function isPrivateIpv4(ip: string): boolean {
  return /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(ip);
}

function isLocalIpv6(ip: string): boolean {
  const value = ip.toLowerCase();
  return value === '::1' || value.startsWith('fc') || value.startsWith('fd');
}

export function isPublicInternetIp(ip: string): boolean {
  const value = normalize(ip);
  if (!value || value === 'unknown') return false;
  if (value.includes(':')) return !isLocalIpv6(value);
  return !isPrivateIpv4(value);
}

export function buildLocationLabel(input: {
  countryCode?: string | null;
  countryName?: string | null;
  region?: string | null;
  city?: string | null;
}): string | null {
  const countryCode = normalize(input.countryCode).toUpperCase();
  const countryName = normalize(input.countryName);
  const region = normalize(input.region);
  const city = normalize(input.city);

  const isUae =
    countryCode === 'AE' ||
    /united arab emirates|uae|阿联酋/i.test(countryName);

  if (isUae) {
    const cityKey = normalizeKey(city);
    const regionKey = normalizeKey(region);
    const cityCn = UAE_CITY_CN_MAP[cityKey]
      || UAE_CITY_CN_MAP[regionKey]
      || Object.entries(UAE_CITY_CN_MAP).find(([key]) => cityKey.includes(key) || regionKey.includes(key))?.[1];
    if (cityCn) return cityCn;
    if (city) return city;
    if (region) return region;
    return '阿联酋';
  }

  if (city) return city;
  if (region) return region;
  if (countryName) return countryName;
  if (countryCode) return countryCode;
  return null;
}

async function ensureIpGeoCacheTable() {
  if (!ensureIpGeoCacheTablePromise) {
    ensureIpGeoCacheTablePromise = (async () => {
      const pool = await getPool();
      await pool.execute(`CREATE TABLE IF NOT EXISTS visitor_ip_geo_cache (
        ip VARCHAR(64) PRIMARY KEY,
        location_label VARCHAR(255) DEFAULT NULL,
        country_code VARCHAR(8) DEFAULT NULL,
        country_name VARCHAR(128) DEFAULT NULL,
        region_name VARCHAR(128) DEFAULT NULL,
        city_name VARCHAR(128) DEFAULT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    })();
  }
  await ensureIpGeoCacheTablePromise;
}

export async function resolveLocationFromIp(ip: string): Promise<string | null> {
  if (!isPublicInternetIp(ip)) return null;
  await ensureIpGeoCacheTable();
  const pool = await getPool();

  const [cachedRows] = await pool.execute(
    `SELECT location_label
     FROM visitor_ip_geo_cache
     WHERE ip = ? AND updated_at >= (NOW() - INTERVAL 30 DAY)
     LIMIT 1`,
    [ip]
  );
  const cached = (cachedRows as any[])[0];
  if (cached?.location_label) {
    return String(cached.location_label);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;
    const data = await response.json() as any;
    const locationLabel = buildLocationLabel({
      countryCode: data.country_code,
      countryName: data.country_name,
      region: data.region || data.region_code,
      city: data.city,
    });

    await pool.execute(
      `INSERT INTO visitor_ip_geo_cache (ip, location_label, country_code, country_name, region_name, city_name)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         location_label = VALUES(location_label),
         country_code = VALUES(country_code),
         country_name = VALUES(country_name),
         region_name = VALUES(region_name),
         city_name = VALUES(city_name),
         updated_at = CURRENT_TIMESTAMP`,
      [
        ip,
        locationLabel,
        normalize(data.country_code) || null,
        normalize(data.country_name) || null,
        normalize(data.region || data.region_code) || null,
        normalize(data.city) || null,
      ]
    );

    return locationLabel;
  } catch {
    return null;
  }
}
