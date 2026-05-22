
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot, orderBy, getDocs } from "firebase/firestore";
import { db } from '../firebase';
import { Course, MainView, ProfessorSubView, Feedback, User } from '../types';
import { 
  Users, FileBadge, Activity, ArrowUpRight, TrendingUp, Tv, ArrowLeft, 
  Search, Filter, BookOpen, ChevronRight, Eye, X, Layers, Star, 
  FileSpreadsheet, Award, CheckCircle2, Clock, ClipboardCheck, 
  Printer, FileDown, Calendar, Download, ImageIcon, FileText, MoreVertical, Edit
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (main: MainView, sub?: ProfessorSubView) => void;
}

type DashboardSubView = 'main' | 'all_courses' | 'certificates' | 'course_details';

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [subView, setSubView] = useState<DashboardSubView>('main');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [certSearch, setCertSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  
  const [realCertificates, setRealCertificates] = useState<any[]>([]);
  const [realFeedbacks, setRealFeedbacks] = useState<Feedback[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    const unsubCourses = onSnapshot(query(collection(db, 'cursos'), orderBy('createdAt', 'desc')), (snap) => {
      setCourses(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    });

    const unsubStudents = onSnapshot(query(collection(db, 'users'), where('role', '==', 'aluno')), (snap) => {
      setStudents(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      setLoading(false);
    });

    const unsubFeedbacks = onSnapshot(collection(db, 'feedbacks'), (snap) => {
      setRealFeedbacks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Feedback)));
    });

    const unsubCerts = onSnapshot(collection(db, 'certificates'), (snap) => {
      setRealCertificates(snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data(), 
        issuedAt: d.data().issuedAt?.toDate ? d.data().issuedAt.toDate() : new Date() 
      })));
    });

    // Simulando busca de resultados de exames (em um cenário real, haveria uma coleção 'results')
    const unsubResults = onSnapshot(collection(db, 'exam_results'), (snap) => {
      setExamResults(snap.docs.map(doc => doc.data()));
    });

    return () => {
      unsubCourses();
      unsubStudents();
      unsubFeedbacks();
      unsubCerts();
      unsubResults();
    };
  }, []);

  const enrollmentMap = useMemo(() => {
    const map: Record<string, number> = {};
    students.forEach((s: any) => {
      const courseId = s.cursoInicial;
      if (courseId) map[courseId] = (map[courseId] || 0) + 1;
    });
    return map;
  }, [students]);

  // MÉTRICAS GLOBAIS REAIS
  const globalMetrics = useMemo(() => {
    if (realFeedbacks.length === 0) return { engagement: "0%", nps: "0.0" };
    const sum = realFeedbacks.reduce((acc, curr) => acc + (curr.rating || 0), 0);
    const avg = sum / realFeedbacks.length;
    const engagementPercent = (avg / 5) * 100;
    return {
      engagement: `${engagementPercent.toFixed(1)}%`,
      nps: avg.toFixed(1)
    };
  }, [realFeedbacks]);

  // MÉTRICAS ESPECÍFICAS DO CURSO SELECIONADO (REAIS)
  const courseMetrics = useMemo(() => {
    if (!selectedCourse) return null;
    
    // 1. Engajamento Real (via Feedbacks do Curso)
    const courseFeedbacks = realFeedbacks.filter(f => f.courseId === selectedCourse.id);
    const engRating = courseFeedbacks.length > 0 
      ? (courseFeedbacks.reduce((a, b) => a + b.rating, 0) / courseFeedbacks.length)
      : 0;
    const engagement = courseFeedbacks.length > 0 ? `${((engRating / 5) * 100).toFixed(1)}%` : "N/A";

    // 2. Média de Notas (via Resultados de Exames vinculados ao curso)
    // Nota: Filtramos por curso se o resultado tiver essa referência
    const courseResults = examResults.filter(r => r.courseId === selectedCourse.id);
    const avgGrade = courseResults.length > 0
      ? (courseResults.reduce((a, b) => a + (b.score || 0), 0) / courseResults.length).toFixed(1)
      : "0.0";

    // 3. Aproveitamento (Certificados emitidos vs Alunos inscritos)
    const certsIssued = realCertificates.filter(c => c.courseId === selectedCourse.id).length;
    const totalEnrolled = enrollmentMap[selectedCourse.id] || 0;
    const aproveitamento = totalEnrolled > 0 
      ? `${((certsIssued / totalEnrolled) * 100).toFixed(1)}%`
      : "0.0%";

    return { engagement, avgGrade, aproveitamento, totalEnrolled };
  }, [selectedCourse, realFeedbacks, examResults, realCertificates, enrollmentMap]);

  const handleExportMatrix = () => {
    const csvContent = "Disciplina,Titular,Categoria,Status,Inscritos\n" + 
      courses.map(c => `${c.nome},${c.professorResponsavel},${c.categoria},${c.status},${enrollmentMap[c.id] || 0}`).join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `matriz_academica_${new Date().getTime()}.csv`;
    link.click();
  };

  const handleDownloadFactSheet = (course: Course) => {
    const metrics = courseMetrics;
    const content = `
FICHA TÉCNICA ACADÊMICA
--------------------------------------
DISCIPLINA: ${course.nome}
PROFESSOR: ${course.professorResponsavel}
CATEGORIA: ${course.categoria}
NÍVEL: ${course.nivelDificuldade}
STATUS: ${course.status}

MÉTRICAS REAIS (DATA: ${new Date().toLocaleDateString()})
--------------------------------------
ALUNOS ATIVOS: ${metrics?.totalEnrolled || 0}
MÉDIA DE NOTAS: ${metrics?.avgGrade || '0.0'}
ENGAJAMENTO (NPS): ${metrics?.engagement || '0.0%'}
TAXA DE APROVEITAMENTO: ${metrics?.aproveitamento || '0.0%'}

DESCRIÇÃO PEDAGÓGICA:
${course.descricao || 'Sem descrição cadastrada.'}
--------------------------------------
Escola Bíblica EAD - Documento Gerado Automaticamente
    `;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ficha_tecnica_${course.nome.replace(/\s/g, '_')}.txt`;
    link.click();
  };

  if (loading) return (
    <div className="flex h-screen items-center justify-center p-20 bg-slate-50">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent"></div>
    </div>
  );

  if (subView === 'main') {
    return (
      <div className="space-y-6 animate-in fade-in duration-700">
        <header>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic leading-none">Painel de Controle</h1>
          <p className="text-slate-500 text-sm font-medium mt-2 italic">Gerenciamento operacional e acadêmico centralizado.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[{ label: 'Alunos Ativos', value: students.length.toString(), icon: <Users size={20} />, action: () => onNavigate('alunos') },
            { label: 'Certificados', value: realCertificates.length.toString(), icon: <FileBadge size={20} />, action: () => setSubView('certificates') },
            { label: 'Engajamento Global', value: globalMetrics.engagement, icon: <Activity size={20} />, action: () => onNavigate('professor', 'feedback') }].map((stat, i) => (
            <div key={i} onClick={stat.action} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm flex items-start justify-between group hover:border-indigo-400 hover:shadow-xl transition-all cursor-pointer">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 italic">{stat.label}</p>
                <h3 className="text-4xl font-black text-slate-900 tracking-tighter tabular-nums">{stat.value}</h3>
              </div>
              <div className="p-5 bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white rounded-[1.5rem] transition-all transform group-hover:scale-110">{stat.icon}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[500px]">
            <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><BookOpen size={20}/></div>
                <h2 className="text-xs font-black text-slate-800 uppercase tracking-widest italic">Disciplinas Recentes</h2>
              </div>
              <button onClick={() => setSubView('all_courses')} className="text-[10px] font-black uppercase text-indigo-600 hover:bg-indigo-600 hover:text-white border border-indigo-200 px-6 py-3 rounded-2xl transition-all italic tracking-widest">Ver Matriz Completa</button>
            </div>
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b italic">
                  <tr><th className="px-10 py-5">Disciplina</th><th className="px-10 py-5">Matrículas</th><th className="px-10 py-5">Professor</th><th className="px-10 py-5"></th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {courses.slice(0, 6).map(c => (
                    <tr key={c.id} className="hover:bg-indigo-50/10 transition-colors group">
                      <td className="px-10 py-6 font-black text-slate-900 text-xs uppercase italic tracking-tight">{c.nome}</td>
                      <td className="px-10 py-6 font-black text-slate-600 text-xs tabular-nums italic">{enrollmentMap[c.id] || 0} Alunos</td>
                      <td className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase italic">{c.professorResponsavel}</td>
                      <td className="px-10 py-6 text-right">
                        <button onClick={() => { setSelectedCourse(c); setSubView('course_details'); }} className="p-3 text-slate-300 hover:text-indigo-600 hover:scale-110 transition-all"><ArrowUpRight size={18} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden group border border-slate-800">
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6"><div className="w-2 h-2 bg-rose-500 rounded-full animate-ping"></div><h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-indigo-400 italic">Transmissão Master</h3></div>
                  <h3 className="text-2xl font-black mb-3 uppercase tracking-tighter italic leading-none">Aula em Tempo Real</h3>
                  <button onClick={() => onNavigate('professor', 'live')} className="w-full bg-white text-slate-900 py-4.5 rounded-[1.5rem] text-[9px] font-black uppercase tracking-[0.2em] hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-3 italic"><Tv size={16} /> Iniciar Sessão</button>
                </div>
                <Tv size={200} className="absolute -bottom-16 -right-16 text-white/5 transform group-hover:scale-110 transition-transform duration-1000" />
             </div>

             <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
                <div className="flex items-center gap-3"><div className="p-2.5 bg-slate-900 text-white rounded-xl shadow-lg"><TrendingUp size={16}/></div><h3 className="text-[10px] font-black text-slate-800 uppercase tracking-widest italic">Ferramentas de Gestão</h3></div>
                <div className="space-y-3">
                   <button onClick={() => setSubView('certificates')} className="w-full flex items-center justify-between px-8 py-5 rounded-[1.5rem] bg-slate-50 hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase italic tracking-widest group">Certificados <ChevronRight size={14}/></button>
                   <button onClick={() => onNavigate('professor', 'frequencia')} className="w-full flex items-center justify-between px-8 py-5 rounded-[1.5rem] bg-slate-50 hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase italic tracking-widest group">Frequência <ChevronRight size={14}/></button>
                   <button onClick={() => onNavigate('professor', 'feedback')} className="w-full flex items-center justify-between px-8 py-5 rounded-[1.5rem] bg-slate-50 hover:bg-indigo-600 hover:text-white transition-all text-[9px] font-black uppercase italic tracking-widest group">Avaliações <ChevronRight size={14}/></button>
                </div>
             </div>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'all_courses') {
    const filtered = courses.filter(c => {
      const matchSearch = c.nome.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCat = !filterCategory || c.categoria === filterCategory;
      const matchStatus = !filterStatus || c.status === filterStatus;
      return matchSearch && matchCat && matchStatus;
    });

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSubView('main')} className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 shadow-sm"><ArrowLeft size={20}/></button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Matriz Acadêmica Global</h1>
          </div>
          <button onClick={handleExportMatrix} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase italic shadow-xl hover:bg-emerald-700 transition-all">
            <Download size={16}/> Exportar Base Curricular
          </button>
        </header>

        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col xl:flex-row gap-6">
             <div className="relative flex-1">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Pesquisar disciplina..." className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black outline-none shadow-inner" />
             </div>
             <div className="flex gap-4">
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[9px] font-black uppercase outline-none shadow-sm"><option value="">Todas Categorias</option><option value="Básico">Básico</option><option value="Doutrina">Doutrina</option><option value="História">História</option></select>
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-[9px] font-black uppercase outline-none shadow-sm"><option value="">Todos Status</option><option value="ativo">Ativo</option><option value="rascunho">Rascunho</option></select>
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b italic">
                <tr><th className="px-10 py-6">Disciplina</th><th className="px-10 py-6">Titular</th><th className="px-10 py-6">Categoria</th><th className="px-10 py-6">Status</th><th className="px-10 py-6">Alunos Ativos</th><th className="px-10 py-6">Gestão</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => (
                  <tr key={c.id} className="hover:bg-indigo-50/10">
                    <td className="px-10 py-6 font-black text-slate-900 text-xs uppercase italic">{c.nome}</td>
                    <td className="px-10 py-6 font-bold text-slate-400 text-[10px] uppercase italic">{c.professorResponsavel}</td>
                    <td className="px-10 py-6 font-black text-indigo-500 text-[9px] uppercase italic">{c.categoria}</td>
                    <td className="px-10 py-6"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase italic ${c.status === 'ativo' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>{c.status}</span></td>
                    <td className="px-10 py-6 font-black text-slate-700 text-xs italic">{enrollmentMap[c.id] || 0} Alunos</td>
                    <td className="px-10 py-6"><button onClick={() => { setSelectedCourse(c); setSubView('course_details'); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm"><ArrowUpRight size={18}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'course_details' && selectedCourse) {
    const metrics = courseMetrics;

    return (
      <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-20">
         <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button onClick={() => setSubView('all_courses')} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all"><ArrowLeft size={20}/></button>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Perfil da Disciplina</h1>
            </div>
            <button onClick={() => handleDownloadFactSheet(selectedCourse)} className="flex items-center gap-3 bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-[9px] font-black uppercase tracking-widest italic shadow-xl hover:bg-indigo-600 transition-all"><FileText size={18}/> Baixar Ficha Técnica (Real)</button>
         </header>

         {/* CAPA DO CURSO */}
         <div className="relative h-96 w-full rounded-[4rem] overflow-hidden shadow-2xl border-4 border-white">
            {selectedCourse.capaUrl ? (
              <img src={selectedCourse.capaUrl} alt={selectedCourse.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400"><ImageIcon size={80}/></div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent flex flex-col justify-end p-12 lg:p-16">
               <div className="px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase italic tracking-[0.2em] w-fit mb-6 shadow-xl border border-indigo-500/30">Dados Extraídos do Firestore</div>
               <h2 className="text-5xl lg:text-7xl font-black text-white uppercase italic tracking-tighter leading-none">{selectedCourse.nome}</h2>
            </div>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-8">
                  <div className="flex items-center gap-4 border-b border-slate-50 pb-8">
                    <div className="w-24 h-24 bg-indigo-50 rounded-[2rem] flex items-center justify-center text-indigo-600 font-black text-3xl shadow-inner border border-indigo-100">{(selectedCourse.nome||'U').charAt(0)}</div>
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{selectedCourse.nome}</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase italic mt-2 tracking-widest">Responsável: {selectedCourse.professorResponsavel}</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
                      <Users size={24} className="text-indigo-600 mb-3" />
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1 italic tracking-widest">Alunos Ativos</p>
                      <p className="text-4xl font-black text-slate-900 tabular-nums leading-none">{metrics?.totalEnrolled || 0}</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
                      <Star size={24} className="text-amber-500 mb-3" />
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1 italic tracking-widest">Engajamento (Real)</p>
                      <p className="text-4xl font-black text-slate-900 tabular-nums leading-none">{metrics?.engagement}</p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex flex-col items-center justify-center text-center shadow-inner">
                      <Award size={24} className="text-emerald-500 mb-3" />
                      <p className="text-[9px] font-black uppercase text-slate-400 mb-1 italic tracking-widest">Dificuldade</p>
                      <p className="text-xs font-black text-slate-900 uppercase italic tracking-widest">{selectedCourse.nivelDificuldade}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 italic tracking-[0.2em] ml-2">Ementa Pedagógica</h4>
                    <p className="text-sm text-slate-600 leading-relaxed italic font-medium bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">{selectedCourse.descricao || 'Sem descrição pedagógica no banco.'}</p>
                  </div>
               </div>
            </div>

            <div className="space-y-8">
               <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white space-y-8 flex flex-col border border-white/5 relative overflow-hidden group">
                  <div className="relative z-10 space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest italic text-indigo-400">Desempenho Real do Firestore</h4>
                    <div className="pt-6 flex flex-col gap-6">
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <span className="text-[10px] font-black uppercase text-white/40 italic">Taxa de Conclusão</span>
                          <span className="text-2xl font-black tracking-tighter tabular-nums">{metrics?.aproveitamento}</span>
                        </div>
                        <div className="flex items-center justify-between border-b border-white/5 pb-4">
                          <span className="text-[10px] font-black uppercase text-white/40 italic">Média Geral de Notas</span>
                          <span className="text-2xl font-black tracking-tighter tabular-nums">{metrics?.avgGrade}</span>
                        </div>
                    </div>
                  </div>
                  <TrendingUp size={150} className="absolute -bottom-10 -right-10 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
               </div>

               <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm space-y-6">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] italic text-slate-800">Professor Titular</h4>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-indigo-600 font-black italic shadow-inner">{(selectedCourse.professorResponsavel||'P').charAt(0)}</div>
                    <div>
                      <p className="text-sm font-black text-slate-900 uppercase italic tracking-tight">{selectedCourse.professorResponsavel}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase italic mt-1">Titular da Cadeira</p>
                    </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    );
  }

  if (subView === 'certificates') {
    const filtered = realCertificates.filter(cert => 
      cert.studentName?.toLowerCase().includes(certSearch.toLowerCase()) || 
      cert.id.toLowerCase().includes(certSearch.toLowerCase()) ||
      cert.courseName?.toLowerCase().includes(certSearch.toLowerCase())
    );

    return (
      <div className="space-y-6 animate-in slide-in-from-right duration-500 pb-20">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSubView('main')} className="p-3 bg-white border border-slate-200 rounded-2xl shadow-sm hover:bg-slate-50 transition-all"><ArrowLeft size={20}/></button>
            <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Repositório de Diplomas</h1>
          </div>
          <button className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase italic shadow-xl hover:bg-emerald-700 transition-all">
            <Download size={18}/> Exportar Relatório de Emissão
          </button>
        </header>

        <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4">
             <div className="relative flex-1">
                <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={certSearch} 
                  onChange={e => setCertSearch(e.target.value)} 
                  placeholder="Pesquisar por aluno, disciplina ou ID de validação..." 
                  className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-[10px] font-black outline-none shadow-inner" 
                />
             </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b italic">
                <tr>
                  <th className="px-8 py-6">ID Validação</th>
                  <th className="px-8 py-6">Aluno</th>
                  <th className="px-8 py-6">Curso / Disciplina</th>
                  <th className="px-8 py-6">Status</th>
                  <th className="px-8 py-6">Emissão</th>
                  <th className="px-8 py-6 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px]">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="p-20 text-center text-slate-300 italic uppercase font-black text-xs tracking-widest">Nenhum registro localizado no banco.</td></tr>
                ) : filtered.map(cert => (
                  <tr key={cert.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-8 py-6 font-mono text-indigo-600 font-bold">{cert.id}</td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 uppercase italic">{cert.studentName}</span>
                        <span className="text-[9px] text-slate-400 font-bold">ID: {cert.academicId || 'S/ID'}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-500 uppercase italic">{cert.courseName}</td>
                    <td className="px-8 py-6">
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase italic border border-emerald-100">Concluído</span>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-400 uppercase italic">{cert.issuedAt.toLocaleDateString('pt-BR')}</td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 rounded-lg transition-all border border-slate-100" title="Visualizar"><Eye size={14}/></button>
                        <button className="p-2 bg-slate-50 text-slate-400 hover:text-amber-600 rounded-lg transition-all border border-slate-100" title="Editar"><Edit size={14}/></button>
                        <button className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg transition-all border border-slate-100" title="Imprimir"><Printer size={14}/></button>
                        <button className="p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white rounded-lg transition-all border border-indigo-100" title="Baixar PDF"><FileDown size={14}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

export default DashboardView;
