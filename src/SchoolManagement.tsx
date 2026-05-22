import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, where, getDocs, orderBy, getDoc
} from "firebase/firestore";
import { db, auth } from './firebase';
import { 
  Exam, User, Course, ProfessorSubView, Material, Feedback, 
  Module, Lesson, Question, ScheduledClass
} from './types';
import { 
  CheckSquare, Plus, X, Trash2, FileText, Radio, Layers, Star, 
  ExternalLink, Award, Edit3, Eye, Calendar, ClipboardList, 
  PlayCircle, TrendingUp, Tv, PenTool, Users, Mic, MicOff, 
  Video, VideoOff, Monitor, PhoneOff, MessageSquare, Sparkles, 
  RefreshCw, Send, Bell, UserX, VolumeX, ShieldCheck, Settings, 
  Presentation, ChevronLeft, ChevronRight, Upload, Play, 
  ShieldAlert, MoreVertical, Sliders, ImageIcon,
  CheckCircle2, AlertTriangle, Info, Clock, Save, ListOrdered, ArrowLeft,
  ChevronLast, Timer, BarChart3, Activity, PowerOff, UserPlus, ShieldX,
  Link as LinkIcon, Database, Paperclip, MonitorOff
} from 'lucide-react';
import SignaturePad from './components/SignaturePad';

interface SchoolManagementProps {
  user: User;
  courses: Course[];
  activeSub: ProfessorSubView;
  selectedCourseId?: string;
}

