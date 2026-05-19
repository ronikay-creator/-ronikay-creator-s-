/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  Users, 
  ClipboardCheck, 
  Star, 
  FileText, 
  Database, 
  Library,
  Menu,
  X,
  LogOut,
  User as UserIcon,
  Search,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, signInWithGoogle, logout, testConnection } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

// Views
import Dashboard from './views/Dashboard';
import Journal from './views/Journal';
import Attendance from './views/Attendance';
import Assessment from './views/Assessment';
import Students from './views/Students';
import Subjects from './views/Subjects';
import Reports from './views/Reports';
import Backup from './views/Backup';

type View = 'dashboard' | 'journal' | 'attendance' | 'assessment' | 'students' | 'subjects' | 'reports' | 'backup';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setSidebarOpen] = useState(false); // Default false for mobile first

  // Close sidebar on view change (especially for mobile)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [activeView]);

  // Handle sidebar initial state based on screen size
  useEffect(() => {
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }
  }, []);
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
      if (u) {
        testConnection();
      }
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-slate-200 text-center"
        >
          <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
            <BookOpen className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2 text-balance">
            E-Jurnal Guru
          </h1>
          <p className="text-slate-500 mb-8 font-sans">
            Solusi praktis manajemen pengajaran untuk guru profesional.
          </p>
          <button
            onClick={signInWithGoogle}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 hover:border-indigo-600 hover:text-indigo-600 py-3 rounded-xl transition-all duration-200 font-bold"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Masuk dengan Google
          </button>
        </motion.div>
      </div>
    );
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'journal', label: 'Jurnal Mengajar', icon: BookOpen },
    { id: 'attendance', label: 'Absensi', icon: ClipboardCheck },
    { id: 'assessment', label: 'Penilaian Harian', icon: Star },
    { id: 'students', label: 'Data Siswa', icon: Users },
    { id: 'subjects', label: 'Mapel', icon: Library },
    { id: 'reports', label: 'Cetak Laporan', icon: FileText },
    { id: 'backup', label: 'Backup', icon: Database },
  ];

  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <Dashboard />;
      case 'journal': return <Journal />;
      case 'attendance': return <Attendance />;
      case 'assessment': return <Assessment />;
      case 'students': return <Students />;
      case 'subjects': return <Subjects />;
      case 'reports': return <Reports />;
      case 'backup': return <Backup />;
      default: return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans">
      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{ 
          width: isSidebarOpen ? (window.innerWidth < 1024 ? 280 : 280) : (window.innerWidth < 1024 ? 0 : 80),
          x: isSidebarOpen ? 0 : (window.innerWidth < 1024 ? -280 : 0)
        }}
        className={`bg-slate-900 flex flex-col fixed h-full z-50 lg:static border-r border-slate-800 shadow-2xl overflow-hidden`}
      >
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3 overflow-hidden whitespace-nowrap">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0 shadow-lg shadow-indigo-500/20">
              <BookOpen className="text-white w-5 h-5" />
            </div>
            {isSidebarOpen && (
              <span className="font-display font-bold text-lg text-white tracking-tight">E-Jurnal Guru</span>
            )}
          </div>
          <button 
            onClick={() => setSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 hover:bg-white/5 rounded-lg text-white/60"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as View)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
              }`}
            >
              <item.icon size={20} className={activeView === item.id ? 'text-white' : 'group-hover:text-indigo-400'} />
              {isSidebarOpen && <span className="font-bold text-xs uppercase tracking-widest leading-none">{item.label}</span>}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-white/5 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0 border border-white/20">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
              ) : (
                <UserIcon size={16} className="text-slate-400" />
              )}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 truncate">
                <p className="text-xs font-black text-white truncate uppercase tracking-tighter">{user.displayName || 'Guru'}</p>
                <p className="text-[10px] text-slate-500 truncate font-mono">{user.email}</p>
              </div>
            )}
          </div>
          <button
            onClick={logout}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all duration-200 font-bold text-xs uppercase tracking-widest`}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Keluar</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto relative">
        {/* Header Mobile */}
        <header className="lg:hidden bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 p-4 flex items-center justify-between">
           <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <BookOpen className="text-white w-4 h-4" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900 tracking-tight">E-Jurnal</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600"
          >
            <Menu size={24} />
          </button>
        </header>

        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Global Footer */}
        <footer className="max-w-6xl mx-auto px-4 md:px-8 pb-8 flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          <div className="flex items-center gap-4">
             <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span> SYSTEM ONLINE
            </span>
            <span>PROD_REGION_ASIA</span>
          </div>
          <div>v1.0.0-PROD</div>
        </footer>
      </main>
    </div>
  );
}
