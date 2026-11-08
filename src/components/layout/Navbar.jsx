import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  Search, 
  ShoppingCart, 
  User, 
  Headphones, 
  ShieldCheck, 
  Menu, 
  X,
  LogOut,
  LayoutDashboard,
  ArrowLeft,
  Settings,
  Mail,
  Phone,
  Building
} from 'lucide-react';

export default function Navbar() {
  const { 
    cart, 
    setIsCartOpen, 
    setIsCsOpen,
    setIsAuthOpen,
    setIsSettingsOpen,
    currentUser,
    loginUser,
    logoutUser,
    searchQuery, 
    setSearchQuery,
    totalItemCount,
    currentView,
    setCurrentView
  } = useApp();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  const handleDashboardClick = () => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    if (currentUser.role === 'admin') {
      setCurrentView('admin-dashboard');
    } else {
      setCurrentView('customer-dashboard');
    }
    setUserDropdownOpen(false);
    setMobileMenuOpen(false);
  };

  const handleNavClick = (hash) => {
    setCurrentView('store');
    setMobileMenuOpen(false);
    if (hash) {
      setTimeout(() => {
        const el = document.querySelector(hash);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 50);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0b1b3d] border-b border-[#142958] shadow-lg transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-3 sm:gap-4">
            <img 
              src="/assets/images/archon_nell_logo.png" 
              alt="Archon Nell Incorporated" 
              className="h-9 sm:h-11 w-auto object-contain drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]"
            />

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-6">
            <button 
              onClick={() => handleNavClick('#home')}
              className={`text-sm font-semibold transition-colors ${
                currentView === 'store' ? 'text-white hover:text-blue-300' : 'text-slate-300 hover:text-white'
              }`}
            >
              Home
            </button>
            <button 
              onClick={() => handleNavClick('#about')}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              About Us
            </button>
            <button 
              onClick={() => handleNavClick('#projects')}
              className="text-sm font-semibold text-slate-300 hover:text-white transition-colors"
            >
              Projects
            </button>
            <button 
              onClick={() => handleNavClick('#products')}
              className="text-sm font-semibold text-white flex items-center gap-1.5 hover:text-blue-300 transition-colors"
            >
              <span>Products</span>
              <span className="bg-blue-600/30 text-blue-300 border border-blue-400/40 text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider">
                Store
              </span>
            </button>
          </nav>

          {/* Search Bar (Desktop / Tablet) */}
          <div className="hidden md:flex flex-1 max-w-xs xl:max-w-md relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, mortars, admixtures..."
              className="w-full pl-9 pr-8 py-2 bg-[#07132c]/90 text-xs sm:text-sm text-white placeholder-slate-400 rounded-full border border-[#142958] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                aria-label="Clear Search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            
            {/* Customer Support Desk */}
            <button
              onClick={() => setIsCsOpen(true)}
              className="p-2 text-slate-200 hover:text-blue-400 hover:bg-[#07132c] rounded-xl transition-colors"
              title="Technical Support Desk"
            >
              <Headphones className="w-5 h-5" />
            </button>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative p-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all flex items-center gap-2 group"
              title="View Cart"
            >
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 group-hover:scale-105 transition-transform" />
              <span className="text-xs font-bold hidden sm:inline">Cart</span>
              {totalItemCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow border-2 border-[#0b1b3d]">
                  {totalItemCount}
                </span>
              )}
            </button>

            {/* AUTH / LOGIN & DASHBOARD BUTTON */}
            {!currentUser ? (
              <button
                onClick={() => setIsAuthOpen(true)}
                className="px-3.5 sm:px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <User className="w-4 h-4" />
                <span>Login</span>
              </button>
            ) : (
              <div className="relative">
                <button
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="px-3 py-1.5 bg-[#07132c] hover:bg-[#0f234c] border border-[#142958] rounded-xl text-xs font-semibold text-white flex items-center gap-2 transition-all shadow-sm"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                    currentUser.role === 'admin'
                      ? 'bg-amber-500 text-slate-900'
                      : 'bg-blue-600 text-white'
                  }`}>
                    {currentUser.role === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold leading-none truncate max-w-[120px]">
                      {currentUser.name}
                    </div>
                    <div className="text-[10px] text-slate-400 capitalize">
                      {currentUser.role}
                    </div>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {userDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 text-slate-800 animate-in fade-in zoom-in-95 duration-150">
                    
                    {/* Rich Profile Card Header */}
                    <div className="p-3 bg-[#07132c] rounded-xl border border-[#142958] text-white space-y-2 mb-2 shadow-inner">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-sm shadow flex-shrink-0">
                          {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('') || 'RD'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold flex items-center gap-0.5 flex-shrink-0">
                              <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                              Verified Account
                            </span>
                          </div>
                          <div className="text-[10px] text-blue-300 flex items-center gap-1 truncate mt-0.5">
                            <Building className="w-3 h-3 text-blue-400 flex-shrink-0" />
                            <span className="truncate">{currentUser.company}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#142958] space-y-1 text-[11px] text-slate-300">
                        <div className="flex items-center gap-1.5 truncate">
                          <Mail className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="truncate">{currentUser.email}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span>{currentUser.phone || 'No phone set'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Links */}
                    <div className="space-y-0.5 text-slate-700">
                      <button
                        onClick={handleDashboardClick}
                        className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 rounded-xl flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <LayoutDashboard className="w-4 h-4 text-blue-600" />
                        <span>{currentUser.role === 'admin' ? 'Open Admin Dashboard' : 'Open My Dashboard'}</span>
                      </button>

                      <button
                        onClick={() => {
                          setIsSettingsOpen(true);
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-slate-100 rounded-xl flex items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <Settings className="w-4 h-4 text-slate-500" />
                        <span>Account Settings</span>
                      </button>

                      <button
                        onClick={() => {
                          logoutUser();
                          setUserDropdownOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs font-semibold hover:bg-rose-50 rounded-xl flex items-center gap-2 text-rose-600 border-t border-slate-100 transition-colors mt-1"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Sign Out</span>
                      </button>
                    </div>

                  </div>
                )}
              </div>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-200 hover:text-white rounded-lg hover:bg-[#07132c]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer (100% Mobile Responsive) */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-[#142958] space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
            {/* Search Input for Mobile */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2.5 bg-[#07132c] text-xs text-white placeholder-slate-400 rounded-xl border border-[#142958] focus:outline-none"
              />
            </div>

            {/* Nav Links */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button 
                onClick={() => handleNavClick('#home')}
                className="px-3.5 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-[#07132c] rounded-xl"
              >
                Home
              </button>
              <button 
                onClick={() => handleNavClick('#about')}
                className="px-3.5 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-[#07132c] rounded-xl"
              >
                About Us
              </button>
              <button 
                onClick={() => handleNavClick('#projects')}
                className="px-3.5 py-2.5 text-left text-xs font-semibold text-slate-200 hover:bg-[#07132c] rounded-xl"
              >
                Projects
              </button>
              <button 
                onClick={() => handleNavClick('#products')}
                className="px-3.5 py-2.5 text-left text-xs font-bold text-blue-300 hover:bg-[#07132c] rounded-xl flex items-center justify-between"
              >
                <span>Store</span>
                <span className="text-[10px] bg-blue-600/40 text-blue-200 px-1.5 py-0.5 rounded">SHOP</span>
              </button>
            </div>

            {/* Mobile Auth Button & Dashboard Switch */}
            <div className="pt-2 border-t border-[#142958]">
              {!currentUser ? (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setIsAuthOpen(true);
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                >
                  <User className="w-4 h-4" />
                  <span>Sign In</span>
                </button>
              ) : (
                <div className="space-y-2">
                  {/* Mobile Profile Card */}
                  <div className="p-3 bg-[#07132c] rounded-xl border border-[#142958] text-white space-y-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-xs shadow flex-shrink-0">
                        {currentUser.name.split(' ').map(n => n[0]).slice(0, 2).join('') || 'RD'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white truncate">{currentUser.name}</span>
                          <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded text-[9px] font-bold">
                            Verified Account
                          </span>
                        </div>
                        <div className="text-[10px] text-blue-300 truncate">{currentUser.company}</div>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 pt-1 border-t border-[#142958] space-y-0.5">
                      <div className="truncate">{currentUser.email}</div>
                      <div>{currentUser.phone || 'No phone set'}</div>
                    </div>
                  </div>

                  <button
                    onClick={handleDashboardClick}
                    className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Open {currentUser.role === 'admin' ? 'Admin Dashboard' : 'My Dashboard'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsOpen(true);
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2.5 bg-[#07132c] hover:bg-[#142958] border border-[#142958] text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Settings className="w-4 h-4 text-slate-400" />
                    <span>Account Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      logoutUser();
                      setMobileMenuOpen(false);
                    }}
                    className="w-full py-2 bg-slate-800 text-rose-400 text-xs font-semibold rounded-xl flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </header>
  );
}
