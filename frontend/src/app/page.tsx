"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import EmergencyOverviewPanel from '@/components/EmergencyOverviewPanel';
import SmartDecisionPanel from '@/components/SmartDecisionPanel';
import ActionControls from '@/components/ActionControls';
import AdminDebugModal from '@/components/AdminDebugModal';
import { Activity, Settings, RefreshCcw } from 'lucide-react';
import axios from 'axios';

// Dynamically import the map component so Leaflet doesn't break Server-Side Rendering
const LiveRouteMapDynamic = dynamic(() => import('@/components/LiveRouteMap'), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-slate-900 border-4 border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 animate-pulse text-xl font-bold tracking-widest">LOADING SATELLITE LINK...</div>
});

const DEFAULT_START: number = 0;
const DEFAULT_END: number = 19;

// Hardcoded sample positions for demonstration (Normally fetched from backend)
const generateMockNodes = (count: number) => {
  return Array.from({ length: count }).map((_, i) => ({
    id: i,
    lat: 28.6139 + (Math.random() - 0.5) * 0.05,
    lng: 77.2090 + (Math.random() - 0.5) * 0.05,
    name: `Node ${i}`
  }));
};

interface AlgoResult {
  algo: string;
  timeMs: number;
  cost: number;
  nodes: number;
  path: number[];
}

export default function AmbulanceDashboard() {
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [routeNodes, setRouteNodes] = useState<number[]>([]);
  const [allNodes, setAllNodes] = useState(generateMockNodes(20)); // Assume 20 nodes for the graph
  const [blockedEdges, setBlockedEdges] = useState<{v1: number, v2: number}[]>([]);
  
  // Dashboard Metrics
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [totalDistanceKm, setTotalDistanceKm] = useState<number | null>(null);
  const [timeSaved, setTimeSaved] = useState<number>(0);
  const [algoUsed, setAlgoUsed] = useState<string>('A*');
  
  // Admin Data
  const [adminResults, setAdminResults] = useState<AlgoResult[]>([]);

  // Simulation State
  const [rerouteWarning, setRerouteWarning] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // Initialize Route
  useEffect(() => {
    fetchOptimalRoute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchOptimalRoute = async () => {
    try {
      // Proxying to our existing Express backend
      const res = await axios.post('/api/smart-route', {
        src: DEFAULT_START,
        dst: DEFAULT_END,
        emergency_level: 'high'
      });
      
      const data = res.data;
      if (data.path) {
        setRouteNodes(data.path);
        setAlgoUsed(data.algorithm);
        setTotalDistanceKm(data.cost * 0.1); // Make up realistic km
        setEtaMinutes(data.cost * 0.15); // Make up realistic minutes
        setTimeSaved(Math.random() + 2); // Random save
        setRerouteWarning(false);
      }
    } catch (error) {
      console.error("Failed to fetch smart route", error);
    }
  };

  const handleStartNavigation = () => {
    setIsNavigating(true);
    // Simulate real-time monitoring
    setTimeout(() => {
      setRerouteWarning(true);
    }, 5000);
  };

  const handleReroute = async () => {
    setRerouteWarning(false);
    // Block a random road just to simulate dynamic traffic change
    if (routeNodes.length >= 2) {
      const u = routeNodes[0];
      const v = routeNodes[1];
      setBlockedEdges(prev => [...prev, { v1: u, v2: v }]);
      await axios.post('/api/block-road', { u, v, blocked: true });
    }
    await fetchOptimalRoute();
  };

  const fireAdminComparison = async () => {
    try {
      const res = await axios.post('/api/compare', {
        src: DEFAULT_START,
        dst: DEFAULT_END,
        algos: ['dijkstra', 'astar', 'bellman', 'floyd']
      });
      
      const results: AlgoResult[] = Object.keys(res.data).map(key => {
        const item = res.data[key];
        return {
          algo: key,
          timeMs: item.time_ms || 0,
          cost: item.cost || 0,
          nodes: item.nodes_explored || 0,
          path: item.path || [],
        };
      });
      setAdminResults(results);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-[#050B14] p-4 text-slate-200 font-sans selection:bg-blue-500/30 overflow-hidden flex flex-col">
      
      {/* Top Warning Panel */}
      <EmergencyOverviewPanel 
        emergencyType="Cardiac Arrest"
        destination="City Central Hospital"
        severity="CRITICAL"
        etaSeconds={etaMinutes ? etaMinutes * 60 : null}
      />

      {/* Main Content Grid */}
      <div className="flex-grow grid grid-cols-1 lg:grid-cols-4 gap-4 pb-4">
        
        {/* Map Visualization (Takes 3/4 cols) */}
        <div className="lg:col-span-3 h-full relative">
          <LiveRouteMapDynamic 
            routeNodes={routeNodes}
            allNodes={allNodes}
            blockedEdges={blockedEdges}
          />
          
          {/* Subtle Dev Toggle */}
          <button 
            onClick={() => setIsAdminOpen(true)}
            className="absolute bottom-4 left-4 z-[999] bg-black/50 hover:bg-black/80 text-slate-400 p-2 rounded border border-slate-700 transition"
            title="System Diagnostics"
          >
            <Activity className="w-4 h-4" />
          </button>
        </div>

        {/* Right Side Panel - AI & Controls */}
        <div className="lg:col-span-1 flex flex-col space-y-4 h-full">
          {/* AI Decision Panel */}
          <div className="flex-1">
             <SmartDecisionPanel 
               algorithmUsed={algoUsed}
               timeSavedMin={timeSaved}
               rerouteWarning={rerouteWarning}
             />
          </div>
          
          {/* Bottom Action Controls */}
          <div>
            <ActionControls 
               etaMinutes={etaMinutes}
               totalDistanceKm={totalDistanceKm}
               onStartNavigation={handleStartNavigation}
               onReroute={handleReroute}
               onRequestClearance={() => alert('Traffic command center alerted. Emergency corridor requested.')}
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
