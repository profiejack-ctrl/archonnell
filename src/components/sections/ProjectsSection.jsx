import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MapPin, Calendar, HardHat, FileText } from 'lucide-react';

export default function ProjectsSection() {
  const { projects } = useApp();
  const [activeRegion, setActiveRegion] = useState('Metro Manila');

  const filteredProjects = projects.filter(proj => 
    !proj.region || proj.region.toLowerCase() === 'metro manila'
  );

  return (
    <section id="projects" className="py-20 bg-slate-50 border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2">
              <HardHat className="w-3.5 h-3.5 text-indigo-600" />
              <span>Infrastructure Track Record</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Featured Engineering Projects
            </h2>
            <p className="text-slate-600 text-sm mt-1">
              Field-proven applications of Archon Nell high-strength mortars, epoxy injections, and concrete admixtures.
            </p>
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-2">
            {['Metro Manila'].map(region => (
              <button
                key={region}
                onClick={() => setActiveRegion(region)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeRegion === region
                    ? 'bg-[#0b1b3d] text-white shadow'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                {region === 'Metro Manila' ? 'Metro Manila' : region}
              </button>
            ))}
          </div>
        </div>

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {filteredProjects.map(project => (
            <div
              key={project.id}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-lg transition-all flex flex-col sm:flex-row group"
            >
              <div className="sm:w-1/2 bg-slate-100 relative h-56 sm:h-auto overflow-hidden">
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <span className="absolute top-3 left-3 bg-[#0b1b3d]/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                  {project.region}
                </span>
              </div>

              <div className="sm:w-1/2 p-6 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-[11px] text-slate-500">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{project.date}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 leading-snug group-hover:text-blue-600 transition-colors">
                    {project.title}
                  </h3>

                  <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{project.location}</span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed pt-1">
                    {project.summary}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{project.contractor}</span>
                  <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-medium">Sample Case</span>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}

