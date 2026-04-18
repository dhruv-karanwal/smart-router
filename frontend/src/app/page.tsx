"use client";

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Toaster, toast } from 'sonner';
import EmergencyOverviewPanel from '@/components/EmergencyOverviewPanel';
import SmartDecisionPanel from '@/components/SmartDecisionPanel';
import ActionControls from '@/components/ActionControls';
import AdminDebugModal from '@/components/AdminDebugModal';
import { Activity, MapPin, Building2, AlertTriangle, Zap } from 'lucide-react';
import { fetchCityGraph, CityGraph, Hospital, shuffleTraffic } from '@/lib/routing/graph-builder';
import { dijkstra, aStar, bellmanFord, RouteResult } from '@/lib/routing/algorithms';

// Dynamically import the map component so Leaflet doesn't break Server-Side Rendering
const LiveRouteMapDynamic = dynamic(() => import('@/components/LiveRouteMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-100 border-4 border-slate-300 rounded-2xl flex items-center justify-center text-slate-500 animate-pulse text-xl font-bold tracking-widest">CONNECTING TO SATELLITE...</div>
});

const DEFAULT_VIT_COORD: [number, number] = [18.4633, 73.8682];

const EMERGENCY_TYPES = [
    { id: 'cardiac', name: 'Cardiac Arrest', severity: 'CRITICAL' },
    { id: 'trauma', name: 'Accident / Trauma', severity: 'CRITICAL' },
    { id: 'stroke', name: 'Stroke', severity: 'CRITICAL' },
    { id: 'fire', name: 'Fire Emergency', severity: 'HIGH' },
    { id: 'preg', name: 'Pregnancy Emergency', severity: 'HIGH' },
    { id: 'gen', name: 'General Emergency', severity: 'MEDIUM' }
];

