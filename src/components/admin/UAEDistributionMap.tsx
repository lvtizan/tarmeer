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

// Color intensity based on count
function getHeatColor(ratio: number): string {
  // ratio 0-1, returns warm gold gradient
  const r = Math.round(184 + (255 - 184) * (1 - ratio));
  const g = Math.round(134 * (1 - ratio * 0.5));
  const b = Math.round(74 * (1 - ratio * 0.7));
  return `rgb(${r},${g},${b})`;
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

    const map = L.map(mapRef.current, {
      center: [24.8, 55.0],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: false,
    });

    // OpenStreetMap clean style
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
      minZoom: 6,
    }).addTo(map);

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear all overlays
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Merge company + inquiry data by city
    const cityMap = new Map<string, { companies: number; inquiries: number }>();
    companyCities.forEach(({ city, count }) => {
      const n = normalizeCity(city);
      const entry = cityMap.get(n) || { companies: 0, inquiries: 0 };
      entry.companies += count;
      cityMap.set(n, entry);
    });
    inquiryCities.forEach(({ city, count }) => {
      const n = normalizeCity(city);
      const entry = cityMap.get(n) || { companies: 0, inquiries: 0 };
      entry.inquiries += count;
      cityMap.set(n, entry);
    });

    const maxTotal = Math.max(...Array.from(cityMap.values()).map(v => v.companies + v.inquiries), 1);

    cityMap.forEach((data, cityName) => {
      const coords = CITY_COORDS[cityName];
      if (!coords) return;

      const total = data.companies + data.inquiries;
      const ratio = total / maxTotal;
      const radius = Math.max(12, Math.min(40, Math.sqrt(total) * 8));

      // Outer glow
      L.circleMarker(coords, {
        radius: radius + 6,
        fillColor: '#B8864A',
        color: 'transparent',
        fillOpacity: 0.15,
      }).addTo(map);

      // Main circle
      L.circleMarker(coords, {
        radius,
        fillColor: getHeatColor(ratio),
        color: '#B8864A',
        weight: 2,
        fillOpacity: 0.75,
      })
        .bindTooltip(
          `<div style="font-size:13px;line-height:1.6">
            <b style="font-size:14px">${cityName}</b><br/>
            <span style="color:#B8864A">● 装企: ${data.companies}</span><br/>
            <span style="color:#5b7fcb">● 询盘: ${data.inquiries}</span><br/>
            <span style="color:#888">合计: ${total}</span>
          </div>`,
          { direction: 'top', offset: [0, -radius], className: 'leaflet-tooltip-custom' }
        )
        .addTo(map);

      // City label
      const label = L.divIcon({
        html: `<div style="font-size:11px;font-weight:600;color:#2c2c2c;text-align:center;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 3px #fff;white-space:nowrap">${cityName}<br/><span style="font-size:10px;font-weight:400;color:#6b6b6b">${total}</span></div>`,
        className: '',
        iconSize: [80, 30],
        iconAnchor: [40, -radius - 4],
      });
      L.marker(coords, { icon: label, interactive: false }).addTo(map);
    });
  }, [companyCities, inquiryCities]);

  return (
    <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-medium text-[#2c2c2c]">地区分布</h2>
          <p className="text-xs text-[#6b6b6b] mt-0.5">装企与询盘的城市分布，圆圈越大数量越多</p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#6b6b6b]">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#B8864A]" />
            装企
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#5b7fcb]" />
            询盘
          </span>
        </div>
      </div>
      <div ref={mapRef} className="h-[400px] rounded-xl overflow-hidden border border-stone-100" style={{ background: '#f2efe9' }} />
    </div>
  );
}
