"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon issue with webpack/Next.js
const customIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface LocationNode {
  id: number;
  lat: number;
  lng: number;
  name?: string;
}

interface LiveRouteMapProps {
  routeNodes: number[];   // array of node IDs in path
  allNodes: LocationNode[]; // graph node details
  blockedEdges: {v1: number, v2: number}[];
}

export default function LiveRouteMap({ routeNodes, allNodes, blockedEdges }: LiveRouteMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]); // Default roughly New Delhi

  useEffect(() => {
    // Center map on the first node of the route if available
    if (routeNodes.length > 0 && allNodes.length > 0) {
      const startNode = allNodes.find(n => n.id === routeNodes[0]);
      if (startNode) {
        setMapCenter([startNode.lat, startNode.lng]);
      }
    }
  }, [routeNodes, allNodes]);

  // Construct latlngs for the optimal route
  const optimalRouteLatLngs = routeNodes
    .map(id => allNodes.find(n => n.id === id))
    .filter(n => n !== undefined)
    .map(n => [n!.lat, n!.lng] as [number, number]);

  // Optionally generate lines for blocked edges
  const blockedLatLngs = blockedEdges.map(edge => {
    const n1 = allNodes.find(n => n.id === edge.v1);
    const n2 = allNodes.find(n => n.id === edge.v2);
    if (!n1 || !n2) return null;
    return [[n1.lat, n1.lng], [n2.lat, n2.lng]] as [[number, number], [number, number]];
  }).filter(l => l !== null) as [[number, number], [number, number]][];

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 relative bg-slate-900">
      <MapContainer 
        center={mapCenter} 
        zoom={14} 
        style={{ height: '100%', width: '100%', background: '#0f172a' }}
        zoomControl={false}
      >
        {/* Dark theme tiles for high contrast emergency view */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />

        {/* Optimal Route Highlight (Green/Cyan) */}
        {optimalRouteLatLngs.length > 0 && (
          <Polyline 
            positions={optimalRouteLatLngs} 
            color="#10b981" // Emerald green
            weight={8} 
            opacity={0.8}
            lineCap="round"
            lineJoin="round"
            className="animate-pulse" // A subtle CSS animation could be added here
          />
        )}

        {/* Blocked Roads Indicators (Red) */}
        {blockedLatLngs.map((pos, idx) => (
          <Polyline 
            key={`blocked-${idx}`}
            positions={pos} 
            color="#ef4444" 
            weight={6} 
            dashArray="10, 10"
            opacity={0.9}
          />
        ))}

        {/* Start / End Markers */}
        {optimalRouteLatLngs.length > 0 && (
          <>
            <Marker position={optimalRouteLatLngs[0]} icon={customIcon}>
              <Popup>AMBULANCE START</Popup>
            </Marker>
            <Marker position={optimalRouteLatLngs[optimalRouteLatLngs.length - 1]} icon={customIcon}>
              <Popup>HOSPITAL DESTINATION</Popup>
            </Marker>
          </>
        )}

      </MapContainer>
      
      {/* Route Status Overlay */}
      <div className="absolute top-4 right-4 z-[1000] bg-black/80 text-white px-4 py-2 rounded-lg border border-slate-700 shadow-lg flex flex-col space-y-2 backdrop-blur-sm pointer-events-none">
        <div className="flex items-center space-x-2">
           <div className="w-4 h-1 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
           <span className="text-sm font-semibold tracking-wide">OPTIMAL CLEAR ROUTE</span>
        </div>
        <div className="flex items-center space-x-2">
           <div className="w-4 h-1 border-b-2 border-dashed border-red-500"></div>
           <span className="text-sm font-semibold text-slate-300">BLOCKED / HEAVY TRAFFIC</span>
        </div>
      </div>
    </div>
  );
}
