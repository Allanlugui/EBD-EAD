
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, serverTimestamp, getDocs, addDoc, orderBy } from "firebase/firestore";
import { updatePassword } from "firebase/auth";
import { auth, db } from '../firebase';
import { Course, User, Module, Lesson, ScheduledClass, Exam } from '../types';
import { 
  BookOpen, PlayCircle, Award, GraduationCap, Bell, Menu, X, LogOut, 
  Home, LifeBuoy, Play, RefreshCw, UserCheck, 
  ChevronRight, Star, UserCircle, MapPin, Lock, Save, 
  FileText, CheckCircle2, Camera, Calendar, Video, 
  Maximize, Minimize, Settings, Volume2, VolumeX, AlertCircle, Play as PlayIcon, Pause,
  MessageSquare, Send, ChevronDown, ThumbsUp, ThumbsDown, CheckSquare, HelpCircle,
  FileQuestion, AlertTriangle, Search, Paperclip, ExternalLink, Clock
} from 'lucide-react';

interface StudentViewProps {
  user: User;
}

type StudentSubView = 'dashboard' | 'library' | 'certificates' | 'support' | 'profile' | 'classroom';

interface TimelineItem {
  id: string;
  type: 'lesson' | 'exam';
  title: string;
  moduleId: string;
  moduleTitle: string;
  data: Lesson | Exam;
  isLocked: boolean;
  isCompleted: boolean;
  index: number;
}

// Global declaration for YouTube Iframe API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

// --- SECURE VIDEO PLAYER COMPONENT ---
interface SecureVideoPlayerProps {
  videoUrl: string;
  onComplete: () => void;
  title: string;
}

const SecureVideoPlayer: React.FC<SecureVideoPlayerProps> = ({ videoUrl, onComplete, title }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const getVideoId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };
  const videoId = getVideoId(videoUrl);

  const sendCommand = (func: string, args: any[] = []) => {
    if (!iframeRef.current) return;
    iframeRef.current.contentWindow?.postMessage(JSON.stringify({
      'event': 'command',
      'func': func,
      'args': args
    }), '*');
  };

  useEffect(() => { setIsPlaying(false); }, [videoId]);

  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    let player: any;
    window.onYouTubeIframeAPIReady = () => { loadPlayer(); };

    const loadPlayer = () => {
      if (videoId && window.YT && window.YT.Player) {
        player = new window.YT.Player(`youtube-player-${videoId}`, {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: { controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0, showinfo: 0, iv_load_policy: 3, autohide: 1 },
          events: {
            'onStateChange': onPlayerStateChange,
            'onReady': (event: any) => { event.target.setVolume(volume); }
          }
        });
      }
    };

    if (window.YT && window.YT.Player) loadPlayer();

    function onPlayerStateChange(event: any) {
      if (event.data == window.YT.PlayerState.PLAYING) setIsPlaying(true);
      if (event.data == window.YT.PlayerState.PAUSED) setIsPlaying(false);
      if (event.data == window.YT.PlayerState.ENDED) {
        setIsPlaying(false);
        onComplete();
      }
    }
    return () => { if (player && player.destroy) player.destroy(); };
  }, [videoId]);

  const togglePlay = () => {
    if (isPlaying) { sendCommand('pauseVideo'); setIsPlaying(false); } 
    else { sendCommand('playVideo'); setIsPlaying(true); }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVol = parseInt(e.target.value);
    setVolume(newVol);
    if (newVol > 0 && isMuted) setIsMuted(false);
    sendCommand('setVolume', [newVol]);
    if (newVol === 0) sendCommand('mute'); else sendCommand('unMute');
  };

  const toggleMute = () => {
    if (isMuted) { sendCommand('unMute'); sendCommand('setVolume', [volume]); setIsMuted(false); } 
    else { sendCommand('mute'); setIsMuted(true); }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullscreen(true); } 
    else { document.exitFullscreen(); setIsFullscreen(false); }
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden group shadow-xl select-none rounded-xl">
      <div className="absolute inset-0 z-10 cursor-pointer" onClick={togglePlay}>
         {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[2px] transition-all">
               <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-md border border-white/30 shadow-2xl scale-100 hover:scale-110 transition-transform">
                  <PlayIcon size={32} className="text-white fill-white ml-1" />
               </div>
            </div>
         )}
      </div>
      <div className="w-full h-full pointer-events-none relative z-0"> 
        <iframe ref={iframeRef} id={`youtube-player-${videoId}`} className="w-full h-full" src={`https://www.youtube.com/embed/${videoId}?enablejsapi=1&controls=0&modestbranding=1&rel=0&showinfo=0&iv_load_policy=3&disablekb=1&playsinline=1`} allow="autoplay; encrypted-media" title={title} />
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/90 via-black/60 to-transparent z-20 flex items-end p-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="w-full flex items-center justify-between pointer-events-auto">
          <div className="flex items-center gap-4">
            <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="text-white hover:text-indigo-400 transition-colors">{isPlaying ? <Pause size={20} fill="currentColor" /> : <PlayIcon size={20} fill="currentColor" />}</button>
            <div className="flex items-center gap-2 group/vol">
              <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className="text-white hover:text-indigo-400 transition-colors">{isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}</button>
              <input type="range" min="0" max="100" value={isMuted ? 0 : volume} onChange={handleVolumeChange} onClick={(e) => e.stopPropagation()} className="w-20 h-1 bg-white/30 rounded-lg appearance-none cursor-pointer hover:bg-white/50 accent-indigo-500"/>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="text-white hover:text-indigo-400 transition-colors">{isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
        </div>
      </div>
    </div>
  );
};

