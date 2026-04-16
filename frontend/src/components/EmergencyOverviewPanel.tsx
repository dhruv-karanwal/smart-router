import React, { useState, useEffect } from 'react';
import { AlertCircle, Clock, HeartPulse, Building2 } from 'lucide-react';

interface EmergencyOverviewPanelProps {
  emergencyType: string;
  destination: string;
  severity: string;
  etaSeconds: number | null;
}

export default function EmergencyOverviewPanel({
  emergencyType,
  destination,
  severity,
  etaSeconds,
}: EmergencyOverviewPanelProps) {
  const [blink, setBlink] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setBlink((prev) => !prev), 1000);
    return () => clearInterval(interval);
  }, []);

  const urgencyColor = severity.toLowerCase() === 'critical' ? 'bg-red-600' : 'bg-orange-500';

  const formatTime = (totalSeconds: number | null) => {
    if (totalSeconds === null) return "--:--";
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m}m ${s}s`;
  };

  return (
    <div className={`w-full ${urgencyColor} text-white rounded-xl shadow-2xl overflow-hidden border border-red-400 p-1 mb-4 flexflex-col animate-in fade-in zoom-in duration-300`}>
      <div className="bg-black/20 px-6 py-4 rounded-lg flex items-center justify-between">
        
        {/* Left: Alert Label */}
        <div className="flex items-center space-x-4">
          <AlertCircle className={`w-12 h-12 text-white ${severity.toLowerCase() === 'critical' ? 'animate-pulse' : ''}`} />
          <div>
            <h1 className="text-3xl font-black tracking-tight uppercase">
              {severity} EMERGENCY
            </h1>
            <div className="text-red-100 flex items-center space-x-2 text-lg font-medium mt-1">
              <HeartPulse className="w-5 h-5 opacity-80" />
              <span>{emergencyType}</span>
            </div>
          </div>
        </div>

        {/* Center: Destination */}
        <div className="hidden md:flex flex-col items-center">
          <div className="text-red-100 text-sm font-semibold uppercase tracking-wider mb-1">Destination</div>
          <div className="flex items-center space-x-2 bg-black/30 px-4 py-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
            <span className="text-xl font-bold">{destination}</span>
          </div>
        </div>

        {/* Right: Timer / ETA */}
        <div className="flex flex-col items-end">
          <div className="text-red-100 text-sm font-semibold uppercase tracking-wider mb-1 flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span>Golden Time Tracker</span>
          </div>
          <div className={`text-4xl font-black font-mono tracking-tighter ${blink ? 'opacity-100' : 'opacity-80'} transition-opacity`}>
            {formatTime(etaSeconds)}
          </div>
        </div>

      </div>
    </div>
  );
}
