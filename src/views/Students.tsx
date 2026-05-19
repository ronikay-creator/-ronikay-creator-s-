import React, { useState, useEffect, useRef } from 'react';
import { Plus, Users, Trash2, Edit2, Loader2, Save, X, Search, User as UserIcon, FileUp, Download, Info, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';
import { 
  collection, 
  getDocs, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  doc, 
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Students() {
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, name: string} | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClassFilter, setSelectedClassFilter] = useState('Semua Kelas');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    id: '',
    nisn: '',
    name: '',
    class: '',
    gender: 'L' as 'L' | 'P'
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
        collection(db, 'students'), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('name', 'asc')
      );
      const snap = await getDocs(q);
      setStudents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'students');
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const studentData = {
        ...formData,
        userId: auth.currentUser.uid
      };
      
      if (formData.id) {
        const docRef = doc(db, 'students', formData.id);
        const { id, ...data } = studentData;
        await updateDoc(docRef, data);
      } else {
        const docId = `std-${Date.now()}`;
        await setDoc(doc(db, 'students', docId), { ...studentData, id: docId });
      }
      setIsModalOpen(false);
      setFormData({ id: '', nisn: '', name: '', class: '', gender: 'L' });
      fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!auth.currentUser) return;
        
        try {
          const batch = writeBatch(db);
          const timestamp = Date.now();
          
          results.data.forEach((row: any, index: number) => {
            const name = row.Nama || row.name || row.Name;
            const nisn = row.NISN || row.nisn;
            const className = row.Kelas || row.class || row.Class;
            const genderRaw = (row.Gender || row.Jenis_Kelamin || row.JK || row.gender || 'L').toString().toUpperCase();
            const gender = genderRaw.startsWith('P') ? 'P' : 'L';

            if (name && className) {
              const docId = `std-${timestamp}-${index}`;
              const docRef = doc(collection(db, 'students'), docId);
              batch.set(docRef, {
                id: docId,
                userId: auth.currentUser?.uid,
                name,
                nisn: nisn ? nisn.toString() : '',
                class: className.toString(),
                gender
              });
            }
          });

          await batch.commit();
          setIsImportModalOpen(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          fetchData();
          alert('Berhasil mengimport data siswa!');
        } catch (error) {
          console.error("Import error:", error);
          alert('Gagal mengimport data. Pastikan format file benar.');
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        console.error("Parse error:", error);
        alert('Gagal membaca file CSV.');
        setIsImporting(false);
      }
    });
  };

  const downloadTemplate = () => {
    const headers = ['Nama', 'NISN', 'Kelas', 'Jenis_Kelamin'];
    const sampleData = [
      ['Budi Santoso', '1234567890', '7A', 'L'],
      ['Siti Aminah', '0987654321', '7A', 'P']
    ];
    const csvContent = [headers, ...sampleData].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "template_siswa.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleEdit = (student: any) => {
    setFormData(student);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const { id } = deleteConfirm;
    setIsSaving(true);
    setDeleteConfirm(null);
    try {
      await deleteDoc(doc(db, 'students', id));
      await fetchData();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'students');
    } finally {
      setIsSaving(false);
    }
  };

  const classes = Array.from(new Set(students.map(s => s.class))).sort();

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.nisn.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.class.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = selectedClassFilter === 'Semua Kelas' || s.class === selectedClassFilter;
    return matchesSearch && matchesClass;
  });

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Data Siswa</h1>
          <p className="text-sm text-slate-500 font-medium font-sans">Kelola informasi lengkap siswa Anda.</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-600 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-50 transition-all shadow-sm"
          >
            <FileUp size={18} />
            Import
          </button>
          <button 
            onClick={() => {
              setFormData({ id: '', nisn: '', name: '', class: '', gender: 'L' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus size={18} />
            Tambah Siswa
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari nama, NISN, atau kelas..."
            className="w-full bg-white border border-slate-200 pl-12 pr-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-400 placeholder:font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full md:w-64">
          <select
            className="w-full bg-white border border-slate-200 px-4 py-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
            value={selectedClassFilter}
            onChange={(e) => setSelectedClassFilter(e.target.value)}
          >
            <option>Semua Kelas</option>
            {classes.map(c => (
              <option key={c} value={c}>Kelas {c}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="animate-spin text-indigo-600" size={40} />
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest">Memuat data siswa...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredStudents.map((student, i) => (
              <motion.div
                key={student.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group hover:shadow-md hover:border-indigo-600/30 transition-all cursor-default"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${student.gender === 'L' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-pink-50 text-pink-500 border-pink-100'}`}>
                    <UserIcon size={18} />
                  </div>
                  <div className="flex items-center gap-1 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleEdit(student)}
                      className="p-2 bg-slate-50 lg:bg-transparent hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors border border-slate-100 lg:border-transparent hover:border-slate-200"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ id: student.id, name: student.name });
                      }}
                      disabled={isSaving}
                      className="p-2 bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-red-100 hover:border-slate-200 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <h3 className="text-base font-black text-slate-900 mb-1 leading-tight">
                  <span className="text-indigo-600 mr-2">{i + 1}.</span>
                  {student.name}
                </h3>
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest leading-none">
                  <span>{student.nisn || 'No NISN'}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span>Kelas {student.class}</span>
                  <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                  <span className={student.gender === 'L' ? 'text-indigo-400' : 'text-pink-400'}>{student.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {filteredStudents.length === 0 && (
            <div className="lg:col-span-3 text-center p-20">
              <div className="w-20 h-20 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Users className="text-slate-300" size={40} />
              </div>
              <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest">Siswa tidak ditemukan.</p>
            </div>
          )}
        </div>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setIsImportModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <FileUp size={16} /> Import Data Siswa
                </h2>
                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex gap-3">
                  <Info className="text-amber-500 shrink-0" size={20} />
                  <div className="space-y-1">
                    <p className="text-amber-800 font-black text-[10px] uppercase tracking-widest">Format File</p>
                    <p className="text-amber-700 text-xs font-medium leading-relaxed">
                      Gunakan file CSV dengan kolom: <span className="font-bold">Nama, NISN, Kelas, Jenis_Kelamin</span> (L/P).
                    </p>
                  </div>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-indigo-600/30 hover:bg-slate-50 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:text-indigo-600 transition-colors">
                    {isImporting ? <Loader2 className="animate-spin" size={32} /> : <FileUp size={32} />}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-black text-slate-900 uppercase tracking-widest mb-1">
                      {isImporting ? 'Mengimport Data...' : 'Klik untuk Unggah CSV'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Maksimal 10MB per file</p>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    accept=".csv"
                    ref={fileInputRef}
                    onChange={handleImport}
                    disabled={isImporting}
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={downloadTemplate}
                    disabled={isImporting}
                    className="flex-1 bg-slate-50 text-slate-600 font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:bg-slate-100 transition-colors border border-slate-200 flex items-center justify-center gap-2"
                  >
                    <Download size={18} />
                    Template
                  </button>
                  <button
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 bg-white text-slate-400 font-black text-xs uppercase tracking-widest py-4 rounded-xl hover:text-slate-600 transition-colors"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setDeleteConfirm(null)}
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
              <h3 className="text-lg font-black text-slate-900 mb-2 uppercase tracking-tight">Hapus Siswa?</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium leading-relaxed">
                Yakin ingin menghapus <span className="font-bold text-slate-900">"{deleteConfirm.name}"</span>? 
                Data absensi dan nilai siswa ini mungkin tidak akan terhubung lagi.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-slate-50 text-slate-600 font-bold text-xs uppercase tracking-widest hover:bg-slate-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold text-xs uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
              className="relative bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-widest">
                  {formData.id ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama Lengkap</label>
                  <input
                    required
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900 placeholder:text-slate-300"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">NISN</label>
                    <input
                      type="text"
                      placeholder="Nomor Induk"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
                      value={formData.nisn}
                      onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Kelas</label>
                    <input
                      required
                      type="text"
                      placeholder="Contoh: 7A"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-6 py-4 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
                      value={formData.class}
                      onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Jenis Kelamin</label>
                  <div className="flex gap-4">
                    <label className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl cursor-pointer font-black text-xs uppercase tracking-widest transition-all border-2 ${formData.gender === 'L' ? 'bg-indigo-50 border-indigo-600 text-indigo-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <input 
                        type="radio" 
                        className="hidden" 
                        name="gender" 
                        value="L" 
                        checked={formData.gender === 'L'} 
                        onChange={() => setFormData({...formData, gender: 'L'})}
                      />
                      Laki-laki
                    </label>
                    <label className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-xl cursor-pointer font-black text-xs uppercase tracking-widest transition-all border-2 ${formData.gender === 'P' ? 'bg-pink-50 border-pink-600 text-pink-600' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                      <input 
                        type="radio" 
                        className="hidden" 
                        name="gender" 
                        value="P" 
                        checked={formData.gender === 'P'} 
                        onChange={() => setFormData({...formData, gender: 'P'})}
                      />
                      Perempuan
                    </label>
                  </div>
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
