import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Settings, 
  User, 
  Building, 
  Mail, 
  Phone, 
  MapPin, 
  ShieldCheck, 
  Check, 
  Bell
} from 'lucide-react';

export default function AccountSettingsModal() {
  const { 
    isSettingsOpen, 
    setIsSettingsOpen, 
    currentUser, 
    updateUserProfile,
    showToast
  } = useApp();

  const [formData, setFormData] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    address: 'Felix Ave. Brgy. Sto. Domingo, Cainta, Rizal / Metro Manila Site',
    smsAlerts: true,
    emailReceipts: true
  });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        name: currentUser.name || 'Demo Customer',
        company: currentUser.company || 'Sample Construction Company',
        email: currentUser.email || 'customer@example.test',
        phone: currentUser.phone || '',
        address: currentUser.address || 'Felix Ave. Brgy. Sto. Domingo, Cainta, Rizal / Metro Manila Site',
        smsAlerts: true,
        emailReceipts: true
      });
    }
  }, [currentUser, isSettingsOpen]);

  if (!isSettingsOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('Please enter your full name.', 'error');
      return;
    }
    if (!formData.email.trim()) {
      showToast('Please enter a valid email address.', 'error');
      return;
    }

    updateUserProfile({
      name: formData.name.trim(),
      company: formData.company.trim(),
      email: formData.email.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim()
    });

    setIsSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-5 sm:p-6 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-2xl text-white">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">Account Settings &amp; Preferences</h3>
              <p className="text-[11px] text-slate-300">Edit your sample profile (browser only)</p>
            </div>
          </div>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="p-2 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
          
          {/* Account Status Badge */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                {formData.name.split(' ').map(n => n[0]).slice(0, 2).join('') || 'AN'}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-xs">{formData.name}</div>
                <div className="text-[10px] text-slate-500">{formData.company}</div>
              </div>
            </div>
            <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Demo Profile
            </span>
          </div>

          {/* Full Name */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>Full Name</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Company */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" />
              <span>Company / Contractor Organization</span>
            </label>
            <input
              type="text"
              value={formData.company}
              onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Email Address</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>Contact Mobile Phone</span>
            </label>
            <input
              type="text"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Default Delivery Address */}
          <div className="space-y-1">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>Primary Job Site / Delivery Address</span>
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-900"
            />
          </div>

          {/* Notification Preferences */}
          <div className="pt-2 border-t border-slate-200 space-y-2">
            <label className="font-bold text-slate-700 flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-slate-400" />
              <span>Notifications &amp; Alerts</span>
            </label>
            
            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-slate-700 font-medium text-[11px]">SMS Dispatch &amp; Logistics Tracking Updates</span>
              <input
                type="checkbox"
                checked={formData.smsAlerts}
                onChange={(e) => setFormData({ ...formData, smsAlerts: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200 cursor-pointer">
              <span className="text-slate-700 font-medium text-[11px]">Email Tax Invoices &amp; Order Confirmations</span>
              <input
                type="checkbox"
                checked={formData.emailReceipts}
                onChange={(e) => setFormData({ ...formData, emailReceipts: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded"
              />
            </label>
          </div>

          {/* Action buttons */}
          <div className="pt-3 flex gap-2">
            <button
              type="submit"
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-98 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Save Changes</span>
            </button>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors"
            >
              Cancel
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

