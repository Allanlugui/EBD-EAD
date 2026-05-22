import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, query, onSnapshot, updateDoc, 
  doc, serverTimestamp, orderBy, where, deleteDoc, getDoc, addDoc, setDoc, getDocs
} from "firebase/firestore";
import { db } from '../firebase';
import { User } from '../types';
import { 
  Ticket as TicketIcon, MessageSquare, Search, X, FileText, UserCheck, 
  ArrowRightLeft, Fingerprint, Send, Archive, Eye, 
  Printer, Folder, File, Download, Plus, ChevronRight,
  UploadCloud, FolderPlus, MoreVertical, CheckCircle2, ShieldCheck,
  AlertTriangle, Home, CornerUpLeft, Paperclip, Save, Timer, MessageCircle,
  Phone, UserX, Edit3, Ban, Check, RefreshCw, Award, Clock, Trash2, FolderInput,
  Move, ThumbsUp, ThumbsDown, ExternalLink, LifeBuoy, ChevronDown, Star
} from 'lucide-react';
import SignaturePad from '../components/SignaturePad';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";

interface SecretariatViewProps { user: User; }
type SecretariatTab = 'atendimento' | 'chat' | 'arquivos' | 'operacional';
type OperationalSubView = 'main' | 'declaracao' | 'historico' | 'transferencia' | 'assinatura' | 'validacao';