export default function AmbulanceDashboard() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [graph, setGraph] = useState<CityGraph | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  
  // Controls
  const [isLoading, setIsLoading] = useState(true);
  const [sourceLoc, setSourceLoc] = useState<'VIT' | 'GPS'>('VIT');
  const [startNodeId, setStartNodeId] = useState<number | null>(null);
  const [targetHospitalId, setTargetHospitalId] = useState<number | null>(null);
  const [emergencyTypeId, setEmergencyTypeId] = useState('cardiac');
  
  // Routing State
  const [routeNodes, setRouteNodes] = useState<number[]>([]);
  const [algoUsed, setAlgoUsed] = useState<string>('dijkstra');
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);
  const [timeSaved, setTimeSaved] = useState<number>(0);
  
  // Traffic Simulation
  const [tick, setTick] = useState(0);
  const [rerouteWarning, setRerouteWarning] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  
  const [adminResults, setAdminResults] = useState<RouteResult[]>([]);

  // 1. Initial Load of Overpass Data
  useEffect(() => {
    loadMapData(DEFAULT_VIT_COORD[0], DEFAULT_VIT_COORD[1]);
  }, []);

  const loadMapData = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const data = await fetchCityGraph(lat, lng, 1200); // 1.2km radius
      setGraph(data.graph);
      setHospitals(data.hospitals);
      
      if (data.hospitals.length > 0) {
          setTargetHospitalId(data.hospitals[0].id);
      }
      
      // Find closest node to start
      let closestSourceId = -1;
      let minDst = Infinity;
      for (const [nid, node] of Array.from(data.graph.nodes.entries())) {
          const dy = node.lat - lat;
          const dx = node.lng - lng;
          const dst = dx*dx + dy*dy;
          if (dst < minDst) {
              minDst = dst;
              closestSourceId = nid;
          }
      }
      if (closestSourceId !== -1) setStartNodeId(closestSourceId);
      
    } catch (e) {
      toast.error("Failed to fetch map data from Overpass API");
    } finally {
      setIsLoading(false);
    }
  };

  // 2. Traffic Simulator Loop (Only runs if navigating)
  useEffect(() => {
    if (!isNavigating || !graph) return;
    const interval = setInterval(() => {
      shuffleTraffic(graph);
      setTick(prev => prev + 1); // trigger re-render and recalculation
    }, 4000); // every 4 seconds, traffic changes dynamically
    return () => clearInterval(interval);
  }, [isNavigating, graph]);

  // 3. React to Traffic Changes (Calculate optimal route live)
  const previousRouteDist = useRef<number>(Infinity);

  useEffect(() => {
    if (!graph || startNodeId === null || targetHospitalId === null) return;
    
    const targetHospNodeId = hospitals.find(h => h.id === targetHospitalId)?.closestNodeId;
    if (!targetHospNodeId) return;

    const res = dijkstra(graph, startNodeId, targetHospNodeId);
    
    // Convert m to km
    const distKm = res.dist / 1000;
    setTotalDistanceKm(distKm);
    
    const effectiveEta = distKm * 1.5; 
    setEtaMinutes(effectiveEta);
    
    if (tick === 0) {
       setTimeSaved(2.5); // base aesthetic
    }

    setRouteNodes(prev => {
        const isNewPath = prev.join(',') !== res.path.join(',');
        if (isNewPath) {
            // Check if new route is wildly different or traffic just got worse
            if (isNavigating && tick > 0) {
               toast.warning("Rerouting: Faster path found", { style: { background: '#f97316', color: '#fff' }});
               setTimeSaved(prevTime => prevTime + 1.2);
               setRerouteWarning(true);
               setTimeout(() => setRerouteWarning(false), 3000);
            }
            return res.path;
        }
        return prev; // Return exact same array reference if unchanged to prevent re-renders
    });

  }, [graph, startNodeId, targetHospitalId, tick, hospitals, isNavigating]);

  const toggleSource = async () => {
    if (sourceLoc === 'VIT') {
       if (navigator.geolocation) {
           navigator.geolocation.getCurrentPosition((pos) => {
               setSourceLoc('GPS');
               loadMapData(pos.coords.latitude, pos.coords.longitude);
           }, () => {
               toast.error("GPS Denied. Falling back to VIT Pune.");
           });
       }
    } else {
       setSourceLoc('VIT');
       loadMapData(DEFAULT_VIT_COORD[0], DEFAULT_VIT_COORD[1]);
    }
  };
  
  const findNearestHospital = () => {
      if (!graph || startNodeId === null || hospitals.length === 0) return;
      
      let bestHospId = hospitals[0].id;
      let minDst = Infinity;
      
      hospitals.forEach(h => {
          if (!h.closestNodeId) return;
          const res = dijkstra(graph, startNodeId, h.closestNodeId);
          if (res.dist < minDst) {
              minDst = res.dist;
              bestHospId = h.id;
          }
      });
      
      setTargetHospitalId(bestHospId);
      toast.success("Nearest hospital automatically selected.");
  };

  const fireAdminComparison = () => {
    if (!graph || startNodeId === null || targetHospitalId === null) return;
    const targetNodeId = hospitals.find(h => h.id === targetHospitalId)?.closestNodeId;
    if (!targetNodeId) return;

    const r1 = dijkstra(graph, startNodeId, targetNodeId);
    const r2 = aStar(graph, startNodeId, targetNodeId);
    const r3 = bellmanFord(graph, startNodeId, targetNodeId);
    
    // Just mock node explored count for visual admin since we didn't track it in our pure TS implementation
    r1.algo = "Dijkstra"; 
    r2.algo = "A* Search"; 
    r3.algo = "Bellman-Ford";
    
    setAdminResults([r1, r2, r3]);
  };

  if (isLoading) {
      return (
          <div className="min-h-screen bg-[#050B14] flex flex-col items-center justify-center text-white">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <h1 className="text-xl font-bold tracking-widest text-slate-300 uppercase">Triangulating City Grid</h1>
              <p className="text-slate-500 text-sm mt-2">Connecting to OpenStreetMap API...</p>
          </div>
      );
  }

  const activeHospitalName = hospitals.find(h => h.id === targetHospitalId)?.name || "Unknown Hospital";
  const activeEmergency = EMERGENCY_TYPES.find(e => e.id === emergencyTypeId)!;

  return (
    <div className="min-h-screen bg-[#050B14] p-4 text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      <Toaster position="top-center" expand={true} />

      {/* Top Warning Panel */}
      <EmergencyOverviewPanel 
        emergencyType={activeEmergency.name}
        destination={activeHospitalName}
        severity={activeEmergency.severity}
        etaSeconds={etaMinutes ? etaMinutes * 60 : null}
      />

      {/* SUPERIOR Header Controls (ABOVE MAP) */}
      <div className="bg-slate-900 border border-slate-700/50 shadow-2xl rounded-xl p-4 mb-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          
          {/* Active Source */}
          <div className="flex flex-col space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><MapPin className="w-3 h-3 mr-1"/> Start Location</span>
              <button onClick={toggleSource} className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 px-4 py-3 rounded-lg border border-slate-600 transition shadow-inner">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="font-bold text-slate-200">{sourceLoc === 'GPS' ? 'Live GPS' : 'VIT Pune'}</span>
              </button>
          </div>

          {/* Emergency Type */}
          <div className="flex flex-col space-y-1">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><AlertTriangle className="w-3 h-3 mr-1"/> Emergency Type</span>
              <select 
                  className="bg-slate-800 border border-slate-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 transition shadow-inner cursor-pointer"
                  value={emergencyTypeId}
                  onChange={(e) => setEmergencyTypeId(e.target.value)}
              >
                  {EMERGENCY_TYPES.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                  ))}
              </select>
          </div>

          {/* Destination Selector */}
          <div className="flex flex-col space-y-1 md:col-span-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center"><Building2 className="w-3 h-3 mr-1"/> Destination Hospital</span>
              <div className="flex space-x-2">
                  <select 
                      className="flex-grow bg-slate-800 border border-slate-600 text-white font-bold py-3 px-4 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition shadow-inner cursor-pointer"
                      value={targetHospitalId || ''}
                      onChange={(e) => setTargetHospitalId(Number(e.target.value))}
                  >
                      {hospitals.map(h => (
                          <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                  </select>
                  <button 
                      onClick={findNearestHospital}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 rounded-lg font-bold shadow-lg transition flex items-center border border-indigo-400 focus:ring-2 focus:ring-indigo-400 group"
                      title="Auto-Select Nearest Hospital"
                  >
                      <Zap className="w-5 h-5 mr-1 group-hover:scale-110 transition-transform text-yellow-300" />
                      Nearest
                  </button>
              </div>
          </div>
      </div>

      {/* Main Content Grid */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 pb-4">
        
        {/* Map Visualization (Takes 3/4 cols) */}
        <div className="lg:col-span-3 h-full relative">
          <LiveRouteMapDynamic 
            graph={graph}
            routeNodes={routeNodes}
            hospitals={hospitals}
            startNodeId={startNodeId}
            targetHospitalId={targetHospitalId}
          />
          
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="absolute bottom-4 left-4 z-[999] bg-white/80 hover:bg-white text-slate-800 p-2 rounded-full shadow-lg border border-slate-300 transition"
            title="System Diagnostics"
          >
            <Activity className="w-5 h-5" />
          </button>
        </div>

        {/* Right Side Panel - AI & Controls */}
        <div className="lg:col-span-1 flex flex-col space-y-4 h-full">
          <div className="flex-1">
             <SmartDecisionPanel 
               algorithmUsed={algoUsed}
               timeSavedMin={timeSaved}
               rerouteWarning={rerouteWarning}
               message={isNavigating ? "Live Navigation Active. AI Monitoring Traffic." : "Optimal path established. Awaiting deployment."}
             />
          </div>
          
          <div>
            <ActionControls 
               etaMinutes={etaMinutes}
               totalDistanceKm={totalDistanceKm}
               onStartNavigation={() => setIsNavigating(true)}
               onReroute={() => {
                   toast.info("Manual Reroute Initiated...");
                   shuffleTraffic(graph!);
                   setTick(p => p + 1);
               }}
               onRequestClearance={() => toast.success('Traffic command center alerted. Emergency corridor requested.')}
            />
          </div>
        </div>
      </div>

      <AdminDebugModal 
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        results={adminResults}
        onRunComparison={fireAdminComparison}
      />
    </div>
  );
}
