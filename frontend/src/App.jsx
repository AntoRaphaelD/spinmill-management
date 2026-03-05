import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Database, LayoutDashboard, Settings, 
  Truck, Factory, FileText, Users, Package, MapPin, 
  CheckSquare, ShoppingBag, Landmark, ArrowLeftRight, 
  BarChart3, ClipboardCheck, Box, Zap, ShieldCheck, 
  MonitorDot, Cpu, HardDrive, Globe, Activity, Layers
} from 'lucide-react';

// --- Master Components ---
import AccountMaster from './components/AccountMaster';
import BrokerMaster from './components/BrokerMaster';
import ProductMaster from './components/ProductMaster';
import TariffMaster from './components/TariffMaster';
import TransportMaster from './components/TransportMaster';
import InvoiceTypeMaster from './components/InvoiceTypeMaster';
import PackingTypeMaster from './components/PackingTypeMaster';

// --- Transactional Components ---
import SalesWithOrder from './components/SalesWithOrder';
import SalesWithoutOrder from './components/SalesWithoutOrder';
import RG1Production from './components/RG1Production';
import DespatchEntry from './components/DespatchEntry';
import InvoicePreparation from './components/InvoicePreparation';
import InvoiceApproval from './components/InvoiceApproval';

// --- Depot Management ---
import DepotSalesInvoice from './components/DepotSalesInvoice';
import DepotStockReceived from './components/DepotStockReceived';
import { DepotTransfer } from './components/DepotTransfer';
import DepotStorage from './components/DepotStorage';

// --- Reports ---
import ReportsDashboard from './components/ReportsDashboard';

/**
 * ANIMATED HOME SCREEN
 */
