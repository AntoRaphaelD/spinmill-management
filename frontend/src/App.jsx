import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, Database, LayoutDashboard, Settings, 
  Truck, Factory, FileText, Users, Package, MapPin, 
  CheckSquare, ShoppingBag, Landmark, ArrowLeftRight, 
  BarChart3, ClipboardCheck, Box, Zap, ShieldCheck, 
  MonitorDot, Cpu, HardDrive, Globe, Activity, Layers, LogOut
} from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import { authAPI, setAuthToken } from './service/api';

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
import SystemMaintenance from './components/SystemMaintenance';

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
    <Link to={to} className="relative group block outline-none">
      <motion.div
        whileHover={{ x: active ? 0 : 5 }}
        whileTap={{ scale: 0.98 }}
        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors duration-300 relative z-10 overflow-hidden
        ${active ? 'text-white' : 'text-slate-700 hover:text-slate-950'}`}
      >
        {!active && (
          <div className="absolute inset-0 bg-slate-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-20" />
        )}
        {active && (
          <motion.div 
            layoutId="sidebar-active"
            className="absolute inset-0 bg-slate-950 rounded-lg -z-10 shadow-lg shadow-slate-200"
            transition={{ type: "spring", bounce: 0.18, duration: 0.55 }}
          />
        )}
        {active && (
          <motion.div
            layoutId="sidebar-active-edge"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-blue-400"
            transition={{ type: "spring", bounce: 0.2, duration: 0.55 }}
          />
        )}
        <span className={`h-8 w-8 rounded-md flex items-center justify-center transition-all duration-300
          ${active ? 'bg-white/15 text-white shadow-inner' : `bg-white border border-slate-100 ${colorClass} group-hover:border-slate-200 group-hover:shadow-sm`}`}
        >
          <Icon size={16} className="transition-transform duration-300 group-hover:scale-110" />
        </span>
        <span className="min-w-0 flex-1 text-xs font-black uppercase tracking-normal truncate">{label}</span>
        <ChevronRight size={14} className={`transition-all duration-300 ${active ? 'opacity-100 translate-x-0 text-blue-200' : 'opacity-0 -translate-x-2 text-slate-300 group-hover:opacity-100 group-hover:translate-x-0'}`} />
        <span className={`absolute right-3 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full transition-opacity ${active ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'} ${colorClass.replace('text-', 'bg-')}`} />
      </motion.div>
    </Link>
  );
};

const SidebarPulse = () => (
  <div className="flex items-end gap-1 h-5">
    {[0, 1, 2].map((item) => (
      <motion.span
        key={item}
        animate={{ height: [6, 18, 8, 14, 6] }}
        transition={{ duration: 1.8, repeat: Infinity, delay: item * 0.18, ease: "easeInOut" }}
        className="w-1 rounded-full bg-blue-400"
      />
    ))}
  </div>
);

const SidebarMetric = ({ label, value, tone = "blue" }) => {
  const toneClass = {
    blue: "bg-blue-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-500"
  }[tone];

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-500">
        <span>{label}</span>
        <span className="text-slate-700">{value}%</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className={`h-full rounded-full ${toneClass}`}
        />
      </div>
    </div>
  );
};

/**
 * SIDEBAR SECTION WRAPPER
 */
