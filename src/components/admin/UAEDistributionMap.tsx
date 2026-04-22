import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const CITY_COORDS: Record<string, [number, number]> = {
  'Dubai': [25.2048, 55.2708],
  'Abu Dhabi': [24.4539, 54.3773],
  'Sharjah': [25.3463, 55.4209],
  'Ajman': [25.4052, 55.5136],
  'Ras Al Khaimah': [25.7895, 55.9432],
  'Fujairah': [25.1288, 56.3265],
  'Umm Al Quwain': [25.5647, 55.5554],
  'Al Ain': [24.1915, 55.7606],
};

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

interface CityData { city: string; count: number }
interface Props { companyCities: CityData[]; inquiryCities: CityData[] }

export default function UAEDistributionMap({ companyCities, inquiryCities }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [24.8, 55.0],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
    });

    // Light grey no-label tile (matches the screenshot style)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
      minZoom: 5,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear overlays
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) map.removeLayer(layer);
    });

    // Merge data by city
    const cityMap = new Map<string, { companies: number; inquiries: number }>();
    companyCities.forEach(({ city, count }) => {
      const n = normalizeCity(city);
      const e = cityMap.get(n) || { companies: 0, inquiries: 0 };
      e.companies += count;
      cityMap.set(n, e);
    });
    inquiryCities.forEach(({ city, count }) => {
      const n = normalizeCity(city);
      const e = cityMap.get(n) || { companies: 0, inquiries: 0 };
      e.inquiries += count;
      cityMap.set(n, e);
    });

    const maxTotal = Math.max(...Array.from(cityMap.values()).map(v => v.companies + v.inquiries), 1);

    cityMap.forEach((data, cityName) => {
      const coords = CITY_COORDS[cityName];
      if (!coords) return;

      const total = data.companies + data.inquiries;
      const radius = Math.max(10, Math.min(45, Math.sqrt(total / maxTotal) * 45));

      // Outer glow — large, very transparent
      L.circleMarker(coords, {
        radius: radius * 1.4,
        fillColor: '#B8864A',
        color: 'transparent',
        fillOpacity: 0.12,
      }).addTo(map);

      // Main bubble — semi-transparent gold
      L.circleMarker(coords, {
        radius,
        fillColor: '#D4A76A',
        color: '#B8864A',
        weight: 1.5,
        fillOpacity: 0.55,
      })
        .bindTooltip(
          `<div style="font-size:13px;line-height:1.5;min-width:100px">
            <div style="font-weight:700;font-size:14px;margin-bottom:2px">${cityName}</div>
            <div style="color:#B8864A">装企 ${data.companies}</div>
            <div style="color:#5b7fcb">询盘 ${data.inquiries}</div>
          </div>`,
          { direction: 'top', offset: [0, -radius] }
        )
        .addTo(map);
    });
  }, [companyCities, inquiryCities]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <span className="text-sm font-medium text-[#2c2c2c]">地区分布</span>
        <div className="flex items-center gap-3 text-xs text-[#6b6b6b]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8864A]" /> 装企
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5b7fcb]" /> 询盘
          </span>
        </div>
      </div>
      <div ref={mapRef} className="h-[380px]" style={{ background: '#eae6e1' }} />
    </div>
  );
}
