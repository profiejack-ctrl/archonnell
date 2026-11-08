import React from 'react';
import { Mail, Phone, MapPin, Clock } from 'lucide-react';

export default function TopStrip() {
  return (
    <div className="bg-[#07132c] text-slate-300 text-xs py-2 border-b border-[#0f234c]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
        <div className="flex items-center gap-6">
          <a
            href="mailto:archonnell.inc@archonnell.com"
            className="flex items-center gap-1.5 hover:text-blue-400 transition-colors"
          >
            <Mail className="w-3.5 h-3.5 text-blue-400" />
            <span>archonnell.inc@archonnell.com</span>
          </a>
          <a
            href="tel:+63286826053"
            className="hidden sm:flex items-center gap-1.5 hover:text-blue-400 transition-colors"
          >
            <Phone className="w-3.5 h-3.5 text-blue-400" />
            <span>+632 8682 6053</span>
          </a>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-500" />
            Mon-Fri 9:00 AM - 6:00 PM
          </span>
          <span className="hidden md:inline">•</span>
          <span className="hidden md:flex items-center gap-1">
            <MapPin className="w-3 h-3 text-slate-500" />
            Cainta, Rizal Head Plant
          </span>
        </div>
      </div>
    </div>
  );
}