const SidebarSection = ({ title, children, tone = "blue" }) => {
  const [open, setOpen] = useState(true);
  const toneClass = {
    blue: "bg-blue-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    slate: "bg-slate-500"
  }[tone];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 px-3"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full mb-1.5 px-2 py-2 flex items-center gap-2 text-left rounded-md hover:bg-slate-50 transition-colors"
      >
        <span className={`h-2 w-2 rounded-full ${toneClass}`} />
        <span className="flex-1 text-[11px] font-black text-slate-600 uppercase tracking-[0.16em]">{title}</span>
        <motion.span animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }} className="text-slate-300">
          <ChevronRight size={16} />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={{ visible: { transition: { staggerChildren: 0.035 } } }}
              className="space-y-1"
            >
              {React.Children.map(children, (child) => (
                <motion.div variants={{ hidden: { opacity: 0, x: -8 }, visible: { opacity: 1, x: 0 } }}>
                  {child}
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * MAIN APP
 */
export default function App() {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('kayaar-auth-token');
    const user = localStorage.getItem('kayaar-auth-user');

    if (!token || !user) return null;

    try {
      setAuthToken(token);
      return { token, user: JSON.parse(user) };
    } catch {
      localStorage.removeItem('kayaar-auth-token');
      localStorage.removeItem('kayaar-auth-user');
      return null;
    }
  });
  const [checkingSession, setCheckingSession] = useState(Boolean(auth?.token));

  useEffect(() => {
    if (!auth?.token) {
      setCheckingSession(false);
      return;
    }

    setAuthToken(auth.token);
    authAPI.me()
      .then((response) => {
        const nextAuth = { token: auth.token, user: response.data.user };
        setAuth(nextAuth);
        localStorage.setItem('kayaar-auth-user', JSON.stringify(response.data.user));
      })
      .catch(() => {
        setAuth(null);
        setAuthToken(null);
        localStorage.removeItem('kayaar-auth-token');
        localStorage.removeItem('kayaar-auth-user');
      })
      .finally(() => setCheckingSession(false));
  }, [auth?.token]);

  const handleAuthenticated = ({ token, user }) => {
    setAuthToken(token);
    localStorage.setItem('kayaar-auth-token', token);
    localStorage.setItem('kayaar-auth-user', JSON.stringify(user));
    setAuth({ token, user });
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch {
      // Clear local auth even if the backend is unavailable.
    }

    setAuth(null);
    setAuthToken(null);
    localStorage.removeItem('kayaar-auth-token');
    localStorage.removeItem('kayaar-auth-user');
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center font-sans">
        <div className="text-[10px] font-black uppercase tracking-[0.35em] text-slate-400">Checking Session</div>
      </div>
    );
  }

  return (
    <Router>
      {!auth ? (
        <LoginScreen onAuthenticated={handleAuthenticated} />
      ) : (
      <>
      <div className="flex h-screen bg-[#F8FAFC] overflow-hidden font-sans text-slate-900">
        
        {/* --- LEGENDARY SIDEBAR --- */}
        <motion.aside
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-64 bg-white border-r border-slate-200 flex flex-col z-30 shadow-xl shadow-slate-200/40 relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none" />
          <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-blue-500 via-emerald-400 to-rose-500 opacity-70" />
          {/* Logo */}
          <div className="relative p-6">
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ rotate: -8, scale: 1.05 }}
                className="h-11 w-11 bg-slate-950 rounded-xl flex items-center justify-center shadow-lg shadow-slate-300"
              >
                <Layers className="text-blue-400" size={20} />
              </motion.div>
              <div className="min-w-0">
                <h1 className="text-lg font-black uppercase tracking-tighter leading-tight">Kayaar</h1>
                <p className="text-[9px] font-bold text-blue-600 uppercase tracking-[0.3em]">Core System</p>
              </div>
              <div className="ml-auto">
                <SidebarPulse />
              </div>
            </div>
            {/* <div className="mt-5 grid grid-cols-2 gap-3"> */}
              {/* <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Mode</p>
                <p className="text-[13px] font-black uppercase text-slate-900">Secure</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-2 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-500">Node</p>
                <p className="text-[13px] font-black uppercase text-emerald-700">Live</p>
              </div> */}
            {/* </div> */}
          </div>

          {/* Navigation - ALL FIELDS INCLUDED */}
          <nav className="relative flex-1 overflow-y-auto custom-scrollbar pb-4">
            <SidebarSection title="Masters" tone="blue">
              <SidebarLink to="/accounts" label="Accounts" icon={Users} colorClass="text-blue-500" />
              <SidebarLink to="/product" label="Product Master" icon={Package} colorClass="text-blue-500" />
              <SidebarLink to="/tariff" label="Tariff Sub Head" icon={FileText} colorClass="text-blue-500" />
              <SidebarLink to="/broker" label="Broker Master" icon={Users} colorClass="text-blue-500" />
              <SidebarLink to="/transport" label="Transport" icon={MapPin} colorClass="text-blue-500" />
              <SidebarLink to="/invoice-types" label="Invoice Types" icon={Settings} colorClass="text-blue-500" />
              <SidebarLink to="/packing" label="Packing Types" icon={Box} colorClass="text-blue-500" />
            </SidebarSection>

              <SidebarSection title="Factory Operations" tone="rose">
                <SidebarLink to="/order-with" label="Sales With Order" icon={ClipboardCheck} colorClass="text-rose-500" />
                <SidebarLink to="/order-without" label="Sales WithOut Order" icon={Zap} colorClass="text-rose-500" />
                <SidebarLink to="/production" label="RG1 Production" icon={Factory} colorClass="text-rose-500" />
                <SidebarLink to="/despatch" label="Despatch Entry" icon={Truck} colorClass="text-rose-500" />
                <SidebarLink to="/invoice-prep" label="Invoice Gen" icon={FileText} colorClass="text-rose-500" />
                {/* <SidebarLink to="/invoice-approval" label="Approvals" icon={CheckSquare} colorClass="text-rose-500" /> */}
              </SidebarSection>

              <SidebarSection title="Depot Management" tone="emerald">
                <SidebarLink to="/depot-sales" label="Depot Sales" icon={ShoppingBag} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-received" label="Stock Inward" icon={Landmark} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-transfer" label="Inter-Transfer" icon={ArrowLeftRight} colorClass="text-emerald-500" />
                <SidebarLink to="/depot-inventory" label="Live Inventory" icon={Box} colorClass="text-emerald-500" />
              </SidebarSection>

            <SidebarSection title="Intelligence" tone="slate">
              <SidebarLink to="/reports" label="Analytics" icon={BarChart3} colorClass="text-slate-500" />
              <SidebarLink to="/system" label="System Logs" icon={HardDrive} colorClass="text-slate-500" />
            </SidebarSection>
          </nav>

          {/* User Profile */}
          <div className="relative m-4 rounded-xl border border-slate-200 bg-slate-50/90 p-4 shadow-sm">
             {/* <div className="space-y-3">
              <SidebarMetric label="Core" value={92} tone="blue" />
              <SidebarMetric label="Backup" value={78} tone="emerald" />
             </div> */}
             <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-3">
               <motion.div
                 whileHover={{ scale: 1.08 }}
                 className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shadow-sm text-[10px] font-black border border-slate-100"
               >
                 {auth.user.username.slice(0, 2).toUpperCase()}
               </motion.div>
               <div className="min-w-0">
                 <p className="text-[13px] font-black uppercase text-slate-900">{auth.user.username}</p>
                 <p className="text-[10px] text-emerald-700 font-bold uppercase animate-pulse">System Online</p>
               </div>
               <button
                 type="button"
                 onClick={handleLogout}
                 className="ml-auto h-8 w-8 rounded-lg bg-white text-slate-400 flex items-center justify-center shadow-sm hover:text-red-600 hover:shadow-md transition-all"
                 title="Logout"
               >
                 <LogOut size={15} />
               </button>
             </div>
          </div>
        </motion.aside>

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
                  <Route path="/system" element={<SystemMaintenance />} />
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

<style>{`
  .custom-scrollbar::-webkit-scrollbar { width: 4px; }
  .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
`}</style>
      </>
      )}
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
