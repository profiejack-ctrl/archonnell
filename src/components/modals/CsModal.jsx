import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  X, 
  Headphones, 
  Send, 
  Bot, 
  User, 
  Package, 
  Tag, 
  Truck, 
  RotateCcw, 
  FileText, 
  CreditCard,
  Sparkles,
  HelpCircle
} from 'lucide-react';

const QUICK_TOPICS = [
  {
    id: 'stock',
    label: 'Stock Availability',
    icon: Package,
    prompt: 'How is warehouse stock tracked and what is currently available?',
    reply: 'Our catalog reflects real-time warehouse inventory directly from Cainta Central Plant. For bulk contractor allocations (>500 bags or 5,000 kg), logistics dispatch is scheduled directly with our operations team.'
  },
  {
    id: 'discount',
    label: 'Promos & Bulk Discounts',
    icon: Tag,
    prompt: 'What discount codes and bulk contractor promos are available?',
    reply: 'You can use voucher code ARCHON20 for 20% OFF on eligible orders! In addition, an automatic 10% Contractor Volume Discount applies automatically to carts with 5 or more units.'
  },
  {
    id: 'delivery',
    label: 'Freight Delivery Rates',
    icon: Truck,
    prompt: 'How much is delivery and what are the freight shipping rates?',
    reply: 'Industrial freight is calculated at PHP 500 per 1,000 kg tier across Metro Manila and Rizal dispatch corridors. Apply voucher code FREESHIP at checkout to waive standard delivery fees!'
  },
  {
    id: 'return',
    label: 'Returns & Cancellations',
    icon: RotateCcw,
    prompt: 'What is the policy for order cancellations and return requests?',
    reply: 'Pending orders can be cancelled immediately from your Customer Portal with automatic stock restoration. Delivered materials can be returned within 7 days by submitting photos via the Request Return action.'
  },
  {
    id: 'specs',
    label: 'Specs & Mix Design',
    icon: FileText,
    prompt: 'What specifications and mix standards do your products meet?',
    reply: 'Archon Nell high-early strength mortars, non-shrink grouts, and admixtures comply with ASTM C150 & PNS standards. Technical Data Sheets (TDS) and Mill Test Certificates are available upon request.'
  },
  {
    id: 'payment',
    label: 'Payment Methods & Invoices',
    icon: CreditCard,
    prompt: 'What payment options and invoice terms are supported?',
    reply: 'We support GCash with instant reference verification, Bank Transfer, Company Purchase Orders (PO) for corporate accounts, and Cash on Delivery (COD) for confirmed job sites. Official invoices are generated with every order.'
  }
];

export default function CsModal() {
  const { isCsOpen, setIsCsOpen } = useApp();
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: 'Good day! Welcome to the Archon Nell Technical Support Desk. Click on any of the popular topics below for instant, accurate technical and logistics details, or type your custom inquiry.',
      time: 'Just now'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isCsOpen) {
      scrollToBottom();
    }
  }, [messages, isCsOpen, isTyping]);

  if (!isCsOpen) return null;

  const postReply = (replyText) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          sender: 'bot',
          text: replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
      setIsTyping(false);
    }, 450);
  };

  const handleSelectTopic = (topic) => {
    const userMsg = {
      sender: 'user',
      text: topic.prompt,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    postReply(topic.reply);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userMsg = {
      sender: 'user',
      text: inputText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    const query = inputText.toLowerCase();
    setInputText('');

    // Match keywords against topics
    let botReply = 'Thank you for contacting Archon Nell Technical Support. For complex structural engineering or batching inquiries, our plant operations team is also available through official phone/email channels.';
    
    if (query.includes('stock') || query.includes('mortar') || query.includes('epoxy') || query.includes('inventory') || query.includes('available')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'stock').reply;
    } else if (query.includes('discount') || query.includes('bulky') || query.includes('promo') || query.includes('voucher') || query.includes('code')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'discount').reply;
    } else if (query.includes('delivery') || query.includes('shipping') || query.includes('deliver') || query.includes('freight') || query.includes('truck')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'delivery').reply;
    } else if (query.includes('return') || query.includes('refund') || query.includes('cancel') || query.includes('exchange')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'return').reply;
    } else if (query.includes('spec') || query.includes('mix') || query.includes('cement') || query.includes('admixture') || query.includes('tds')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'specs').reply;
    } else if (query.includes('pay') || query.includes('gcash') || query.includes('cod') || query.includes('invoice') || query.includes('terms')) {
      botReply = QUICK_TOPICS.find(t => t.id === 'payment').reply;
    }

    postReply(botReply);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col h-[620px] max-h-[92vh]">
        
        {/* Header */}
        <div className="p-4 bg-[#0b1b3d] text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md">
              <Headphones className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white">Archon Nell Technical Support Desk</h3>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Engineering & Logistics Knowledge Base</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsCsOpen(false)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 text-xs">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-2 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {m.sender === 'bot' && (
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0 shadow-xs">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] p-3.5 rounded-2xl ${
                  m.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-none shadow-sm'
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-tl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-line">{m.text}</p>
                <span className={`text-[9px] mt-1.5 block ${m.sender === 'user' ? 'text-blue-200 text-right' : 'text-slate-400'}`}>
                  {m.time}
                </span>
              </div>
              {m.sender === 'user' && (
                <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-white flex-shrink-0 shadow-xs">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex gap-2 justify-start items-center text-slate-400 text-xs py-1">
              <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-white border border-slate-200 rounded-2xl px-3 py-2 flex items-center gap-1 shadow-xs">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Selection Topics Container */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Click a topic for instant answers:</span>
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">No typing needed</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {QUICK_TOPICS.map(topic => {
              const Icon = topic.icon;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => handleSelectTopic(topic)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white hover:bg-blue-50 hover:border-blue-400 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 hover:text-blue-700 text-left transition-all shadow-xs active:scale-95"
                >
                  <Icon className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">{topic.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message Input Form */}
        <form onSubmit={handleSend} className="p-3 bg-white border-t border-slate-200 flex gap-2 flex-shrink-0">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Or type a custom technical question here..."
            className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-500 text-slate-800"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Send</span>
          </button>
        </form>

      </div>
    </div>
  );
}
