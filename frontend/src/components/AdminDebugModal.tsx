import React from 'react';
import { X, Activity } from 'lucide-react';

interface AlgorithmResult {
  algo: string;
  timeMs: number;
  cost: number;
  nodes: number;
  path: number[];
}

interface AdminDebugModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: AlgorithmResult[];
  onRunComparison: () => void;
}

export default function AdminDebugModal({
  isOpen,
  onClose,
  results,
  onRunComparison
}: AdminDebugModalProps) {
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-800">
          <div className="flex items-center space-x-2 text-white">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-bold text-lg tracking-wide uppercase">Admin / Debug Mode: DSA Metrics</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="mb-4 flex justify-between items-center">
            <p className="text-slate-400 text-sm">
              Algorithm performance comparison. This panel is not visible to drivers.
            </p>
            <button 
              onClick={onRunComparison}
              className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-semibold text-sm transition-colors"
            >
              Run Full Comparison
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="text-xs uppercase bg-slate-800 text-slate-400 border-b border-slate-700">
                <tr>
                  <th className="px-6 py-3">Algorithm</th>
                  <th className="px-6 py-3">Exec Time (ms)</th>
                  <th className="px-6 py-3">Total Cost (Dist)</th>
                  <th className="px-6 py-3">Nodes Explored</th>
                  <th className="px-6 py-3">Path (Nodes)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((res, index) => (
                  <tr key={index} className="border-b border-slate-700 bg-slate-900 hover:bg-slate-800">
                    <td className="px-6 py-4 font-bold text-white capitalize">{res.algo}</td>
                    <td className="px-6 py-4 font-mono text-purple-400">{res.timeMs ? res.timeMs.toFixed(3) : '--'}</td>
                    <td className="px-6 py-4 font-mono text-emerald-400">{res.cost ?? '--'}</td>
                    <td className="px-6 py-4 font-mono text-blue-400">{res.nodes ?? '--'}</td>
                    <td className="px-6 py-4 font-mono text-xs max-w-xs truncate" title={res.path.join(' -> ')}>
                      {res.path.length > 0 ? res.path.join(' → ') : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {results.length === 0 && (
              <div className="py-8 text-center text-slate-500 italic">No comparison data run yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
