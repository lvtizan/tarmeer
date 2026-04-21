import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// UAE city coordinates
const CITY_COORDS: Record<string, [number, number]> = {
  'Dubai': [25.2048, 55.2708],
  'Abu Dhabi': [24.4539, 54.3773],
  'Sharjah': [25.3463, 55.4209],
  'Ajman': [25.4052, 55.5136],
  'Ras Al Khaimah': [25.7895, 55.9432],
  'Fujairah': [25.1288, 56.3265],
  'Umm Al Quwain': [25.5647, 55.5554],
  'Al Ain': [24.1915, 55.7606],
  'Riyadh': [24.7136, 46.6753],
  'Jeddah': [21.4858, 39.1925],
};

// Normalize city names for matching
function normalizeCity(city: string): string {
  const c = city.trim();
  for (const key of Object.keys(CITY_COORDS)) {
    if (c.toLowerCase() === key.toLowerCase()) return key;
  }
  if (/abu\s*dhabi/i.test(c)) return 'Abu Dhabi';
  if (/ras\s*al/i.test(c)) return 'Ras Al Khaimah';
  if (/umm\s*al/i.test(c)) return 'Umm Al Quwain';
  if (/al\s*ain/i.test(c)) return 'Al Ain';
  return c;
}

interface CityData {
  city: string;
  count: number;
}

interface Props {
  companyCities: CityData[];
  inquiryCities: CityData[];
}

export default function UAEDistributionMap({ companyCities, inquiryCities }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Center on UAE
    const map = L.map(mapRef.current, {
      center: [25.0, 55.2],
      zoom: 7,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 14,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Company markers (gold)
    companyCities.forEach(({ city, count }) => {
      const normalized = normalizeCity(city);
      const coords = CITY_COORDS[normalized];
      if (!coords) return;

      const radius = Math.max(8, Math.min(30, Math.sqrt(count) * 6));
      L.circleMarker(coords, {
        radius,
        fillColor: '#B8864A',
        color: '#8a6535',
        weight: 2,
        fillOpacity: 0.7,
      })
        .bindTooltip(`<b>${normalized}</b><br/>装企: ${count}`, { direction: 'top' })
        .addTo(map);
    });

    // Inquiry markers (blue, offset slightly to not overlap)
    inquiryCities.forEach(({ city, count }) => {
      const normalized = normalizeCity(city);
      const coords = CITY_COORDS[normalized];
      if (!coords) return;

      const radius = Math.max(6, Math.min(25, Math.sqrt(count) * 4));
      const offset: [number, number] = [coords[0] + 0.08, coords[1] + 0.08];
      L.circleMarker(offset, {
        radius,
        fillColor: '#5b7fcb',
        color: '#3d5a9e',
        weight: 2,
        fillOpacity: 0.6,
      })
        .bindTooltip(`<b>${normalized}</b><br/>询盘: ${count}`, { direction: 'top' })
        .addTo(map);
    });
  }, [companyCities, inquiryCities]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-[#6b6b6b]">地区分布</h2>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#B8864A]" />
            装企
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#5b7fcb]" />
            询盘
          </span>
        </div>
      </div>
      <div ref={mapRef} className="h-[360px] rounded-xl overflow-hidden" />
    </div>
  );
}
