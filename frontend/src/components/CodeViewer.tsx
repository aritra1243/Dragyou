'use client';

import React from 'react';
import { Copy, FileText, Download } from 'lucide-react';

interface CodeViewerProps {
  filename: string;
  content: string;
}

export default function CodeViewer({ filename, content }: CodeViewerProps) {
  const lines = content.split('\n');
  const sizeBytes = new Blob([content]).size;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  return (
    <div className="border border-gray-800 rounded-xl overflow-hidden glass-panel">
      {/* Header toolbar */}
      <div className="bg-gray-900/90 px-4 py-2.5 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
          <FileText size={16} className="text-blue-400" />
          <span className="font-semibold text-gray-100">{filename}</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400">{lines.length} lines</span>
          <span className="text-gray-500">•</span>
          <span className="text-gray-400">{sizeBytes} bytes</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono text-gray-300 bg-gray-800/80 hover:bg-gray-700 hover:text-white transition-colors"
          >
            <Copy size={13} /> Copy
          </button>
        </div>
      </div>

      {/* Code Editor Body */}
      <div className="overflow-x-auto p-4 font-mono text-xs leading-6 text-gray-200 bg-gray-950/90">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-blue-500/5 group">
                <td className="w-12 select-none text-right pr-4 text-gray-600 font-mono text-[11px] group-hover:text-gray-400">
                  {i + 1}
                </td>
                <td className="whitespace-pre pl-2 font-mono text-gray-300">
                  {line || ' '}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
