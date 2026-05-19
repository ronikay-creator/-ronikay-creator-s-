import React, { useState, useEffect } from 'react';
import { Plus, Search, Calendar, BookOpen, MoreVertical, Trash2, Edit2, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  orderBy,
  where 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Journal() {
  const [journals, setJournals] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('Semua Kelas');
  
  // Form State
  const [formData, setFormData] = useState({
    id: '',
    date: new Date().toISOString().split('T')[0],
    subjectId: '',
    classId: '',
    topic: '',
    activity: '',
    notes: ''
  });

  const classes = Array.from(new Set(students.map(s => s.class))).sort();

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
    const userId = auth.currentUser.uid;
    try {
      const journalSnap = await getDocs(query(
        collection(db, 'journal_entries'), 
        where('userId', '==', userId),
        orderBy('date', 'desc')
      ));
      const subjectSnap = await getDocs(query(
        collection(db, 'subjects'),
        where('userId', '==', userId)
      ));
      const studentSnap = await getDocs(query(
        collection(db, 'students'),
        where('userId', '==', userId)
      ));
      
      setJournals(journalSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSubjects(subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'journal_entries');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const journalData = {
        ...formData,
        userId: auth.currentUser.uid
      };

      if (formData.id) {
        // Update
        const docRef = doc(db, 'journal_entries', formData.id);
        const { id, ...data } = journalData;
        await updateDoc(docRef, data);
      } else {
        // Create
        const docId = `jrn-${Date.now()}`;
        await addDoc(collection(db, 'journal_entries'), { ...journalData, id: docId });
      }
      setIsModalOpen(false);
      setFormData({
        id: '',
        date: new Date().toISOString().split('T')[0],
        subjectId: '',
        classId: '',
        topic: '',
        activity: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'journal_entries');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (journal: any) => {
    setFormData(journal);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus jurnal ini?')) return;
    try {
      await deleteDoc(doc(db, 'journal_entries', id));
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'journal_entries');
    }
  };

  const getSubjectName = (id: string) => {
    return subjects.find(s => s.id === id)?.name || 'Mapel Tidak Ditemukan';
  };

  const filteredJournals = journals.filter(j => {
    const matchesSearch = j.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getSubjectName(j.subjectId).toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'Semua Kelas' || j.classId === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-slate-900">Jurnal Mengajar</h1>
          <p className="text-sm text-slate-500 font-medium">Dokumentasikan setiap kegiatan belajar mengajar Anda.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({
              id: '',
              date: new Date().toISOString().split('T')[0],
              subjectId: '',
              classId: '',
              topic: '',
              activity: '',
              notes: ''
            });
            setIsModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:scale-[1.02] transition-all shadow-lg shadow-indigo-500/20 text-xs uppercase tracking-widest"
        >
          <Plus size={18} />
          Jurnal Baru
        </button>
      </header>

      {/* Search and Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari topik atau mata pelajaran..."
            className="w-full bg-white border border-slate-200 pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="bg-white border border-slate-200 px-6 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 min-w-[200px]"
          value={selectedClassFilter}
          onChange={(e) => setSelectedClassFilter(e.target.value)}
        >
          <option value="Semua Kelas">Semua Kelas</option>
          {classes.map(c => (
            <option key={c} value={c}>Kelas {c}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="animate-spin text-[#5A5A40]" size={40} />
          <p className="text-[#141414]/40 font-medium font-serif">Memuat data jurnal...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AnimatePresence>
            {filteredJournals.map((journal) => (
              <motion.div
                key={journal.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white p-6 rounded-3xl border border-[#141414]/5 shadow-sm group hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex gap-2">
                    <div className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                      {getSubjectName(journal.subjectId)}
                    </div>
                    {journal.classId && (
                      <div className="bg-slate-50 text-slate-700 border border-slate-100 px-3 py-1 rounded-md text-[10px] font-black uppercase tracking-widest">
                        Kelas {journal.classId}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => handleEdit(journal)}
                      className="p-2 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => handleDelete(journal.id)}
                      className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-slate-200"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                
                <h3 className="text-base font-black text-slate-900 mb-2 leading-tight">{journal.topic}</h3>
                <p className="text-slate-500 text-xs mb-6 line-clamp-2 leading-relaxed">{journal.activity}</p>
                
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                    <Calendar size={12} className="text-indigo-500" />
                    {new Date(journal.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredJournals.length === 0 && (
            <div className="md:col-span-2 text-center p-20">
              <BookOpen className="mx-auto text-[#141414]/10 mb-4" size={64} />
              <p className="text-[#141414]/40 font-medium font-serif text-xl">Tidak ada jurnal yang ditemukan.</p>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Modal */}
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
              className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {formData.id ? 'Edit Jurnal' : 'Tambah Jurnal Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mata Pelajaran</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
                      value={formData.subjectId}
                      onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                    >
                      <option value="">Pilih Mata Pelajaran</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kelas</label>
                    <select
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
                      value={formData.classId}
                      onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                    >
                      <option value="">Pilih Kelas</option>
                      {classes.map(c => (
                        <option key={c} value={c}>Kelas {c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Tanggal</label>
                    <input
                      required
                      type="date"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
                      value={formData.date}
                      onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Topik Pembahasan</label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: Pengenalan Aljabar"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kegiatan Pembelajaran</label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Apa saja yang dilakukan di kelas?"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300 resize-none leading-relaxed"
                    value={formData.activity}
                    onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Catatan/Refleksi (Opsional)</label>
                  <textarea
                    rows={3}
                    placeholder="Catatan tambahan..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300 resize-none leading-relaxed"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 bg-slate-100 text-slate-600 font-black text-sm uppercase tracking-widest py-4 rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 bg-indigo-600 text-white font-black text-sm uppercase tracking-widest py-4 rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {formData.id ? 'Simpan' : 'Tambah'}
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
