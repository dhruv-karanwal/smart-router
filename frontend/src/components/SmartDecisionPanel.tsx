import React from 'react';
import { BrainCircuit, CheckCircle2, Navigation, AlertTriangle } from 'lucide-react';

interface SmartDecisionPanelProps {
  algorithmUsed: string;
  timeSavedMin: number;
  message?: string;
  rerouteWarning?: boolean;
}

export default function SmartDecisionPanel({
  algorithmUsed,
  timeSavedMin,
  message = "Optimal path found. Minimal traffic interference detected.",
  rerouteWarning = false,
}: SmartDecisionPanelProps) {
  
  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 overflow-hidden flex flex-col h-full">
      <div className="bg-blue-600/20 px-4 py-3 border-b border-blue-500/30 flex items-center space-x-3">
        <BrainCircuit className="w-6 h-6 text-blue-400" />
        <h2 className="text-blue-100 font-bold uppercase tracking-wider text-sm">Smart Route Decision</h2>
      </div>

      <div className="p-5 flex-grow flex flex-col justify-center space-y-6">
        
        {/* Main Recommendation */}
        <div className="flex items-start space-x-4">
          <div className="mt-1 bg-green-500/20 p-2 rounded-full border border-green-500/30">
            <CheckCircle2 className="w-8 h-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white">Route Active</h3>
            <p className="text-slate-300 text-lg leading-snug mt-1">
              {message}
            </p>
          </div>
        </div>

        {/* Reason Highlights */}
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
          <h4 className="text-slate-400 text-xs font-bold uppercase mb-3">Why this route?</h4>
          <ul className="space-y-3">
            <li className="flex items-center text-slate-200">
              <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
              <span className="font-semibold text-lg text-white">~{timeSavedMin.toFixed(1)} min faster</span>
              <span className="ml-2 text-slate-400">than average</span>
            </li>
            <li className="flex items-center text-slate-200">
              <span className="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>
              <span className="font-semibold text-lg text-white">Clear</span>
              <span className="ml-2 text-slate-400">of reported accidents</span>
            </li>
          </ul>
        </div>

        {/* Dynamic Alerts */}
        {rerouteWarning && (
          <div className="animate-pulse bg-orange-500/20 border border-orange-500/50 rounded-lg p-4 flex items-start space-x-3">
            <AlertTriangle className="w-6 h-6 text-orange-400 flex-shrink-0" />
            <div>
              <div className="text-orange-400 font-bold uppercase text-sm">Traffic Increasing Ahead</div>
              <div className="text-orange-200 text-sm mt-1">System is monitoring for alternative paths...</div>
            </div>
          </div>
        )}

      </div>
      
      {/* Footer minimal info */}
      <div className="bg-slate-900 px-4 py-2 flex items-center justify-between border-t border-slate-700">
         <span className="text-xs text-slate-500 font-mono flex items-center">
            <Navigation className="w-3 h-3 mr-1 inline"/> Auto-Navigation Active
         </span>
         <span className="text-xs text-slate-600 font-mono" title="Legacy Internal Reference">
           Engine: {algorithmUsed.toUpperCase()}
         </span>
      </div>
    </div>
  );
}
