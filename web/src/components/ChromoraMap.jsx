import React, { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import 'leaflet/dist/leaflet.css';

const markerClass = result => ({ POSITIVE: 'positive', NEGATIVE: 'negative', INCONCLUSIVE: 'inconclusive', ANALYSIS_PENDING: 'pending' }[result] || 'pending');
const iconFor = result => L.divIcon({ className: 'chromora-marker-wrap', html: `<span class="chromora-marker ${markerClass(result)}"><i></i></span>`, iconSize: [24, 24], iconAnchor: [12, 12] });
function Bounds({ records }) { const map = useMap(); useEffect(() => { if (records.length > 1) map.fitBounds(records.map(record => [record.latitude, record.longitude]), { padding: [28, 28] }); else if (records.length === 1) map.setView([records[0].latitude, records[0].longitude], 13); }, [map, records]); return null; }
export default function ChromoraMap({ records = [], height = 300, onSelect }) {
  const geotagged = records.filter(record => record.latitude != null && record.longitude != null);
  if (!geotagged.length) return <div className="map-empty">No geotagged field tests in this period.</div>;
  return <div className="chromora-map" style={{ height }}><MapContainer center={[geotagged[0].latitude, geotagged[0].longitude]} zoom={12} scrollWheelZoom><TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/><Bounds records={geotagged}/>{geotagged.map(record => <Marker key={record.id} position={[record.latitude, record.longitude]} icon={iconFor(record.presumptive_result)} eventHandlers={{ click: () => onSelect?.(record) }}><Popup><b>{record.test_number}</b><span>{record.location_label || `${Number(record.latitude).toFixed(5)}, ${Number(record.longitude).toFixed(5)}`}</span><span>{record.presumptive_result?.replaceAll('_', ' ')}</span><span>{record.operator_name}</span><span>Accuracy: {Math.round(record.location_accuracy || 0)}m</span><Link to={`/field-tests/${record.id}`}>View Test &rarr;</Link></Popup></Marker>)}</MapContainer></div>;
}