const DashboardHome = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  };

  return (
    <motion.div initial="hidden" animate="visible" className="relative p-10 flex flex-col items-center justify-center min-h-[85vh] overflow-hidden">
      {/* Abstract Background Logic */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:40px_40px] opacity-30" />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity }} className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-50/50 to-transparent" />
      </div>

      <motion.div variants={containerVariants} className="relative z-10 w-full max-w-6xl text-center">
        <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.3em] mb-8">
          <Activity size={12} className="text-blue-400" /> System Active: FY 2025-26
        </motion.div>
        
        <motion.h2 variants={itemVariants} className="text-7xl font-black text-slate-900 uppercase tracking-tighter mb-4">
          Kayaar <span className="text-blue-600">ERP</span>
        </motion.h2>
        <motion.p variants={itemVariants} className="text-slate-400 font-bold uppercase text-xs tracking-[0.5em] mb-16">
          Next-Generation Enterprise Resource Planning
        </motion.p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { title: "Core Masters", icon: Database, color: "blue", path: "/accounts", desc: "Entities, Products & Logistics" },
            { title: "Factory Ops", icon: Factory, color: "rose", path: "/order-with", desc: "Production & Sales Pipeline" },
            { title: "Depot & Stock", icon: WarehouseIcon, color: "emerald", path: "/depot-inventory", desc: "Inventory & Global Transfers" },
          ].map((card, idx) => (
            <motion.div key={idx} variants={itemVariants} whileHover={{ y: -10 }} className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 group cursor-pointer">
               <div className={`h-14 w-14 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-${card.color}-600 group-hover:text-white transition-all duration-500`}>
                 <card.icon size={28} />
               </div>
               <h3 className="text-xl font-black text-slate-800 uppercase mb-2">{card.title}</h3>
               <p className="text-sm text-slate-500 mb-6">{card.desc}</p>
               <Link to={card.path} className="text-[10px] font-black uppercase tracking-widest text-blue-600 border-b-2 border-blue-100 pb-1">Open Module</Link>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

const WarehouseIcon = (props) => (
  <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21V7L12 3L21 7V21"/><path d="M9 21V12H15V21"/></svg>
);

/**
 * THE LEGENDARY SIDEBAR LINK
 */
const SidebarLink = ({ to, label, icon: Icon, colorClass }) => {
  const loc = useLocation();
  const active = loc.pathname === to;
  
  return (
    <Link to={to} className="relative group block">
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-300 relative z-10
        ${active ? 'text-white' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}`}
      >
        <Icon size={18} className={`${active ? 'text-white' : colorClass} transition-transform group-hover:scale-110`} />
        <span className="text-[11px] font-bold uppercase tracking-tight">{label}</span>
        {active && (
          <motion.div 
            layoutId="sidebar-active"
            className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-lg shadow-blue-200"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
      </div>
    </Link>
  );
};

/**
 * SIDEBAR SECTION WRAPPER
 */
const SidebarSection = ({ title, children }) => (
  <div className="mb-6 px-4">
    <h5 className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 px-2 flex items-center gap-2">
      <div className="h-px flex-1 bg-slate-100"></div>
      {title}
      <div className="h-px flex-1 bg-slate-100"></div>
    </h5>
    <div className="space-y-1">{children}</div>
  </div>
);

/**
 * MAIN APP
 */
export default function App() {
  return (
    <Router>
      <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
        
        {/* --- LEGENDARY SIDEBAR --- */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col z-30 shadow-sm">
          {/* Logo */}
          <div className="p-8">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg">
                <Layers className="text-blue-400" size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black uppercase tracking-tighter leading-tight">Kayaar</h1>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.3em]">Core System</p>
              </div>
            </div>
          </div>

          {/* Navigation - ALL FIELDS INCLUDED */}
          <nav className="flex-1 overflow-y-auto custom-scrollbar pb-10">
            <SidebarSection title="Masters">
              <SidebarLink to="/accounts" label="Accounts" icon={Users} colorClass="text-blue-500" />
              <SidebarLink to="/product" label="Product Master" icon={Package} colorClass="text-blue-500" />
              <SidebarLink to="/tariff" label="Tariff Sub Head" icon={FileText} colorClass="text-blue-500" />
              <SidebarLink to="/broker" label="Broker Master" icon={Users} colorClass="text-blue-500" />
              <SidebarLink to="/transport" label="Transport" icon={MapPin} colorClass="text-blue-500" />
              <SidebarLink to="/invoice-types" label="Invoice Types" icon={Settings} colorClass="text-blue-500" />
              <SidebarLink to="/packing" label="Packing Types" icon={Box} colorClass="text-blue-500" />
            </SidebarSection>

              <SidebarSection title="Factory Operations">
                <SidebarLink to="/order-with" label="Sales With Order" icon={ClipboardCheck} colorClass="text-rose-500" />
                <SidebarLink to="/order-without" label="Sales WithOut Order" icon={Zap} colorClass="text-rose-500" />
                <SidebarLink to="/production" label="RG1 Production" icon={Factory} colorClass="text-rose-500" />
                <SidebarLink to="/despatch" label="Despatch Entry" icon={Truck} colorClass="text-rose-500" />
                <SidebarLink to="/invoice-prep" label="Invoice Gen" icon={FileText} colorClass="text-rose-500" />
                <SidebarLink to="/invoice-approval" label="Approvals" icon={CheckSquare} colorClass="text-rose-500" />
              </SidebarSection>

              <SidebarSection title="Depot Management">
                <SidebarLink to="/depot-sales" label="Depot Sales" icon={ShoppingBag} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-received" label="Stock Inward" icon={Landmark} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-transfer" label="Inter-Transfer" icon={ArrowLeftRight} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-inventory" label="Live Inventory" icon={Box} colorClass="text-emerald-500" />
              </SidebarSection>

            <SidebarSection title="Intelligence">
              <SidebarLink to="/reports" label="Analytics" icon={BarChart3} colorClass="text-slate-500" />
            </SidebarSection>
          </nav>

          {/* User Profile */}
          <div className="p-4 bg-slate-50 m-4 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-3">
               <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shadow-sm text-[10px] font-black">AD</div>
               <div>
                 <p className="text-[10px] font-black uppercase">Administrator</p>
                 <p className="text-[8px] text-emerald-500 font-bold uppercase animate-pulse">● System Online</p>
               </div>
             </div>
          </div>
        </aside>

        {/* --- MAIN VIEWPORT --- */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-20">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1 bg-red-600 text-white text-[10px] font-black italic rounded">K</div>
              <h1 className="text-slate-800 font-black text-sm uppercase tracking-widest">Kayaar Exports <span className="text-slate-300 mx-2">|</span> <span className="text-blue-600">Digital Core</span></h1>
            </div>
            
            <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest">
              <div className="flex flex-col items-end">
                <span className="text-slate-400">Server Time</span>
                <span className="text-slate-900">{new Date().toLocaleTimeString()}</span>
              </div>
              <div className="h-8 w-px bg-slate-100"></div>
              <div className="flex flex-col items-end">
                <span className="text-slate-400">Node Status</span>
                <span className="text-emerald-500">Secure</span>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto bg-[#FBFBFB] relative custom-scrollbar">
            <AnimatePresence mode="wait">
              <PageTransition key={window.location.pathname}>
                <Routes>
                  <Route path="/" element={<DashboardHome />} />
                  <Route path="/accounts" element={<AccountMaster />} />
                  <Route path="/product" element={<ProductMaster />} />
                  <Route path="/tariff" element={<TariffMaster />} />
                  <Route path="/broker" element={<BrokerMaster />} />
                  <Route path="/transport" element={<TransportMaster />} />
                  <Route path="/invoice-types" element={<InvoiceTypeMaster />} />
                  <Route path="/packing" element={<PackingTypeMaster />} />
                  <Route path="/order-with" element={<SalesWithOrder />} />
                  <Route path="/order-without" element={<SalesWithoutOrder />} />
                  <Route path="/production" element={<RG1Production />} />
                  <Route path="/despatch" element={<DespatchEntry />} />
                  <Route path="/invoice-prep" element={<InvoicePreparation />} />
                  <Route path="/invoice-approval" element={<InvoiceApproval />} />
                  <Route path="/depot-sales" element={<DepotSalesInvoice />} />
                  <Route path="/depot-received" element={<DepotStockReceived />} />
                  <Route path="/depot-transfer" element={<DepotTransfer />} />
                  <Route path="/depot-inventory" element={<DepotStorage />} />
                  <Route path="/reports" element={<ReportsDashboard />} />
                </Routes>
              </PageTransition>
            </AnimatePresence>
          </main>

          <footer className="h-8 bg-slate-900 text-slate-500 text-[8px] px-8 flex items-center justify-between font-mono uppercase tracking-[0.3em]">
             <div className="flex gap-6">
               <span className="flex items-center gap-1"><ShieldCheck size={10} className="text-blue-500"/> Data Encrypted</span>
               <span>Node: 127.0.0.1</span>
             </div>
             <div className="text-slate-400 font-bold">© Kayaar Exports Pvt Ltd 2026</div>
          </footer>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </Router>
  );
}

const PageTransition = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, x: 5 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -5 }}
    transition={{ duration: 0.2 }}
  >
    {children}
  </motion.div>
);