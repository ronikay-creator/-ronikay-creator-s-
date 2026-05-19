import { useState, useEffect } from 'react';
import { Star, Library, Users, Save, Loader2, Calendar, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  query,
  orderBy,
  where,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Assessment() {
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [scores, setScores] = useState<Record<string, { score: any; desc: string }>>({});
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedClass, setSelectedClass] = useState('');

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

  useEffect(() => {
    if (selectedSubject && selectedDate && selectedClass && auth.currentUser) {
      fetchScores();
    }
  }, [selectedSubject, selectedDate, selectedClass]);

  async function fetchData() {
    if (!auth.currentUser) return;
    setLoading(true);
    const userId = auth.currentUser.uid;
    try {
      const studentSnap = await getDocs(query(
        collection(db, 'students'), 
        where('userId', '==', userId),
        orderBy('name', 'asc')
      ));
      const subjectSnap = await getDocs(query(
        collection(db, 'subjects'), 
        where('userId', '==', userId),
        orderBy('name', 'asc')
      ));
      
      setStudents(studentSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setSubjects(subjectSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'assessments');
    } finally {
      setLoading(false);
    }
  }

  async function fetchScores() {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'assessments'), 
        where('userId', '==', auth.currentUser.uid),
        where('date', '==', selectedDate),
        where('subjectId', '==', selectedSubject)
      );
      const snap = await getDocs(q);
      const data: Record<string, { score: any; desc: string }> = {};
      snap.docs.forEach(doc => {
        const record = doc.data();
        data[record.studentId] = { score: record.score, desc: record.description || '' };
      });
      setScores(data);
    } catch (error) {
      console.error("Error fetching scores:", error);
    }
  }

  const handleScoreChange = (studentId: string, score: any) => {
    setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], score } }));
  };

  const handleDescChange = (studentId: string, desc: string) => {
    setScores(prev => ({ ...prev, [studentId]: { ...prev[studentId], desc } }));
  };

  const handleSave = async () => {
    if (!selectedSubject || !selectedClass || !auth.currentUser) return;
    setIsSaving(true);
    try {
      const filteredStudents = students.filter(s => s.class === selectedClass);
      
      const promises = filteredStudents.map(student => {
        const item = scores[student.id];
        if (!item?.score) return null; // Skip empty scores

        const assessmentId = `${selectedDate}_${selectedSubject}_${student.id}`;
        return setDoc(doc(db, 'assessments', assessmentId), {
          id: assessmentId,
          userId: auth.currentUser!.uid,
          date: selectedDate,
          subjectId: selectedSubject,
          studentId: student.id,
          score: Number(item.score),
          description: item.desc || ''
        });
      });

      await Promise.all(promises.filter(p => p !== null));
      alert('Nilai berhasil disimpan!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'assessments');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!selectedSubject || !selectedClass || !auth.currentUser) return;
    
    if (!window.confirm(`Apakah Anda yakin ingin menghapus SEMUA nilai untuk mata pelajaran dan kelas ini pada tanggal ${new Date(selectedDate).toLocaleDateString('id-ID')}? Tindakan ini tidak dapat dibatalkan.`)) {
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      const studentsInClass = students.filter(s => s.class === selectedClass);
      
      // Direct deletion using IDs is more reliable than query-then-delete
      studentsInClass.forEach(student => {
        const assessmentId = `${selectedDate}_${selectedSubject}_${student.id}`;
        batch.delete(doc(db, 'assessments', assessmentId));
      });

      await batch.commit();
      
      // Clear local state for these students explicitly
      const newScores = { ...scores };
      studentsInClass.forEach(s => {
        newScores[s.id] = { score: '', desc: '' };
      });
      setScores(newScores);
      
      alert('Semua nilai berhasil dihapus!');
    } catch (error) {
      console.error("Error deleting all assessments:", error);
      handleFirestoreError(error, OperationType.DELETE, 'assessments');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredStudents = students.filter(s => s.class === selectedClass);

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="h-32 bg-white rounded-3xl" />
      <div className="h-96 bg-white rounded-3xl" />
    </div>;
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Penilaian Harian</h1>
        <p className="text-sm text-slate-500 font-medium">Catat perkembangan akademis siswa Anda.</p>
      </header>

      {/* Filters Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              <Calendar size={12} className="text-indigo-600" /> Tanggal
            </label>
            <input 
              type="date" 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              <Library size={12} className="text-indigo-600" /> Mata Pelajaran
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
            >
              <option value="">Pilih Mapel</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
              <Users size={12} className="text-indigo-600" /> Kelas
            </label>
            <select
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 transition-all font-bold text-sm text-slate-900"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
            >
              <option value="">Pilih Kelas</option>
              {classes.map(c => <option key={c} value={c}>Kelas {c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedClass && selectedSubject ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px] md:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16 text-center">No</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Siswa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-40 text-center">Nilai</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Keterangan / KD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.map((student, i) => (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <span className="text-[10px] font-black text-slate-400 tabular-nums">{i + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900 text-sm whitespace-nowrap">{student.name}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{student.nisn}</p>
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="number"
                        min="0"
                        max="100"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-black text-center text-sm text-slate-900"
                        value={scores[student.id]?.score !== undefined ? scores[student.id].score : ''}
                        placeholder="0"
                        onChange={(e) => handleScoreChange(student.id, e.target.value === '' ? undefined : Number(e.target.value))}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input 
                        type="text"
                        placeholder="Masukkan keterangan penilaian..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-600/10 focus:border-indigo-600 font-bold text-sm text-slate-900 placeholder:text-slate-300"
                        value={scores[student.id]?.desc || ''}
                        onChange={(e) => handleDescChange(student.id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50 flex justify-between items-center border-t border-slate-200">
            <button
              onClick={handleDeleteAll}
              disabled={isSaving}
              className="bg-rose-50 text-rose-600 px-6 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 disabled:opacity-50 transition-all flex items-center gap-2 border border-rose-100"
            >
              <Trash2 size={18} />
              Hapus Semua Nilai
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Simpan Nilai
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner text-slate-300">
            <Star size={32} />
          </div>
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest text-balance">
            Silakan pilih Tanggal, Mata Pelajaran, dan Kelas untuk memulai penilaian.
          </p>
        </div>
      )}
    </div>
  );
}
