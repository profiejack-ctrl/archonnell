import React from 'react';
import { Shield, MapPin, Phone, Mail, CheckCircle } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-[#07132c] text-slate-400 text-sm border-t border-[#0f234c] pt-12 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 pb-10 border-b border-[#142958]">
          
          {/* Col 1: Brand Info */}
          <div className="space-y-4">
            <img 
              src="/assets/images/archon_nell_logo.png" 
              alt="Archon Nell Incorporated" 
              className="h-10 w-auto object-contain"
            />
            <p className="text-xs text-slate-300 leading-relaxed">
              Archon Nell Incorporated is a leading industrial provider of high-strength concrete repair mortars, structural epoxy injections, and concrete admixtures across the Philippines.
            </p>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Quick Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li><a href="#home" className="hover:text-white transition-colors">Home Page</a></li>
              <li><a href="#about" className="hover:text-white transition-colors">About Archon Nell</a></li>
              <li><a href="#products" className="hover:text-white transition-colors">Industrial Products Catalog</a></li>
              <li><a href="#projects" className="hover:text-white transition-colors">Engineering Projects</a></li>
            </ul>
          </div>

          {/* Col 3: Product Categories */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Payment Modes Accepted</h4>
            <ul className="space-y-2 text-xs">
              <li><span className="text-slate-300">Cash on Delivery (UI Preview)</span></li>
              <li><span className="text-slate-300">Maya (UI Preview)</span></li>
              <li><span className="text-slate-300">GCash (UI Preview)</span></li>
            </ul>
          </div>

          {/* Col 4: Plant & Operations */}
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Head Plant & Support</h4>
            <div className="space-y-2.5 text-xs text-slate-300">
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                <span>Cainta, Rizal Batching Plant & Central Warehouse Depot, Philippines</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>+632 8682 6053 / +63 917 884 9912</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-400 flex-shrink-0" />
                <span>archonnell.inc@archonnell.com</span>
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-slate-500 text-center sm:text-left">
          <p>© 2026 Archon Nell Incorporated. All Rights Reserved.</p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-slate-400">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              Frontend Demo Store
            </span>
            <span className="text-slate-600">|</span>
            <span>Refractory & Construction Chemical Solutions</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