// --- HELPERS ---
const generateVerificationCode = () => {
  return `${new Date().getFullYear()}.${Math.random().toString(36).substr(2, 4).toUpperCase()}.${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

const viewFile = (file: any) => {
  if (!file || !file.url) return;
  
  if (file.mimeType === 'application/pdf' || file.name?.endsWith('.pdf')) {
      const newWindow = window.open();
      if (newWindow) {
          if (file.url.startsWith('data:')) {
             newWindow.document.write(
                 `<iframe width='100%' height='100%' style='border:none;' src='${file.url}'></iframe>`
             );
             newWindow.document.title = file.name;
          } else {
             newWindow.location.href = file.url;
          }
      } else {
          alert("Pop-up bloqueado. Permita pop-ups para visualizar o PDF.");
      }
      return;
  }
  window.open(file.url, '_blank');
};

const viewAttachment = (url: string) => {
    if (!url) return;
    if (url.startsWith('http')) { window.open(url, '_blank'); return; }
    if (url.startsWith('data:')) {
        try {
            const byteString = atob(url.split(',')[1]);
            const mimeString = url.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
            const blob = new Blob([ab], {type: mimeString});
            const blobUrl = URL.createObjectURL(blob);
            const win = window.open(blobUrl, '_blank');
            if (!win) { alert("Pop-up bloqueado. Permita pop-ups para ver o anexo."); }
        } catch (e) { console.error("Erro ao abrir anexo:", e); alert("Erro ao abrir anexo."); }
        return;
    }
};

const SecretariatView: React.FC<SecretariatViewProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<SecretariatTab>('atendimento');
  const [opSubView, setOpSubView] = useState<OperationalSubView>('main');
  
  // Data States
  const [tickets, setTickets] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [fileSystem, setFileSystem] = useState<any[]>([]);
  
  // UI States - Atendimento
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'todos' | 'pendente' | 'ativo' | 'finalizado'>('todos');
  const [activeTicket, setActiveTicket] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]); 
  const [chatMessage, setChatMessage] = useState('');
  
  // UI States - General
  const [secSignature, setSecSignature] = useState<string | null>(null); 
  const [directorSignature, setDirectorSignature] = useState<string | null>(null); 

  // File Explorer & Save States
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<{id: string, name: string}[]>([{id: 'root', name: 'Arquivos'}]);
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [fileToMove, setFileToMove] = useState<any>(null);
  const [moveTargetFolderId, setMoveTargetFolderId] = useState('root');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);

  // Operational State
  const [opStudent, setOpStudent] = useState<any>(null);
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  
  // Audit Modal State
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any | null>(null);

  // Timer & Survey
  const [timerDisplay, setTimerDisplay] = useState<string>('');
  const [survey, setSurvey] = useState({ demandMet: null as boolean|null, problemSolved: null as boolean|null, likedChat: null as boolean|null, rating: 0 });

  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- EFFECTS ---
  useEffect(() => {
    // Ticket Listener
    const unsubT = onSnapshot(collection(db, 'tickets'), s => {
        const t = s.docs.map(d => ({ id: d.id, ...d.data() }));
        t.sort((a:any, b:any) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
        setTickets(t);
        if (activeTicket) {
            const updated = t.find((x: any) => x.id === activeTicket.id);
            if (updated) setActiveTicket(updated);
        }
    });
    
    // File System Listener
    const unsubF = onSnapshot(collection(db, 'secretaria_arquivos'), s => {
      setFileSystem(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Students Listener
    const unsubS = onSnapshot(collection(db, 'users'), s => {
      const allUsers = s.docs.map(d => ({ uid: d.id, ...d.data() }));
      setStudents(allUsers.filter((u: any) => u.role === 'aluno'));
    });
    
    // Fetch Signatures
    getDoc(doc(db, 'users', user.uid)).then(d => d.exists() && setSecSignature(d.data().signatureUrl));
    const qDir = query(collection(db, 'users'), where('role', '==', 'diretor'));
    getDocs(qDir).then(s => {
        if (!s.empty) setDirectorSignature(s.docs[0].data().signatureUrl);
    });
    
    return () => { unsubT(); unsubF(); unsubS(); };
  }, [user.uid, activeTicket?.id]);

  // Sync Chat
  useEffect(() => {
    if (!activeTicket) { setMessages([]); return; }
    const q = query(collection(db, 'tickets', activeTicket.id, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [activeTicket]);

  // Timer Logic
  useEffect(() => {
    let interval: any;
    if (activeTicket && activeTicket.status === 'Pendente') {
        interval = setInterval(async () => {
            const now = Date.now();
            const created = activeTicket.createdAt?.seconds ? activeTicket.createdAt.seconds * 1000 : Date.now();
            const diff = now - created;
            const limit = 5 * 60 * 1000;
            if (diff >= limit) {
                const hasTimeoutMsg = messages.some((m: any) => m.text.includes("todos os atendentes"));
                if (!hasTimeoutMsg) {
                    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), {
                        text: "Infelizmente, todos os atendentes estão ocupados. Sua solicitação foi registrada e entraremos em contato.",
                        sender: 'Sistema', isBot: true, createdAt: serverTimestamp()
                    });
                    await updateDoc(doc(db, 'tickets', activeTicket.id), {
                        status: 'Encaminhado', lastMessage: "Timeout - Encaminhado", updatedAt: serverTimestamp()
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
    } else { setTimerDisplay(''); }
    return () => clearInterval(interval);
  }, [activeTicket, messages]);

  // --- FILE EXPLORER HELPERS ---
  const getFilesForFolder = (folderId: string) => {
    return fileSystem.filter(f => f.parentId === folderId).sort((a,b) => {
      if(a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === 'folder' ? -1 : 1;
    });
  };

  const currentItems = useMemo(() => getFilesForFolder(currentFolderId), [fileSystem, currentFolderId]);

  const handleCreateFolder = async () => {
    const name = prompt("Nome da nova pasta:");
    if (!name) return;
    await addDoc(collection(db, 'secretaria_arquivos'), {
      name, type: 'folder', parentId: currentFolderId, createdAt: serverTimestamp(), createdBy: user.uid
    });
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      if (ev.target?.result) {
        // ATENÇÃO: Salvando Base64 diretamente no Firestore. Cuidado com arquivos > 1MB.
        await addDoc(collection(db, 'secretaria_arquivos'), {
          name: file.name, type: 'file', mimeType: file.type, url: ev.target.result, 
          parentId: currentFolderId, size: file.size, createdAt: serverTimestamp(), createdBy: user.uid
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteFile = async (id: string) => {
      if(confirm('Tem certeza que deseja excluir este item?')) {
          await deleteDoc(doc(db, 'secretaria_arquivos', id));
      }
  }

  const handleMoveFile = async () => {
      if (!fileToMove) return;
      await updateDoc(doc(db, 'secretaria_arquivos', fileToMove.id), {
          parentId: moveTargetFolderId, updatedAt: serverTimestamp()
      });
      setMoveModalOpen(false);
      setFileToMove(null);
      alert("Arquivo movido com sucesso.");
  };

  const handleNavigate = (folder: any) => {
    setCurrentFolderId(folder.id);
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumb = (index: number) => {
    const newPath = folderPath.slice(0, index + 1);
    setFolderPath(newPath);
    setCurrentFolderId(newPath[newPath.length - 1].id);
  };

  // --- CHAT FUNCTIONS ---
  const handleBotOption = async (option: string) => {
    if(!activeTicket) return;
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), { text: option, sender: 'Aluno', createdAt: serverTimestamp() });
    let botResponse = ''; let nextOptions: string[] = []; let escalate = false;
    
    switch(option) {
        case 'Problemas de Acesso': botResponse = 'Para problemas de acesso: 1. Verifique senha. 2. Redefina no perfil. 3. Limpe cache.'; nextOptions = ['Sim, resolvido', 'Não, preciso de ajuda']; break;
        case 'Material Didático': botResponse = 'O download é liberado após conclusão da aula anterior.'; nextOptions = ['Sim, resolvido', 'Não, material com erro']; break;
        case 'Aplicativo / Perfil': botResponse = 'Edite seus dados na aba "Meu Perfil".'; nextOptions = ['Sim, resolvido', 'Não, erro ao salvar']; break;
        case 'Elogio / Sugestão': botResponse = 'Digite seu elogio ou sugestão abaixo.'; break;
        case 'Reclamação': botResponse = 'Descreva o problema. Um humano analisará com prioridade.'; escalate = true; break;
        case 'Sim, resolvido': botResponse = 'Ótimo! Encerrando atendimento. Avalie nosso suporte.'; await updateDoc(doc(db, 'tickets', activeTicket.id), { status: 'Resolvido' }); break;
        case 'Não, preciso de ajuda': case 'Não, material com erro': case 'Não, erro ao salvar': botResponse = 'Chamando um especialista...'; escalate = true; break;
        default: botResponse = 'Descreva sua solicitação.';
    }
    
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), { text: botResponse, sender: 'Sistema', isBot: true, options: nextOptions.length > 0 ? nextOptions : null, createdAt: serverTimestamp() });
    const updatePayload: any = { lastMessage: `Bot: ${option}`, updatedAt: serverTimestamp() };
    if (escalate) { updatePayload.status = 'Pendente'; updatePayload.createdAt = serverTimestamp(); } // Reset timer on escalation
    await updateDoc(doc(db, 'tickets', activeTicket.id), updatePayload);
  };

  const sendMessage = async () => {
    if (!chatMessage.trim() || !activeTicket) return;
    await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), { text: chatMessage, sender: 'Secretaria', createdAt: serverTimestamp() });
    await updateDoc(doc(db, 'tickets', activeTicket.id), { lastMessage: chatMessage, updatedAt: serverTimestamp() });
    setChatMessage('');
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !activeTicket) return;
    const reader = new FileReader();
    reader.onload = async (ev) => { if(ev.target?.result) { const base64 = ev.target.result as string; await addDoc(collection(db, 'tickets', activeTicket.id, 'messages'), { text: `Arquivo enviado: ${file.name}`, attachmentUrl: base64, sender: 'Secretaria', createdAt: serverTimestamp() }); await updateDoc(doc(db, 'tickets', activeTicket.id), { lastMessage: `[Arquivo]: ${file.name}`, updatedAt: serverTimestamp() }); } };
    reader.readAsDataURL(file);
  };

  const handleStudentFinalize = async () => {
    if(!activeTicket) return;
    if(!confirm("Deseja encerrar este atendimento?")) return;
    await updateDoc(doc(db, 'tickets', activeTicket.id), { status: 'Finalizado', updatedAt: serverTimestamp() });
    setActiveTicket((prev: any) => prev ? {...prev, status: 'Finalizado'} : null);
  };

  const submitSurvey = async () => {
    if (!activeTicket) return;
    await updateDoc(doc(db, 'tickets', activeTicket.id), { status: 'Arquivado', survey: survey, archivedAt: serverTimestamp() });
    setSurvey({ demandMet: null, problemSolved: null, likedChat: null, rating: 0 });
    setActiveTicket(null);
    setActiveTab('atendimento');
  };

  // --- PDF GENERATOR ---
  const generateLegalPDF = async (docType: 'matricula' | 'conclusao' | 'transferencia' | 'historico') => {
      if (!opStudent) { alert("Selecione um aluno primeiro."); return; }
      setIsGeneratingPdf(true);

      try {
          const code = generateVerificationCode();
          const docTitle = docType === 'matricula' ? 'DECLARAÇÃO DE MATRÍCULA' : 
                           docType === 'conclusao' ? 'CERTIFICADO DE CONCLUSÃO' : 
                           docType === 'historico' ? 'HISTÓRICO ESCOLAR' : 'GUIA DE TRANSFERÊNCIA';
          
          let courseData: any = {};
          let modulesData: any[] = [];
          
          if (opStudent.cursoInicial) {
              const cSnap = await getDoc(doc(db, 'cursos', opStudent.cursoInicial));
              if (cSnap.exists()) courseData = cSnap.data();
              const mQuery = query(collection(db, 'modulos'), where('courseId', '==', opStudent.cursoInicial), orderBy('order'));
              const mSnap = await getDocs(mQuery);
              modulesData = mSnap.docs.map(d => d.data());
          }

          const validationUrl = `${window.location.origin}?code=${code}`;
          const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, { margin: 1, width: 100 });

          const docPdf = new jsPDF({
              orientation: docType === 'conclusao' ? 'landscape' : 'portrait',
              unit: 'mm', format: 'a4'
          });

          const width = docPdf.internal.pageSize.getWidth();
          const height = docPdf.internal.pageSize.getHeight();

          // Layout básico
          docPdf.setDrawColor(0);
          docPdf.setLineWidth(1);
          docPdf.rect(5, 5, width - 10, height - 10);
          
          docPdf.setFont("times", "bold");
          docPdf.setFontSize(22);
          docPdf.text("ESCOLA BÍBLICA EAD", width / 2, 25, { align: "center" });
          docPdf.setFontSize(10);
          docPdf.setFont("helvetica", "normal");
          docPdf.text("Portaria Nº 1004/2017", width / 2, 32, { align: "center" });

          docPdf.setFont("times", "bold");
          docPdf.setFontSize(24);
          docPdf.text(docTitle, width / 2, 50, { align: "center" });

          docPdf.setFont("times", "normal");
          docPdf.setFontSize(12);
          const margin = 25;
          let currentY = 70;

          const textData = `Certificamos que ${opStudent.displayName?.toUpperCase()}, CPF ${opStudent.cpf || '---'}.`;
          docPdf.text(textData, margin, currentY);
          currentY += 20;

          if (docType === 'historico') {
              const tableBody = modulesData.map((m: any) => [m.title || "Módulo", "20h", "100%", "10.0", "APROVADO"]);
              autoTable(docPdf, {
                  startY: currentY,
                  head: [['Disciplina', 'C.H.', 'Freq.', 'Nota', 'Situação']],
                  body: tableBody,
                  theme: 'grid',
              });
              currentY = (docPdf as any).lastAutoTable.finalY + 20;
          }

          // Assinaturas e Footer
          const sigY = height - 60;
          if (directorSignature) docPdf.addImage(directorSignature, 'PNG', margin + 10, sigY - 20, 40, 20);
          if (secSignature) docPdf.addImage(secSignature, 'PNG', width - margin - 70, sigY - 20, 40, 20);
          
          docPdf.addImage(qrCodeDataUrl, 'PNG', margin, height - 25, 20, 20);
          docPdf.setFontSize(7);
          docPdf.text(`Validação: ${code}`, margin + 25, height - 15);

          const pdfBase64 = docPdf.output('datauristring');
          
          // Salvar no sistema de arquivos virtual
          await addDoc(collection(db, 'secretaria_arquivos'), {
              name: `${docTitle} - ${opStudent.displayName}.pdf`,
              type: 'file', mimeType: 'application/pdf', url: pdfBase64,
              parentId: 'root', createdAt: serverTimestamp(), createdBy: user.uid,
              studentId: opStudent.uid, docType: docType
          });

          // Abrir para impressão
          const pdfBlob = docPdf.output('blob');
          const blobUrl = URL.createObjectURL(pdfBlob);
          window.open(blobUrl, '_blank');

      } catch (e: any) {
          alert("Erro: " + e.message);
      } finally {
          setIsGeneratingPdf(false);
      }
  };

  // --- RENDER ---
  return (
    <div className="space-y-4 animate-in fade-in h-full max-w-full overflow-hidden flex flex-col pb-6">
      {/* HEADER */}
      <header className="flex flex-col md:flex-row justify-between items-center bg-slate-900 p-4 text-white gap-4 rounded-xl shadow-lg print:hidden">
        <div className="flex items-center gap-3">
           <div className="p-2 bg-indigo-600 rounded-lg shadow-lg"><Archive size={20}/></div>
           <div>
               <h1 className="text-lg font-black uppercase italic tracking-tighter leading-none">Gabinete Operacional</h1>
               <p className="text-[9px] text-indigo-400 font-bold uppercase tracking-widest mt-0.5 italic">Secretaria EB-AD</p>
           </div>
        </div>
        <div className="flex bg-slate-800 p-1 rounded-lg shadow-inner border border-white/5 overflow-x-auto max-w-full">
           {(['atendimento', 'chat', 'arquivos', 'operacional'] as any).map((t:any) => (
             <button key={t} onClick={() => { setActiveTab(t); setOpSubView('main'); if(t !== 'chat') setActiveTicket(null); }} 
             className={`px-4 py-2 text-[9px] font-black uppercase italic transition-all rounded-lg whitespace-nowrap ${activeTab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                {t}
             </button>
           ))}
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
         {/* TAB: LISTA DE ATENDIMENTOS */}
         {activeTab === 'atendimento' && (
             <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 bg-slate-50 border-b flex gap-2">
                    {['todos', 'pendente', 'ativo', 'finalizado'].map((f:any) => (
                        <button key={f} onClick={() => setTicketFilter(f)} className={`px-3 py-1 rounded text-[10px] font-black uppercase ${ticketFilter === f ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{f}</button>
                    ))}
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {tickets.filter(t => ticketFilter === 'todos' || t.status.toLowerCase() === ticketFilter).map(t => (
                        <div key={t.id} className="flex justify-between p-3 border-b hover:bg-slate-50 items-center">
                            <div>
                                <span className="font-bold text-xs text-indigo-700">#{t.protocolo}</span> 
                                <span className="text-xs ml-2 text-slate-700">{t.user}</span>
                                <div className="text-[10px] text-slate-400">{t.lastMessage}</div>
                            </div>
                            <button onClick={() => {setActiveTicket(t); setActiveTab('chat');}} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase border border-indigo-100 hover:bg-indigo-600 hover:text-white transition-all">Abrir</button>
                        </div>
                    ))}
                    {tickets.length === 0 && <div className="text-center p-10 text-slate-400 text-sm">Nenhum atendimento encontrado.</div>}
                </div>
             </div>
         )}

         {/* TAB: CHAT */}
         {activeTab === 'chat' && (
             <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative">
                {activeTicket ? (
                  <>
                    <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                       <div>
                           <h3 className="font-black text-slate-900 text-sm uppercase italic">Protocolo #{activeTicket.protocolo}</h3>
                           <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status: {activeTicket.status}</p>
                       </div>
                       {timerDisplay && <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 animate-pulse"><Clock size={12} /><span className="text-[10px] font-black uppercase">Espera: {timerDisplay}</span></div>}
                       <div className="flex gap-2">
                           {activeTicket.status !== 'Arquivado' && activeTicket.status !== 'Resolvido' && activeTicket.status !== 'Finalizado' && 
                             <button onClick={handleStudentFinalize} className="px-3 py-2 bg-rose-50 text-rose-600 rounded-lg text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all border border-rose-100">Encerrar</button>
                           }
                       </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50 relative">
                       {messages.map((m, i) => (
                         <div key={i} className={`flex flex-col ${m.sender === 'Secretaria' || m.sender === 'Sistema' ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[75%] p-3 rounded-2xl text-xs font-medium leading-relaxed shadow-sm 
                                ${m.sender === 'Secretaria' ? 'bg-indigo-600 text-white rounded-br-none' : 
                                  m.isBot ? 'bg-slate-200 text-slate-600 rounded-bl-none text-[11px]' : 
                                  'bg-white border border-slate-200 text-slate-700 rounded-bl-none'}`}>
                               {m.text}
                               {m.attachmentUrl && 
                                 <div onClick={() => viewAttachment(m.attachmentUrl)} className="mt-2 p-2 bg-black/10 rounded flex items-center gap-2 cursor-pointer hover:bg-black/20 text-white truncate">
                                    <FileText size={14}/> <span className="text-[9px] font-bold uppercase underline">Anexo</span> <ExternalLink size={10}/>
                                 </div>
                               }
                            </div>
                            {m.sender === 'Sistema' && m.options && activeTicket.status === 'Pendente' && (
                                <div className="mt-2 flex flex-wrap gap-1 justify-end">
                                    {m.options.map((opt: string) => <span key={opt} className="px-2 py-1 bg-slate-100 text-slate-400 border border-slate-200 rounded text-[9px]">{opt}</span>)}
                                </div>
                            )}
                            <span className="text-[8px] font-bold text-slate-300 mt-1 uppercase px-1">{m.sender}</span>
                         </div>
                       ))}
                       <div ref={chatEndRef} />
                    </div>

                    {/* Chat Input or Survey */}
                    {(activeTicket.status === 'Resolvido' || activeTicket.status === 'Finalizado') ? (
                        <div className="p-6 bg-slate-100 border-t flex flex-col items-center gap-4 text-center">
                            <h4 className="text-sm font-bold text-slate-700 uppercase">Pesquisa de Satisfação (Cliente)</h4>
                            <div className="text-xs text-slate-500">Aguardando avaliação do aluno ou arquivamento manual.</div>
                            <button onClick={submitSurvey} className="px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold uppercase text-xs shadow-lg hover:bg-indigo-700">Arquivar Ticket</button>
                        </div>
                    ) : activeTicket.status !== 'Arquivado' ? (
                      <div className="p-4 border-t border-slate-100 bg-white">
                        <div className="flex gap-3 items-center">
                            <button onClick={() => chatFileInputRef.current?.click()} className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-indigo-100 hover:text-indigo-600 transition-all"><Paperclip size={18}/></button>
                            <input type="file" ref={chatFileInputRef} className="hidden" onChange={handleChatFileUpload}/>
                            <input 
                                value={chatMessage} 
                                onChange={e => setChatMessage(e.target.value)} 
                                onKeyDown={e => e.key === 'Enter' && sendMessage()} 
                                className="flex-1 bg-slate-50 border-none rounded-lg py-2 px-4 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Digite sua resposta..."
                            />
                            <button onClick={sendMessage} className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-md transition-all"><Send size={18}/></button>
                        </div>
                      </div>
                    ) : <div className="p-4 text-center bg-slate-50 text-xs text-slate-400 uppercase font-bold">Ticket Arquivado</div>}
                  </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300">
                        <MessageSquare size={48} className="mb-4 opacity-20"/>
                        <p className="text-xs uppercase font-bold">Selecione um atendimento</p>
                    </div>
                )}
             </div>
         )}

         {/* TAB: ARQUIVOS */}
         {activeTab === 'arquivos' && (
             <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                     <div className="flex gap-1 items-center overflow-x-auto">
                        {folderPath.map((folder, idx) => (
                            <div key={folder.id} className="flex items-center">
                                <button onClick={() => handleBreadcrumb(idx)} className="text-xs font-bold text-slate-600 hover:text-indigo-600 uppercase hover:underline">{folder.name}</button>
                                {idx < folderPath.length - 1 && <ChevronRight size={12} className="mx-1 text-slate-300"/>}
                            </div>
                        ))}
                     </div>
                     <div className="flex gap-2">
                        <button onClick={handleCreateFolder} className="p-2 bg-white border border-slate-200 rounded hover:bg-indigo-50 text-indigo-600"><FolderPlus size={16}/></button>
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 shadow-sm"><UploadCloud size={16}/></button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadFile} />
                     </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-4">
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {currentItems.map(item => (
                            <div key={item.id} className="group relative bg-slate-50 border border-slate-100 rounded-xl p-4 flex flex-col items-center justify-center gap-3 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer"
                                 onClick={() => item.type === 'folder' ? handleNavigate(item) : viewFile(item)}
                            >
                                {item.type === 'folder' ? <Folder size={32} className="text-indigo-400 group-hover:text-indigo-600"/> : <FileText size={32} className="text-slate-400 group-hover:text-slate-600"/>}
                                <span className="text-[10px] font-bold uppercase text-center text-slate-600 truncate w-full">{item.name}</span>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteFile(item.id); }} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 text-rose-400 hover:bg-rose-50 rounded"><Trash2 size={12}/></button>
                                <button onClick={(e) => { e.stopPropagation(); setFileToMove(item); setMoveModalOpen(true); }} className="absolute top-1 left-1 opacity-0 group-hover:opacity-100 p-1 text-indigo-400 hover:bg-indigo-50 rounded"><Move size={12}/></button>
                            </div>
                        ))}
                     </div>
                 </div>
             </div>
         )}

         {/* TAB: OPERACIONAL (GERAÇÃO DE DOCS) */}
         {activeTab === 'operacional' && (
             <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                 <div className="p-6 border-b border-slate-100 bg-slate-50">
                    <h2 className="text-sm font-black uppercase text-slate-800 mb-4 flex items-center gap-2"><Printer size={16}/> Emissão de Documentos</h2>
                    <div className="flex gap-4">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 text-slate-400" size={16}/>
                            <input 
                                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                                placeholder="Buscar aluno por nome ou CPF..."
                                value={studentSearchTerm}
                                onChange={e => setStudentSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                 </div>

                 <div className="flex-1 flex overflow-hidden">
                    {/* Lista de Alunos */}
                    <div className="w-1/3 border-r border-slate-100 overflow-y-auto bg-slate-50/50 p-2">
                        {students.filter(s => s.displayName?.toLowerCase().includes(studentSearchTerm.toLowerCase()) || s.cpf?.includes(studentSearchTerm)).map(s => (
                            <div key={s.uid} onClick={() => setOpStudent(s)} className={`p-3 mb-2 rounded-lg cursor-pointer border ${opStudent?.uid === s.uid ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}>
                                <div className="font-bold text-xs uppercase">{s.displayName}</div>
                                <div className="text-[10px] opacity-70 flex justify-between mt-1">
                                    <span>CPF: {s.cpf || '---'}</span>
                                    <span>{s.academicId}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Painel de Ações */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {opStudent ? (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                    <h3 className="font-black text-indigo-900 text-lg uppercase">{opStudent.displayName}</h3>
                                    <div className="grid grid-cols-2 gap-4 mt-2 text-xs text-indigo-700">
                                        <p><strong>Email:</strong> {opStudent.email}</p>
                                        <p><strong>Curso:</strong> {opStudent.cursoInicial || 'Não definido'}</p>
                                        <p><strong>Status:</strong> <span className="px-2 py-0.5 bg-white rounded border border-indigo-200 uppercase font-bold text-[10px]">{opStudent.status || 'Pendente'}</span></p>
                                        <button onClick={() => {setEditingStudent(opStudent); setAuditModalOpen(true);}} className="text-left underline hover:text-indigo-900">Editar Dados / Validar</button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-xs font-bold uppercase text-slate-400 mb-3 tracking-widest">Documentos Disponíveis</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        {[
                                            {id: 'matricula', label: 'Declaração de Matrícula', icon: FileText},
                                            {id: 'historico', label: 'Histórico Escolar', icon: File},
                                            {id: 'conclusao', label: 'Certificado de Conclusão', icon: Award},
                                            {id: 'transferencia', label: 'Guia de Transferência', icon: ArrowRightLeft},
                                        ].map((docItem) => (
                                            <button 
                                                key={docItem.id} 
                                                onClick={() => generateLegalPDF(docItem.id as any)}
                                                disabled={isGeneratingPdf}
                                                className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-xl hover:border-indigo-500 hover:shadow-md transition-all group disabled:opacity-50"
                                            >
                                                <div className="p-3 bg-slate-50 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <docItem.icon size={20}/>
                                                </div>
                                                <div className="text-left">
                                                    <div className="font-bold text-slate-700 text-xs uppercase group-hover:text-indigo-700">{docItem.label}</div>
                                                    <div className="text-[10px] text-slate-400">Gerar PDF Assinado</div>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300">
                                <Search size={48} className="mb-4 opacity-20"/>
                                <p className="text-xs uppercase font-bold">Selecione um aluno para iniciar</p>
                            </div>
                        )}
                    </div>
                 </div>
             </div>
         )}
      </main>

      {/* --- MODAIS --- */}
      
      {/* Modal Mover Arquivo */}
      {moveModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
                  <h3 className="font-bold text-slate-800 mb-4">Mover para...</h3>
                  <div className="space-y-2 max-h-60 overflow-y-auto border p-2 rounded">
                      <div onClick={() => setMoveTargetFolderId('root')} className={`p-2 rounded cursor-pointer ${moveTargetFolderId === 'root' ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-50'}`}>
                          <Folder size={14} className="inline mr-2"/> Raiz
                      </div>
                      {fileSystem.filter(f => f.type === 'folder' && f.id !== fileToMove?.id).map(f => (
                          <div key={f.id} onClick={() => setMoveTargetFolderId(f.id)} className={`p-2 rounded cursor-pointer ${moveTargetFolderId === f.id ? 'bg-indigo-100 text-indigo-700' : 'hover:bg-slate-50'}`}>
                              <Folder size={14} className="inline mr-2"/> {f.name}
                          </div>
                      ))}
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                      <button onClick={() => setMoveModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500">Cancelar</button>
                      <button onClick={handleMoveFile} className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold">Mover</button>
                  </div>
              </div>
          </div>
      )}

      {/* Modal Auditoria/Edição Aluno */}
      {auditModalOpen && editingStudent && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg">
                  <h3 className="font-bold text-slate-800 mb-4 uppercase flex items-center gap-2"><ShieldCheck size={18}/> Auditoria de Cadastro</h3>
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Nome Completo</label>
                          <input className="w-full p-2 border rounded text-xs" value={editingStudent.displayName} onChange={e => setEditingStudent({...editingStudent, displayName: e.target.value})}/>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">CPF</label>
                          <input className="w-full p-2 border rounded text-xs" value={editingStudent.cpf || ''} onChange={e => setEditingStudent({...editingStudent, cpf: e.target.value})}/>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Matrícula (ID)</label>
                          <input className="w-full p-2 border rounded text-xs bg-slate-50" disabled value={editingStudent.academicId || ''}/>
                      </div>
                      <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Status Acadêmico</label>
                          <select className="w-full p-2 border rounded text-xs" value={editingStudent.status || 'pendente'} onChange={e => setEditingStudent({...editingStudent, status: e.target.value})}>
                              <option value="pendente">Pendente</option>
                              <option value="ativo">Ativo (Regular)</option>
                              <option value="bloqueado">Bloqueado</option>
                              <option value="formado">Formado</option>
                          </select>
                      </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-2">
                      <button onClick={() => setAuditModalOpen(false)} className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded">Cancelar</button>
                      <button onClick={async () => {
                          try {
                              await updateDoc(doc(db, 'users', editingStudent.uid), editingStudent);
                              alert("Dados atualizados!");
                              setAuditModalOpen(false);
                          } catch(e) { alert("Erro ao salvar."); }
                      }} className="px-4 py-2 bg-indigo-600 text-white rounded text-xs font-bold hover:bg-indigo-700">Salvar Alterações</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default SecretariatView;