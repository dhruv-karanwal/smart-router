"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { CityGraph, Hospital } from '@/lib/routing/graph-builder';

// Source Marker (Blue)
const sourceIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Hospital/Destination Marker (Red)
const hospitalIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Grey Unselected Hospital Marker
const unselectedIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});


interface LiveRouteMapProps {
  graph: CityGraph | null;
  routeNodes: number[];   // array of node IDs in path
  hospitals: Hospital[];
  startNodeId: number | null;
  targetHospitalId: number | null;
}

// Component to recenter map when source changes
function RecenterMap({ lat, lng }: { lat: number, lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], 15, { duration: 1.5 });
  }, [lat, lng, map]);
  return null;
}

export default function LiveRouteMap({ graph, routeNodes, hospitals, startNodeId, targetHospitalId }: LiveRouteMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([18.4633, 73.8682]); // Default VIT Pune

  useEffect(() => {
    if (graph && startNodeId !== null && graph.nodes.has(startNodeId)) {
        const n = graph.nodes.get(startNodeId)!;
        setMapCenter([n.lat, n.lng]);
    }
  }, [graph, startNodeId]);

  // Extract Route Path LatLngs
  const routeLatLngs: [number, number][] = [];
  if (graph && routeNodes.length > 0) {
      for (const nId of routeNodes) {
          const n = graph.nodes.get(nId);
          if (n) routeLatLngs.push([n.lat, n.lng]);
      }
  }

  // Pre-calculate rendering edges
  const allEdges = React.useMemo(() => {
      if (!graph) return [];
      const edges: { pos: [[number, number], [number, number]], color: string, weight: number }[] = [];
      const seen = new Set<string>();
      
      for (const [u, adj] of Array.from(graph.adjList.entries())) {
          for (const e of adj) {
              const id = u < e.v ? `${u}-${e.v}` : `${e.v}-${u}`;
              if (!seen.has(id)) {
                  seen.add(id);
                  let color = '#94a3b8'; // default slate-400 for better visibility on light map
                  let weight = 3;
                  if (e.trafficFactor === 3) {
                      color = '#eab308'; // strong yellow/amber
                      weight = 4;
                  } else if (e.trafficFactor === 6) {
                      color = '#ef4444'; // strong red
                      weight = 4;
                  }
                  
                  const uN = graph.nodes.get(u)!;
                  const vN = graph.nodes.get(e.v)!;
                  edges.push({ pos: [[uN.lat, uN.lng], [vN.lat, vN.lng]], color, weight });
              }
          }
      }
      return edges;
  }, [graph]);

  const startN = startNodeId !== null && graph?.nodes.get(startNodeId);

  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border-4 border-slate-700 relative bg-slate-100">
      <MapContainer 
        center={mapCenter} 
        zoom={15} 
        style={{ height: '100%', width: '100%', background: '#f8fafc' }}
        zoomControl={false}
      >
        <RecenterMap lat={mapCenter[0]} lng={mapCenter[1]} />
        
        {/* Light Theme Base Map for clarity */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap &copy; CARTO'
        />

        {/* Base Road Network showing traffic */}
        {allEdges.map((e, idx) => (
            <Polyline 
                key={idx}
                positions={e.pos}
                color={e.color}
                weight={e.weight}
                opacity={0.7}
            />
        ))}

        {/* Optimal Route Highlight (Bright Green, above roads) */}
        {routeLatLngs.length > 0 && (
          <Polyline 
            positions={routeLatLngs} 
            color="#0ea5e9" // bright blue-green vibe
            weight={8} 
            opacity={0.9}
            lineCap="round"
            lineJoin="round"
            className="animate-pulse shadow-lg" 
          />
        )}
        
        {/* Bright green inner overlay for route to make it pop like Google Maps */}
        {routeLatLngs.length > 0 && (
          <Polyline 
            positions={routeLatLngs} 
            color="#22c55e" 
            weight={4} 
            opacity={1}
            lineCap="round"
            lineJoin="round"
          />
        )}

        {/* Hospital Markers */}
        {hospitals.map(h => (
            <Marker 
              key={h.id} 
              position={[h.lat, h.lng]} 
              icon={targetHospitalId === h.id ? hospitalIcon : unselectedIcon}
              zIndexOffset={targetHospitalId === h.id ? 100 : 0}
            >
              <Popup>
                  <div className="font-bold text-slate-800 text-lg">{h.name}</div>
                  {targetHospitalId === h.id && <div className="text-red-600 font-bold mt-1">DESTINATION</div>}
              </Popup>
            </Marker>
        ))}

        {/* Source Marker - draw last so it's on top */}
        {startN && (
            <Marker position={[startN.lat, startN.lng]} icon={sourceIcon} zIndexOffset={1000}>
              <Popup>
                  <div className="font-bold text-blue-600 text-lg">Ambulance Source</div>
              </Popup>
            </Marker>
        )}

      </MapContainer>
      
      {/* Legend */}
      <div className="absolute top-4 right-4 z-[1000] bg-white/90 text-slate-800 px-4 py-3 rounded-lg border border-slate-200 shadow-xl flex flex-col space-y-3 backdrop-blur-md">
        <div className="flex items-center justify-between space-x-4">
           <span className="text-sm font-black uppercase text-slate-600">Road Traffic</span>
        </div>
        <div className="flex items-center space-x-2">
           <div className="w-5 h-1.5 bg-slate-400 rounded-full"></div><span className="text-sm font-semibold text-slate-700">Clear</span>
        </div>
        <div className="flex items-center space-x-2">
           <div className="w-5 h-1.5 bg-yellow-500 rounded-full"></div><span className="text-sm font-semibold text-slate-700">Medium</span>
        </div>
        <div className="flex items-center space-x-2">
           <div className="w-5 h-1.5 bg-red-500 rounded-full"></div><span className="text-sm font-semibold text-slate-700">Heavy</span>
        </div>
        <div className="w-full h-px bg-slate-200 my-1"></div>
        <div className="flex items-center space-x-2">
           <div className="w-5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_5px_#22c55e]"></div>
           <span className="text-sm font-black tracking-wide text-emerald-600">OPTIMAL ROUTE</span>
        </div>
      </div>
    </div>
  );
}
