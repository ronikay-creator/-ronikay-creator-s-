import { useState, useEffect } from 'react';
import { 
  Users, 
  Library, 
  BookOpen, 
  Star,
  ArrowUpRight,
  Calendar,
  Clock,
  Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { collection, query, getDocs, limit, orderBy, where } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export default function Dashboard() {
  const [stats, setStats] = useState({
    students: 0,
    subjects: 0,
    journals: 0,
    assessments: 0
  });
  const [recentJournals, setRecentJournals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!auth.currentUser) return;
      
      const userId = auth.currentUser.uid;
      setLoading(true);
      
      try {
        const studentQuery = query(collection(db, 'students'), where('userId', '==', userId));
        const subjectQuery = query(collection(db, 'subjects'), where('userId', '==', userId));
        const journalQuery = query(collection(db, 'journal_entries'), where('userId', '==', userId));
        const assessmentQuery = query(collection(db, 'assessments'), where('userId', '==', userId));

        const [studentSnap, subjectSnap, journalSnap, assessmentSnap] = await Promise.all([
          getDocs(studentQuery),
          getDocs(subjectQuery),
          getDocs(journalQuery),
          getDocs(assessmentQuery)
        ]);

        setStats({
          students: studentSnap.size,
          subjects: subjectSnap.size,
          journals: journalSnap.size,
          assessments: assessmentSnap.size
        });

        // Get recent journals
        const q = query(
          collection(db, 'journal_entries'), 
          where('userId', '==', userId),
          orderBy('date', 'desc'), 
          limit(5)
        );
        const recentSnap = await getDocs(q);
        setRecentJournals(recentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchData();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const statCards = [
    { label: 'Total Siswa', value: stats.students, icon: Users, color: 'bg-blue-500' },
    { label: 'Mata Pelajaran', value: stats.subjects, icon: Library, color: 'bg-emerald-500' },
    { label: 'Jurnal Mengajar', value: stats.journals, icon: BookOpen, color: 'bg-amber-500' },
    { label: 'Total Nilai', value: stats.assessments, icon: Star, color: 'bg-purple-500' },
  ];

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-white rounded-3xl" />)}
      </div>
      <div className="h-96 bg-white rounded-3xl" />
    </div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl md:text-4xl font-display font-black text-slate-900 mb-2">Dashboard Ringkasan</h1>
        <p className="text-xs md:text-sm text-slate-500 font-medium">Selamat datang kembali di sistem manajemen pengajaran digital.</p>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`${card.color} p-2.5 rounded-xl text-white shadow-lg shadow-current/20`}>
                <card.icon className="w-5 h-5" />
              </div>
              <div className="text-slate-300 group-hover:text-indigo-600 transition-colors">
                <ArrowUpRight size={18} />
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{card.label}</p>
            <h3 className="text-3xl font-black text-slate-900">{card.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <h2 className="font-black text-slate-900 text-sm uppercase tracking-wider">Jurnal Mengajar Terakhir</h2>
            <button className="text-xs font-bold text-indigo-600 hover:underline">Lihat Semua</button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentJournals.length > 0 ? recentJournals.map((journal) => (
              <div key={journal.id} className="p-4 hover:bg-slate-50 transition-colors cursor-pointer group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors border border-slate-200">
                    <Calendar className="text-slate-400 group-hover:text-indigo-600" size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="font-bold text-slate-900 text-sm">{journal.topic}</h3>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                        {new Date(journal.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1">{journal.activity}</p>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                  <BookOpen className="text-slate-300" size={32} />
                </div>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Belum ada jurnal pengajaran.</p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions / Schedule */}
        <div className="space-y-6">
          <div className="bg-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-indigo-200 overflow-hidden relative">
            <div className="relative z-10">
              <h4 className="text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-300" />
                Input Cepat
              </h4>
              <p className="text-white/80 text-xs font-medium mb-6 leading-relaxed">Jangan lupa catat jurnal dan absen siswa hari ini.</p>
              <button className="w-full bg-white text-indigo-700 font-black text-xs uppercase tracking-widest py-3 rounded-xl hover:bg-indigo-50 transition-colors shadow-xl">
                Tambah Jurnal
              </button>
            </div>
            <div className="absolute -right-12 -bottom-12 opacity-10 rotate-12">
              <BookOpen size={160} strokeWidth={1} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
               <Clock className="w-4 h-4 text-indigo-600" />
               Waktu Server
            </h3>
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-indigo-500 rounded-full"></div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</p>
                  <p className="text-[10px] text-slate-400 font-bold italic">Waktu Lokal Sekarang</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-1.5 h-10 bg-slate-200 rounded-full"></div>
                <div>
                  <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  <p className="text-[10px] text-slate-400 font-bold italic">{new Date().toLocaleDateString('id-ID', { weekday: 'long' })}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
