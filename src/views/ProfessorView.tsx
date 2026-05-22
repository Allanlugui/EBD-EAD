
import React, { useState, useEffect, useMemo } from 'react';
// Fixing firestore modular imports
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  doc, 
  serverTimestamp,
  getDocs,
  writeBatch
} from "firebase/firestore";
import { db } from '../firebase';
import { Course, User, ProfessorSubView } from '../types';
import { 
  Search, 
  BookOpen, 
  Plus, 
  X, 
  Trash2,
  Pencil,
  LayoutGrid,
  Eye,
  ImageIcon
} from 'lucide-react';
import SchoolManagement from '../SchoolManagement';

interface ProfessorViewProps {
  user: User;
  activeSubView?: ProfessorSubView;
}

type ModalTab = 'geral' | 'docente' | 'midias';

const ProfessorView: React.FC<ProfessorViewProps> = ({ user, activeSubView = 'cursos' }) => {
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [activeTab, setActiveTab] = useState<ModalTab>('geral');
  const [internalSubView, setInternalSubView] = useState<ProfessorSubView>(activeSubView);
  const [selectedMatrizId, setSelectedMatrizId] = useState<string | undefined>(undefined);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tema: '',
    categoria: '',
    nivelDificuldade: 'Iniciante' as Course['nivelDificuldade'],
    capaUrl: '',
    status: 'rascunho' as Course['status'],
    professorResponsavel: user.displayName || '',
    biografiaDocente: '',
    fotoDocenteUrl: '',
    materialApoioUrl: ''
  });

  useEffect(() => {
    setInternalSubView(activeSubView);
  }, [activeSubView]);

  useEffect(() => {
    const q = query(collection(db, 'cursos'), where('professorId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snap) => {
      setMyCourses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Course)));
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user.uid]);

  const filteredCourses = useMemo(() => {
    return myCourses.filter(c => 
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.categoria.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [myCourses, searchTerm]);

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Deseja excluir este curso e seus conteúdos?')) return;
    await deleteDoc(doc(db, 'cursos', courseId));
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, professorId: user.uid, updatedAt: serverTimestamp() };
    if (editingCourse) {
      await updateDoc(doc(db, 'cursos', editingCourse.id), payload);
    } else {
      await addDoc(collection(db, 'cursos'), { ...payload, inscritos: 0, createdAt: serverTimestamp() });
    }
    setIsModalOpen(false);
  };

  const openEditModal = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      nome: course.nome, descricao: course.descricao || '', tema: course.tema || '',
      categoria: course.categoria, nivelDificuldade: course.nivelDificuldade,
      capaUrl: course.capaUrl, status: course.status, professorResponsavel: course.professorResponsavel,
      biografiaDocente: course.biografiaDocente || '', fotoDocenteUrl: course.fotoDocenteUrl || '',
      materialApoioUrl: course.materialApoioUrl || ''
    });
    setIsModalOpen(true);
  };

  if (internalSubView !== 'cursos') {
    return <SchoolManagement user={user} courses={myCourses} activeSub={internalSubView} selectedCourseId={selectedMatrizId} />;
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div><h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Meus Cursos</h1><p className="text-slate-500 text-sm font-medium italic">Seu catálogo acadêmico completo.</p></div>
        <button onClick={() => { setEditingCourse(null); setIsModalOpen(true); }} className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-2xl transition-all active:scale-95"><Plus size={18} /> Criar Disciplina</button>
      </header>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm min-h-[500px] overflow-hidden">
        <div className="p-8 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
          <div className="relative w-full max-sm:max-w-none max-w-sm">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar nos meus cursos..." 
              className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
            />
          </div>
        </div>

        {loading ? (
          <div className="p-32 text-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent mx-auto mb-4"></div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Acessando Arquivos...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 p-10">
            {filteredCourses.map(course => (
              <div key={course.id} className="group relative bg-slate-50/50 border border-slate-100 rounded-[2.5rem] hover:bg-white hover:shadow-2xl hover:border-indigo-100 transition-all duration-500 p-8 flex flex-col overflow-hidden">
                {course.capaUrl && (
                  <div className="absolute inset-0 z-0 h-40 overflow-hidden opacity-10 group-hover:opacity-20 transition-opacity">
                    <img src={course.capaUrl} alt="Capa" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="relative z-10 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-8">
                    <div className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm ${course.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{course.status}</div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                      <button onClick={() => openEditModal(course)} className="p-3 bg-white border border-slate-100 rounded-xl text-indigo-600 shadow-sm hover:scale-110 transition-all"><Pencil size={14}/></button>
                      <button onClick={() => handleDeleteCourse(course.id)} className="p-3 bg-white border border-slate-100 rounded-xl text-red-600 shadow-sm hover:scale-110 transition-all"><Trash2 size={14}/></button>
                    </div>
                  </div>
                  {course.capaUrl ? (
                    <div className="w-full h-40 rounded-2xl overflow-hidden mb-6 shadow-lg border border-white">
                      <img src={course.capaUrl} alt={course.nome} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    </div>
                  ) : (
                    <div className="w-full h-40 rounded-2xl bg-indigo-50 flex items-center justify-center mb-6 shadow-inner border border-indigo-100">
                      <ImageIcon className="text-indigo-200" size={40} />
                    </div>
                  )}
                  <h3 className="font-black text-slate-900 text-xl leading-tight uppercase tracking-tighter mb-3 group-hover:text-indigo-600 transition-colors">{course.nome}</h3>
                  <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed mb-10">{course.descricao || 'Nenhuma descrição disponível.'}</p>
                  <div className="mt-auto space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white/80 p-5 rounded-2xl border border-slate-100">
                      <div className="flex items-center gap-2"><LayoutGrid size={16} className="text-indigo-400" /> {course.inscritos} Alunos</div>
                      <span className="text-indigo-600">{course.categoria}</span>
                    </div>
                    <button onClick={() => { setSelectedMatrizId(course.id); setInternalSubView('modulos'); }} className="w-full py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 shadow-xl transition-all active:scale-[0.98]">Gerenciar Conteúdo</button>
                  </div>
                </div>
              </div>
            ))}
            {filteredCourses.length === 0 && <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] text-slate-300 font-black uppercase text-xs tracking-widest italic">Nenhum curso encontrado na busca.</div>}
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="px-10 py-8 bg-slate-50 border-b flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">{editingCourse ? 'Editar Disciplina' : 'Nova Disciplina'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-4 bg-white rounded-full shadow-sm"><X size={20} /></button>
            </div>
            <div className="flex border-b bg-slate-50/50 px-10">
              {(['geral', 'docente', 'midias'] as ModalTab[]).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)} className={`px-8 py-5 text-[10px] font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === tab ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400'}`}>{tab}</button>
              ))}
            </div>
            <form onSubmit={handleSaveCourse} className="p-10 space-y-6 max-h-[60vh] overflow-y-auto">
              {activeTab === 'geral' && (
                <div className="space-y-6">
                  <input required value={formData.nome} onChange={(e) => setFormData({...formData, nome: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-bold shadow-sm" placeholder="Nome do Curso" />
                  <textarea rows={3} value={formData.descricao} onChange={(e) => setFormData({...formData, descricao: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-medium shadow-sm" placeholder="Descrição pedagógica..."></textarea>
                  <div className="grid grid-cols-2 gap-4">
                    <select value={formData.categoria} onChange={(e) => setFormData({...formData, categoria: e.target.value})} className="px-6 py-5 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase shadow-sm"><option value="Básico">Básico</option><option value="Doutrina">Doutrina</option><option value="História">História</option></select>
                    <select value={formData.nivelDificuldade} onChange={(e) => setFormData({...formData, nivelDificuldade: e.target.value as any})} className="px-6 py-5 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase shadow-sm"><option value="Iniciante">Iniciante</option><option value="Intermediário">Intermediário</option><option value="Avançado">Avançado</option></select>
                  </div>
                </div>
              )}
              {activeTab === 'docente' && (
                <div className="space-y-6">
                  <input value={formData.professorResponsavel} onChange={(e) => setFormData({...formData, professorResponsavel: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-bold" placeholder="Titular da Cadeira" />
                  <textarea rows={4} value={formData.biografiaDocente} onChange={(e) => setFormData({...formData, biografiaDocente: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-medium" placeholder="Minicurrículo..."></textarea>
                </div>
              )}
              {activeTab === 'midias' && (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Capa do Curso (URL)</label>
                    <input type="url" value={formData.capaUrl} onChange={(e) => setFormData({...formData, capaUrl: e.target.value})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-bold" placeholder="https://..." />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-4 italic">Status de Exibição</label>
                    <select value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value as any})} className="w-full px-8 py-5 bg-slate-50 border-none rounded-2xl font-black uppercase text-[10px]"><option value="rascunho">Rascunho</option><option value="ativo">Publicado</option></select>
                  </div>
                </div>
              )}
              <div className="flex gap-4 pt-8">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase transition-colors hover:bg-slate-200">Cancelar</button>
                <button type="submit" className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase shadow-2xl hover:bg-indigo-600 transition-all">Gravar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessorView;
