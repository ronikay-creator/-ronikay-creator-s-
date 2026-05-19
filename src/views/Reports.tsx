import { useState, useEffect } from 'react';
import { FileText, Printer, Library, Users, Calendar, Loader2, Search } from 'lucide-react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export default function Reports() {
  const [data, setData] = useState<any>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedClass, setSelectedClass] = useState('');

  const classes = Array.from(new Set(students.map(s => s.class))).sort();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        fetchMeta();
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  async function fetchMeta() {
    if (!auth.currentUser) return;
    const userId = auth.currentUser.uid;
    try {
      const subSnap = await getDocs(query(
        collection(db, 'subjects'), 
        where('userId', '==', userId),
        orderBy('name', 'asc')
      ));
      const stdSnap = await getDocs(query(
        collection(db, 'students'), 
        where('userId', '==', userId),
        orderBy('name', 'asc')
      ));
      setSubjects(subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setStudents(stdSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function generateReport() {
    if (!selectedSubject || !selectedClass || !auth.currentUser) return;
    setGenerating(true);
    const userId = auth.currentUser.uid;
    try {
      const studentList = students.filter(s => s.class === selectedClass);
      
      const [journalSnap, attendanceSnap, assessmentSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'journal_entries'), 
          where('userId', '==', userId),
          where('subjectId', '==', selectedSubject), 
          orderBy('date', 'desc')
        )),
        getDocs(query(
          collection(db, 'attendance'), 
          where('userId', '==', userId),
          where('subjectId', '==', selectedSubject)
        )),
        getDocs(query(
          collection(db, 'assessments'), 
          where('userId', '==', userId),
          where('subjectId', '==', selectedSubject)
        ))
      ]);

      const journals = journalSnap.docs.map(doc => doc.data());
      const attendance = attendanceSnap.docs.map(doc => doc.data());
      const assessments = assessmentSnap.docs.map(doc => doc.data());

      // Get students in this class
      const classStudentIds = new Set(studentList.map(s => s.id));
      const classAssessments = assessments.filter(a => classStudentIds.has(a.studentId));

      // Get unique combinations of description and date (columns) for this class only
      const uniqueColumns = Array.from(new Set(
        classAssessments
          .map(a => JSON.stringify({ description: a.description, date: a.date }))
          .filter(d => {
            const parsed = JSON.parse(d);
            return parsed.description && parsed.description.trim() !== '';
          })
      ))
      .map(s => JSON.parse(s as string))
      .sort((a, b) => a.date.localeCompare(b.date));

      setData({
        subject: subjects.find(s => s.id === selectedSubject),
        class: selectedClass,
        columns: uniqueColumns,
        students: studentList.map(student => {
          const studentAttendance = attendance.filter(a => a.studentId === student.id);
          const studentAssessments = assessments.filter(a => a.studentId === student.id);
          
          const columnScores: Record<string, number | string> = {};
          uniqueColumns.forEach(col => {
            const key = `${col.description}|${col.date}`;
            const found = studentAssessments.find(a => a.description === col.description && a.date === col.date);
            columnScores[key] = found ? found.score : '-';
          });

          return {
            ...student,
            columnScores,
            stats: {
              hadir: studentAttendance.filter(a => a.status === 'Hadir').length,
              sakit: studentAttendance.filter(a => a.status === 'Sakit').length,
              izin: studentAttendance.filter(a => a.status === 'Izin').length,
              alpa: studentAttendance.filter(a => a.status === 'Alpa').length,
              avgScore: studentAssessments.length > 0 
                ? (studentAssessments.reduce((acc, curr) => acc + curr.score, 0) / studentAssessments.length).toFixed(1)
                : '-'
            }
          };
        }),
        journals: journals
      });
    } catch (e) {
      console.error(e);
      alert('Gagal menghasilkan laporan.');
    } finally {
      setGenerating(false);
    }
  }

  const handlePrint = () => {
    console.log('handlePrint triggered');
    if (!data) return;
    const originalTitle = document.title;
    try {
      const subjectName = data.subject?.name || 'Laporan';
      document.title = `Laporan_${subjectName.replace(/\s+/g, '_')}_Kelas_${data.class}`;
      
      // Focus the window first, which is often necessary in iframe environments
      window.focus();
      
      // Delay printing slightly to allow the title change to register and ensure focus
      setTimeout(() => {
        window.print();
        
        // Restore title after a longer delay to ensure the print dialog has captured it
        setTimeout(() => {
          document.title = originalTitle;
        }, 2000);
      }, 250);
    } catch (e) {
      console.error('Print failed:', e);
      // Fallback if print fails, though alert might also be blocked
      alert('Fitur cetak terdeteksi tidak merespon di browser Anda. Cobalah buka aplikasi di tab baru jika Anda menggunakan HP atau jika terus berlanjut.');
    }
  };

  if (loading) return <div className="p-20 text-center text-[#141414]/40">Memuat metadata...</div>;

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-3xl font-display font-black text-slate-900 leading-tight">Cetak Laporan</h1>
          <p className="text-sm text-slate-500 font-medium">Rekapitulasi data jurnal, absensi, dan nilai.</p>
        </div>
      </header>

      {/* Selector Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
        <button
          onClick={generateReport}
          disabled={generating || !selectedSubject || !selectedClass}
          className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-600/20 hover:bg-indigo-700 transition-all"
        >
          {generating ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
          Generate Laporan
        </button>
      </div>

      {/* Report View */}
      {data && (
        <div id="report-view" className="bg-white rounded-2xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <style>
            {`
              @media print {
                @page { size: portrait; margin: 10mm; }
                body { background: white !important; margin: 0 !important; padding: 0 !important; }
                nav, aside, header, .print-hidden, .no-print { display: none !important; }
                #report-view { border: none !important; box-shadow: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; position: static !important; }
                table { width: 100% !important; border-collapse: collapse !important; }
                th, td { font-size: 8px !important; padding: 4px !important; border: 1px solid #e2e8f0 !important; }
                .bg-slate-50 { background-color: #f8fafc !important; -webkit-print-color-adjust: exact; }
                .bg-indigo-50\/30 { background-color: rgba(238, 242, 255, 0.3) !important; -webkit-print-color-adjust: exact; }
                .text-indigo-600 { color: #4f46e5 !important; -webkit-print-color-adjust: exact; }
              }
            `}
          </style>
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-end print:hidden">
            <button 
              type="button"
              onClick={handlePrint}
              className="no-print flex items-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/20 active:scale-95 cursor-pointer z-50"
            >
              <Printer size={16} /> Cetak (PDF)
            </button>
          </div>

          <div className="p-12 font-sans text-slate-900">
            <div className="text-center mb-12 pb-8 border-b-2 border-slate-900">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">Laporan Pembelajaran</h2>
              <p className="text-lg font-bold text-slate-500 uppercase tracking-widest">{data.subject.name} — Kelas {data.class}</p>
            </div>

            <div className="grid grid-cols-2 gap-12 mb-12">
              <div>
                <h3 className="text-[10px] font-black border-b border-slate-200 pb-2 mb-4 uppercase tracking-widest text-slate-400">Informasi Umum</h3>
                <table className="w-full text-xs">
                  <tbody>
                    <tr><td className="py-2 text-slate-500 font-bold uppercase tracking-tight w-32">Guru Pengampu</td><td className="py-2 font-black">: {auth.currentUser?.displayName}</td></tr>
                    <tr><td className="py-2 text-slate-500 font-bold uppercase tracking-tight w-32">Tanggal Laporan</td><td className="py-2 font-black">: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>

            <h3 className="text-[10px] font-black border-b border-slate-200 pb-2 mb-6 uppercase tracking-widest text-slate-400">Rekapitulasi Perkembangan Siswa</h3>
            <div className="overflow-x-auto print:overflow-visible border border-slate-200 rounded-xl mb-12">
              <table className="w-full border-collapse text-xs min-w-[600px] md:min-w-0 print:min-w-0">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-4 text-center border-r border-slate-200 w-12 text-[10px]">No</th>
                    <th className="p-4 text-left border-r border-slate-200 min-w-32">Nama Siswa</th>
                    <th className="p-4 text-center border-r border-slate-200 w-8">H</th>
                    <th className="p-4 text-center border-r border-slate-200 w-8">S</th>
                    <th className="p-4 text-center border-r border-slate-200 w-8">I</th>
                    <th className="p-4 text-center border-r border-slate-200 w-8">A</th>
                    {data.columns.map((col: any) => (
                      <th key={`${col.description}-${col.date}`} className="p-2 text-center border-r border-slate-200 min-w-24 align-top bg-slate-50/50 print:bg-slate-50 print:min-w-16">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[7px] font-black text-indigo-600 uppercase tracking-tighter">
                            {new Date(col.date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[8px] font-bold text-slate-500 leading-tight line-clamp-3">
                            {col.description}
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="p-4 text-center text-indigo-600 w-16 uppercase tracking-widest text-[9px]">Avg</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.students.map((s: any, i: number) => (
                    <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 border-r border-slate-200 text-center font-medium text-slate-400">{i + 1}</td>
                      <td className="p-4 border-r border-slate-200 font-bold">{s.name}</td>
                      <td className="p-4 border-r border-slate-200 text-center font-medium text-slate-500">{s.stats.hadir}</td>
                      <td className="p-4 border-r border-slate-200 text-center font-medium text-slate-500">{s.stats.sakit}</td>
                      <td className="p-4 border-r border-slate-200 text-center font-medium text-slate-500">{s.stats.izin}</td>
                      <td className="p-4 border-r border-slate-200 text-center font-medium text-slate-500">{s.stats.alpa}</td>
                      {data.columns.map((col: any) => (
                        <td key={`${col.description}-${col.date}`} className="p-4 border-r border-slate-200 text-center font-bold text-slate-700 not-italic">
                          {s.columnScores[`${col.description}|${col.date}`]}
                        </td>
                      ))}
                      <td className="p-4 text-center font-black text-indigo-700 bg-indigo-50/30 not-italic">{s.stats.avgScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-[10px] font-black border-b border-slate-200 pb-2 mb-6 uppercase tracking-widest text-slate-400">Log Jurnal Pembelajaran</h3>
            <div className="space-y-4">
              {data.journals.map((j: any) => (
                <div key={j.id} className="p-6 border border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-black text-slate-900 text-sm">{j.topic}</span>
                    <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded uppercase tracking-widest">
                      {new Date(j.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium italic">“{j.activity}”</p>
                </div>
              ))}
            </div>
            
            <div className="mt-16 pt-12 border-t border-slate-200 hidden print:block">
              <div className="flex justify-end">
                <div className="text-center w-64">
                  <p className="text-xs font-bold mb-16 uppercase tracking-widest text-slate-500">Guru Mata Pelajaran</p>
                  <p className="border-b border-slate-900 mx-auto w-48 mb-2"></p>
                  <p className="text-sm font-black uppercase tracking-widest">{auth.currentUser?.displayName}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
