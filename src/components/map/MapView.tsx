import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import type { MapMarker } from "./types";

const icons = {
  restaurant: L.divIcon({ className: "", html: '<div class="wm-pin wm-restaurant">🍽️</div>', iconSize: [36, 36], iconAnchor: [18, 18] }),
  customer: L.divIcon({ className: "", html: '<div class="wm-pin wm-customer">🏠</div>', iconSize: [36, 36], iconAnchor: [18, 18] }),
  driver: L.divIcon({ className: "", html: '<div class="wm-pin wm-driver">🛵</div>', iconSize: [36, 36], iconAnchor: [18, 18] }),
};

function FitBounds({ markers, fit }: { markers: MapMarker[]; fit: boolean }) {
  const map = useMap();
  const key = markers.map((m) => m.kind).join(",");
  useEffect(() => {
    if (!fit || markers.length < 2) return;
    map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [40, 40], maxZoom: 15 });
    // fit once per marker set, not on every driver move
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fit, map]);
  return null;
}

function ClickToMove({ onPick }: { onPick?: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function MapView({
  markers,
  center,
  zoom = 14,
  line = false,
  draggableKind,
  onPick,
  fit = true,
}: {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  line?: boolean;
  draggableKind?: MapMarker["kind"];
  onPick?: (lat: number, lng: number) => void;
  fit?: boolean;
}) {
  const c = center ?? markers[0] ?? { lat: 33.5138, lng: 36.2765 };
  return (
    <MapContainer center={[c.lat, c.lng]} zoom={zoom} className="h-full w-full" scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {markers.map((m) => (
        <Marker
          key={m.kind + (m.id ?? "")}
          position={[m.lat, m.lng]}
          icon={icons[m.kind]}
          draggable={draggableKind === m.kind}
          eventHandlers={
            draggableKind === m.kind
              ? { dragend: (e) => { const p = (e.target as L.Marker).getLatLng(); onPick?.(p.lat, p.lng); } }
              : undefined
          }
        >
          {m.label && <Tooltip direction="top" offset={[0, -16]}>{m.label}</Tooltip>}
        </Marker>
      ))}
      {line && markers.length >= 2 && (
        <Polyline positions={markers.map((m) => [m.lat, m.lng] as [number, number])} pathOptions={{ color: "#2BB59A", weight: 4, dashArray: "6 10" }} />
      )}
      <FitBounds markers={markers} fit={fit} />
      {onPick && <ClickToMove onPick={onPick} />}
    </MapContainer>
  );
}