const SchoolManagement: React.FC<SchoolManagementProps> = ({ user, courses, activeSub, selectedCourseId }) => {
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<Exam[]>([]);
  const [allStudents, setAllStudents] = useState<User[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [scheduledClasses, setScheduledClasses] = useState<ScheduledClass[]>([]);

  // Calendar States
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Live States
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [showLobby, setShowLobby] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [screenShareActive, setScreenShareActive] = useState(false);
  const [devices, setDevices] = useState<{audio: MediaDeviceInfo[], video: MediaDeviceInfo[]}>({audio: [], video: []});
  const [selectedDevices, setSelectedDevices] = useState({audio: '', video: ''});
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [presentationSlide, setPresentationSlide] = useState(1);
  const [showPptUpload, setShowPptUpload] = useState(false);
  const [activePanel, setActivePanel] = useState<'none' | 'chat' | 'participants' | 'settings'>('none');
  const [chatMessage, setChatMessage] = useState('');
  const [chatMessages, setChatMessages] = useState<{user: string, text: string, time: string, attachment?: string}[]>([]);
  const [activeReactions, setActiveReactions] = useState<{id: number, emoji: string, left: number}[]>([]);
  const [virtualBg, setVirtualBg] = useState<'none' | 'blur' | 'office' | 'custom'>('none');
  const [customBgUrl, setCustomBgUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [globalMute, setGlobalMute] = useState(false);
  const [globalCamBlock, setGlobalCamBlock] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Academic States
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [selectedCourseForModules, setSelectedCourseForModules] = useState<string>(selectedCourseId || (courses[0]?.id || ''));
  
  // Modais
  const [isModuleModalOpen, setIsModuleModalOpen] = useState(false);
  const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
  const [isExamModalOpen, setIsExamModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);

  // Telas Cheias
  const [fullScreenMode, setFullScreenMode] = useState<'none' | 'question_editor' | 'test_simulation' | 'course_preview'>('none');

  // Form States
  const [moduleTitle, setModuleTitle] = useState('');
  const [currentModuleId, setCurrentModuleId] = useState<string | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState({ title: '', videoUrl: '', description: '', materialUrl: '' });
  const [examForm, setExamForm] = useState({ title: '', courseId: '', moduleId: '', type: 'activity' as 'activity'|'evaluation', passingGrade: 70 });
  const [questionForm, setQuestionForm] = useState({ text: '', options: ['', '', '', ''], correct: 0 });
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ title: '', date: '', courseId: '' });
  const [materialForm, setMaterialForm] = useState({ title: '', url: '', courseId: selectedCourseForModules, type: 'pdf' as Material['type'] });

  // Simulation
  const [testStarted, setTestStarted] = useState(false);
  const [currentTestAnswers, setCurrentTestAnswers] = useState<Record<string, number>>({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180); 

  const videoRef = useRef<HTMLVideoElement>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const customBgInputRef = useRef<HTMLInputElement>(null);
  const chatAttachmentRef = useRef<HTMLInputElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleNextQuestion = () => {
    if (!currentExam) return;
    if (currentQuestionIndex < (currentExam.questions?.length || 0) - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(180);
    } else {
      setTestStarted(false);
      setFullScreenMode('none');
      alert('Simulação finalizada!');
    }
  };

  useEffect(() => {
    const unsubscribes: (() => void)[] = [];
    setLoading(true);

    unsubscribes.push(onSnapshot(collection(db, 'exams'), (snap) => {
      setExams(snap.docs.map(d => ({ id: d.id, ...d.data() } as Exam)));
    }));

    unsubscribes.push(onSnapshot(query(collection(db, 'scheduledClasses'), where('professorId', '==', user.uid)), (snap) => {
      setScheduledClasses(snap.docs.map(d => ({ id: d.id, ...d.data() } as ScheduledClass)));
    }));

    if (selectedCourseForModules) {
      unsubscribes.push(onSnapshot(query(collection(db, 'modulos'), where('courseId', '==', selectedCourseForModules)), (snap) => {
        setModules(snap.docs.map(d => ({ id: d.id, ...d.data() } as Module)).sort((a,b) => (a.order||0)-(b.order||0)));
      }));
    }

    unsubscribes.push(onSnapshot(collection(db, 'materials'), (snap) => {
      setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
    }));

    unsubscribes.push(onSnapshot(collection(db, 'feedbacks'), (snap) => {
      setFeedbacks(snap.docs.map(d => ({ id: d.id, ...d.data() } as Feedback)));
    }));
    
    getDocs(query(collection(db, 'users'), where('role', '==', 'aluno'))).then(snap => {
      setAllStudents(snap.docs.map(d => ({ uid: d.id, ...d.data() } as User)));
      setLoading(false);
    });

    const fetchSig = async () => {
      const d = await getDoc(doc(db, 'users', user.uid));
      if (d.exists()) setUserSignature(d.data().signatureUrl || null);
    };
    fetchSig();

    navigator.mediaDevices.enumerateDevices().then(d => {
      setDevices({
        audio: d.filter(i => i.kind === 'audioinput'),
        video: d.filter(i => i.kind === 'videoinput')
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, [selectedCourseForModules, user.uid]);

  useEffect(() => {
    let timer: any;
    if (testStarted && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && testStarted) {
      handleNextQuestion();
    }
    return () => clearInterval(timer);
  }, [testStarted, timeLeft]);

  // Calendar Logic
  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  
  const getDaysArray = useMemo(() => {
    const totalDays = daysInMonth(calendarDate);
    const startOffset = firstDayOfMonth(calendarDate);
    const arr = [];
    for (let i = 0; i < startOffset; i++) arr.push(null);
    for (let i = 1; i <= totalDays; i++) arr.push(new Date(calendarDate.getFullYear(), calendarDate.getMonth(), i));
    return arr;
  }, [calendarDate]);

  const changeMonth = (offset: number) => {
    setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + offset, 1));
  };

  const startLiveMedia = async (videoId?: string, audioId?: string) => {
    setMediaError(null);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    try {
      const constraints = {
        video: videoId ? { deviceId: { exact: videoId } } : true,
        audio: audioId ? { deviceId: { exact: audioId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;
    } catch (err: any) { 
      console.error("Media Error:", err); 
      setMediaError(err.message || "Não foi possível acessar a câmera/microfone.");
    }
  };

  const startLobby = async () => {
    setShowLobby(true);
    await startLiveMedia(selectedDevices.video, selectedDevices.audio);
  };

  const startLiveFromLobby = () => {
    setIsLiveActive(true);
    setShowLobby(false);
    setTimeout(() => {
      if (videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
    }, 200);
  };

  const stopLive = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsLiveActive(false);
    setIsPresentationMode(false);
    setScreenShareActive(false);
  };

  const toggleMic = () => {
    if (streamRef.current) {
      const track = streamRef.current.getAudioTracks()[0];
      if (track) { track.enabled = !track.enabled; setMicActive(track.enabled); }
    }
  };

  const toggleVideo = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) { track.enabled = !track.enabled; setVideoActive(track.enabled); }
    }
  };

  const toggleScreenShare = async () => {
    if (screenShareActive) {
      await startLiveMedia(selectedDevices.video, selectedDevices.audio);
      setScreenShareActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setScreenShareActive(true);
        stream.getTracks()[0].onended = () => {
          toggleScreenShare();
        };
      } catch (err) {
        console.error("Screen share error:", err);
      }
    }
  };

  const triggerReaction = (emoji: string) => {
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        const id = Date.now() + i;
        setActiveReactions(prev => [...prev, { id, emoji, left: Math.random() * 80 + 10 }]);
        setTimeout(() => setActiveReactions(prev => prev.filter(r => r.id !== id)), 2500);
      }, i * 150);
    }
  };

  const handleSendMessage = (attachment?: string) => {
    if (!chatMessage.trim() && !attachment) return;
    setChatMessages(prev => [...prev, { 
      user: user.displayName, 
      text: chatMessage, 
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      attachment 
    }]);
    setChatMessage('');
  };

  const handleSaveQuestion = async () => {
    if (!currentExam || !questionForm.text) return;
    const newQ = { id: Math.random().toString(36).substr(2,9), text: questionForm.text, options: [...questionForm.options], correctOption: questionForm.correct };
    const up = [...(currentExam.questions || []), newQ];
    await updateDoc(doc(db, 'exams', currentExam.id), { questions: up });
    setCurrentExam({ ...currentExam, questions: up });
    setQuestionForm({ text: '', options: ['', '', '', ''], correct: 0 });
  };

  const handleSaveLesson = async () => {
    if (!currentModuleId || !lessonForm.title) return;
    const modRef = doc(db, 'modulos', currentModuleId);
    const modSnap = await getDoc(modRef);
    if (!modSnap.exists()) return;
    const moduleData = modSnap.data() as Module;
    let lessons = [...(moduleData.lessons || [])];
    if (editingLessonId) {
      lessons = lessons.map(l => l.id === editingLessonId ? { ...l, ...lessonForm } : l);
    } else {
      lessons.push({ id: Math.random().toString(36).substr(2, 9), ...lessonForm, order: lessons.length + 1 });
    }
    await updateDoc(modRef, { lessons });
    setIsLessonModalOpen(false);
  };

  const handleSaveMaterial = async () => {
    if (!materialForm.title || !materialForm.url || !materialForm.courseId) return;
    await addDoc(collection(db, 'materials'), {
      ...materialForm,
      createdAt: serverTimestamp()
    });
    setIsMaterialModalOpen(false);
    setMaterialForm({ title: '', url: '', courseId: selectedCourseForModules, type: 'pdf' });
  };

  const statsFeedback = useMemo(() => {
    const relevant = feedbacks.filter(f => f.courseId === selectedCourseForModules);
    const total = relevant.length;
    const avg = total > 0 ? (relevant.reduce((a, b) => a + (b.rating || 0), 0) / total).toFixed(1) : '0.0';
    const cats = { elogio: relevant.filter(f => f.type === 'elogio').length, reclamacao: relevant.filter(f => f.type === 'reclamacao').length, sugestao: relevant.filter(f => f.type === 'sugestao').length };
    const dist = [1,2,3,4,5].map(s => ({ star: s, count: relevant.filter(f => f.rating === s).length }));
    return { avg, total, cats, dist, relevant };
  }, [feedbacks, selectedCourseForModules]);

  if (loading) return <div className="h-full flex items-center justify-center"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent animate-spin rounded-full"></div></div>;

  // VIEW: PREVIEW ALUNO
  if (fullScreenMode === 'course_preview') {
    return (
      <div className="fixed inset-0 z-[1000] bg-white flex flex-col animate-in slide-in-from-right duration-500 overflow-hidden text-slate-900">
        <header className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-xl">
          <div className="flex items-center gap-4">
            <button onClick={() => setFullScreenMode('none')} className="p-2 hover:bg-white/10 rounded-full"><ArrowLeft size={20}/></button>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight italic">Ambiente do Aluno</h2>
              <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest">{courses.find(c => c.id === selectedCourseForModules)?.nome}</p>
            </div>
          </div>
          <button onClick={() => setFullScreenMode('none')} className="px-6 py-2.5 bg-indigo-600 rounded-xl text-[9px] font-black uppercase shadow-lg shadow-indigo-900/50">Sair da Simulação</button>
        </header>
        <div className="flex-1 flex overflow-hidden">
          <aside className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto p-6 hidden md:block">
            <h3 className="text-[9px] font-black uppercase text-slate-400 mb-6 tracking-widest italic">Conteúdo Acadêmico</h3>
            <div className="space-y-6">
              {modules.map((m, idx) => (
                <div key={m.id} className="space-y-3">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase text-indigo-600 italic">
                    <span className="w-5 h-5 rounded bg-indigo-100 flex items-center justify-center text-[9px]">{idx + 1}</span> {m.title}
                  </div>
                  <div className="pl-6 space-y-2">
                    {m.lessons.map(l => (
                      <div key={l.id} className="flex items-center gap-2 text-[10px] font-medium text-slate-500 hover:text-indigo-600 cursor-pointer group">
                        <PlayCircle size={12} className="text-slate-300 group-hover:text-indigo-600" /> {l.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>
          <main className="flex-1 overflow-y-auto p-12 bg-white flex flex-col items-center">
            <div className="max-w-4xl w-full space-y-8 animate-in fade-in duration-700">
              <div className="aspect-video bg-slate-900 rounded-[2.5rem] shadow-2xl flex flex-col items-center justify-center text-white/50 group relative overflow-hidden">
                 <Play size={80} className="text-white relative z-10" />
                 <p className="mt-4 text-[10px] font-black uppercase tracking-[0.4em] relative z-10 text-white/70 italic">Streaming Master 4K</p>
              </div>
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                   <div className="h-8 w-1 bg-indigo-600 rounded-full"></div>
                   <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">Aula Inaugural</h1>
                </div>
                <p className="text-slate-500 leading-relaxed text-sm font-medium italic">Seu aprendizado sem limites.</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // TELA CHEIA: EDITOR DE QUESTÕES (BANCO DE DADOS)
  if (fullScreenMode === 'question_editor' && currentExam) {
    return (
      <div className="fixed inset-0 z-[1100] bg-slate-50 flex flex-col animate-in fade-in overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm text-slate-900">
          <div className="flex items-center gap-4">
            <button onClick={() => setFullScreenMode('none')} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"><ArrowLeft size={20}/></button>
            <div>
              <h2 className="text-lg font-black uppercase tracking-tighter italic leading-none">Gestão de Itens: {currentExam.title}</h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Ambiente de Edição do Professor</p>
            </div>
          </div>
          <button onClick={() => setFullScreenMode('none')} className="bg-slate-900 text-white px-8 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 shadow-xl transition-all">Sair do Editor</button>
        </header>
        <div className="flex-1 overflow-y-auto bg-slate-50/50 p-8 flex flex-col lg:flex-row gap-8">
            <div className="w-full lg:w-[400px] space-y-6 lg:sticky lg:top-0 h-fit">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"><Plus size={18}/></div>
                  <h3 className="font-black uppercase text-xs tracking-tight italic">Criar Novo Item</h3>
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-3 italic">Enunciado</label>
                    <textarea value={questionForm.text} onChange={e => setQuestionForm({...questionForm, text: e.target.value})} placeholder="Escreva a pergunta acadêmica aqui..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl h-32 font-bold shadow-inner outline-none focus:ring-1 focus:ring-indigo-600 resize-none text-xs"></textarea>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[8px] font-black uppercase text-slate-400 ml-3 italic">Alternativas (Marque a correta)</label>
                    {questionForm.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <button onClick={() => setQuestionForm({...questionForm, correct: i})} className={`w-10 h-10 rounded-xl font-black text-xs transition-all shadow-md shrink-0 ${questionForm.correct === i ? 'bg-emerald-50 text-white' : 'bg-white border border-slate-100 text-slate-300'}`}>{String.fromCharCode(65+i)}</button>
                        <input value={opt} onChange={e => { const up = [...questionForm.options]; up[i] = e.target.value; setQuestionForm({...questionForm, options: up}); }} placeholder={`Opção ${String.fromCharCode(65+i)}...`} className="flex-1 px-5 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-bold shadow-inner outline-none focus:ring-1 focus:ring-indigo-600" />
                      </div>
                    ))}
                  </div>
                  <button onClick={handleSaveQuestion} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-2xl shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition-all italic tracking-widest">Anexar Questão ao Banco</button>
                </div>
              </div>
            </div>
            <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-3"><ListOrdered className="text-indigo-600" size={20}/><h4 className="font-black uppercase text-[10px] tracking-widest italic leading-none">Banco de Itens Atual ({currentExam.questions?.length||0})</h4></div>
                </div>
                <div className="divide-y divide-slate-100 flex-1 overflow-y-auto custom-scrollbar">
                  {(!currentExam.questions || currentExam.questions.length === 0) ? (
                    <div className="p-20 text-center text-slate-300 italic uppercase font-black text-xs tracking-widest">Nenhuma questão cadastrada.</div>
                  ) : currentExam.questions.map((q, idx) => (
                    <div key={q.id} className="p-8 hover:bg-indigo-50/10 transition-all group relative flex gap-6">
                       <span className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs italic shrink-0 shadow-lg">#{idx+1}</span>
                       <div className="flex-1">
                          <p className="text-sm font-black uppercase italic text-slate-800 leading-tight mb-5">{q.text}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {q.options.map((opt, oi) => (
                              <div key={oi} className={`px-4 py-2.5 rounded-xl text-[10px] font-bold border transition-all ${oi === q.correctOption ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-white text-slate-400 border-slate-100'}`}>
                                <span className="opacity-50 mr-2">{String.fromCharCode(65+oi)})</span>{opt}
                              </div>
                            ))}
                          </div>
                       </div>
                       <button onClick={async () => { if(confirm('Deseja excluir este item?')) { const up = currentExam.questions.filter(i => i.id !== q.id); await updateDoc(doc(db, 'exams', currentExam.id), { questions: up }); setCurrentExam({...currentExam, questions: up}); }}} className="p-3 text-slate-200 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 border border-transparent hover:border-rose-100 shadow-sm"><Trash2 size={18}/></button>
                    </div>
                  ))}
                </div>
            </div>
        </div>
      </div>
    );
  }

  // SIMULADOR DE EXAME (ESTILO ALUNO)
  if (fullScreenMode === 'test_simulation' && currentExam) {
    const q = currentExam.questions?.[currentQuestionIndex];
    return (
      <div className="fixed inset-0 z-[1200] bg-black flex flex-col text-white animate-in fade-in overflow-hidden">
        <header className="bg-black/40 backdrop-blur-3xl border-b border-white/5 px-8 py-5 flex items-center justify-between relative z-20">
           <div className="flex items-center gap-4">
              <div className="p-2.5 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-600/30"><Timer size={20}/></div>
              <div>
                <h2 className="text-sm font-black uppercase italic tracking-tighter leading-none">{currentExam.title}</h2>
                <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.4em] mt-2 block">Questão {currentQuestionIndex + 1} / {currentExam.questions?.length || 0}</span>
              </div>
           </div>
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 px-5 py-2 rounded-2xl bg-white/5 border border-white/10 text-indigo-400 shadow-inner">
                 <Timer size={16} /><span className="text-xs font-black tabular-nums tracking-widest">{formatTime(timeLeft)}</span>
              </div>
              <button onClick={() => { setFullScreenMode('none'); setTestStarted(false); }} className="p-2.5 bg-white/5 hover:bg-rose-600 rounded-full transition-all"><X size={18}/></button>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto relative z-10 flex flex-col items-center justify-center p-6 lg:p-12">
           {!testStarted ? (
             <div className="bg-white text-slate-900 w-full max-w-lg rounded-[2.5rem] p-8 lg:p-12 text-center shadow-2xl animate-in zoom-in-95">
                <div className="w-16 h-16 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-indigo-600 shadow-inner border border-indigo-100"><ShieldAlert size={32} /></div>
                <h3 className="text-2xl font-black uppercase tracking-tighter italic mb-4 leading-none text-slate-900">Exame Simulado</h3>
                <div className="space-y-4 mb-8 text-slate-500 font-medium italic text-[10px] text-left bg-slate-50 p-6 rounded-[1.5rem] border border-slate-100 leading-relaxed shadow-inner">
                   <p className="flex items-center gap-3"><CheckCircle2 size={12} className="text-emerald-500"/> Tempo sugerido: <strong>3 minutos</strong> por item.</p>
                   <p className="flex items-center gap-3"><CheckCircle2 size={12} className="text-emerald-500"/> Média de aprovação: <strong>{currentExam.passingGrade}%</strong>.</p>
                   <p className="flex items-center gap-3"><CheckCircle2 size={12} className="text-emerald-500"/> Este é um ambiente de simulação pedagógica.</p>
                </div>
                <button onClick={() => { setTestStarted(true); setTimeLeft(180); setCurrentQuestionIndex(0); }} className="w-full py-4 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-[0.3em] italic hover:bg-indigo-600 transition-all shadow-2xl active:scale-95 shadow-slate-200">Iniciar Simulação Acadêmica</button>
             </div>
           ) : q ? (
             <div className="w-full max-w-3xl space-y-8 lg:space-y-12 animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="text-center space-y-4">
                   <h4 className="text-xl md:text-3xl font-black text-white uppercase italic tracking-tighter leading-tight break-words px-4 drop-shadow-2xl">"{q.text}"</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
                   {q.options.map((opt, i) => (
                     <div key={i} onClick={() => setCurrentTestAnswers({...currentTestAnswers, [q.id]: i})} className={`p-5 rounded-[1.5rem] border-2 flex items-center gap-4 transition-all cursor-pointer relative shadow-2xl ${currentTestAnswers[q.id] === i ? 'border-indigo-500 bg-indigo-600/20 scale-105' : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/20'}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shrink-0 shadow-lg ${currentTestAnswers[q.id] === i ? 'bg-indigo-500 text-white' : 'bg-zinc-800 text-white/20'}`}>{String.fromCharCode(65+i)}</div>
                        <span className={`text-base font-bold italic leading-tight transition-colors ${currentTestAnswers[q.id] === i ? 'text-white' : 'text-white/40'}`}>{opt}</span>
                     </div>
                   ))}
                </div>
                <div className="flex flex-col items-center pt-4">
                   <button disabled={currentTestAnswers[q.id] === undefined} onClick={handleNextQuestion} className="px-12 py-5 bg-white text-black rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] italic shadow-2xl hover:bg-indigo-500 hover:text-white active:scale-95 transition-all">
                      {currentQuestionIndex < (currentExam.questions?.length || 1) - 1 ? 'Prosseguir para Próximo Item' : 'Finalizar e Validar Exame'}
                   </button>
                </div>
             </div>
           ) : null}
        </div>
      </div>
    );
  }

  // SALA DE LIVE ATIVA (VIRTUAL CLASSROOM LIVE)
  if (isLiveActive) {
    return (
      <div className="fixed inset-0 z-[2000] bg-black flex flex-col text-white overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none z-[2100] overflow-hidden">
           {activeReactions.map(r => (
             <div key={r.id} className="absolute bottom-32 text-6xl animate-reaction-float opacity-0" style={{ left: `${r.left}%` }}>{r.emoji}</div>
           ))}
        </div>

        <div className="absolute top-0 left-0 right-0 z-[2200] p-6 flex items-center justify-between pointer-events-none">
           <div className="flex items-center gap-3 pointer-events-auto">
              <div className="bg-rose-600 px-4 py-2 rounded-xl flex items-center gap-2 shadow-2xl border border-rose-500/20"><div className="w-2 h-2 bg-white rounded-full animate-ping"></div><span className="text-[8px] font-black uppercase italic tracking-widest text-white">AO VIVO</span></div>
              <div className="bg-black/60 backdrop-blur-2xl px-4 py-2 rounded-xl border border-white/10 flex items-center gap-3 shadow-2xl"><Users size={14} className="text-indigo-400"/><span className="text-[8px] font-black uppercase tracking-widest text-white">{allStudents.length} ALUNOS</span></div>
              {isPresentationMode && (
                <button 
                  onClick={() => { setIsPresentationMode(false); setSelectedFileName(null); }}
                  className="bg-rose-600/90 hover:bg-rose-700 backdrop-blur-2xl px-4 py-2 rounded-xl border border-rose-500/30 flex items-center gap-2 shadow-2xl transition-all animate-in slide-in-from-left text-white"
                >
                  <MonitorOff size={14} /><span className="text-[8px] font-black uppercase tracking-widest">End Presentation</span>
                </button>
              )}
           </div>
           <div className="bg-indigo-600 px-4 py-2 rounded-xl text-[8px] font-black uppercase flex items-center gap-2 shadow-2xl italic tracking-widest border border-indigo-400/30 pointer-events-auto text-white"><ShieldCheck size={16}/> {user.displayName}</div>
        </div>

        <div className="flex-1 flex overflow-hidden">
           <div className="flex-1 relative flex items-center justify-center p-6 lg:p-10">
              <div className={`w-full h-full max-w-[1600px] aspect-video bg-zinc-950 rounded-[2.5rem] overflow-hidden border border-white/5 relative group transition-all duration-700 shadow-[0_50px_100px_rgba(0,0,0,0.8)]`}>
                 
                 {/* SLIDE PRESENTATION LAYER */}
                 {isPresentationMode && selectedFileName && (
                   <div className="absolute inset-0 z-40 bg-white flex flex-col items-center justify-center text-slate-900 animate-in fade-in transition-all">
                      <div className="absolute top-10 flex flex-col items-center gap-2">
                         <div className="px-5 py-1.5 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase border border-indigo-100 shadow-sm">Academic Asset Active</div>
                         <h5 className="font-black text-lg uppercase italic text-slate-900 tracking-tight">{selectedFileName}</h5>
                      </div>
                      <Presentation size={150} className="text-indigo-600 opacity-5 mb-10" />
                      <div className="text-center space-y-4">
                        <p className="text-slate-400 font-black text-2xl uppercase tracking-[0.5em] italic">SLIDE MASTER #{presentationSlide}</p>
                        <p className="text-slate-300 text-[10px] font-bold uppercase tracking-widest italic">Interação Pedagógica em Tempo Real</p>
                      </div>
                      <div className="absolute inset-x-12 top-1/2 -translate-y-1/2 flex justify-between pointer-events-none">
                         <button onClick={() => setPresentationSlide(Math.max(1, presentationSlide - 1))} className="p-8 bg-slate-50/80 backdrop-blur-md rounded-full text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-2xl pointer-events-auto border border-slate-200/50"><ChevronLeft size={40}/></button>
                         <button onClick={() => setPresentationSlide(presentationSlide + 1)} className="p-8 bg-slate-50/80 backdrop-blur-md rounded-full text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-2xl pointer-events-auto border border-slate-200/50"><ChevronRight size={40}/></button>
                      </div>
                   </div>
                 )}

                 {/* VIRTUAL BACKGROUND LAYER (FULL CONTAINER) */}
                 {virtualBg !== 'none' && (
                    <div 
                      className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-500" 
                      style={{ 
                        backgroundImage: virtualBg === 'office' ? 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80)' : virtualBg === 'custom' && customBgUrl ? `url(${customBgUrl})` : 'none',
                        filter: virtualBg === 'blur' ? 'blur(30px) brightness(0.7)' : 'brightness(0.7)'
                      }} 
                    />
                 )}

                 {/* VIDEO STREAM LAYER (TOP COMPOSITION) */}
                 <div className={`relative w-full h-full z-10 transition-all duration-700 flex items-center justify-center ${isPresentationMode ? 'scale-[0.25] origin-bottom-right absolute bottom-10 right-10 z-[100]' : ''}`}>
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className={`w-full h-full object-cover transition-opacity duration-1000 ${videoActive ? 'opacity-100' : 'opacity-0'}`}
                      style={{
                        // Inversão: Se houver fundo virtual, aplicamos um efeito de "recorte suave" (edge feathering) no vídeo
                        // Mas sem o círculo central. Usamos uma máscara radial sutil apenas nas bordas extremas.
                        maskImage: virtualBg !== 'none' ? 'radial-gradient(circle, black 85%, transparent 100%)' : 'none',
                        WebkitMaskImage: virtualBg !== 'none' ? 'radial-gradient(circle, black 85%, transparent 100%)' : 'none',
                      }}
                    />
                    {!videoActive && <div className="absolute inset-0 z-20 bg-zinc-900 flex flex-col items-center justify-center"><div className="w-24 h-24 rounded-full bg-indigo-600 flex items-center justify-center font-black text-4xl text-white shadow-2xl">{(user.displayName||'U').charAt(0)}</div><p className="mt-6 text-[9px] font-black uppercase tracking-widest text-white/20 italic">Docente em Pausa de Captura</p></div>}
                 </div>

                 {/* CONTROLS DOCK */}
                 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-black/80 backdrop-blur-3xl px-10 py-5 rounded-[2.5rem] border border-white/10 shadow-2xl z-[2300] opacity-0 group-hover:opacity-100 transition-all border border-white/5">
                    <button onClick={toggleMic} className={`p-3.5 rounded-xl transition-all shadow-xl ${micActive ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-rose-600 text-white'}`}>{micActive ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                    <button onClick={toggleVideo} className={`p-3.5 rounded-xl transition-all shadow-xl ${videoActive ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-rose-600 text-white'}`}>{videoActive ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                    <button onClick={toggleScreenShare} className={`p-3.5 rounded-xl transition-all shadow-xl ${screenShareActive ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`} title="Share Screen"><Monitor size={20}/></button>
                    <button onClick={() => setShowPptUpload(true)} className={`p-3.5 rounded-xl transition-all shadow-xl ${isPresentationMode ? 'bg-indigo-600 text-white' : 'bg-white/5 hover:bg-white/10 text-white'}`} title="Display Slides"><Presentation size={20}/></button>
                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                    <div className="flex gap-2 bg-black/40 p-1.5 rounded-2xl border border-white/5">
                       {['👏', '❤️', '🔥', '🙌'].map(e => <button key={e} onClick={() => triggerReaction(e)} className="p-2.5 hover:bg-white/10 rounded-xl text-xl active:scale-125 transition-transform">{e}</button>)}
                    </div>
                    <div className="w-px h-8 bg-white/10 mx-2"></div>
                    <button onClick={stopLive} className="px-10 py-4 bg-rose-600 hover:bg-rose-700 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all italic text-white flex items-center gap-3"><PhoneOff size={18}/> End Class</button>
                 </div>

                 <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-[2300] opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={() => setActivePanel(activePanel === 'chat' ? 'none' : 'chat')} className={`p-4 rounded-2xl border transition-all shadow-2xl ${activePanel === 'chat' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/80 border-white/10 text-white'}`}><MessageSquare size={24}/></button>
                    <button onClick={() => setActivePanel(activePanel === 'participants' ? 'none' : 'participants')} className={`p-4 rounded-2xl border transition-all shadow-2xl ${activePanel === 'participants' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/80 border-white/10 text-white'}`}><Users size={24}/></button>
                    <button onClick={() => setActivePanel(activePanel === 'settings' ? 'none' : 'settings')} className={`p-4 rounded-2xl border transition-all shadow-2xl ${activePanel === 'settings' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-black/80 border-white/10 text-white'}`}><Settings size={24}/></button>
                 </div>
              </div>
           </div>
           
           {activePanel !== 'none' && (
             <div className="w-full lg:w-[400px] bg-zinc-950 border-l border-white/5 flex flex-col animate-in slide-in-from-right h-full z-[2400] shadow-2xl">
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
                  <h4 className="text-[11px] font-black uppercase italic text-indigo-400 tracking-widest">{activePanel === 'chat' ? 'Chat Acadêmico Permanente' : activePanel === 'participants' ? 'Turma Online' : 'Configurações Master'}</h4>
                  <button onClick={() => setActivePanel('none')} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={18}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
                   {activePanel === 'chat' ? (
                     <>
                       {chatMessages.length === 0 ? (
                         <div className="h-full flex flex-col items-center justify-center opacity-20 italic p-10 text-center"><MessageSquare size={40} className="mb-4"/><p className="text-[10px] font-black uppercase tracking-widest">Chat History Empty</p></div>
                       ) : chatMessages.map((m, i) => (
                         <div key={i} className="animate-in fade-in slide-in-from-bottom-2">
                           <div className="flex items-center gap-3 mb-1.5">
                             <span className="text-[10px] font-black text-indigo-400 uppercase italic">{m.user}</span>
                             <span className="text-[8px] text-white/20 font-bold">{m.time}</span>
                           </div>
                           <div className="bg-white/5 p-4 rounded-[1.5rem] border border-white/5 text-[11px] font-medium italic text-slate-300 leading-relaxed shadow-inner">
                             {m.text && <p className="mb-3">"{m.text}"</p>}
                             {m.attachment && (
                               <div className="flex items-center gap-3 p-3 bg-black/40 rounded-2xl border border-white/5 mt-2 group cursor-pointer hover:bg-indigo-600/10 hover:border-indigo-500/30 transition-all">
                                 <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors"><FileText size={16} /></div>
                                 <span className="flex-1 truncate text-[9px] font-black uppercase tracking-tight">{m.attachment}</span>
                                 <ExternalLink size={14} className="text-white/20 group-hover:text-white" />
                               </div>
                             )}
                           </div>
                         </div>
                       ))}
                     </>
                   ) : activePanel === 'participants' ? (
                     <div className="space-y-6">
                       <div className="p-6 bg-white/5 rounded-[2rem] border border-white/10 space-y-4 shadow-inner">
                         <h5 className="text-[9px] font-black uppercase text-slate-500 tracking-[0.2em] italic ml-2">Moderação Global</h5>
                         <div className="grid grid-cols-2 gap-3">
                           <button onClick={() => setGlobalMute(!globalMute)} className={`py-3.5 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg ${globalMute ? 'bg-rose-600 border-rose-400 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                             {globalMute ? <VolumeX size={16}/> : <Mic size={16}/>} {globalMute ? 'Unmute All' : 'Mute All'}
                           </button>
                           <button onClick={() => setGlobalCamBlock(!globalCamBlock)} className={`py-3.5 rounded-xl border text-[9px] font-black uppercase flex items-center justify-center gap-2 transition-all shadow-lg ${globalCamBlock ? 'bg-rose-600 border-rose-400 text-white' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                             {globalCamBlock ? <UserX size={16}/> : <Video size={16}/>} {globalCamBlock ? 'Unlock All' : 'Block Cams'}
                           </button>
                         </div>
                       </div>
                       <div className="space-y-3">
                        <h5 className="text-[9px] font-black uppercase text-white/20 tracking-[0.2em] italic ml-2">Alunos Presentes ({allStudents.length})</h5>
                        {allStudents.map(s => (
                          <div key={s.uid} className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-all">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center font-black text-sm italic text-indigo-400 shadow-lg group-hover:scale-110 transition-transform">{(s.displayName||'U').charAt(0)}</div>
                              <span className="text-[11px] font-black uppercase italic text-slate-300 tracking-tight">{s.displayName}</span>
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                              <button className="p-2.5 bg-white/5 hover:bg-rose-600 rounded-xl transition-all border border-white/5 shadow-sm"><VolumeX size={14}/></button>
                              <button className="p-2.5 bg-white/5 hover:bg-rose-600 rounded-xl transition-all border border-white/5 shadow-sm"><PowerOff size={14}/></button>
                            </div>
                          </div>
                        ))}
                       </div>
                     </div>
                   ) : (
                     <div className="space-y-8">
                        <div className="space-y-4"><h5 className="text-[9px] font-black uppercase text-white/20 italic tracking-widest ml-2">Fontes Master de Entrada</h5><div className="space-y-3">
                           <div className="relative group"><Video size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-indigo-400 transition-colors" /><select value={selectedDevices.video} onChange={e => { setSelectedDevices({...selectedDevices, video:e.target.value}); startLiveMedia(e.target.value, selectedDevices.audio); }} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-[11px] font-black text-slate-300 outline-none appearance-none hover:bg-white/10 transition-all"><option value="">Detectar Câmera...</option>{devices.video.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></div>
                           <div className="relative group"><Mic size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-indigo-400 transition-colors" /><select value={selectedDevices.audio} onChange={e => { setSelectedDevices({...selectedDevices, audio:e.target.value}); startLiveMedia(selectedDevices.video, e.target.value); }} className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-4 text-[11px] font-black text-slate-300 outline-none appearance-none hover:bg-white/10 transition-all"><option value="">Detectar Microfone...</option>{devices.audio.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></div>
                        </div></div>
                        <div className="space-y-4"><h5 className="text-[9px] font-black uppercase text-white/20 italic tracking-widest ml-2">Cenário Digital Effect</h5><div className="grid grid-cols-2 gap-3">
                           {['none', 'blur', 'office', 'custom'].map(bg => (
                             <button key={bg} onClick={() => { if(bg === 'custom') customBgInputRef.current?.click(); else setVirtualBg(bg as any); }} className={`p-6 rounded-[2rem] border text-[10px] font-black uppercase transition-all flex flex-col items-center gap-4 ${virtualBg === bg ? 'bg-indigo-600 border-indigo-400 text-white shadow-2xl scale-105' : 'bg-white/5 border-white/10 hover:bg-white/10 text-white/40'}`}>
                                <span className="p-4 bg-black/40 rounded-2xl shadow-inner group-hover:scale-110 transition-transform">{bg === 'none' ? <Video size={20} /> : bg === 'blur' ? <Sparkles size={20} /> : bg === 'office' ? <ImageIcon size={20} /> : <Upload size={20} />}</span>{bg}
                             </button>
                           ))}
                        </div></div>
                     </div>
                   )}
                </div>
                {activePanel === 'chat' && (
                  <div className="p-8 border-t border-white/5 bg-[#080808] shadow-2xl">
                    <div className="relative flex items-center gap-3">
                      <button onClick={() => chatAttachmentRef.current?.click()} className="p-3 text-white/20 hover:text-indigo-400 hover:bg-indigo-600/10 transition-all bg-white/5 rounded-2xl shadow-sm"><Paperclip size={20}/></button>
                      <input value={chatMessage} onChange={e => setChatMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendMessage()} placeholder="Write to students..." className="flex-1 bg-white/5 border-none rounded-2xl px-6 py-4.5 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-600 placeholder:text-white/10 shadow-inner" />
                      <button onClick={() => handleSendMessage()} className="p-3 text-indigo-500 hover:text-indigo-400 hover:scale-110 bg-indigo-500/10 rounded-2xl transition-all shadow-lg active:scale-95"><Send size={22}/></button>
                    </div>
                  </div>
                )}
             </div>
           )}
        </div>

        {/* UPLOAD MODAL */}
        {showPptUpload && (
          <div className="fixed inset-0 z-[3000] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-xl rounded-[4rem] p-16 text-center shadow-[0_100px_200px_rgba(0,0,0,0.8)] animate-in zoom-in-95 border border-slate-100 relative">
              <button onClick={() => { setShowPptUpload(false); setSelectedFileName(null); }} className="absolute top-10 right-10 p-3 bg-slate-50 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm"><X size={24}/></button>
              <div className="w-24 h-24 bg-indigo-50 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 text-indigo-600 shadow-inner border border-indigo-100 animate-bounce-slow"><Presentation size={48}/></div>
              <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter italic mb-4 leading-none">Exposição Docente</h3>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.3em] italic mb-10">Selecione PDFs ou PPTs para exibir em tempo real.</p>
              <div onClick={() => fileInputRef.current?.click()} className={`border-4 border-dashed rounded-[3rem] p-16 mb-12 cursor-pointer transition-all duration-500 transform hover:scale-[1.02] ${selectedFileName ? 'border-emerald-200 bg-emerald-50/20 shadow-2xl' : 'border-slate-100 hover:border-indigo-400 hover:bg-slate-50 shadow-sm'}`}>
                {selectedFileName ? (
                  <div className="space-y-6 animate-in zoom-in-50"><CheckCircle2 size={80} className="text-emerald-500 mx-auto drop-shadow-xl" /><p className="text-lg font-black text-slate-900 uppercase italic tracking-tighter shadow-sm">{selectedFileName}</p></div>
                ) : (
                  <><Upload size={50} className="text-slate-200 mb-6 mx-auto opacity-50" /><span className="text-xs font-black uppercase text-slate-300 tracking-[0.6em] block leading-none">CHOOSE FILE MASTER</span></>
                )}
                <input type="file" ref={fileInputRef} className="hidden" accept=".pptx,.ppt,.pdf" onChange={(e) => { if(e.target.files?.[0]) { setSelectedFileName(e.target.files[0].name); } }} />
              </div>
              <div className="flex gap-4">
                <button onClick={() => { setShowPptUpload(false); setSelectedFileName(null); }} className="flex-1 py-6 bg-slate-100 text-slate-400 rounded-[2rem] text-[11px] font-black uppercase tracking-widest italic hover:bg-slate-200 transition-all">Cancelar</button>
                <button disabled={!selectedFileName} onClick={() => { setIsPresentationMode(true); setShowPptUpload(false); }} className={`flex-1 py-6 text-white rounded-[2rem] text-[11px] font-black uppercase shadow-2xl tracking-[0.4em] italic transition-all ${selectedFileName ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-slate-200 cursor-not-allowed'}`}>Start Presentation</button>
              </div>
            </div>
          </div>
        )}
        <input type="file" ref={customBgInputRef} className="hidden" accept="image/*" onChange={e => { if(e.target.files?.[0]) { const reader = new FileReader(); reader.onload = (f) => { setCustomBgUrl(f.target?.result as string); setVirtualBg('custom'); }; reader.readAsDataURL(e.target.files[0]); }}} />
        <input type="file" ref={chatAttachmentRef} className="hidden" onChange={e => { if(e.target.files?.[0]) handleSendMessage(e.target.files[0].name); }} />
        <style>{`
          @keyframes reaction-float {
            0% { transform: translateY(0) scale(0.5); opacity: 0; }
            10% { opacity: 1; }
            100% { transform: translateY(-400px) scale(1.5); opacity: 0; }
          }
          .animate-reaction-float { animation: reaction-float 2.5s ease-out forwards; }
          .animate-bounce-slow { animation: bounce 3s infinite; }
        `}</style>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in h-full text-slate-900">
      {/* MATRIZ CURRICULAR */}
      {activeSub === 'modulos' && (
        <div className="space-y-5 animate-in slide-in-from-bottom-5">
           <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><Layers size={22}/></div>
              <div><h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Matriz Acadêmica</h1><p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Gestão de Conteúdo EAD</p></div>
            </div>
            
            <div className="flex flex-wrap items-center justify-center lg:justify-end gap-3">
              {userSignature && (
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-inner group">
                   <img src={userSignature} alt="Signature" className="h-6 grayscale opacity-40 group-hover:opacity-100 transition-opacity" />
                   <span className="text-[7px] font-black uppercase text-slate-400 italic">Docente Validado</span>
                </div>
              )}
              <button onClick={() => setIsSignModalOpen(true)} className="bg-amber-50 text-amber-600 px-5 py-3 rounded-xl text-[8px] font-black uppercase border border-amber-100 flex items-center gap-2 hover:bg-amber-100 transition-all italic"><PenTool size={14}/> Coletar Assinatura</button>
              <button onClick={() => setFullScreenMode('course_preview')} className="bg-slate-100 text-slate-600 px-5 py-3 rounded-xl text-[8px] font-black uppercase hover:bg-slate-200 transition-all flex items-center gap-2 italic"><Eye size={14}/> Preview Aluno</button>
              <select value={selectedCourseForModules} onChange={e => setSelectedCourseForModules(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[9px] font-black uppercase outline-none shadow-inner">
                {courses.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
              <button onClick={() => { setModuleTitle(''); setCurrentModuleId(null); setIsModuleModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-[8px] font-black uppercase shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center gap-2 italic tracking-widest"><Plus size={16}/> Novo Módulo</button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {modules.map(mod => (
              <div key={mod.id} className="bg-white border border-slate-100 rounded-[2.5rem] overflow-hidden group shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-500">
                  <div className="bg-slate-50/50 px-8 py-5 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm italic shadow-inner">#{mod.order}</span>
                      <h3 className="font-black text-slate-800 text-sm uppercase italic tracking-[0.1em]">{mod.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <button onClick={() => { setExamForm({title:'', courseId: selectedCourseForModules, moduleId: mod.id, type:'activity', passingGrade:70}); setIsExamModalOpen(true); }} className="px-4 py-2.5 bg-amber-50 text-amber-600 text-[8px] font-black uppercase rounded-lg border border-amber-100 hover:bg-amber-100 transition-all italic tracking-widest flex items-center gap-2"><Award size={14}/> Criar Avaliação</button>
                      <button onClick={() => { setCurrentModuleId(mod.id); setEditingLessonId(null); setLessonForm({title:'', videoUrl:'', description:'', materialUrl:''}); setIsLessonModalOpen(true); }} className="px-5 py-2.5 bg-indigo-600 text-white text-[8px] font-black uppercase rounded-lg shadow-lg hover:scale-105 transition-all italic tracking-widest">Add Aula</button>
                      <button onClick={() => { setModuleTitle(mod.title); setCurrentModuleId(mod.id); setIsModuleModalOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"><Edit3 size={16}/></button>
                      <button onClick={async () => { if(confirm('Excluir módulo?')) await deleteDoc(doc(db, 'modulos', mod.id)); }} className="p-2 text-slate-200 hover:text-rose-600 transition-all"><Trash2 size={16}/></button>
                    </div>
                  </div>
                  <div className="p-8 space-y-3">
                    {mod.lessons.map((l, i) => (
                      <div key={l.id} className="bg-white p-5 rounded-2xl flex items-center justify-between border border-slate-50 hover:border-indigo-100 transition-all group/l shadow-sm">
                        <div className="flex items-center gap-4">
                          <span className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center font-black text-slate-300 group-hover/l:bg-indigo-600 group-hover/l:text-white transition-all italic text-xs">{i+1}</span>
                          <div>
                            <h4 className="font-black text-slate-900 uppercase italic tracking-tight text-xs leading-none">{l.title}</h4>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: Publicado</p>
                          </div>
                        </div>
                        <div className="flex gap-2 opacity-0 group-hover/l:opacity-100 transition-opacity">
                          <button onClick={() => { setCurrentModuleId(mod.id); setEditingLessonId(l.id); setLessonForm({title:l.title, videoUrl:l.videoUrl, description:l.description||'', materialUrl:l.materialUrl||''}); setIsLessonModalOpen(true); }} className="p-2.5 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all bg-white border border-slate-100 shadow-sm"><Edit3 size={14}/></button>
                          <button onClick={async () => { if(confirm('Excluir?')) { const up = mod.lessons.filter(item => item.id !== l.id); await updateDoc(doc(db, 'modulos', mod.id), { lessons: up }); }}} className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all border border-slate-100 shadow-sm"><Trash2 size={14}/></button>
                        </div>
                      </div>
                    ))}
                    {exams.filter(e => e.moduleId === mod.id).map(ex => (
                      <div key={ex.id} className="bg-amber-50/20 p-6 rounded-2xl flex items-center justify-between border border-amber-100 shadow-sm group/e hover:bg-amber-50 transition-all">
                        <div className="flex items-center gap-5">
                          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl shadow-inner"><Award size={22}/></div>
                          <div>
                             <h4 className="font-black text-amber-900 text-xs uppercase italic leading-none">{ex.title}</h4>
                             <span className="text-[8px] font-black text-amber-600/60 uppercase italic mt-1.5 block tracking-widest">{ex.questions?.length||0} Itens Acadêmicos</span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => { setCurrentExam(ex); setFullScreenMode('question_editor'); }} className="px-6 py-3 bg-amber-600 text-white text-[9px] font-black uppercase rounded-xl shadow-xl hover:bg-amber-700 transition-all italic tracking-widest">Gerir Itens</button>
                           <button onClick={() => { setCurrentExam(ex); setFullScreenMode('test_simulation'); setTestStarted(false); }} className="p-3 bg-white text-amber-600 border border-amber-200 rounded-xl hover:bg-amber-600 hover:text-white transition-all"><Eye size={18}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MATERIAIS */}
      {activeSub === 'materiais' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg shadow-sm"><FileText size={18}/></div>
              <div><h1 className="text-base font-black uppercase italic tracking-tighter leading-none">Materiais</h1><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gestão de Arquivos</p></div>
            </div>
            <button 
              onClick={() => {
                setMaterialForm({ title: '', url: '', courseId: selectedCourseForModules, type: 'pdf' });
                setIsMaterialModalOpen(true);
              }}
              className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[8px] font-black uppercase shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-1.5 italic tracking-widest"
            >
              <Plus size={14}/> Novo Arquivo
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {materials.filter(m => m.courseId === selectedCourseForModules).length === 0 ? (
              <div className="col-span-full py-20 text-center text-slate-300 font-black uppercase text-xs tracking-widest italic border-4 border-dashed rounded-[3rem]">Nenhum material anexado.</div>
            ) : materials.filter(m => m.courseId === selectedCourseForModules).map(m => (
              <div key={m.id} className="bg-white p-6 rounded-3xl border border-slate-100 relative group hover:shadow-2xl hover:border-indigo-200 transition-all text-center">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner group-hover:bg-indigo-50 transition-colors"><FileText size={24} className="text-indigo-500" /></div>
                <h4 className="font-black text-slate-900 text-[10px] uppercase italic mb-5 leading-tight tracking-tight line-clamp-2 h-8">{m.title}</h4>
                <a href={m.url} target="_blank" className="w-full flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase hover:bg-indigo-600 transition-all italic"><ExternalLink size={12}/> Abrir</a>
                <button onClick={async () => { if(confirm('Excluir?')) await deleteDoc(doc(db, 'materials', m.id)); }} className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 text-slate-200 hover:text-rose-500 transition-all"><Trash2 size={14}/></button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AVALIAÇÃO */}
      {activeSub === 'avaliacao' && (
        <div className="space-y-5 animate-in fade-in">
          <div className="bg-white p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg shadow-sm"><Award size={18}/></div>
              <div><h1 className="text-base font-black uppercase italic tracking-tighter leading-none">Banca de Avaliação</h1><p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Controladoria Acadêmica</p></div>
            </div>
            <button onClick={() => { setExamForm({title:'', courseId: selectedCourseForModules, moduleId:'', type:'activity', passingGrade:70}); setIsExamModalOpen(true); }} className="bg-slate-900 text-white px-5 py-2.5 rounded-lg text-[8px] font-black uppercase shadow-2xl hover:bg-indigo-600 transition-all flex items-center gap-1.5 italic tracking-widest"><Plus size={14}/> Criar Avaliação</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {exams.filter(e => e.courseId === selectedCourseForModules).map(ex => (
              <div key={ex.id} className="bg-white p-6 rounded-3xl border border-slate-100 group relative hover:shadow-2xl transition-all duration-500">
                <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-slate-50 rounded-xl shadow-inner group-hover:bg-amber-50 transition-colors"><Award size={24} className={ex.type === 'evaluation' ? 'text-amber-500' : 'text-emerald-500'} /></div>
                  <div className="text-right flex flex-col">
                    <span className="text-[7px] font-black uppercase text-slate-400 italic">Corte</span>
                    <span className="text-xl font-black text-slate-900 tabular-nums leading-none tracking-tighter">{ex.passingGrade}%</span>
                  </div>
                </div>
                <h4 className="font-black text-slate-900 text-xs uppercase italic mb-6 line-clamp-1 group-hover:text-indigo-600 transition-colors">{ex.title}</h4>
                <div className="flex gap-2 items-center">
                  <button onClick={() => { setCurrentExam(ex); setFullScreenMode('question_editor'); }} className="flex-1 py-3 bg-slate-900 text-white rounded-xl text-[8px] font-black uppercase shadow-lg hover:bg-indigo-600 transition-all italic tracking-widest">Itens ({ex.questions?.length||0})</button>
                  <button onClick={() => { setCurrentExam(ex); setFullScreenMode('test_simulation'); setTestStarted(false); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all shadow-sm border border-indigo-100"><Eye size={16}/></button>
                  <button onClick={async () => { if(confirm('Excluir?')) await deleteDoc(doc(db, 'exams', ex.id)); }} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-600 transition-all shadow-sm border border-rose-100"><Trash2 size={16}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK ANALYTICS */}
      {activeSub === 'feedback' && (
        <div className="space-y-6 animate-in fade-in">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-600 text-white rounded-[1rem] shadow-2xl shadow-indigo-100"><BarChart3 size={20}/></div>
              <div><h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Métricas de Satisfação</h1><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">NPS Global</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
               <div className="text-center px-6 border-r border-slate-200"><p className="text-2xl font-black text-indigo-600 leading-none tabular-nums">{statsFeedback.avg}</p><p className="text-[7px] font-black uppercase text-slate-400 mt-2 italic tracking-widest">NPS Geral</p></div>
               <div className="text-center px-6 border-r border-slate-200"><p className="text-2xl font-black text-emerald-600 leading-none tabular-nums">{statsFeedback.cats.elogio}</p><p className="text-[7px] font-black uppercase text-slate-400 mt-2 italic tracking-widest">Elogios</p></div>
               <div className="text-center px-6"><p className="text-2xl font-black text-rose-600 leading-none tabular-nums">{statsFeedback.cats.reclamacao}</p><p className="text-[7px] font-black uppercase text-slate-400 mt-2 italic tracking-widest">Críticas</p></div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
             <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8 h-fit">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] italic flex items-center gap-3 text-slate-800"><Activity size={16} className="text-indigo-600" /> Comentários Reais ({statsFeedback.relevant.length})</h3>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                   {statsFeedback.relevant.length === 0 ? (
                     <p className="text-center py-10 text-[10px] font-black uppercase text-slate-300 italic">Sem feedbacks registrados no banco.</p>
                   ) : statsFeedback.relevant.map(f => (
                     <div key={f.id} className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase text-indigo-600 italic">{(f as any).userName || 'Anônimo'}</span>
                          <div className="flex gap-0.5">{Array.from({length:5}).map((_,i) => <Star key={i} size={10} className={i < f.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}</div>
                        </div>
                        <p className="text-[11px] font-medium text-slate-600 italic">"{f.comment}"</p>
                     </div>
                   ))}
                </div>
             </div>
             <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group h-fit">
                <div className="relative z-10 space-y-6">
                   <h3 className="text-[10px] font-black uppercase tracking-widest italic text-indigo-400">Status do Banco</h3>
                   <div className="space-y-3">
                      <p className="text-slate-300 text-[11px] italic leading-relaxed">Engajamento discente calculado via Firestore em tempo real.</p>
                      <div className="pt-6 grid grid-cols-2 gap-4 border-t border-white/5">
                        <div><p className="text-2xl font-black tracking-tighter tabular-nums">{statsFeedback.avg}</p><p className="text-[7px] font-black uppercase text-white/30 tracking-widest">Média NPS</p></div>
                        <div><p className="text-2xl font-black tracking-tighter tabular-nums">{statsFeedback.total}</p><p className="text-[7px] font-black uppercase text-white/30 tracking-widest">Total Itens</p></div>
                      </div>
                   </div>
                </div>
                <BarChart3 size={150} className="absolute -bottom-10 -right-10 text-white/5 group-hover:scale-110 transition-transform duration-1000" />
             </div>
          </div>
        </div>
      )}

      {/* DIÁRIO / RELATÓRIO / FREQUÊNCIA */}
      {(['diario', 'relatorio', 'frequencia'] as ProfessorSubView[]).includes(activeSub) && (
        <div className="space-y-5 animate-in fade-in flex flex-col h-full">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex items-center gap-5 shrink-0">
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl shadow-2xl">
              {activeSub === 'diario' ? <Calendar size={22}/> : activeSub === 'relatorio' ? <TrendingUp size={22}/> : <Users size={22}/>}
            </div>
            <div><h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">{activeSub === 'diario' ? 'Diário de Classe' : activeSub === 'relatorio' ? 'Relatório Mensal' : 'Frequência Discente'}</h1><p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sincronização Acadêmica</p></div>
          </div>
          <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm flex-1">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-[8px] font-black uppercase text-slate-400 tracking-[0.3em] border-b border-slate-100">
                  <tr><th className="px-8 py-5">Nome do Aluno</th><th className="px-8 py-5">Engajamento</th><th className="px-8 py-5">Média Semestral</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-[10px]">
                  {allStudents.length === 0 ? (
                    <tr><td colSpan={3} className="px-8 py-20 text-center text-slate-300 italic uppercase font-black text-xs tracking-widest">Nenhum aluno matriculado neste fluxo.</td></tr>
                  ) : allStudents.map(s => (
                    <tr key={s.uid} className="hover:bg-indigo-50/20 transition-all group">
                      <td className="px-8 py-4 flex items-center gap-4"><div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-lg italic shrink-0">{(s.displayName||'U').charAt(0)}</div><span className="font-black uppercase italic text-slate-900 text-xs tracking-tight">{s.displayName}</span></td>
                      <td className="px-8 py-4 font-black text-slate-600 tabular-nums">92.5%</td>
                      <td className="px-8 py-4"><span className="px-4 py-1.5 bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase rounded-lg border border-indigo-100">9.2 / 10.0</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AULA AO VIVO (LOBBY + AGENDA CALENDAR) */}
      {activeSub === 'live' && !isLiveActive && (
        <div className="h-full flex flex-col animate-in fade-in space-y-8 overflow-y-auto pb-10 custom-scrollbar">
          {showLobby ? (
            <div className="fixed inset-0 z-[2500] bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center p-6 animate-in zoom-in-95">
               <div className="bg-white w-full max-w-5xl rounded-[3rem] overflow-hidden flex flex-col md:flex-row shadow-[0_50px_100px_rgba(0,0,0,0.5)]">
                  <div className="flex-1 bg-black relative flex items-center justify-center group overflow-hidden">
                     {virtualBg !== 'none' && (
                        <div className="absolute inset-0 z-0 bg-cover bg-center transition-all duration-700" style={{ 
                           backgroundImage: virtualBg === 'office' ? 'url(https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80)' : virtualBg === 'custom' && customBgUrl ? `url(${customBgUrl})` : 'none',
                           filter: virtualBg === 'blur' ? 'blur(30px) brightness(0.7)' : 'brightness(0.7)'
                        }}></div>
                     )}
                     <video 
                      ref={lobbyVideoRef} 
                      autoPlay 
                      playsInline 
                      muted 
                      className={`w-full h-full object-cover transition-all relative z-10 ${videoActive ? 'opacity-100' : 'opacity-0'}`} 
                      style={{
                        maskImage: virtualBg !== 'none' ? 'radial-gradient(circle, black 85%, transparent 100%)' : 'none',
                        WebkitMaskImage: virtualBg !== 'none' ? 'radial-gradient(circle, black 85%, transparent 100%)' : 'none',
                      }}
                     />
                     {!videoActive && <div className="absolute inset-0 z-20 flex items-center justify-center"><div className="w-20 h-20 rounded-[2rem] bg-indigo-600 flex items-center justify-center font-black text-4xl text-white shadow-2xl">{(user.displayName||'P').charAt(0)}</div></div>}
                     {mediaError && (
                       <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 bg-rose-600/90 text-white p-6 rounded-2xl flex flex-col items-center gap-3">
                         <AlertTriangle size={32} />
                         <p className="text-xs font-black uppercase tracking-tight text-center">{mediaError}</p>
                         <button onClick={() => startLiveMedia()} className="px-4 py-2 bg-white text-rose-600 rounded-lg text-[9px] font-black uppercase">Tentar Novamente</button>
                       </div>
                     )}
                     <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3 bg-black/40 backdrop-blur-xl p-3 rounded-2xl border border-white/10">
                        <button onClick={toggleMic} className={`p-3 rounded-xl shadow-2xl transition-all ${micActive ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-600 text-white'}`}>{micActive ? <Mic size={20}/> : <MicOff size={20}/>}</button>
                        <button onClick={toggleVideo} className={`p-3 rounded-xl shadow-2xl transition-all ${videoActive ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-rose-600 text-white'}`}>{videoActive ? <Video size={20}/> : <VideoOff size={20}/>}</button>
                     </div>
                  </div>
                  <div className="w-full md:w-[400px] p-10 space-y-8 flex flex-col justify-center bg-white">
                     <div className="space-y-1.5 text-center">
                        <h3 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Setup da Aula</h3>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.4em] italic leading-none">Ajuste seu ambiente de ensino</p>
                     </div>
                     <div className="space-y-6">
                        <div className="space-y-2.5">
                           <label className="text-[8px] font-black uppercase text-indigo-600 ml-3 tracking-widest italic">Fonte de Captura</label>
                           <div className="space-y-2">
                             <div className="relative"><Video size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" /><select onChange={e => { setSelectedDevices({...selectedDevices, video: e.target.value}); startLiveMedia(e.target.value, selectedDevices.audio); }} className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"><option value="">Ajustar Câmera...</option>{devices.video.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></div>
                             <div className="relative"><Mic size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" /><select onChange={e => { setSelectedDevices({...selectedDevices, audio: e.target.value}); startLiveMedia(selectedDevices.video, e.target.value); }} className="w-full bg-slate-50 border-none rounded-xl pl-10 pr-4 py-3 text-[10px] font-black shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"><option value="">Ajustar Áudio...</option>{devices.audio.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}</select></div>
                           </div>
                        </div>
                        <div className="space-y-2.5">
                           <label className="text-[8px] font-black uppercase text-indigo-600 ml-3 tracking-widest italic">Moderador Discente</label>
                           <div className="grid grid-cols-2 gap-2">
                              <button onClick={() => setGlobalMute(!globalMute)} className={`py-3 rounded-xl border text-[8px] font-black uppercase flex items-center justify-center gap-2 transition-all ${globalMute ? 'bg-rose-600 border-rose-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                {globalMute ? <VolumeX size={14}/> : <Mic size={14}/>} Mutar Todos
                              </button>
                              <button onClick={() => setGlobalCamBlock(!globalCamBlock)} className={`py-3 rounded-xl border text-[8px] font-black uppercase flex items-center justify-center gap-2 transition-all ${globalCamBlock ? 'bg-rose-600 border-rose-400 text-white' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                                {globalCamBlock ? <UserX size={14}/> : <Video size={14}/>} Bloquear Cams
                              </button>
                           </div>
                        </div>
                        <div className="space-y-2.5">
                           <label className="text-[8px] font-black uppercase text-indigo-600 ml-3 tracking-widest italic">Cenário Digital Effect</label>
                           <div className="grid grid-cols-4 gap-2">
                              {['none', 'blur', 'office', 'custom'].map(b => (
                                <button key={b} onClick={() => { if(b === 'custom') customBgInputRef.current?.click(); else setVirtualBg(b as any); }} className={`py-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all ${virtualBg === b ? 'bg-indigo-600 border-indigo-400 text-white shadow-xl scale-105' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}>
                                   {b === 'none' ? <Video size={14}/> : b === 'blur' ? <Sparkles size={14}/> : b === 'office' ? <ImageIcon size={14}/> : <Upload size={14}/>}
                                   <span className="text-[7px] font-black uppercase">{b}</span>
                                </button>
                              ))}
                           </div>
                        </div>
                     </div>
                     <div className="flex gap-3 pt-4"><button onClick={() => setShowLobby(false)} className="flex-1 py-4 bg-slate-100 text-slate-400 rounded-2xl text-[10px] font-black uppercase italic tracking-widest">Voltar</button><button onClick={startLiveFromLobby} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all italic tracking-widest">Iniciar Aula</button></div>
                  </div>
               </div>
            </div>
          ) : (
            <div className="space-y-8 flex flex-col animate-in slide-in-from-bottom-5">
              <div className="bg-white p-12 rounded-[3.5rem] border border-slate-200 shadow-sm text-center flex flex-col items-center justify-center group hover:shadow-2xl transition-all duration-500">
                <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6 animate-pulse shadow-inner"><Radio size={32} className="text-rose-600" /></div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-2 italic leading-none">Virtual Classroom</h2>
                <p className="text-slate-400 text-[9px] font-medium uppercase tracking-[0.2em] italic mb-8 leading-relaxed max-w-xs">Transmissão nativa em alta definição para seus alunos.</p>
                <button onClick={startLobby} className="bg-slate-900 text-white px-10 py-4 rounded-xl text-[9px] font-black uppercase shadow-2xl shadow-slate-200 hover:bg-rose-600 transition-all flex items-center gap-2 italic tracking-widest active:scale-95"><Tv size={16}/> Configurar Início</button>
              </div>

              {/* CALENDAR AGENDA */}
              <div className="bg-white p-8 lg:p-10 rounded-[3.5rem] border border-slate-200 shadow-sm flex flex-col">
                  <div className="flex flex-col sm:flex-row items-center justify-between mb-10 gap-6">
                    <div className="flex items-center gap-5">
                      <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl shadow-inner"><Calendar size={24}/></div>
                      <div>
                        <h3 className="font-black text-slate-900 uppercase text-sm italic tracking-widest leading-none">Calendário Docente</h3>
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1.5">{calendarDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl shadow-inner border border-slate-100">
                      <button onClick={() => changeMonth(-1)} className="p-3 hover:bg-white hover:text-indigo-600 rounded-xl transition-all text-slate-400"><ChevronLeft size={20}/></button>
                      <button onClick={() => setCalendarDate(new Date())} className="px-5 py-2 text-[9px] font-black uppercase text-slate-600 hover:text-indigo-600 italic">Hoje</button>
                      <button onClick={() => changeMonth(1)} className="p-3 hover:bg-white hover:text-indigo-600 rounded-xl transition-all text-slate-400"><ChevronRight size={20}/></button>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-2 lg:gap-4 mb-4">
                    {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                      <div key={d} className="text-center text-[9px] font-black uppercase text-slate-300 italic py-2">{d}</div>
                    ))}
                    {getDaysArray.map((date, i) => {
                      const isToday = date && date.toDateString() === new Date().toDateString();
                      const hasClass = date && scheduledClasses.some(s => {
                        const sDate = s.date?.seconds ? new Date(s.date.seconds * 1000) : new Date(s.date);
                        return sDate.toDateString() === date.toDateString();
                      });
                      
                      return (
                        <div 
                          key={i} 
                          onClick={() => { if(date) { setScheduleForm({...scheduleForm, date: date.toISOString().split('T')[0]}); setIsScheduleModalOpen(true); } }}
                          className={`aspect-square rounded-[1.5rem] lg:rounded-[2.5rem] p-3 lg:p-5 flex flex-col justify-between border transition-all cursor-pointer relative group ${
                            !date ? 'bg-transparent border-transparent' : 
                            isToday ? 'bg-indigo-600 border-indigo-400 text-white shadow-2xl scale-105 z-10' :
                            hasClass ? 'bg-amber-50 border-amber-100 text-slate-900 hover:border-indigo-200' :
                            'bg-slate-50 border-slate-100 text-slate-400 hover:bg-white hover:border-indigo-100'
                          }`}
                        >
                          {date && (
                            <>
                              <span className={`text-sm lg:text-lg font-black italic tabular-nums ${isToday ? 'text-white' : hasClass ? 'text-amber-600' : 'text-slate-400'}`}>
                                {date.getDate()}
                              </span>
                              {hasClass && (
                                <div className={`w-1.5 h-1.5 lg:w-2 lg:h-2 rounded-full mx-auto ${isToday ? 'bg-white' : 'bg-amber-500 animate-pulse'}`}></div>
                              )}
                              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-indigo-600/10 rounded-[1.5rem] lg:rounded-[2.5rem] transition-opacity">
                                <Plus size={20} className="text-indigo-600" />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      {isModuleModalOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-2xl animate-in zoom-in-95">
          <div className="bg-white w-full max-md:max-w-md max-w-md rounded-[2.5rem] p-10 text-center shadow-2xl">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-8 text-indigo-600 shadow-inner"><Layers size={32}/></div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 italic leading-none">{currentModuleId ? 'Revisar Módulo' : 'Novo Módulo Master'}</h3>
            <div className="space-y-1.5 text-left mb-10">
              <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Estrutura Curricular</label>
              <input value={moduleTitle} onChange={e => setModuleTitle(e.target.value)} placeholder="Ex: Teologia Sistemática..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl outline-none font-black text-xs shadow-inner focus:ring-1 focus:ring-indigo-600 transition-all" />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setIsModuleModalOpen(false); setModuleTitle(''); setCurrentModuleId(null); }} className="flex-1 py-4.5 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest italic">Cancelar</button>
              <button onClick={async () => { if(!moduleTitle) return; if(currentModuleId) { await updateDoc(doc(db, 'modulos', currentModuleId), { title: moduleTitle }); } else { await addDoc(collection(db, 'modulos'), { courseId: selectedCourseForModules, title: moduleTitle, order: modules.length+1, lessons: [], createdAt: serverTimestamp() }); } setIsModuleModalOpen(false); }} className="flex-1 py-4.5 bg-indigo-600 text-white rounded-2xl text-[9px] font-black uppercase shadow-2xl shadow-indigo-100 italic hover:bg-indigo-700">Gravar Dados</button>
            </div>
          </div>
        </div>
      )}

      {isLessonModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 space-y-8 shadow-2xl overflow-y-auto max-h-[90vh] custom-scrollbar text-slate-900">
            <div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">{editingLessonId ? 'Revisar Aula' : 'Nova Aula Master'}</h3>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mt-2 italic leading-none">Integração Pedagógica Completa</p>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-3">Título do Encontro</label>
                <input value={lessonForm.title} onChange={e => setLessonForm({...lessonForm, title: e.target.value})} placeholder="Ex: Introdução à Hermenêutica..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs shadow-inner focus:ring-1 focus:ring-indigo-600 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-3">Link Vídeo-Aula</label>
                <input value={lessonForm.videoUrl} onChange={e => setLessonForm({...lessonForm, videoUrl: e.target.value})} placeholder="URL..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-3">Material de Apoio (Vincular da Pasta)</label>
                <select 
                  value={lessonForm.materialUrl} 
                  onChange={e => setLessonForm({...lessonForm, materialUrl: e.target.value})} 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="">Selecione um material...</option>
                  {materials.filter(m => m.courseId === selectedCourseForModules).map(m => (
                    <option key={m.id} value={m.url}>{m.title}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-3">Resumo Pedagógico</label>
                <textarea value={lessonForm.description} onChange={e => setLessonForm({...lessonForm, description: e.target.value})} placeholder="Resumo e objetivos da aula..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl h-28 font-medium text-[11px] shadow-inner resize-none"></textarea>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsLessonModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase tracking-widest italic hover:bg-slate-200 transition-colors">Voltar</button>
              <button onClick={handleSaveLesson} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-2xl shadow-slate-200 hover:bg-indigo-600 transition-all italic">Publicar Aula</button>
            </div>
          </div>
        </div>
      )}

      {isExamModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
             <div className="flex items-center gap-4"><div className="p-3 bg-amber-50 text-amber-600 rounded-xl shadow-inner border border-amber-100"><Award size={24}/></div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Configuração de Exame</h3></div>
             <div className="space-y-5">
                <div className="space-y-1.5">
                   <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Curso Vinculado</label>
                   <select 
                     value={examForm.courseId} 
                     onChange={e => {
                       const cId = e.target.value;
                       setExamForm({...examForm, courseId: cId, moduleId: ''});
                     }} 
                     className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"
                   >
                     <option value="">Selecione o curso...</option>
                     {courses.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                   </select>
                </div>
                {examForm.courseId && (
                  <div className="space-y-1.5 animate-in slide-in-from-top-2">
                    <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Módulo Vinculado</label>
                    <select 
                      value={examForm.moduleId} 
                      onChange={e => setExamForm({...examForm, moduleId: e.target.value})} 
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"
                    >
                      <option value="">Selecione o módulo...</option>
                      {modules.filter(m => m.courseId === examForm.courseId).map(m => (
                        <option key={m.id} value={m.id}>{m.title}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="space-y-1.5"><label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Título da Avaliação</label><input value={examForm.title} onChange={e => setExamForm({...examForm, title: e.target.value})} placeholder="Ex: Avaliação Master do Módulo..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs shadow-inner focus:ring-1 focus:ring-indigo-600" /></div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1.5"><label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Média Corte %</label><input type="number" value={examForm.passingGrade} onChange={e => setExamForm({...examForm, passingGrade: Number(e.target.value)})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs shadow-inner" /></div>
                   <div className="space-y-1.5"><label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Tipo Acadêmico</label><select value={examForm.type} onChange={e => setExamForm({...examForm, type: e.target.value as any})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] uppercase shadow-inner"><option value="activity">Atividade</option><option value="evaluation">Prova Final</option></select></div>
                </div>
             </div>
             <div className="flex gap-3 pt-2"><button onClick={() => setIsExamModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase italic">Voltar</button><button disabled={!examForm.moduleId} onClick={async () => { const payload = { ...examForm, authorId: user.uid, questions: currentExam?.questions || [], createdAt: serverTimestamp() }; if(currentExam) await updateDoc(doc(db, 'exams', currentExam.id), payload); else await addDoc(collection(db, 'exams'), payload); setIsExamModalOpen(false); }} className={`flex-1 py-5 text-white rounded-2xl text-[9px] font-black uppercase shadow-2xl italic ${examForm.moduleId ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-slate-300 cursor-not-allowed'}`}>Gravar Avaliação</button></div>
          </div>
        </div>
      )}

      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-md:max-w-md max-w-md rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
             <div className="flex items-center gap-4"><div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl shadow-inner border border-indigo-100"><Calendar size={24}/></div><h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Agendar Aula</h3></div>
             <div className="space-y-5">
                <div className="space-y-1.5"><label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Data Selecionada</label><input type="date" value={scheduleForm.date} readOnly className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs text-indigo-600 shadow-inner" /></div>
                <div className="space-y-1.5">
                   <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Curso Destino</label>
                   <select value={scheduleForm.courseId} onChange={e => setScheduleForm({...scheduleForm, courseId: e.target.value})} className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] uppercase shadow-inner">
                      <option value="">Selecione o curso...</option>
                      {courses.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                   </select>
                </div>
                <div className="space-y-1.5"><label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Título da Transmissão</label><input value={scheduleForm.title} onChange={e => setScheduleForm({...scheduleForm, title: e.target.value})} placeholder="Ex: Aula de Reforço Módulo 2..." className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs shadow-inner" /></div>
             </div>
             <div className="flex gap-3 pt-2"><button onClick={() => setIsScheduleModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase italic">Cancelar</button><button onClick={async () => { if(!scheduleForm.courseId || !scheduleForm.title) return; await addDoc(collection(db, 'scheduledClasses'), { ...scheduleForm, professorId: user.uid, status: 'scheduled', date: new Date(scheduleForm.date), createdAt: serverTimestamp() }); setIsScheduleModalOpen(false); }} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl text-[9px] font-black uppercase shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all italic">Agendar Agora</button></div>
          </div>
        </div>
      )}

      {/* MODAL DE MATERIAL */}
      {isMaterialModalOpen && (
        <div className="fixed inset-0 z-[3000] bg-slate-950/80 backdrop-blur-2xl flex items-center justify-center p-6 animate-in zoom-in-95">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 space-y-8 shadow-2xl">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-inner border border-emerald-100">
                <FileText size={24}/>
              </div>
              <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic leading-none">Novo Material</h3>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Curso Alvo</label>
                <select 
                  value={materialForm.courseId} 
                  onChange={e => setMaterialForm({...materialForm, courseId: e.target.value})} 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner outline-none appearance-none focus:ring-1 focus:ring-indigo-600"
                >
                  <option value="">Selecione o curso...</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Título do Arquivo</label>
                <input 
                  value={materialForm.title} 
                  onChange={e => setMaterialForm({...materialForm, title: e.target.value})} 
                  placeholder="Ex: Apostila de Teologia Vol. 1..." 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-xs shadow-inner focus:ring-1 focus:ring-indigo-600" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest italic ml-4">Link do Arquivo (PDF/Drive)</label>
                <input 
                  value={materialForm.url} 
                  onChange={e => setMaterialForm({...materialForm, url: e.target.value})} 
                  placeholder="https://drive.google.com/..." 
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl font-black text-[10px] shadow-inner focus:ring-1 focus:ring-indigo-600" 
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setIsMaterialModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-400 rounded-2xl text-[9px] font-black uppercase italic">Voltar</button>
              <button 
                onClick={handleSaveMaterial}
                disabled={!materialForm.title || !materialForm.url || !materialForm.courseId}
                className={`flex-1 py-5 text-white rounded-2xl text-[9px] font-black uppercase shadow-2xl italic ${materialForm.title && materialForm.url && materialForm.courseId ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-slate-300 cursor-not-allowed'}`}
              >
                Salvar Arquivo
              </button>
            </div>
          </div>
        </div>
      )}
      
      {isSignModalOpen && <SignaturePad title="Validação Docente" onCancel={() => setIsSignModalOpen(false)} onSave={async (b) => { await updateDoc(doc(db, 'users', user.uid), {signatureUrl: b}); setUserSignature(b); setIsSignModalOpen(false); }} />}
    </div>
  );
};

export default SchoolManagement;