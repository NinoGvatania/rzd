import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Без этого иконки не подгружаются — Leaflet сам ищет относительные пути.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) { onPick({ lat: e.latlng.lat, lng: e.latlng.lng }); },
  });
  return null;
}

export default function MapPicker({ value, defaultCenter, onChange }) {
  const center = useMemo(() => value ?? defaultCenter ?? [55.7558, 37.6173], [value, defaultCenter]);
  const centerArr = Array.isArray(center) ? center : [center.lat, center.lng];

  return (
    <div className="rounded-2xl overflow-hidden border border-stone-200" style={{ height: 260 }}>
      <MapContainer center={centerArr} zoom={16} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Recenter center={defaultCenter && !value ? centerArr : null} />
        <ClickHandler onPick={onChange} />
        {value && <Marker position={[value.lat, value.lng]} icon={defaultIcon} />}
      </MapContainer>
    </div>
  );
}
