import React from 'react';
import { Navigation2, RefreshCw, PhoneCall, ShieldAlert, Car, Route, Timer } from 'lucide-react';

interface ActionControlsProps {
  onStartNavigation: () => void;
  onReroute: () => void;
  onRequestClearance: () => void;
  totalDistanceKm: number | null;
  etaMinutes: number | null;
}

export default function ActionControls({
  onStartNavigation,
  onReroute,
  onRequestClearance,
  totalDistanceKm,
  etaMinutes,
}: ActionControlsProps) {

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-4">
      
      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col items-center justify-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1 flex items-center"><Timer className="w-4 h-4 mr-1"/> ETA</div>
          <div className="text-3xl font-black text-white">
             {etaMinutes !== null ? `${Math.ceil(etaMinutes)} MIN` : '--'}
          </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col items-center justify-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1 flex items-center"><Route className="w-4 h-4 mr-1"/> Distance</div>
          <div className="text-3xl font-black text-white">
             {totalDistanceKm !== null ? `${totalDistanceKm.toFixed(1)} KM` : '--'}
          </div>
        </div>
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-700 flex flex-col items-center justify-center">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1 flex items-center"><Car className="w-4 h-4 mr-1"/> Status</div>
          <div className="text-2xl font-black text-emerald-400">
             READY
          </div>
        </div>
      </div>

      {/* Primary Action */}
      <button 
        onClick={onStartNavigation}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-2xl font-black py-6 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.4)] flex justify-center items-center mb-4 transition-all active:scale-95"
      >
        <Navigation2 className="w-8 h-8 mr-3" />
        START NAVIGATION
      </button>

      {/* Secondary Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button 
          onClick={onReroute}
          className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-4 rounded-lg flex flex-col items-center justify-center transition-colors border border-slate-600 active:bg-slate-800"
        >
          <RefreshCw className="w-6 h-6 mb-2 text-blue-400" />
          REROUTE NOW
        </button>

        <button 
          onClick={onRequestClearance}
          className="bg-slate-700 hover:bg-orange-600 text-white font-bold py-4 rounded-lg flex flex-col items-center justify-center transition-colors border border-slate-600 active:bg-orange-700"
        >
          <ShieldAlert className="w-6 h-6 mb-2 text-orange-400" />
          REQUEST CLEARANCE
        </button>
      </div>

    </div>
  );
}
