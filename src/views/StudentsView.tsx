
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, query, where, onSnapshot, deleteDoc, serverTimestamp, doc, setDoc, updateDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword, updateProfile, getAuth, signOut } from "firebase/auth";
import { initializeApp, getApp, getApps } from "firebase/app";
import { db, auth } from '../firebase';
import { User, Course } from '../types';
import { 
  Search, UserPlus, X, Save, UserCog, Trash2, Edit3, Camera, Eye, 
  MapPin, RefreshCw, ShieldCheck, CreditCard, Phone, Download, 
  FileSpreadsheet, Mail, Lock, CheckCircle2, AlertCircle, Ban
} from 'lucide-react';

// Re-declare config for secondary app initialization with CORRECT bucket
const firebaseConfig = {
  apiKey: "AIzaSyBr5ZmAaZGOr_3SbrfyoCwhoKonx2DsLb0",
  authDomain: "siteigreja-461f6.firebaseapp.com",
  projectId: "siteigreja-461f6",
  storageBucket: "siteigreja-461f6.appspot.com", // FIXED: Use appspot.com
  messagingSenderId: "612518994868",
  appId: "1:612518994868:web:c0e25d7664ad1ca67f88e1"
};

const StudentsView: React.FC = () => {
  const [students, setStudents] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Estado do formulário unificado
  const [formData, setFormData] = useState({
    nome: '', 
    emailPessoal: '', 
    emailAcademico: '', 
    telefone: '', 
    cursoId: '', 
    status: 'ativo', 
    cpf: '', 
    nascimento: '', 
    fotoUrl: '', 
    password: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' }
  });

  useEffect(() => {
    // Busca todos os alunos (ativos, pendentes, bloqueados)
    const unsubS = onSnapshot(query(collection(db, 'users'), where('role', '==', 'aluno')), s => {
      setStudents(s.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
      setLoading(false);
    });
    const unsubC = onSnapshot(collection(db, 'cursos'), s => setCourses(s.docs.map(d => ({ id: d.id, ...d.data() } as Course))));
    return () => { unsubS(); unsubC(); };
  }, []);

  const handleCepSearch = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setFormData(prev => ({ ...prev, endereco: { ...prev.endereco, cep: cleanCep } }));
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setFormData(prev => ({
            ...prev,
            endereco: { 
              ...prev.endereco, 
              rua: data.logradouro, 
              bairro: data.bairro, 
              cidade: data.localidade, 
              uf: data.uf 
            }
          }));
        }
      } catch (e) { console.error("CEP error", e); }
    }
  };

  const generateAcademicEmail = async (fullName: string) => {
    const names = fullName.trim().toLowerCase().split(' ');
    const first = names[0];
    const last = names.length > 1 ? names[names.length - 1] : '';
    return `${first}.${last}@ead.com`; 
  };

  const compressImage = (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  const filtered = useMemo(() => students.filter(s => {
    const term = searchTerm.toLowerCase();
    const name = (s.displayName || (s as any).nome || '').toLowerCase();
    const email = (s.email || '').toLowerCase();
    const id = ((s as any).academicId || '').toLowerCase();
    return name.includes(term) || email.includes(term) || id.includes(term);
  }), [students, searchTerm]);

  const handleExportExcel = () => {
    const headers = "Nome,Matricula,Email Login,Email Pessoal,CPF,Telefone,Status,Curso,Cidade/UF\n";
    const rows = students.map(s => {
      const curso = courses.find(c => c.id === (s as any).cursoInicial)?.nome || 'N/A';
      const end = (s as any).endereco;
      return `"${s.displayName}","${(s as any).academicId || ''}","${s.email}","${(s as any).emailPessoal || ''}","${(s as any).cpf || ''}","${(s as any).telefone || ''}","${(s as any).status}","${curso}","${end?.cidade || ''}/${end?.uf || ''}"`;
    }).join("\n");
    
    const blob = new Blob(["\uFEFF" + headers + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Alunos_EB_EAD_${new Date().toLocaleDateString()}.csv`;
    link.click();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      let finalUid = selectedStudent?.uid;
      const academicId = selectedStudent?.academicId || `MAT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      // CREATE USER IN AUTH IF NEW (Using Secondary App to avoid logging out Admin)
      if (!selectedStudent) {
        try {
          if (!formData.emailAcademico || !formData.password) {
            throw new Error("Email e Senha são obrigatórios para novo cadastro.");
          }

          // Initialize secondary app to create user without logging out admin
          let secondaryApp;
          try {
            secondaryApp = getApp("SecondaryAuth");
          } catch (e) {
            secondaryApp = initializeApp(firebaseConfig, "SecondaryAuth");
          }
          
          const secondaryAuth = getAuth(secondaryApp);
          const userCred = await createUserWithEmailAndPassword(secondaryAuth, formData.emailAcademico.trim().toLowerCase(), formData.password);
          
          // Update profile on the new auth user
          await updateProfile(userCred.user, {
            displayName: formData.nome,
            photoURL: formData.fotoUrl || null
          });

          finalUid = userCred.user.uid;
          
          // Sign out of secondary auth immediately to clean up
          await signOut(secondaryAuth);

        } catch (authErr: any) {
           console.error("Auth creation failed:", authErr);
           alert("Erro ao criar login: " + authErr.message);
           setActionLoading(false);
           return;
        }
      }

      // PAYLOAD FOR FIRESTORE
      const payload: any = {
        uid: finalUid,
        displayName: formData.nome,
        nome: formData.nome,
        email: formData.emailAcademico.toLowerCase().trim(),
        emailPessoal: formData.emailPessoal.toLowerCase().trim(),
        telefone: formData.telefone,
        cpf: formData.cpf,
        nascimento: formData.nascimento,
        photoURL: formData.fotoUrl || '',
        endereco: {
          cep: formData.endereco.cep,
          rua: formData.endereco.rua,
          numero: formData.endereco.numero,
          bairro: formData.endereco.bairro,
          cidade: formData.endereco.cidade,
          uf: formData.endereco.uf
        },
        cursoInicial: formData.cursoId,
        role: 'aluno',
        status: formData.status,
        academicId,
        updatedAt: serverTimestamp()
      };

      if (!selectedStudent) {
        payload.createdAt = serverTimestamp();
        payload.passwordHint = formData.password; // Optional: Store pwd hint for admin reference if policy allows
        payload.termsAccepted = false;
        payload.sincronizado = true;
        
        // Use merge: true to ensure atomic write with any Auth trigger listeners
        await setDoc(doc(db, 'users', finalUid), payload, { merge: true });
      } else {
        await updateDoc(doc(db, 'users', finalUid), payload);
      }

      setIsRegisterModalOpen(false);
      setSelectedStudent(null);
      alert("Aluno matriculado com sucesso! Acesso (Login/Senha) criado e dados salvos.");
    } catch (err: any) {
      alert("Erro na operação: " + err.message);
    } finally { setActionLoading(false); }
  };

  const openEdit = (s: any) => {
    setSelectedStudent(s);
    setFormData({
      nome: s.displayName || s.nome || '',
      emailPessoal: s.emailPessoal || '',
      emailAcademico: s.email || '',
      telefone: s.telefone || '',
      cursoId: s.cursoInicial || '',
      status: s.status || 'ativo',
      cpf: s.cpf || '',
      nascimento: s.nascimento || '',
      fotoUrl: s.photoURL || '',
      password: s.passwordHint || '',
      endereco: s.endereco || { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' }
    });
    setIsRegisterModalOpen(true);
  };

  const openNew = () => {
    setSelectedStudent(null);
    setFormData({
      nome: '', emailPessoal: '', emailAcademico: '', telefone: '', cursoId: '', 
      status: 'ativo', cpf: '', nascimento: '', fotoUrl: '', password: '',
      endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' }
    });
    setIsRegisterModalOpen(true);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
           const compressed = await compressImage(ev.target.result as string);
           setFormData(prev => ({...prev, fotoUrl: compressed}));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-20 text-center flex flex-col items-center gap-6"><RefreshCw className="animate-spin text-indigo-600" size={40}/><p className="font-black text-slate-400 uppercase italic text-xs tracking-[0.5em]">Carregando Base...</p></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* HEADER DA GESTÃO */}
      <header className="bg-white p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row justify-between items-center shadow-lg gap-4">
        <div>
           <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Gestão de Alunos</h1>
           <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic leading-none">Administração Acadêmica</p>
        </div>
        <div className="flex gap-3">
           <button onClick={handleExportExcel} className="bg-emerald-50 text-emerald-600 px-5 py-3 rounded-xl text-[10px] font-black uppercase italic hover:bg-emerald-100 transition-all flex items-center gap-2 border border-emerald-100"><FileSpreadsheet size={16}/> Excel</button>
           <button onClick={openNew} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase italic hover:bg-indigo-600 transition-all flex items-center gap-2 shadow-lg active:scale-95 shadow-indigo-100"><UserPlus size={16}/> Matrícula</button>
        </div>
      </header>

      {/* TABELA DE ALUNOS */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-50 bg-slate-50/30 flex flex-col md:flex-row gap-4 items-center">
           <div className="relative flex-1 w-full"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16}/><input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar por Nome, Matrícula ou E-mail..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-600 shadow-inner" /></div>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
           <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[9px] font-black uppercase italic text-slate-400 border-b border-slate-100 tracking-widest">
                 <tr>
                    <th className="px-6 py-4">Identificação</th>
                    <th className="px-6 py-4 text-center">Matrícula</th>
                    <th className="px-6 py-4">Dados de Acesso</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-center">Gestão</th>
                 </tr>
              </thead>
              <tbody className="text-xs">
                 {filtered.length === 0 ? (
                   <tr><td colSpan={5} className="p-20 text-center text-slate-300 font-black uppercase italic text-xs tracking-widest">Nenhum Aluno Encontrado.</td></tr>
                 ) : filtered.map(s => (
                   <tr key={s.uid} className="border-b border-slate-50 hover:bg-indigo-50/10 transition-all group">
                      <td className="px-6 py-3">
                         <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 overflow-hidden border-2 border-white shadow-sm shrink-0">
                               {s.photoURL ? <img src={s.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black italic text-slate-300 text-sm">{(s.displayName||'U').charAt(0)}</div>}
                            </div>
                            <div>
                               <p className="font-black uppercase text-slate-900 italic tracking-tight text-xs leading-none">{s.displayName}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-tighter italic flex items-center gap-1"><Mail size={10}/> {s.email}</p>
                            </div>
                         </div>
                      </td>
                      <td className="px-6 py-3 text-center font-mono font-black text-indigo-600 text-xs tracking-tighter">{(s as any).academicId || '---'}</td>
                      <td className="px-6 py-3">
                         <div className="space-y-0.5">
                            <p className="text-[10px] font-bold text-slate-600">Login: <span className="text-indigo-600">{s.email}</span></p>
                            <p className="text-[9px] text-slate-400 italic">Pessoal: {(s as any).emailPessoal || '---'}</p>
                         </div>
                      </td>
                      <td className="px-6 py-3 text-center">
                         <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase italic border flex items-center justify-center gap-1 w-fit mx-auto ${
                           (s as any).status === 'ativo' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                           (s as any).status === 'bloqueado' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                           'bg-amber-50 text-amber-600 border-amber-100'
                         }`}>
                           {(s as any).status === 'ativo' ? <CheckCircle2 size={10}/> : (s as any).status === 'bloqueado' ? <Ban size={10}/> : <AlertCircle size={10}/>}
                           {(s as any).status || 'PENDENTE'}
                         </span>
                      </td>
                      <td className="px-6 py-3 text-center">
                         <div className="flex justify-center gap-2">
                            <button onClick={() => { setSelectedStudent(s); setIsViewModalOpen(true); }} className="p-2 bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Ver Prontuário"><Eye size={14}/></button>
                            <button onClick={() => openEdit(s)} className="p-2 bg-slate-50 text-slate-400 hover:text-amber-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Editar"><Edit3 size={14}/></button>
                            <button onClick={async () => { if(confirm('ATENÇÃO: Excluir este aluno removerá todo o histórico escolar. Confirmar?')) await deleteDoc(doc(db, 'users', s.uid)); }} className="p-2 bg-slate-50 text-slate-400 hover:text-rose-600 hover:bg-white rounded-lg transition-all border border-transparent hover:border-slate-100 shadow-sm" title="Excluir"><Trash2 size={14}/></button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* MODAL DE CADASTRO/EDIÇÃO */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-[5000] bg-white flex flex-col animate-in slide-in-from-bottom duration-500 overflow-y-auto">
          <header className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center shrink-0 shadow-lg sticky top-0 z-50">
            <div className="flex items-center gap-4">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg border border-indigo-400/30"><UserCog size={20}/></div>
              <div><h2 className="text-lg font-black uppercase italic tracking-tighter leading-none">{selectedStudent ? 'Editar Matrícula' : 'Nova Matrícula Institucional'}</h2><p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5 italic">Sincronização Master</p></div>
            </div>
            <button onClick={() => setIsRegisterModalOpen(false)} className="p-2 hover:bg-rose-600 rounded-full transition-all bg-white/5"><X size={20}/></button>
          </header>
          
          <form onSubmit={handleSave} className="max-w-4xl mx-auto py-8 px-6 space-y-8 pb-32 text-slate-900">
             {/* SEÇÃO 1: IDENTIFICAÇÃO */}
             <section className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4"><h3 className="text-xs font-black uppercase text-slate-900 italic tracking-[0.2em]">01. Identidade</h3></div>
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                   <div className="lg:col-span-1 flex flex-col items-center gap-3">
                      <div onClick={() => fileInputRef.current?.click()} className="w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden rounded-2xl shadow-md group hover:border-indigo-400 transition-all border-indigo-100">
                        {formData.fotoUrl ? <img src={formData.fotoUrl} className="w-full h-full object-cover" /> : <div className="text-center opacity-30"><Camera size={28} className="mx-auto text-slate-400"/><span className="text-[8px] font-black uppercase mt-2 block tracking-widest italic">Foto</span></div>}
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                   </div>
                   <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">Nome Completo</label><input required value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">WhatsApp</label><input required value={formData.telefone} onChange={e => setFormData({...formData,telefone:e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600" placeholder="(00) 00000-0000" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">CPF</label><input required value={formData.cpf} onChange={e => setFormData({...formData, cpf: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic">Nascimento</label><input type="date" required value={formData.nascimento} onChange={e => setFormData({...formData, nascimento: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                   </div>
                </div>
             </section>

             {/* SEÇÃO 2: ENDEREÇO */}
             <section className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4"><h3 className="text-xs font-black uppercase text-slate-900 italic tracking-[0.2em]">02. Endereço</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3 bg-slate-50 p-5 rounded-2xl border border-slate-100 shadow-inner">
                   <div className="md:col-span-1 space-y-1"><label className="text-[8px] font-black uppercase text-indigo-600 ml-1 italic">CEP</label><input required value={formData.endereco.cep} onChange={e => handleCepSearch(e.target.value)} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm" placeholder="00000-000" /></div>
                   <div className="md:col-span-4 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 italic">Logradouro</label><input required value={formData.endereco.rua} onChange={e => setFormData({...formData, endereco: {...formData.endereco, rua: e.target.value}})} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm" /></div>
                   <div className="md:col-span-1 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 italic">Nº</label><input required value={formData.endereco.numero} onChange={e => setFormData({...formData, endereco: {...formData.endereco, numero: e.target.value}})} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm" /></div>
                   <div className="md:col-span-2 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 italic">Bairro</label><input required value={formData.endereco.bairro} onChange={e => setFormData({...formData, endereco: {...formData.endereco, bairro: e.target.value}})} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm" /></div>
                   <div className="md:col-span-3 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 italic">Cidade</label><input required value={formData.endereco.cidade} onChange={e => setFormData({...formData, endereco: {...formData.endereco, cidade: e.target.value}})} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm" /></div>
                   <div className="md:col-span-1 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400 ml-1 italic">UF</label><input required value={formData.endereco.uf} onChange={e => setFormData({...formData, endereco: {...formData.endereco, uf: e.target.value.toUpperCase()}})} className="w-full p-2.5 bg-white border-none rounded-lg text-xs font-black shadow-sm text-center" maxLength={2} /></div>
                </div>
             </section>

             {/* SEÇÃO 3: ACADÊMICO E LOGIN */}
             <section className="space-y-6">
                <div className="flex items-center gap-3 border-l-4 border-indigo-600 pl-4"><h3 className="text-xs font-black uppercase text-slate-900 italic tracking-[0.2em]">03. Acesso e Curso</h3></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic tracking-widest">E-mail Pessoal</label><input type="email" required value={formData.emailPessoal} onChange={e => { const val = e.target.value; setFormData(prev => ({...prev, emailPessoal: val})); if (!selectedStudent && val) generateAcademicEmail(formData.nome).then(ae => setFormData(prev => ({...prev, emailPessoal: val, emailAcademico: ae}))); }} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic tracking-widest">Curso</label>
                      <select required value={formData.cursoId} onChange={e => setFormData({...formData, cursoId: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase shadow-inner outline-none focus:ring-1 focus:ring-indigo-600">
                         <option value="">Selecionar...</option>
                         {courses.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-indigo-600 ml-2 italic tracking-widest">Login Acadêmico</label>
                      <input type="email" required value={formData.emailAcademico} onChange={e => setFormData({...formData, emailAcademico: e.target.value})} className="w-full p-3 bg-indigo-50 border-2 border-indigo-100 rounded-xl text-xs font-black shadow-sm" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-rose-500 ml-2 italic tracking-widest">Senha</label>
                      <div className="relative">
                         <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-mono font-black shadow-inner" placeholder={selectedStudent ? "Manter atual" : "Min 6 chars"} />
                         <Lock size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300"/>
                      </div>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 italic tracking-widest">Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black uppercase shadow-inner">
                         <option value="ativo">Ativo</option>
                         <option value="pendente">Pendente</option>
                         <option value="bloqueado">Bloqueado</option>
                         <option value="concluido">Concluído</option>
                         <option value="aguardando_validacao">Aguardando Validação</option>
                      </select>
                   </div>
                </div>
             </section>

             <div className="flex gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsRegisterModalOpen(false)} className="flex-1 py-3 bg-slate-100 text-slate-400 rounded-xl text-[10px] font-black uppercase italic tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                <button type="submit" disabled={actionLoading} className="flex-[2] py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase italic tracking-[0.3em] shadow-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-indigo-100">
                  {actionLoading ? <RefreshCw className="animate-spin" size={16}/> : <><ShieldCheck size={16}/> {selectedStudent ? 'Atualizar' : 'Efetivar'}</>}
                </button>
             </div>
          </form>
        </div>
      )}

      {/* MODAL DE VISUALIZAÇÃO (PRONTUÁRIO) */}
      {isViewModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-[5000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in zoom-in-95">
           <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl relative border border-white/20">
              <button onClick={() => setIsViewModalOpen(false)} className="absolute top-4 right-4 p-2 bg-slate-50 rounded-lg hover:bg-rose-50 text-slate-400 transition-all"><X size={18}/></button>
              
              <div className="flex flex-col items-center text-center space-y-4">
                 <div className="w-24 h-24 bg-slate-100 rounded-2xl overflow-hidden shadow-lg border-4 border-white">
                    {selectedStudent.photoURL ? <img src={selectedStudent.photoURL} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-2xl text-slate-300">{(selectedStudent.displayName||'U').charAt(0)}</div>}
                 </div>
                 <div>
                    <h2 className="text-lg font-black uppercase italic text-slate-900 leading-none">{selectedStudent.displayName}</h2>
                    <p className="text-[9px] font-bold text-indigo-600 uppercase tracking-[0.3em] mt-1">Matrícula: {selectedStudent.academicId}</p>
                 </div>
                 <div className="grid grid-cols-2 gap-3 w-full bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="text-left space-y-0.5"><p className="text-[8px] font-black text-slate-400 uppercase">CPF</p><p className="text-xs font-bold text-slate-800">{selectedStudent.cpf}</p></div>
                    <div className="text-left space-y-0.5"><p className="text-[8px] font-black text-slate-400 uppercase">Nascimento</p><p className="text-xs font-bold text-slate-800">{selectedStudent.nascimento}</p></div>
                    <div className="text-left space-y-0.5"><p className="text-[8px] font-black text-slate-400 uppercase">E-mail</p><p className="text-xs font-bold text-slate-800 truncate">{selectedStudent.emailPessoal}</p></div>
                    <div className="text-left space-y-0.5"><p className="text-[8px] font-black text-slate-400 uppercase">Telefone</p><p className="text-xs font-bold text-slate-800">{selectedStudent.telefone}</p></div>
                    <div className="col-span-2 text-left space-y-0.5 border-t border-slate-200 pt-2"><p className="text-[8px] font-black text-slate-400 uppercase">Endereço</p><p className="text-xs font-bold text-slate-800">{selectedStudent.endereco?.rua}, {selectedStudent.endereco?.numero} - {selectedStudent.endereco?.bairro}, {selectedStudent.endereco?.cidade}/{selectedStudent.endereco?.uf}</p></div>
                 </div>
                 <div className="w-full p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex justify-between items-center">
                    <span className="text-[9px] font-black text-indigo-600 uppercase italic">Acesso Portal</span>
                    <span className="text-xs font-bold text-slate-900">{selectedStudent.email}</span>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default StudentsView;