// --- QUIZ COMPONENT ---
interface QuizPlayerProps { exam: Exam; onPass: (score: number) => void; }
const QuizPlayer: React.FC<QuizPlayerProps> = ({ exam, onPass }) => {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [passed, setPassed] = useState(false);

  const handleSubmit = () => {
    let correctCount = 0;
    exam.questions.forEach((q) => { if (answers[q.id] === q.correctOption) correctCount++; });
    const finalScore = (correctCount / exam.questions.length) * 100;
    setScore(finalScore);
    setSubmitted(true);
    if (finalScore >= (exam.passingGrade || 70)) { setPassed(true); onPass(finalScore); }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 animate-in zoom-in-95">
        <div className={`w-24 h-24 rounded-full flex items-center justify-center shadow-inner ${passed ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>{passed ? <Award size={48}/> : <AlertCircle size={48}/>}</div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter leading-none">{passed ? 'Aprovado!' : 'Tente Novamente'}</h2>
          <p className="text-slate-500 font-bold mt-2">Sua nota: <span className={passed ? 'text-emerald-600' : 'text-rose-600'}>{score.toFixed(0)}%</span></p>
          <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 italic">Mínimo necessário: {exam.passingGrade}%</p>
        </div>
        {!passed && <button onClick={() => { setSubmitted(false); setAnswers({}); }} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-lg">Refazer Avaliação</button>}
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="text-center space-y-2"><h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter">{exam.title}</h2><div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100"><Award size={12}/> Mínimo: {exam.passingGrade}%</div></div>
      <div className="space-y-6">
        {exam.questions.map((q, i) => (
          <div key={q.id} className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex gap-4 mb-6"><span className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center font-black text-xs italic shrink-0">{i + 1}</span><p className="text-sm font-bold text-slate-800 leading-relaxed">{q.text}</p></div>
            <div className="space-y-3 pl-12">
              {q.options.map((opt, optIdx) => (
                <label key={optIdx} className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${answers[q.id] === optIdx ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'}`}>
                  <input type="radio" name={q.id} className="hidden" checked={answers[q.id] === optIdx} onChange={() => setAnswers({...answers, [q.id]: optIdx})} />
                  <span className="text-xs font-bold uppercase tracking-wide">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end"><button onClick={handleSubmit} disabled={Object.keys(answers).length < exam.questions.length} className="px-10 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-xl hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Enviar Respostas</button></div>
    </div>
  );
};

