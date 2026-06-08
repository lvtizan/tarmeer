'use client';

import { useEffect, useRef, useState } from 'react';
import { X, MapPin } from 'lucide-react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';

export interface PinResult {
  address: string;
  lat: number;
  lng: number;
}

interface MapPinModalProps {
  initialAddress?: string;
  onConfirm: (result: PinResult) => void;
  onClose: () => void;
}

export default function MapPinModal({ initialAddress = '', onConfirm, onClose }: MapPinModalProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const [address, setAddress] = useState(initialAddress);
  const [pinResult, setPinResult] = useState<PinResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!;

    async function initMap() {
      try {
        setOptions({ key: apiKey, v: 'weekly', libraries: ['places', 'marker', 'geocoding'] });

        const { Map } = await importLibrary('maps');
        const { AdvancedMarkerElement } = await importLibrary('marker');
        const { Autocomplete } = await importLibrary('places');

        if (!mapRef.current) return;

        const defaultCenter = { lat: 25.2048, lng: 55.2708 }; // Dubai
        const map = new Map(mapRef.current, {
          center: defaultCenter,
          zoom: 12,
          mapId: 'tarmeer-field-survey',
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        const marker = new AdvancedMarkerElement({ map, position: defaultCenter, gmpDraggable: true });
        markerRef.current = marker;

        marker.addListener('dragend', () => {
          const pos = marker.position as google.maps.LatLng;
          if (pos) {
            setPinResult(prev => ({ address: prev?.address ?? '', lat: pos.lat(), lng: pos.lng() }));
          }
        });

        if (inputRef.current) {
          const autocomplete = new Autocomplete(inputRef.current, { fields: ['formatted_address', 'geometry'] });
          autocomplete.addListener('place_changed', () => {
            const place = autocomplete.getPlace();
            if (!place.geometry?.location) return;
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            const addr = place.formatted_address ?? inputRef.current?.value ?? '';
            setAddress(addr);
            map.panTo({ lat, lng });
            map.setZoom(17);
            marker.position = { lat, lng };
            setPinResult({ address: addr, lat, lng });
          });
        }

        // Geocode initial address if provided
        if (initialAddress) {
          const { Geocoder } = await importLibrary('geocoding');
          new Geocoder().geocode({ address: initialAddress }, (results, status) => {
            if (status === 'OK' && results?.[0]?.geometry?.location) {
              const loc = results[0].geometry.location;
              map.panTo(loc);
              map.setZoom(17);
              marker.position = loc;
              setPinResult({ address: initialAddress, lat: loc.lat(), lng: loc.lng() });
            }
          });
        }

        setLoading(false);
      } catch (err: unknown) {
        setError('Failed to load Google Maps: ' + (err instanceof Error ? err.message : String(err)));
        setLoading(false);
      }
    }

    initMap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleConfirm() {
    if (!pinResult) return;
    onConfirm({ ...pinResult, address: address || pinResult.address });
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* Header */}
      <div className="bg-white px-3 py-2.5 flex items-center gap-2 shadow-sm">
        <button
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center shrink-0"
        >
          <X className="w-4 h-4 text-stone-500" />
        </button>
        <input
          ref={inputRef}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Search address…"
          className="flex-1 h-10 px-4 rounded-xl border border-stone-200 bg-stone-50 text-[15px] text-[#1c1917] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#b8864a]/20 focus:border-[#b8864a]"
        />
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />
        {loading && (
          <div className="absolute inset-0 bg-white flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-[#b8864a]/30 border-t-[#b8864a] rounded-full animate-spin" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white flex items-center justify-center px-8">
            <p className="text-red-500 text-sm text-center">{error}</p>
          </div>
        )}
        {!loading && !error && (
          <p
            className="absolute bottom-20 left-0 right-0 text-center text-xs text-white/80 pointer-events-none select-none"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}
          >
            Drag the pin to adjust location
          </p>
        )}
      </div>

      {/* Confirm */}
      <div className="bg-white px-4 py-4">
        <button
          onClick={handleConfirm}
          disabled={!pinResult}
          className="w-full h-12 rounded-2xl bg-[#b8864a] text-white font-semibold text-[15px] flex items-center justify-center gap-2 disabled:opacity-40 active:opacity-80 transition"
        >
          <MapPin className="w-4 h-4" />
          {pinResult ? 'Confirm Pin' : 'Place a pin first'}
        </button>
        {pinResult && (
          <p className="text-center text-xs text-stone-400 mt-2">
            {pinResult.lat.toFixed(5)}, {pinResult.lng.toFixed(5)}
          </p>
        )}
      </div>
    </div>
  );
}
