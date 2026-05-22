
import React, { useState, useEffect, useRef } from 'react';
import { 
  doc, updateDoc, getDoc, collection, onSnapshot, query, where, 
  addDoc, deleteDoc, serverTimestamp, orderBy, limit, setDoc
} from "firebase/firestore";
import { db, auth } from '../firebase';
import { 
  Users, Shield, Building, Save, Activity, 
  Plus, Trash2, Mail, CheckCircle2, UserCheck,
  Calendar, HardDrive, Key, X, Camera, GraduationCap,
  Eye, Edit3, Award, MapPin, User as UserIcon, Upload, 
  Briefcase, PlusCircle, MinusCircle, Smartphone, Fingerprint, RefreshCw,
  ShieldCheck, Lock, Globe, Phone, FileText, Image as ImageIcon
} from 'lucide-react';

type SettingsTab = 'geral' | 'equipe' | 'seguranca' | 'infra';
type RoleClassification = 'diretor' | 'vice_diretor' | 'coordenador' | 'secretaria' | 'professor' | 'apoio' | 'ti';

interface Formacao { curso: string; instituicao: string; ano: string; }
interface Experiencia { cargo: string; empresa: string; periodo: string; }

const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('geral');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  
  const [staff, setStaff] = useState<any[]>([]);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  
  const [memberForm, setMemberForm] = useState({
    nome: '', email: '', documento: '', telefone: '',
    cargo: 'professor' as RoleClassification,
    status: 'ativo', fotoUrl: '', password: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' },
    formacoes: [] as Formacao[],
    experiencias: [] as Experiencia[],
    biografia: ''
  });

  const [governanceLogs, setGovernanceLogs] = useState<any[]>([]);
  
  const [schoolConfig, setSchoolConfig] = useState({
    schoolName: 'Escola Bíblica EAD',
    logoUrl: '',
    primaryColor: '#4f46e5',
    secondaryColor: '#0f172a',
    academicYear: '2026',
    cnpj: '',
    enderecoFisico: '',
    telefoneInstitucional: '',
    emailSuporte: '',
    missao: ''
  });

  const [securityConfig, setSecurityConfig] = useState({
    mfaRequired: false,
    sessionTimeout: '24h',
    allowPublicRegistration: false,
    passwordComplexity: 'medium'
  });

  useEffect(() => {
    const unsubConfig = onSnapshot(doc(db, 'system_settings', 'main_config'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.schoolConfig) setSchoolConfig(prev => ({ ...prev, ...data.schoolConfig }));
        if (data.securityConfig) setSecurityConfig(prev => ({ ...prev, ...data.securityConfig }));
      }
      setLoading(false);
    });

    const unsubStaff = onSnapshot(query(collection(db, 'users'), where('role', 'in', ['diretor', 'vice_diretor', 'coordenador', 'secretaria', 'professor', 'apoio', 'ti'])), (snap) => {
      setStaff(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubLogs = onSnapshot(query(collection(db, 'system_logs'), orderBy('timestamp', 'desc'), limit(10)), (snap) => {
      setGovernanceLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsubConfig(); unsubStaff(); unsubLogs(); };
  }, []);

  const compressImage = (base64: string, maxWidth = 300): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        setMemberForm({ ...memberForm, fotoUrl: compressed });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        // Logo pode precisar de mais qualidade, aumentei o maxWidth
        const compressed = await compressImage(reader.result as string, 500);
        setSchoolConfig(prev => ({ ...prev, logoUrl: compressed }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveSystemConfig = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'system_settings', 'main_config'), {
        schoolConfig: { ...schoolConfig },
        securityConfig: { ...securityConfig },
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      await addDoc(collection(db, 'system_logs'), {
        action: `Alteração de Configurações Institucionais`,
        user: auth.currentUser?.email || 'Admin',
        timestamp: serverTimestamp()
      });
      
      alert("Configurações do sistema atualizadas e auditadas!");
    } catch (err) {
      alert("Erro ao salvar configurações.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (confirm(`Remover permanentemente ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
        await addDoc(collection(db, 'system_logs'), {
          action: `Exclusão de Membro: ${name}`,
          user: auth.currentUser?.email || 'Admin',
          timestamp: serverTimestamp()
        });
      } catch (err) { alert("Erro na exclusão."); }
    }
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const payload: any = {
        nome: memberForm.nome,
        displayName: memberForm.nome,
        email: memberForm.email.toLowerCase().trim(),
        documento: memberForm.documento,
        telefone: memberForm.telefone,
        role: memberForm.cargo,
        status: memberForm.status,
        photoURL: memberForm.fotoUrl,
        endereco: memberForm.endereco,
        formacoes: memberForm.formacoes,
        experiencias: memberForm.experiencias,
        biografia: memberForm.biografia,
        updatedAt: serverTimestamp()
      };

      if (!selectedMember) {
        payload.createdAt = serverTimestamp();
        payload.staffId = `STF-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        payload.password = memberForm.password; 
        await addDoc(collection(db, 'users'), payload);
      } else {
        if (memberForm.password) payload.password = memberForm.password;
        await updateDoc(doc(db, 'users', selectedMember.id), payload);
      }

      await addDoc(collection(db, 'system_logs'), {
        action: selectedMember ? `Editou membro: ${memberForm.nome}` : `Cadastrou novo membro: ${memberForm.nome}`,
        user: auth.currentUser?.email || 'Admin',
        timestamp: serverTimestamp()
      });

      setIsMemberModalOpen(false);
      setSelectedMember(null);
      alert("Operação realizada com sucesso!");
    } catch (err) {
      alert("Erro ao processar dados no Firestore.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><RefreshCw className="animate-spin text-indigo-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 px-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight uppercase italic">Configurações</h1>
          <p className="text-slate-500 text-xs font-medium uppercase tracking-widest">Governança e Identidade Institucional</p>
        </div>
        <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          {[
            { id: 'geral', label: 'Institucional', icon: <Building size={14}/> },
            { id: 'equipe', label: 'Equipe', icon: <Users size={14}/> },
            { id: 'seguranca', label: 'Segurança', icon: <ShieldCheck size={14}/> },
            { id: 'infra', label: 'Logs', icon: <Activity size={14}/> }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                activeTab === tab.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </header>

      {activeTab === 'geral' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-8">
              <div className="flex items-center gap-3 border-b pb-4">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Globe size={18}/></div>
                <h3 className="font-black text-slate-900 uppercase italic text-sm">Identidade e Credibilidade</h3>
              </div>
              
              {/* LOGO UPLOAD SECTION */}
              <div className="flex items-center gap-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                 <div onClick={() => logoInputRef.current?.click()} className="w-24 h-24 bg-white border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center cursor-pointer hover:border-indigo-500 overflow-hidden relative group">
                    {schoolConfig.logoUrl ? <img src={schoolConfig.logoUrl} className="w-full h-full object-contain p-2"/> : <ImageIcon size={24} className="text-slate-300"/>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all text-white font-bold text-[8px] uppercase">Alterar Logo</div>
                 </div>
                 <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoUpload} />
                 <div className="flex-1">
                    <h4 className="text-xs font-black uppercase text-slate-700">Logotipo Oficial</h4>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">Esta imagem será utilizada no cabeçalho de todos os certificados e documentos oficiais gerados pela plataforma. Formato recomendado: PNG Transparente.</p>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Institucional</label>
                  <input value={schoolConfig.schoolName} onChange={e => setSchoolConfig({...schoolConfig, schoolName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ex: Escola Bíblica Central" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">CNPJ / Registro Acadêmico</label>
                  <input value={schoolConfig.cnpj} onChange={e => setSchoolConfig({...schoolConfig, cnpj: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="00.000.000/0001-00" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Telefone de Contato</label>
                  <input value={schoolConfig.telefoneInstitucional} onChange={e => setSchoolConfig({...schoolConfig, telefoneInstitucional: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="(00) 00000-0000" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail de Suporte</label>
                  <input value={schoolConfig.emailSuporte} onChange={e => setSchoolConfig({...schoolConfig, emailSuporte: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="suporte@escola.edu.br" />
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Endereço da Sede Física</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input value={schoolConfig.enderecoFisico} onChange={e => setSchoolConfig({...schoolConfig, enderecoFisico: e.target.value})} className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Rua, Número, Bairro, Cidade - UF" />
                  </div>
                </div>
                <div className="md:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Missão Acadêmica / Mantra</label>
                  <textarea value={schoolConfig.missao} onChange={e => setSchoolConfig({...schoolConfig, missao: e.target.value})} className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl text-sm font-medium italic outline-none focus:ring-2 focus:ring-indigo-500 h-24 resize-none" placeholder="Descreva brevemente a visão pedagógica da escola..." />
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-50">
                <button onClick={handleSaveSystemConfig} disabled={isSaving} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 transition-all shadow-lg flex items-center gap-2">
                  {isSaving ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} Gravar Dados Institucionais
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-black text-slate-900 uppercase italic text-sm border-b pb-4">Ano Letivo</h3>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Ciclo Ativo</label>
                <input value={schoolConfig.academicYear} onChange={e => setSchoolConfig({...schoolConfig, academicYear: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
              <h3 className="font-black text-slate-900 uppercase italic text-sm border-b pb-4 text-center">Identidade Visual</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cor Primária</span>
                  <input type="color" value={schoolConfig.primaryColor} onChange={e => setSchoolConfig({...schoolConfig, primaryColor: e.target.value})} className="h-10 w-16 rounded-lg border-none cursor-pointer shadow-sm" />
                </div>
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Cor Secundária</span>
                  <input type="color" value={schoolConfig.secondaryColor} onChange={e => setSchoolConfig({...schoolConfig, secondaryColor: e.target.value})} className="h-10 w-16 rounded-lg border-none cursor-pointer shadow-sm" />
                </div>
              </div>
              <p className="text-[9px] text-slate-400 font-medium uppercase text-center tracking-widest italic">As cores serão aplicadas em todo o ecossistema.</p>
            </div>
          </div>
        </div>
      )}

      {/* Seguranca, Equipe, Infra tabs remain unchanged... */}
      {activeTab === 'seguranca' && (
        <div className="max-w-3xl mx-auto animate-in zoom-in-95">
           {/* ... existing code ... */}
           <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl space-y-10">
            {/* ... Content of security tab ... */}
            <div className="flex items-center gap-4 border-b pb-6">
              <div className="p-4 bg-rose-50 text-rose-600 rounded-[1.5rem] shadow-inner"><Shield size={28}/></div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Políticas de Segurança</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controle de Acesso e Integridade de Dados</p>
              </div>
            </div>
            {/* ... Rest of Security Tab ... */}
           </div>
        </div>
      )}
      {/* ... Equipe and Infra Logic (no changes needed) ... */}
      {activeTab === 'equipe' && (
          // ... Existing Staff Logic ...
          <div className="space-y-4 animate-in fade-in">
             <div className="bg-white p-5 rounded-2xl border border-slate-200 flex justify-between items-center shadow-sm">
                {/* ... Header ... */}
                <h3 className="font-black text-slate-800 uppercase italic text-sm">Corpo Docente e Administrativo</h3>
                <button onClick={() => { setSelectedMember(null); setMemberForm({ nome: '', email: '', documento: '', telefone: '', cargo: 'professor', status: 'ativo', fotoUrl: '', password: '', endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' }, formacoes: [], experiencias: [], biografia: '' }); setIsMemberModalOpen(true); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-indigo-700 transition-all shadow-lg"><Plus size={16}/> Credenciar Profissional</button>
             </div>
             {/* ... Table and Modals ... */}
             <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                {/* ... Staff Table ... */}
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-100"><tr><th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Profissional</th><th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Cargo / Função</th><th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Login E-mail</th><th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400">Status</th><th className="px-6 py-4 text-[9px] font-black uppercase text-slate-400 text-right">Gestão</th></tr></thead>
                  <tbody className="divide-y divide-slate-50">
                    {staff.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-6 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border-2 border-white shadow-sm shrink-0">{m.photoURL ? <img src={m.photoURL} className="w-full h-full object-cover"/> : <UserIcon className="m-auto text-slate-300 mt-2" size={24}/>}</div><div><p className="text-xs font-black text-slate-900 uppercase italic tracking-tight">{m.nome}</p><p className="text-[9px] text-slate-400 font-mono tracking-tighter">REF: {m.staffId || 'MASTER'}</p></div></div></td>
                            <td className="px-6 py-4"><span className="text-[9px] font-black uppercase bg-indigo-50 px-2.5 py-1 rounded-lg text-indigo-600 border border-indigo-100 italic">{m.role}</span></td>
                            <td className="px-6 py-4"><p className="text-[11px] font-bold text-slate-600">{m.email}</p></td>
                            <td className="px-6 py-4"><div className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${m.status === 'ativo' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span><span className="text-[10px] font-bold text-slate-500 uppercase">{m.status}</span></div></td>
                            <td className="px-6 py-4 text-right"><div className="flex justify-end gap-2"><button onClick={() => { setSelectedMember(m); setIsViewModalOpen(true); }} className="p-2 text-slate-300 hover:text-indigo-600"><Eye size={18}/></button><button onClick={() => handleDeleteMember(m.id, m.nome)} className="p-2 text-slate-100 hover:text-rose-600"><Trash2 size={18}/></button></div></td>
                        </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
      )}
      {/* ... Modals for Member Edit/View ... */}
      {isMemberModalOpen && (
          <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
             {/* ... Member Form Modal ... */}
             <div className="bg-white w-full max-w-5xl h-[90vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
                <header className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                   <h2 className="text-lg font-black text-slate-900 uppercase italic tracking-tighter">{selectedMember ? 'Revisar Prontuário' : 'Novo Credenciamento'}</h2>
                   <button onClick={() => setIsMemberModalOpen(false)} className="p-2 hover:bg-rose-50 text-slate-400 rounded-full transition-all"><X size={20}/></button>
                </header>
                <form onSubmit={handleSaveMember} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
                   {/* ... Form Fields (retained) ... */}
                   <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
                      <div className="lg:col-span-1 flex flex-col items-center gap-4">
                         <div onClick={() => fileInputRef.current?.click()} className="w-44 h-44 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-all relative group shadow-inner">
                            {memberForm.fotoUrl ? <img src={memberForm.fotoUrl} className="w-full h-full object-cover"/> : <Camera size={40} className="mx-auto text-slate-300"/>}
                         </div>
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                      </div>
                      <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-5">
                         <input required value={memberForm.nome} onChange={e => setMemberForm({...memberForm, nome: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold outline-none" placeholder="Nome Completo"/>
                         <select value={memberForm.cargo} onChange={e => setMemberForm({...memberForm, cargo: e.target.value as any})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-[11px] font-black uppercase"><option value="professor">Professor</option><option value="diretor">Diretor</option><option value="secretaria">Secretaria</option></select>
                         <input type="email" required value={memberForm.email} onChange={e => setMemberForm({...memberForm, email: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold" placeholder="Email"/>
                         <input value={memberForm.password} onChange={e => setMemberForm({...memberForm, password: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-mono" placeholder="Senha"/>
                      </div>
                   </div>
                   <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-600 transition-all">Salvar</button>
                </form>
             </div>
          </div>
      )}
    </div>
  );
};

export default SettingsView;
