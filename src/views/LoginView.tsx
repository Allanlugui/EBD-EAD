
import React, { useState, useEffect, useRef } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { auth, db } from '../firebase';
import { Lock, GraduationCap, ArrowRight, BookOpen, Camera, MapPin, ChevronLeft, Info, RefreshCw, CheckCircle2, LogIn, CreditCard } from 'lucide-react';

type ViewMode = 'landing' | 'login' | 'enroll_form' | 'success_notice';

const LoginView: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [generatedEmail, setGeneratedEmail] = useState('');

  const [enrollForm, setEnrollForm] = useState({
    nome: '', emailPessoal: '', password: '', cpf: '', nascimento: '', telefone: '', fotoUrl: '',
    endereco: { cep: '', rua: '', numero: '', bairro: '', cidade: '', uf: '' }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'cursos'), where('status', '==', 'ativo')), snap => {
      setCourses(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleCepSearch = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    // Correctly update nested state
    setEnrollForm(prev => ({ ...prev, endereco: { ...prev.endereco, cep: cleanCep } }));
    
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setEnrollForm(prev => ({
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
      } catch (e) { console.error("Erro ViaCEP", e); }
    }
  };

  const generateAcademicEmail = async (fullName: string) => {
    const names = fullName.trim().toLowerCase().split(' ');
    const first = names[0];
    const last = names.length > 1 ? names[names.length - 1] : '';
    let base = `${first}${last ? '.' + last : ''}@ead.com`;
    const snap = await getDocs(query(collection(db, 'users'), where('email', '==', base)));
    if (!snap.empty) base = `${first}.${last}${Math.floor(Math.random() * 99)}@ead.com`;
    return base;
  };

  // Compression for signup
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

  const handleFinalizeEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse) return;
    setLoading(true);
    setError('');
    
    // Explicit validation
    if (!enrollForm.nome || !enrollForm.cpf || !enrollForm.telefone || !enrollForm.nascimento || !enrollForm.endereco.cep) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      setLoading(false);
      return;
    }

    try {
      const academicoEmail = await generateAcademicEmail(enrollForm.nome);
      const userCredential = await createUserWithEmailAndPassword(auth, academicoEmail, enrollForm.password);
      
      // CRÍTICO: Sincronização imediata do Perfil para evitar o "U" e a falta de foto no Auth
      await updateProfile(userCredential.user, {
        displayName: enrollForm.nome,
        photoURL: enrollForm.fotoUrl || null
      });

      const uid = userCredential.user.uid;
      // Geração imediata do ID acadêmico
      const academicId = `MAT-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      
      // Construção explícita do payload para garantir que nada se perca
      const payload = {
        uid,
        displayName: enrollForm.nome,
        nome: enrollForm.nome,
        email: academicoEmail,
        emailPessoal: enrollForm.emailPessoal.toLowerCase().trim(),
        cpf: enrollForm.cpf,
        nascimento: enrollForm.nascimento,
        telefone: enrollForm.telefone,
        photoURL: enrollForm.fotoUrl || '',
        endereco: {
          cep: enrollForm.endereco.cep || '',
          rua: enrollForm.endereco.rua || '',
          numero: enrollForm.endereco.numero || '',
          bairro: enrollForm.endereco.bairro || '',
          cidade: enrollForm.endereco.cidade || '',
          uf: enrollForm.endereco.uf || ''
        },
        role: 'aluno',
        // Support multiple courses. Initialize with the selected one.
        matriculas: [selectedCourse.id],
        // Legacy support (optional, but good for older logic)
        cursoInicial: selectedCourse.id,
        status: 'aguardando_validacao', 
        academicId,
        createdAt: serverTimestamp(),
        progress: 0,
        sincronizado: true,
        termsAccepted: false 
      };

      // Salva no Firestore
      // Added merge: true here as well to be safe against double-writes
      await setDoc(doc(db, 'users', uid), payload, { merge: true });
      
      setGeneratedEmail(academicoEmail);
      setViewMode('success_notice');
    } catch (err: any) {
      setError('Falha na sincronização Master: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        // Compress
        if (ev.target?.result) {
           const compressed = await compressImage(ev.target.result as string);
           setEnrollForm(prev => ({...prev, fotoUrl: compressed}));
        }
      };
      reader.readAsDataURL(file);
    }
  };

  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
        <div className="relative min-h-screen flex flex-col">
          <div className="absolute inset-0 z-0"><img src="https://images.unsplash.com/photo-1519791883288-dc8bd696e667?auto=format&fit=crop&w=1920&q=80" className="w-full h-full object-cover brightness-[0.2]" /><div className="absolute inset-0 bg-gradient-to-b from-indigo-900/30 via-transparent to-white"></div></div>
          <header className="relative z-10 h-24 px-4 md:px-8 flex items-center justify-between max-w-7xl mx-auto w-full">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-2xl"><BookOpen size={20} /></div>
              <div className="flex flex-col"><span className="font-black text-white text-lg uppercase italic tracking-tighter leading-none">EB-AD</span><span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">LMS Master</span></div>
            </div>
            <div className="flex items-center gap-2 md:gap-4">
              <button onClick={() => setViewMode('login')} className="px-5 py-2.5 bg-white/10 backdrop-blur-md text-white border border-white/20 rounded-full text-[10px] font-black uppercase italic transition-all hover:bg-white hover:text-slate-900 shadow-lg">Entrar</button>
              <a href="#cursos" className="px-5 py-2.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase shadow-2xl hover:bg-indigo-500 transition-all">Matrícula Master</a>
            </div>
          </header>
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-20 max-w-5xl mx-auto">
             <div className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600/30 backdrop-blur-xl rounded-full border border-indigo-400/30 text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-8">Fluxo Acadêmico Sincronizado</div>
             <h1 className="text-5xl md:text-8xl lg:text-9xl font-black text-white uppercase italic tracking-tighter leading-[0.82] mb-8 drop-shadow-2xl">Teologia <br/> <span className="text-indigo-500">Master</span></h1>
             <p className="text-slate-300 text-lg md:text-2xl font-medium italic max-w-2xl mb-12">Onde a fé encontra a excelência acadêmica em uma plataforma 100% sincronizada.</p>
             <a href="#cursos" className="w-full max-w-xs py-6 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase italic tracking-[0.3em] shadow-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 active:scale-95">Explorar Matriz <ArrowRight size={18}/></a>
          </main>
        </div>
        <section id="cursos" className="py-20 md:py-32 px-4 md:px-8 max-w-7xl mx-auto space-y-12">
          <div className="text-center space-y-3"><h2 className="text-4xl md:text-5xl font-black uppercase italic tracking-tighter text-slate-900">Nossa Matriz Acadêmica</h2><p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.4em] italic">Vagas Reais e Imediatas</p></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {courses.map(course => (
              <div key={course.id} className="group bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-2xl transition-all flex flex-col">
                <div className="h-60 overflow-hidden relative"><img src={course.capaUrl} className="w-full h-full object-cover transition-transform group-hover:scale-105" /><div className="absolute top-4 right-4 px-3 py-1 bg-white/90 rounded-full text-[8px] font-black uppercase text-indigo-600 italic shadow-lg">{course.categoria}</div></div>
                <div className="p-8 flex-1 flex flex-col items-center text-center">
                  <h3 className="text-xl font-black uppercase italic text-slate-900 mb-6 tracking-tighter leading-tight">{course.nome}</h3>
                  <button onClick={() => { setSelectedCourse(course); setViewMode('enroll_form'); }} className="mt-auto w-full py-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase italic tracking-widest hover:bg-indigo-600 transition-all shadow-xl">Iniciar Matrícula Agora</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (viewMode === 'enroll_form') {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="bg-white border-b border-slate-200 h-20 px-4 md:px-8 flex items-center justify-between shadow-sm sticky top-0 z-10">
          <button onClick={() => setViewMode('landing')} className="flex items-center gap-2 text-[9px] font-black uppercase text-slate-400 hover:text-indigo-600 transition-all"><ChevronLeft size={16}/> Cancelar</button>
          <div className="text-center hidden sm:block"><h2 className="text-sm font-black uppercase italic leading-none text-slate-900">Matrícula Sincronizada Master</h2><p className="text-[7px] font-bold text-slate-400 uppercase mt-1 italic tracking-widest">{selectedCourse?.nome}</p></div>
          <div className="w-20"></div>
        </header>
        <div className="flex-1 overflow-y-auto py-8 px-4">
          <form onSubmit={handleFinalizeEnroll} className="max-w-4xl mx-auto bg-white rounded-2xl p-6 md:p-12 shadow-2xl space-y-10 border border-slate-100 text-slate-900 animate-in zoom-in-95">
             <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                <div className="lg:col-span-1 flex flex-col items-center gap-4">
                   <div onClick={() => fileInputRef.current?.click()} className="w-40 h-40 bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center cursor-pointer overflow-hidden rounded-2xl group hover:border-indigo-400 transition-all shadow-inner">
                      {enrollForm.fotoUrl ? <img src={enrollForm.fotoUrl} className="w-full h-full object-cover" /> : <Camera size={32} className="text-slate-300"/>}
                   </div>
                   <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                   <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest text-center">Selfie de Identificação Acadêmica</p>
                </div>
                <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-5">
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Nome Completo</label><input required value={enrollForm.nome} onChange={e => setEnrollForm(prev => ({...prev, nome: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" /></div>
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">WhatsApp Institucional</label><input required value={enrollForm.telefone} onChange={e => setEnrollForm(prev => ({...prev, telefone: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" placeholder="(00) 00000-0000" /></div>
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">E-mail Pessoal</label><input type="email" required value={enrollForm.emailPessoal} onChange={e => setEnrollForm(prev => ({...prev, emailPessoal: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" /></div>
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Senha de Acesso</label><input type="password" required value={enrollForm.password} onChange={e => setEnrollForm(prev => ({...prev, password: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" /></div>
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">CPF Documental</label><input required value={enrollForm.cpf} onChange={e => setEnrollForm(prev => ({...prev, cpf: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                   <div className="space-y-1.5"><label className="text-[9px] font-black uppercase text-slate-400 ml-4">Data de Nascimento</label><input type="date" required value={enrollForm.nascimento} onChange={e => setEnrollForm(prev => ({...prev, nascimento: e.target.value}))} className="w-full p-4 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                </div>
             </div>
             <div className="pt-6 border-t border-slate-100 space-y-6">
                <h4 className="text-[10px] font-black uppercase text-indigo-600 italic tracking-widest flex items-center gap-2"><MapPin size={14}/> Dados de Localidade (Auto-fill)</h4>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                   <div className="col-span-1 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">CEP</label><input required value={enrollForm.endereco.cep} onChange={e => handleCepSearch(e.target.value)} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600" maxLength={8}/></div>
                   <div className="col-span-2 md:col-span-3 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Logradouro / Rua</label><input required value={enrollForm.endereco.rua} onChange={e => setEnrollForm(prev => ({...prev, endereco: {...prev.endereco, rua: e.target.value}}))} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                   <div className="col-span-1 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Nº</label><input required value={enrollForm.endereco.numero} onChange={e => setEnrollForm(prev => ({...prev, endereco: {...prev.endereco, numero: e.target.value}}))} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner outline-none focus:ring-1 focus:ring-indigo-600" /></div>
                   <div className="col-span-2 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Bairro</label><input required value={enrollForm.endereco.bairro} onChange={e => setEnrollForm(prev => ({...prev, endereco: {...prev.endereco, bairro: e.target.value}}))} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                   <div className="col-span-1 md:col-span-2 space-y-1"><label className="text-[8px] font-black uppercase text-slate-400">Cidade</label><input required value={enrollForm.endereco.cidade} onChange={e => setEnrollForm(prev => ({...prev, endereco: {...prev.endereco, cidade: e.target.value}}))} className="w-full p-3 bg-slate-50 border-none rounded-xl text-xs font-black shadow-inner" /></div>
                </div>
             </div>
             {error && <div className="p-4 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-xl flex items-center gap-2 animate-bounce border border-rose-100"><Info size={14}/> {error}</div>}
             <button type="submit" disabled={loading} className="w-full py-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase italic tracking-[0.3em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-indigo-200">
                {loading ? <RefreshCw className="animate-spin" size={20}/> : <><CreditCard size={20}/> Concluir e Sincronizar Matrícula</>}
             </button>
          </form>
        </div>
      </div>
    );
  }

  if (viewMode === 'success_notice') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
         <div className="max-w-md w-full bg-white rounded-3xl p-10 md:p-12 text-center shadow-[0_50px_100px_rgba(0,0,0,0.5)] space-y-10 animate-in zoom-in-95">
            <div className="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner border border-emerald-100"><CheckCircle2 size={48}/></div>
            <div className="space-y-3"><h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">Matrícula Concluída!</h2><p className="text-slate-400 text-xs font-medium italic leading-relaxed">Seus dados acadêmicos foram propagados para o Cloud Firestore. Acesse o portal para iniciar seus estudos.</p></div>
            <div className="p-8 bg-indigo-50 rounded-2xl border border-indigo-100 space-y-4 shadow-inner"><p className="text-[9px] font-black uppercase text-indigo-400 tracking-widest">Seu Login Acadêmico Master</p><p className="text-base font-black text-indigo-600 italic select-all underline tracking-tight">{generatedEmail}</p></div>
            <button onClick={() => setViewMode('login')} className="w-full py-5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase italic tracking-widest hover:bg-indigo-600 transition-all shadow-xl active:scale-95">Acessar Sala de Aula Virtual</button>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
       <div className="absolute inset-0 z-0 opacity-20"><img src="https://images.unsplash.com/photo-1501290830387-99bc439ca623?auto=format&fit=crop&w=1920&q=80" className="w-full h-full object-cover" /></div>
       <div className="relative z-10 w-full max-w-5xl bg-white rounded-3xl shadow-[0_100px_200px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col lg:flex-row animate-in zoom-in-95">
          <div className="lg:w-1/2 p-8 md:p-16 space-y-10 flex flex-col justify-center bg-white text-slate-900">
             <div className="space-y-3"><h3 className="text-4xl font-black uppercase italic tracking-tighter leading-none">Acesso <span className="text-indigo-600">Master</span></h3><p className="text-slate-400 text-xs font-medium italic">Seu ambiente de aprendizado teológico em tempo real.</p></div>
             {error && <div className="p-4 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-xl border border-rose-100 flex items-center gap-2 animate-shake"><Info size={16}/> {error}</div>}
             <form onSubmit={e => { e.preventDefault(); setLoading(true); signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password).catch(err => { setError('Credenciais Inválidas ou em Sincronização.'); setLoading(false); }); }} className="space-y-6">
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 ml-4 italic tracking-widest">Login Acadêmico (@ead.com)</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="w-full p-5 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" /></div>
                <div className="space-y-1.5"><label className="text-[10px] font-black uppercase text-slate-400 ml-4 italic tracking-widest">Senha de Segurança</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full p-5 bg-slate-50 border-none rounded-2xl text-sm font-bold shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 transition-all" /></div>
                <button type="submit" disabled={loading} className="w-full py-6 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase italic tracking-[0.4em] shadow-2xl hover:bg-indigo-600 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-indigo-100">
                   {loading ? <RefreshCw className="animate-spin" size={24}/> : <><LogIn size={20}/> Ingressar no Ecossistema</>}
                </button>
             </form>
          </div>
          <div className="lg:w-1/2 bg-slate-50 p-8 md:p-16 flex flex-col items-center justify-center text-center gap-8 border-l border-slate-100">
             <div className="w-20 h-20 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/20"><GraduationCap size={40}/></div>
             <div className="space-y-3"><h4 className="text-xl font-black uppercase italic text-slate-900 tracking-tighter">Não possui matrícula?</h4><p className="text-slate-400 text-xs font-medium italic leading-relaxed px-4">Sincronize sua jornada agora mesmo. A auto-matrícula Master leva menos de 2 minutos.</p></div>
             <button onClick={() => setViewMode('landing')} className="w-full py-5 bg-white border border-slate-200 text-slate-900 rounded-2xl text-[10px] font-black uppercase italic tracking-widest hover:border-indigo-600 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-lg active:scale-95"><ArrowRight size={18}/> Iniciar Fluxo de Captação</button>
          </div>
       </div>
    </div>
  );
};

export default LoginView;
