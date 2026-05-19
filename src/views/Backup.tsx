import { useState } from 'react';
import { Database, Download, AlertTriangle, Loader2, CheckCircle2, Trash2, X } from 'lucide-react';
import { collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { motion, AnimatePresence } from 'motion/react';

export default function Backup() {
  const [loading, setLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [success, setSuccess] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  const collections = ['subjects', 'students', 'journal_entries', 'attendance', 'assessments'];

  async function handleBackup() {
    if (!auth.currentUser) return;
    setLoading(true);
    setSuccess(false);
    try {
      const backupData: any = {};
      const userId = auth.currentUser.uid;
      
      for (const colName of collections) {
        const q = query(collection(db, colName), where('userId', '==', userId));
        const snap = await getDocs(q);
        backupData[colName] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_jurnal_guru_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccess(true);
    } catch (e) {
      console.error(e);
      alert('Gagal melakukan backup.');
    } finally {
      setLoading(false);
    }
  }

  async function handleClearData() {
    if (!auth.currentUser) return;
    setIsClearing(true);
    setClearSuccess(false);
    try {
      const userId = auth.currentUser.uid;
      
      for (const colName of collections) {
        const q = query(collection(db, colName), where('userId', '==', userId));
        const snap = await getDocs(q);
        
        // Firestore batches are limited to 500 operations
        // If there's a lot of data, we might need multiple batches
        let batch = writeBatch(db);
        let count = 0;
        
        for (const document of snap.docs) {
          batch.delete(doc(db, colName, document.id));
          count++;
          if (count === 500) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        
        if (count > 0) {
          await batch.commit();
        }
      }

      setClearSuccess(true);
      setShowClearConfirm(false);
      setTimeout(() => setClearSuccess(false), 5000);
    } catch (e) {
      console.error(e);
      alert('Gagal mengosongkan data.');
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Pencadangan Data</h1>
        <p className="text-sm text-slate-500 font-medium">Amankan data Anda dengan mendownload salinan cadangan.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center flex flex-col">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-sm">
            <Database size={28} />
          </div>
          
          <h2 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Export Data</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium text-sm flex-grow">
            Download salinan cadangan semua data Anda (Siswa, Jurnal, Absensi, Penilaian) dalam format JSON.
          </p>

          <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 mb-8 text-left flex gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={16} />
            <p className="text-amber-700 text-[10px] font-bold leading-tight uppercase tracking-wider">Disarankan melakukan backup sebelum mengosongkan data.</p>
          </div>

          <button
            onClick={handleBackup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
            {loading ? 'Memproses...' : 'Download Backup'}
          </button>

          {success && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest"
            >
              <CheckCircle2 size={14} />
              Backup Berhasil!
            </motion.div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 text-center flex flex-col">
          <div className="w-16 h-16 bg-red-50 border border-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600 shadow-sm">
            <Trash2 size={28} />
          </div>
          
          <h2 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Kosongkan Data</h2>
          <p className="text-slate-500 mb-8 leading-relaxed font-medium text-sm flex-grow">
            Hapus semua data untuk memulai semester baru. Tindakan ini tidak dapat dibatalkan.
          </p>

          <div className="bg-red-50/50 border border-red-200 rounded-xl p-4 mb-8 text-left flex gap-3">
            <AlertTriangle className="text-red-600 shrink-0" size={16} />
            <p className="text-red-700 text-[10px] font-bold leading-tight uppercase tracking-wider">Hanya lakukan ini jika Anda sudah mendownload backup data.</p>
          </div>

          <button
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearing}
            className="w-full flex items-center justify-center gap-3 bg-white border-2 border-red-100 text-red-600 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-red-50 hover:border-red-200 transition-all disabled:opacity-50"
          >
            {isClearing ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
            {isClearing ? 'Menghapus...' : 'Mulai Semester Baru'}
          </button>

          {clearSuccess && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center justify-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest"
            >
              <CheckCircle2 size={14} />
              Data Berhasil Dikosongkan!
            </motion.div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setShowClearConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-slate-200 p-8 text-center"
            >
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Hapus Semua Data?</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                Tindakan ini akan menghapus permanen semua data Anda. Pastikan Anda sudah melakukan <span className="font-bold text-slate-900 underline">Backup</span>.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  Tidak
                </button>
                <button
                  onClick={handleClearData}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Ya, Kosongkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
