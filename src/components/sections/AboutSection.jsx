import React from 'react';
import { 
  Eye, 
  Target, 
  Wrench, 
  Award, 
  Lightbulb, 
  Truck, 
  Building, 
  MapPin, 
  Clock, 
  Phone 
} from 'lucide-react';

export default function AboutSection() {
  return (
    <section id="about" className="py-16 sm:py-20 bg-slate-50 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
          <span className="text-xs font-bold text-blue-700 uppercase tracking-widest bg-blue-50 px-3.5 py-1 rounded-full border border-blue-200 shadow-xs">
            ABOUT ARCHON NELL INC.
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-4 tracking-tight">
            Our Company
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm mt-3 leading-relaxed">
            <strong>Archon Nell Incorporated (ANI)</strong> is a 100% Filipino-owned corporation incorporated on January 14, 2011. Operations began on February 1, 2011. ANI quickly became known in the Cement, Steel, Sugar, Power, Petrochemical and Construction industries as a reliable solutions provider.
          </p>
        </div>

        {/* Vision & Mission Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 mb-12 sm:mb-16">

          {/* Vision */}
          <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-sm space-y-3 hover:shadow-md transition-shadow">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Eye className="w-5 h-5 text-blue-600" />
              <span>OUR VISION</span>
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              ANI envisions itself to be a leading player in the market segments where it operates, providing top of the line products and technologies to customers and backed up by excellent services and in partnership with world-class international companies.
            </p>
          </div>

          {/* Mission */}
          <div className="bg-white border border-slate-200 p-6 sm:p-7 rounded-2xl shadow-sm space-y-3 hover:shadow-md transition-shadow">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              <span>OUR MISSION</span>
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              ANI’s primary purpose is to provide comprehensive, innovative, cost-effective and timely solutions to our customers thereby helping them achieve their business goals. Our secondary purpose is to develop meaningful career and personal opportunities for our staff and to provide satisfactory value to our shareholders.
            </p>
          </div>

        </div>

        {/* What We Offer Cards */}
        <div className="mb-12 sm:mb-16">
          <h3 className="text-lg sm:text-xl font-extrabold text-slate-900 text-center mb-6 sm:mb-8 tracking-tight">
            WHAT WE OFFER
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">

            {/* Card 1 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Wrench className="w-5 h-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">FULL SERVICE</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Includes design, materials and professional installation.</p>
            </div>

            {/* Card 2 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">SUPERIOR PRODUCTS</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Specially formulated and guaranteed by renowned international companies.</p>
            </div>

            {/* Card 3 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                <Lightbulb className="w-5 h-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">SOLUTIONS</h4>
              <p className="text-xs text-slate-500 leading-relaxed">To address specific plant maintenance and structural repair problems.</p>
            </div>

            {/* Card 4 */}
            <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm space-y-2 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <Truck className="w-5 h-5" />
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">ON TIME DELIVERY</h4>
              <p className="text-xs text-slate-500 leading-relaxed">Prototype order tracking preview for customers and deliveries.</p>
            </div>

          </div>
        </div>

        {/* Office & Head Plant Details */}
        <div className="bg-white border border-slate-200 p-6 sm:p-8 rounded-2xl shadow-sm max-w-4xl mx-auto space-y-6">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 border-b border-slate-100 pb-4 flex items-center gap-2">
            <Building className="w-5 h-5 text-slate-700" />
            <span>Head Office &amp; Plant 2</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Plant 2 Location:</span>
                <span className="leading-relaxed">#1024 Industrial Park, Felix Ave. Brgy. Sto. Domingo, Cainta, 1900 Rizal</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-slate-700 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Working Hours:</span>
                <span className="leading-relaxed">Mondays through Fridays from 9:00 AM to 6:00 PM</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Phone className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">Direct Plant Contact:</span>
                <span className="leading-relaxed">(02) 8682 6053 (Landline Cainta Plant)</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
