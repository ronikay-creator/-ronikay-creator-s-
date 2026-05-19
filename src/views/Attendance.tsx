import { useState, useEffect } from 'react';
import { ClipboardCheck, Search, Loader2, Save, Calendar, Library } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  getDocs, 
  setDoc, 
  doc, 
  query,
  orderBy,
  where 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-utils';

export default function Attendance() {
  const [students, setStudents] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
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
      fetchAttendance();
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
      handleFirestoreError(error, OperationType.LIST, 'attendance_meta');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAttendance() {
    if (!auth.currentUser) return;
    try {
      const q = query(
        collection(db, 'attendance'), 
        where('userId', '==', auth.currentUser.uid),
        where('date', '==', selectedDate),
        where('subjectId', '==', selectedSubject)
      );
      const snap = await getDocs(q);
      const data: Record<string, string> = {};
      snap.docs.forEach(doc => {
        const record = doc.data();
        data[record.studentId] = record.status;
      });
      setAttendance(data);
    } catch (error) {
      console.error("Error fetching attendance:", error);
    }
  }

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendance(prev => ({ ...prev, [studentId]: status }));
  };

  const handleSave = async () => {
    if (!selectedSubject || !selectedClass || !auth.currentUser) return;
    setIsSaving(true);
    try {
      const filteredStudents = students.filter(s => s.class === selectedClass);
      
      const promises = filteredStudents.map(student => {
        const status = attendance[student.id] || 'Hadir';
        const attendanceId = `${selectedDate}_${selectedSubject}_${student.id}`;
        return setDoc(doc(db, 'attendance', attendanceId), {
          id: attendanceId,
          userId: auth.currentUser!.uid,
          date: selectedDate,
          subjectId: selectedSubject,
          studentId: student.id,
          status: status
        });
      });

      await Promise.all(promises);
      alert('Absensi berhasil disimpan!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'attendance');
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
        <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Presensi Siswa</h1>
        <p className="text-sm text-slate-500 font-medium">Rekap kehadiran siswa per mata pelajaran.</p>
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
              <ClipboardCheck size={12} className="text-indigo-600" /> Kelas
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

      {/* Student List */}
      {selectedClass && selectedSubject ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px] md:min-w-0">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest w-16 text-center">No</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Siswa</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Status Kehadiran</th>
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
                      <div className="flex items-center justify-center gap-1.5">
                        {['Hadir', 'Sakit', 'Izin', 'Alpa'].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(student.id, status)}
                            className={`px-3 py-2 md:px-4 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                              (attendance[student.id] || 'Hadir') === status 
                                ? status === 'Hadir' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' :
                                  status === 'Sakit' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' :
                                  status === 'Izin' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' :
                                  'bg-red-600 text-white shadow-lg shadow-red-600/20'
                                : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                            }`}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-6 bg-slate-50 flex justify-end border-t border-slate-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-indigo-600 text-white px-10 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Simpan Presensi
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-20 text-center shadow-sm">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-inner">
            <ClipboardCheck className="text-slate-300" size={32} />
          </div>
          <p className="text-slate-400 font-black text-xs uppercase tracking-widest text-balance">
            Silakan pilih Tanggal, Mata Pelajaran, dan Kelas untuk memulai presensi.
          </p>
        </div>
      )}
    </div>
  );
}
