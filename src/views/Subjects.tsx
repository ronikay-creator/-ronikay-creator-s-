import React, { useState, useEffect } from 'react';
import { Plus, Library, Trash2, Edit2, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query,
  orderBy,
  where 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Subjects() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    code: ''
  });

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchData();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function fetchData() {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'subjects'), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('name', 'asc')
      );
      const snap = await getDocs(q);
      setSubjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const subjectData = {
        ...formData,
        userId: auth.currentUser.uid
      };

      if (formData.id) {
        const docRef = doc(db, 'subjects', formData.id);
        const { id, ...data } = subjectData;
        await updateDoc(docRef, data);
      } else {
        const docId = `sub-${Date.now()}`;
        await addDoc(collection(db, 'subjects'), { ...subjectData, id: docId });
      }
      setIsModalOpen(false);
      setFormData({ id: '', name: '', code: '' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subjects');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (subject: any) => {
    setFormData(subject);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus mata pelajaran ini?')) return;
    try {
      await deleteDoc(doc(db, 'subjects', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'subjects');
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Mata Pelajaran</h1>
          <p className="text-sm text-slate-500 font-medium">Kelola daftar mata pelajaran yang Anda ajarkan.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ id: '', name: '', code: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus size={18} />
          Tambah Mapel
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="animate-spin text-[#5A5A40]" size={40} />
          <p className="text-[#141414]/40 font-medium font-serif">Memuat data mapel...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {subjects.map((subject, i) => (
              <motion.div
                key={subject.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-md hover:border-indigo-600/30 transition-all cursor-default"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-indigo-600">
                    <Library size={18} />
                  </div>
                  <div className="flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(subject)}
                      className="p-2 bg-slate-50 lg:bg-transparent hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100 lg:border-transparent hover:border-slate-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(subject.id)}
                      className="p-2 bg-red-50 text-red-400 hover:text-red-600 rounded-lg transition-colors border border-red-100 hover:border-slate-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-black text-slate-900 mb-1 leading-tight">{subject.name}</h3>
                <p className="text-slate-400 text-[10px] font-black tracking-widest uppercase">{subject.code || 'Tanpa Kode'}</p>
              </motion.div>
            ))}
          </AnimatePresence>

          {subjects.length === 0 && (
            <div className="lg:col-span-3 text-center p-20">
              <div className="w-20 h-20 bg-[#F5F5F0] rounded-full flex items-center justify-center mx-auto mb-6">
                <Library className="text-[#141414]/10" size={40} />
              </div>
              <p className="text-[#141414]/40 font-medium font-serif text-xl">Belum ada mata pelajaran.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {formData.id ? 'Edit Mata Pelajaran' : 'Tambah Mapel Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Mata Pelajaran</label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: Matematika"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kode Mapel (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: MAT-01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    Simpan
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
