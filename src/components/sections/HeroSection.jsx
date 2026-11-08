import React from 'react';
import { useApp } from '../../context/AppContext';
import { ShoppingBag, Truck, Building, FileSignature, ArrowRight } from 'lucide-react';

export default function HeroSection() {
  const { setIsTrackingOpen, setIsCsOpen } = useApp();

  return (
    <>
      {/* ================= HERO SECTION ================= */}
      <section id="home" className="relative overflow-hidden pt-10 pb-14 sm:pt-16 sm:pb-20 lg:pt-20 lg:pb-24 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-7 space-y-5 sm:space-y-6 text-center lg:text-left">
              
              {/* Top Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Engineering Maintenance &amp; Industrial Construction Solutions</span>
              </div>

              {/* Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Design, Supply &amp; <span className="text-blue-600">Installation</span>
              </h1>

              {/* Subtitle */}
              <p className="text-sm sm:text-base lg:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 font-normal leading-relaxed">
                A Leading Provider of Quality Construction Chemical, Refractory Materials and Related Services in the Philippines. Manufacturer and Supplier of Construction Chemicals, Authorized local blender of Megaflow Admixtures under license by Conmix Ltd., UAE.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-1">
                <a
                  href="#products"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm px-6 sm:px-7 py-3 sm:py-3.5 rounded-xl shadow-sm flex items-center gap-2 transition-all"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Shop Products</span>
                </a>

                <a
                  href="#about"
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs sm:text-sm px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl flex items-center gap-2 transition-all shadow-sm"
                >
                  <Building className="w-4 h-4 text-slate-500" />
                  <span>Company Info</span>
                </a>
              </div>

              {/* Services Highlights Row */}
              <div className="grid grid-cols-3 gap-2 sm:gap-4 pt-6 border-t border-slate-100 max-w-lg mx-auto lg:mx-0">
                <div className="text-center lg:text-left">
                  <span className="text-xs sm:text-base font-extrabold text-slate-900 block leading-tight">Construction Chemicals</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Manufacturer &amp; Supplier</span>
                </div>
                <div className="text-center lg:text-left">
                  <span className="text-xs sm:text-base font-extrabold text-slate-900 block leading-tight">Refractory Materials</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Official Distributor</span>
                </div>
                <div className="text-center lg:text-left">
                  <span className="text-xs sm:text-base font-extrabold text-slate-900 block leading-tight">Full Service</span>
                  <span className="text-[10px] sm:text-xs text-slate-500">Design &amp; Installation</span>
                </div>
              </div>

            </div>

            {/* Right Visual Showcase Banner */}
            <div className="lg:col-span-5 relative mt-4 lg:mt-0">
              <div className="relative mx-auto max-w-md lg:max-w-none rounded-2xl bg-slate-100 p-2 sm:p-2.5 shadow-md border border-slate-200">
                <div className="relative overflow-hidden rounded-xl bg-white aspect-[4/3] flex items-center justify-center p-2">
                  <img
                    src="/assets/images/concrete_admixture_1785519590894.png"
                    alt="Archon Nell Concrete Solutions - Megaflow Admixture"
                    className="w-full h-full object-contain sm:object-cover rounded-lg transform hover:scale-105 transition-transform duration-700"
                  />

                  {/* Floating Consultation Card */}
                  <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 bg-white/95 backdrop-blur-md border border-slate-200 p-3 sm:p-3.5 rounded-xl flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2.5 sm:gap-3">
                      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white flex-shrink-0">
                        <FileSignature className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-extrabold text-slate-900 leading-tight">Technical Consultation</h4>
                        <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight">Fast quote for engineers &amp; contractors</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setIsCsOpen(true)}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
                    >
                      Inquire
                    </button>
                  </div>

                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= BANNER CALLOUT ================= */}
      <section className="bg-slate-950 py-5 sm:py-6 text-white border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <div>
            <h3 className="text-xs sm:text-sm md:text-base font-bold tracking-wide uppercase">
              FOR EXCELLENT REFRACTORY AND CONSTRUCTION PRODUCTS AND SERVICES GET YOUR FREE CONSULTATION AND QUOTATION NOW.
            </h3>
          </div>
          <button
            onClick={() => setIsCsOpen(true)}
            className="bg-white hover:bg-slate-100 text-slate-900 font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition-all whitespace-nowrap"
          >
            GET A QUOTE
          </button>
        </div>
      </section>
    </>
  );
}