// --- SUPPORT SYSTEM COMPONENT ---
interface SupportSystemProps { user: User; }
const SupportSystem: React.FC<SupportSystemProps> = ({ user }) => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatFilter, setChatFilter] = useState<'abertos'|'fechados'>('abertos');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Timer State for Wait Logic
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  
  // Survey State
  const [survey, setSurvey] = useState({ demandMet: null as boolean|null, problemSolved: null as boolean|null, likedChat: null as boolean|null, rating: 0 });

  // --- HELPER TO VIEW ATTACHMENTS SAFELY ---
  const viewAttachment = (url: string) => {
    if (!url) return;
    
    if (url.startsWith('http')) {
        window.open(url, '_blank');
        return;
    }

    if (url.startsWith('data:')) {
        try {
            const byteString = atob(url.split(',')[1]);
            const mimeString = url.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], {type: mimeString});
            const blobUrl = URL.createObjectURL(blob);
            
            const win = window.open(blobUrl, '_blank');
            if (!win) {
                alert("Pop-up bloqueado. Permita pop-ups para ver o anexo.");
            }
        } catch (e) {
            console.error("Erro ao abrir anexo:", e);
            alert("Erro ao abrir anexo.");
        }
        return;
    }
  };

  useEffect(() => {
    // Show all tickets for this user
    const q = query(collection(db, 'tickets'), where('senderId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const allTickets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      allTickets.sort((a: any, b: any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
      
      setTickets(allTickets);
      
      if (activeTicket) {
        const updated = allTickets.find(t => t.id === activeTicket.id);
        if (updated) setActiveTicket(updated);
      }
    });
    return () => unsub();
  }, [user.uid, activeTicket?.id]);

  useEffect(() => {
    if (!activeTicket) return;
    const q = query(collection(db, 'tickets', activeTicket.id, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
    return () => unsub();
  }, [activeTicket]);

  // --- TIMER & AUTO-RESPONSE LOGIC ---
  useEffect(() => {
    let interval: any;
    if (activeTicket && activeTicket.status === 'Pendente' && !activeTicket.specialistJoined) {
        interval = setInterval(async () => {
            const now = Date.now();
            const created = activeTicket.createdAt?.seconds * 1000;
            const diff = now - created;
            const limit = 5 * 60 * 1000; // 5 minutes

            if (diff >= limit) {
                // Check if we already sent the timeout message to avoid loop
                const hasTimeoutMsg = messages.some((m: any) => m.text.includes("todos os atendentes e especialistas estão ocupados"));
                if (!hasTimeoutMsg) {
                    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
                        text: "Infelizmente, todos os atendentes e especialistas estão ocupados no momento. Sua solicitação foi registrada e entraremos em contato através do seu WhatsApp cadastrado em breve.",
                        sender: 'Sistema',
                        isBot: true,
                        createdAt: serverTimestamp()
                    });
                    await updateDoc(doc(db, 'tickets', activeTicket.id), {
                        status: 'Encaminhado', // Change status so timer stops
                        lastMessage: "Encaminhado para WhatsApp (Timeout)",
                        updatedAt: serverTimestamp()
                    });
                }
                setTimerDisplay("Tempo esgotado");
            } else {
                const remaining = Math.ceil((limit - diff) / 1000);
                const mins = Math.floor(remaining / 60);
                const secs = remaining % 60;
                setTimerDisplay(`${mins}:${secs.toString().padStart(2, '0')}`);
            }
        }, 1000);
    } else {
        setTimerDisplay('');
    }
    return () => clearInterval(interval);
  }, [activeTicket, messages]);

  const createTicket = async () => {
    const docRef = await addDoc(collection(db, 'tickets'), {
      user: user.displayName,
      senderId: user.uid,
      protocolo: Math.random().toString(36).substr(2, 9).toUpperCase(),
      lastMessage: 'Atendimento Iniciado',
      status: 'Pendente',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    await addDoc(collection(db, 'tickets', docRef.id, 'messages'), {
      text: `Olá ${user.displayName.split(' ')[0]}. Sou o assistente virtual. Selecione um tema abaixo para que eu possa te ajudar:`,
      sender: 'Sistema',
      isBot: true,
      options: ['Problemas de Acesso', 'Material Didático', 'Aplicativo / Perfil', 'Elogio / Sugestão', 'Reclamação'], 
      createdAt: serverTimestamp()
    });

    const newTicketSnap = await getDoc(docRef);
    if (newTicketSnap.exists()) {
      setActiveTicket({ id: newTicketSnap.id, ...newTicketSnap.data() });
    }
  };

  const handleBotOption = async (option: string) => {
    if(!activeTicket) return;
    
    // 1. User selects option
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
      text: option,
      sender: 'Aluno',
      createdAt: serverTimestamp()
    });

    // 2. Bot Logic
    let botResponse = '';
    let nextOptions: string[] = [];
    let escalate = false;

    switch(option) {
        case 'Problemas de Acesso':
            botResponse = 'Para problemas de acesso: 1. Verifique se sua senha está correta. 2. Tente redefinir a senha no perfil. 3. Limpe o cache do navegador. Isso resolveu?';
            nextOptions = ['Sim, resolvido', 'Não, preciso de ajuda'];
            break;
        case 'Material Didático':
            botResponse = 'Para materiais: O download é liberado após a conclusão da aula anterior. Verifique se há aulas pendentes no módulo. Conseguiu baixar?';
            nextOptions = ['Sim, resolvido', 'Não, material com erro'];
            break;
        case 'Aplicativo / Perfil':
            botResponse = 'Você pode editar seus dados (Foto, WhatsApp, Senha) na aba "Meu Perfil". O sistema atualiza imediatamente. Conseguiu editar?';
            nextOptions = ['Sim, resolvido', 'Não, erro ao salvar'];
            break;
        case 'Elogio / Sugestão':
            botResponse = 'Que ótimo! Por favor, digite seu elogio ou sugestão abaixo. Nós leremos com carinho!';
            break;
        case 'Reclamação':
            botResponse = 'Sinto muito por isso. Por favor, descreva o problema detalhadamente abaixo. Um atendente humano irá analisar seu caso com prioridade.';
            escalate = true;
            break;
        case 'Sim, resolvido':
            botResponse = 'Fico feliz em ajudar! Vou encerrar este atendimento. Por favor, avalie nosso suporte.';
            await updateDoc(doc(db, 'tickets', activeTicket.id), { status: 'Resolvido' }); // Triggers survey
            break;
        case 'Não, preciso de ajuda':
        case 'Não, material com erro':
        case 'Não, erro ao salvar':
            botResponse = 'Aguarde enquanto chamo um especialista. Um atendente entrará no chat em instantes.';
            escalate = true;
            break;
        default:
            botResponse = 'Certo. Por favor, descreva sua solicitação para o atendente.';
    }

    // 3. Send Bot Response
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
      text: botResponse,
      sender: 'Sistema',
      isBot: true,
      options: nextOptions.length > 0 ? nextOptions : null,
      createdAt: serverTimestamp()
    });
    
    // Update Ticket State
    const updatePayload: any = {
        lastMessage: `Bot: ${option}`,
        updatedAt: serverTimestamp()
    };
    if (escalate) {
        // Reset createdAt to now to start the timer for the specialist
        updatePayload.status = 'Pendente';
        updatePayload.createdAt = serverTimestamp(); // Reset timer start
    }

    await updateDoc(doc(db, 'tickets', activeTicket.id), updatePayload);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !activeTicket) return;
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
      text: newMessage,
      sender: 'Aluno',
      createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, 'tickets', activeTicket.id), {
      lastMessage: newMessage,
      updatedAt: serverTimestamp()
    });
    setNewMessage('');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeTicket) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        if(ev.target?.result) {
            const base64 = ev.target.result as string;
            await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
                text: `Arquivo enviado: ${file.name}`,
                attachmentUrl: base64,
                sender: 'Aluno',
                createdAt: serverTimestamp()
            });
            await updateDoc(doc(db, 'tickets', activeTicket.id), {
                lastMessage: `[Arquivo]: ${file.name}`,
                updatedAt: serverTimestamp()
            });
        }
    };
    reader.readAsDataURL(file);
  };

  const handleStudentFinalize = async () => {
    if(!activeTicket) return;
    if(!confirm("Deseja encerrar este atendimento? Uma vez finalizado, não será possível reabrir este chamado.")) return;
    
    await updateDoc(doc(db, 'tickets', activeTicket.id), {
        status: 'Finalizado', 
        updatedAt: serverTimestamp()
    });
    setActiveTicket(prev => prev ? {...prev, status: 'Finalizado'} : null);
  };

  const submitSurvey = async () => {
    if (!activeTicket) return;
    await updateDoc(doc(db, 'tickets', activeTicket.id), {
      status: 'Arquivado', 
      survey: survey,
      archivedAt: serverTimestamp()
    });
    setSurvey({ demandMet: null, problemSolved: null, likedChat: null, rating: 0 });
    setActiveTicket(null);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex gap-6 animate-in fade-in">
      {/* ... (Sidebar Code Remains Same) ... */}
      <div className="w-80 flex flex-col gap-4">
        <button onClick={createTicket} className="w-full py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"><MessageSquare size={16}/> Iniciar Novo Atendimento</button>
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="flex border-b border-slate-100 p-2 gap-1">
             <button onClick={() => setChatFilter('abertos')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${chatFilter === 'abertos' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Ativos</button>
             <button onClick={() => setChatFilter('fechados')} className={`flex-1 py-2 text-[9px] font-black uppercase rounded-xl transition-all ${chatFilter === 'fechados' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'}`}>Histórico</button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-2">
             {tickets.filter(t => chatFilter === 'abertos' ? (t.status !== 'Arquivado' && t.status !== 'Finalizado') : (t.status === 'Arquivado' || t.status === 'Finalizado')).map(t => (
               <div key={t.id} onClick={() => setActiveTicket(t)} className={`p-4 rounded-2xl cursor-pointer border transition-all ${activeTicket?.id === t.id ? 'bg-indigo-50 border-indigo-200 shadow-inner' : 'bg-white border-slate-100 hover:border-indigo-100'}`}>
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-[8px] font-black bg-white px-2 py-1 rounded border border-slate-100 text-slate-500">#{t.protocolo}</span>
                    <span className={`text-[8px] font-bold ${t.status === 'Pendente' ? 'text-amber-500' : t.status === 'Resolvido' ? 'text-emerald-500' : t.status === 'Em Atendimento' ? 'text-indigo-500' : 'text-slate-400'}`}>{t.status === 'Em Atendimento' ? 'Em Andamento' : t.status}</span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-700 line-clamp-2 italic">{t.lastMessage}</p>
               </div>
             ))}
             {tickets.filter(t => chatFilter === 'abertos' ? (t.status !== 'Arquivado' && t.status !== 'Finalizado') : (t.status === 'Arquivado' || t.status === 'Finalizado')).length === 0 && (
                 <p className="text-center text-[10px] text-slate-400 italic py-10">Nenhum chamado encontrado.</p>
             )}
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
        {activeTicket ? (
          <>
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
               <div>
                 <h3 className="font-black text-slate-900 text-sm uppercase italic">Protocolo #{activeTicket.protocolo}</h3>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: {activeTicket.status}</p>
               </div>
               {timerDisplay && (
                   <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 animate-pulse">
                       <Clock size={12} />
                       <span className="text-[10px] font-black uppercase">Espera: {timerDisplay}</span>
                   </div>
               )}
               <div className="flex gap-2">
                   {activeTicket.status !== 'Arquivado' && activeTicket.status !== 'Resolvido' && activeTicket.status !== 'Finalizado' && (
                       <button onClick={handleStudentFinalize} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all">Encerrar Atendimento</button>
                   )}
                   {(activeTicket.status === 'Resolvido' || activeTicket.status === 'Finalizado') && <div className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[9px] font-black uppercase animate-pulse">Pesquisa Pendente</div>}
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 custom-scrollbar relative">
               {messages.map((m, i) => (
                 <div key={i} className={`flex flex-col ${m.sender === 'Aluno' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[70%] p-4 rounded-2xl text-xs font-medium leading-relaxed shadow-sm ${m.sender === 'Aluno' ? 'bg-indigo-600 text-white rounded-tr-sm' : m.sender === 'Sistema' ? 'bg-white border border-slate-200 text-slate-700' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'}`}>
                       {m.text}
                       {m.attachmentUrl && (
                         <div onClick={() => viewAttachment(m.attachmentUrl)} className="mt-2 p-2 bg-black/10 rounded flex items-center gap-2 cursor-pointer hover:bg-black/20 text-white">
                            <FileText size={14}/> <span className="text-[9px] font-bold uppercase underline">Visualizar Anexo</span> <ExternalLink size={10}/>
                         </div>
                       )}
                    </div>
                    {/* Render Interactive Buttons */}
                    {m.sender === 'Sistema' && m.options && (activeTicket.status !== 'Arquivado' && activeTicket.status !== 'Resolvido' && activeTicket.status !== 'Finalizado') && (
                        <div className="mt-3 flex flex-wrap gap-2 max-w-[80%]">
                            {m.options.map((opt: string) => (
                                <button key={opt} onClick={() => handleBotOption(opt)} className="px-4 py-2 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                                    {opt}
                                </button>
                            ))}
                        </div>
                    )}
                    <span className="text-[8px] font-bold text-slate-300 mt-1 uppercase px-2">{m.sender} • {m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
                 </div>
               ))}
               <div ref={chatEndRef} />

               {/* SATISFACTION SURVEY (Existing) */}
               {(activeTicket.status === 'Resolvido' || activeTicket.status === 'Finalizado') && (
                 <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-8">
                    <div className="bg-white w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95">
                       <h3 className="text-xl font-black text-slate-900 uppercase italic text-center mb-6">Pesquisa de Satisfação</h3>
                       <div className="space-y-6">
                          <div>
                             <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">1. Sua demanda foi atendida?</p>
                             <div className="flex gap-2">
                                <button onClick={() => setSurvey({...survey, demandMet: true})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.demandMet === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}>Sim</button>
                                <button onClick={() => setSurvey({...survey, demandMet: false})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.demandMet === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200'}`}>Não</button>
                             </div>
                          </div>
                          <div>
                             <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">2. Seu problema foi resolvido?</p>
                             <div className="flex gap-2">
                                <button onClick={() => setSurvey({...survey, problemSolved: true})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.problemSolved === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}>Sim</button>
                                <button onClick={() => setSurvey({...survey, problemSolved: false})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.problemSolved === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200'}`}>Não</button>
                             </div>
                          </div>
                          <div>
                             <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">3. Gostou do atendimento?</p>
                             <div className="flex gap-2">
                                <button onClick={() => setSurvey({...survey, likedChat: true})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.likedChat === true ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200'}`}><ThumbsUp size={16} className="mx-auto"/></button>
                                <button onClick={() => setSurvey({...survey, likedChat: false})} className={`flex-1 py-2 rounded-lg border text-xs font-black uppercase ${survey.likedChat === false ? 'bg-rose-600 text-white border-rose-600' : 'bg-white border-slate-200'}`}><ThumbsDown size={16} className="mx-auto"/></button>
                             </div>
                          </div>
                          <div>
                             <p className="text-[10px] font-bold uppercase text-slate-500 mb-2">Recomendação (Estrelas)</p>
                             <div className="flex justify-center gap-2">
                                {[1,2,3,4,5].map(s => (
                                  <button key={s} onClick={() => setSurvey({...survey, rating: s})} className={`text-2xl transition-all hover:scale-125 ${s <= survey.rating ? 'text-amber-400' : 'text-slate-200'}`}>★</button>
                                ))}
                             </div>
                          </div>
                          <button onClick={submitSurvey} disabled={survey.rating === 0 || survey.demandMet === null} className="w-full py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase shadow-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">Enviar e Finalizar</button>
                       </div>
                    </div>
                 </div>
               )}
            </div>

            {activeTicket.status !== 'Arquivado' && activeTicket.status !== 'Resolvido' && activeTicket.status !== 'Finalizado' ? (
              <div className="p-4 border-t border-slate-100 bg-white">
                 <div className="flex gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-indigo-100 hover:text-indigo-600 transition-all"><Paperclip size={18}/></button>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload}/>
                    <input value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} className="flex-1 bg-slate-50 border-none rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-1 focus:ring-indigo-600" placeholder="Digite sua mensagem..." />
                    <button onClick={sendMessage} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg hover:bg-indigo-700 transition-all"><Send size={18}/></button>
                 </div>
              </div>
            ) : (
              <div className="p-4 bg-slate-100 text-center text-[10px] font-black uppercase text-slate-400">Atendimento Encerrado.</div>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4">
             <LifeBuoy size={64} className="opacity-20"/>
             <p className="text-xs font-black uppercase tracking-widest opacity-50">Selecione um chamado ou inicie um novo.</p>
             
             {/* FAQ SECTION */}
             <div className="max-w-md w-full mt-8 space-y-3 px-8">
                <h4 className="text-[10px] font-black uppercase text-indigo-400 text-center mb-4 tracking-widest">Perguntas Frequentes</h4>
                {[{q: 'Como baixo meu certificado?', a: 'Após concluir todas as aulas e exames com média 70%, o certificado aparecerá na aba "Galeria de Diplomas".'}, {q: 'Como alterar minha senha?', a: 'Vá em "Meu Perfil" e use a seção de segurança para redefinir sua senha.'}].map((faq, i) => (
                  <details key={i} className="group bg-slate-50 rounded-xl border border-slate-100 open:bg-white open:shadow-lg transition-all cursor-pointer">
                     <summary className="p-4 text-[10px] font-black uppercase text-slate-600 flex justify-between items-center list-none">{faq.q} <ChevronDown size={14} className="group-open:rotate-180 transition-transform"/></summary>
                     <div className="px-4 pb-4 text-[10px] text-slate-500 leading-relaxed">{faq.a}</div>
                  </details>
                ))}
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StudentView: React.FC<StudentViewProps> = ({ user }) => {
  const [activeSubView, setActiveSubView] = useState<StudentSubView>('dashboard');
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [currentLesson, setCurrentLesson] = useState<TimelineItem | null>(null);

  // Load course and modules
  useEffect(() => {
    const loadData = async () => {
        if (user.cursoInicial || (user.matriculas && user.matriculas.length > 0)) {
            const courseId = user.cursoInicial || user.matriculas![0];
            const courseSnap = await getDoc(doc(db, 'cursos', courseId));
            if (courseSnap.exists()) {
                setCourse({ id: courseSnap.id, ...courseSnap.data() } as Course);

                // Modules
                const modQ = query(collection(db, 'modulos'), where('courseId', '==', courseId), orderBy('order'));
                const modSnap = await getDocs(modQ);
                const loadedModules = modSnap.docs.map(d => ({ id: d.id, ...d.data() } as Module));
                setModules(loadedModules);

                // Exams
                const examQ = query(collection(db, 'exams'), where('courseId', '==', courseId));
                const examSnap = await getDocs(examQ);
                const exams = examSnap.docs.map(d => ({ id: d.id, ...d.data() } as Exam));

                // Build Timeline
                const items: TimelineItem[] = [];
                let idx = 0;
                loadedModules.forEach(m => {
                    m.lessons.forEach(l => {
                        items.push({
                            id: l.id, type: 'lesson', title: l.title,
                            moduleId: m.id, moduleTitle: m.title, data: l,
                            isLocked: idx > 0, // Simplified locking
                            isCompleted: false, // Simplified completion
                            index: idx++
                        });
                    });
                    const modExams = exams.filter(e => e.moduleId === m.id);
                    modExams.forEach(e => {
                        items.push({
                            id: e.id, type: 'exam', title: e.title,
                            moduleId: m.id, moduleTitle: m.title, data: e,
                            isLocked: idx > 0,
                            isCompleted: false,
                            index: idx++
                        });
                    });
                });
                setTimeline(items);
                if (items.length > 0) setCurrentLesson(items[0]);
            }
        }
    };
    loadData();
  }, [user]);

  const renderContent = () => {
    switch(activeSubView) {
        case 'dashboard':
            return (
                <div className="space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div>
                            <h1 className="text-3xl font-black uppercase italic text-slate-900 tracking-tighter">Olá, {user.displayName.split(' ')[0]}</h1>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 italic">Bem-vindo ao seu portal acadêmico</p>
                        </div>
                        <div className="flex gap-3">
                             <button onClick={() => setActiveSubView('classroom')} className="px-8 py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase shadow-xl hover:bg-indigo-700 transition-all flex items-center gap-2"><PlayCircle size={16}/> Continuar Estudos</button>
                        </div>
                    </div>
                    {course && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                                <h3 className="text-sm font-black uppercase text-slate-800 italic mb-4">Seu Curso</h3>
                                <div className="aspect-video rounded-xl bg-slate-100 overflow-hidden mb-4 relative">
                                    <img src={course.capaUrl} className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                        <PlayCircle size={40} className="text-white opacity-80" />
                                    </div>
                                </div>
                                <h4 className="font-black text-lg uppercase italic text-slate-900 leading-tight">{course.nome}</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">{modules.length} Módulos • {timeline.length} Atividades</p>
                            </div>
                        </div>
                    )}
                </div>
            );
        case 'classroom':
            return (
                <div className="h-[calc(100vh-140px)] flex gap-6">
                    <div className="flex-1 bg-black rounded-[2rem] overflow-hidden relative shadow-2xl flex flex-col">
                        {currentLesson?.type === 'lesson' ? (
                            <SecureVideoPlayer 
                                videoUrl={(currentLesson.data as Lesson).videoUrl} 
                                title={currentLesson.title} 
                                onComplete={() => {
                                    // Handle completion
                                    const nextIdx = currentLesson.index + 1;
                                    if (nextIdx < timeline.length) {
                                        // Unlock next
                                        const newTimeline = [...timeline];
                                        newTimeline[nextIdx].isLocked = false;
                                        setTimeline(newTimeline);
                                    }
                                }} 
                            />
                        ) : currentLesson?.type === 'exam' ? (
                            <div className="flex-1 bg-slate-50 overflow-y-auto p-8 custom-scrollbar">
                                <QuizPlayer 
                                    exam={currentLesson.data as Exam} 
                                    onPass={() => {
                                        const nextIdx = currentLesson.index + 1;
                                        if (nextIdx < timeline.length) {
                                            const newTimeline = [...timeline];
                                            newTimeline[nextIdx].isLocked = false;
                                            setTimeline(newTimeline);
                                        }
                                    }} 
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-white/50">Selecione uma aula</div>
                        )}
                        <div className="bg-slate-900 p-4 flex justify-between items-center">
                            <div>
                                <h3 className="text-white font-black uppercase italic text-sm">{currentLesson?.title}</h3>
                                <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">{currentLesson?.moduleTitle}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    disabled={!currentLesson || currentLesson.index === 0}
                                    onClick={() => currentLesson && setCurrentLesson(timeline[currentLesson.index - 1])}
                                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-30"
                                >
                                    <ChevronDown className="rotate-90" size={20}/>
                                </button>
                                <button 
                                    disabled={!currentLesson || currentLesson.index === timeline.length - 1 || timeline[currentLesson.index + 1]?.isLocked}
                                    onClick={() => currentLesson && setCurrentLesson(timeline[currentLesson.index + 1])}
                                    className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 disabled:bg-slate-700"
                                >
                                    <ChevronDown className="-rotate-90" size={20}/>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div className="w-80 bg-white rounded-[2rem] border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                        <div className="p-6 border-b border-slate-100 bg-slate-50">
                            <h3 className="text-xs font-black uppercase text-slate-800 italic">Conteúdo Programático</h3>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Sua Jornada</p>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {timeline.map((item, idx) => (
                                <button 
                                    key={idx} 
                                    disabled={item.isLocked}
                                    onClick={() => setCurrentLesson(item)}
                                    className={`w-full text-left p-4 rounded-xl border flex items-center gap-3 transition-all ${
                                        currentLesson?.id === item.id 
                                            ? 'bg-indigo-50 border-indigo-200 shadow-inner' 
                                            : item.isLocked 
                                                ? 'bg-slate-50 border-transparent opacity-50 cursor-not-allowed' 
                                                : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-100'
                                    }`}
                                >
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 ${
                                        item.isCompleted ? 'bg-emerald-100 text-emerald-600' : 
                                        item.isLocked ? 'bg-slate-200 text-slate-400' : 
                                        'bg-indigo-100 text-indigo-600'
                                    }`}>
                                        {item.isLocked ? <Lock size={12}/> : item.isCompleted ? <CheckCircle2 size={14}/> : <Play size={12}/>}
                                    </div>
                                    <div>
                                        <p className={`text-[10px] font-black uppercase leading-tight ${currentLesson?.id === item.id ? 'text-indigo-700' : 'text-slate-700'}`}>{item.title}</p>
                                        <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5">{item.type === 'exam' ? 'Avaliação' : 'Vídeo-Aula'}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            );
        case 'support':
            return <SupportSystem user={user} />;
        default:
            return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
        {/* Mobile Header */}
        <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50">
            <span className="font-black italic">EB-EAD STUDENT</span>
            <button><Menu/></button>
        </div>
        
        <div className="flex flex-1 overflow-hidden h-screen">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col z-40">
                <div className="p-8">
                    <h1 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">EB-EAD</h1>
                    <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Portal do Aluno</p>
                </div>
                <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
                    {[
                        {id: 'dashboard', label: 'Meu Painel', icon: <Home size={18}/>},
                        {id: 'classroom', label: 'Sala de Aula', icon: <PlayCircle size={18}/>},
                        {id: 'support', label: 'Suporte', icon: <LifeBuoy size={18}/>},
                    ].map(item => (
                        <button key={item.id} onClick={() => setActiveSubView(item.id as any)} className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl text-xs font-bold uppercase transition-all ${activeSubView === item.id ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                            {item.icon} {item.label}
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center font-black text-indigo-600 uppercase">
                             {user.displayName?.charAt(0)}
                         </div>
                         <div className="flex-1 min-w-0">
                             <p className="text-xs font-black truncate text-slate-900 uppercase italic">{user.displayName}</p>
                             <p className="text-[9px] text-slate-400 truncate font-mono">{user.email}</p>
                         </div>
                         <button onClick={() => auth.signOut()} className="text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors"><LogOut size={16}/></button>
                    </div>
                </div>
            </aside>
            <main className="flex-1 overflow-y-auto bg-slate-50 p-4 lg:p-8 custom-scrollbar">
                {renderContent()}
            </main>
        </div>
    </div>
  );
};

export default StudentView;