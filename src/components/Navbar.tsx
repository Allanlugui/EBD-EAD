
import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  MessageSquare, 
  Settings, 
  LogOut,
  Menu,
  X,
  Bell,
  AlertCircle,
  Ticket
} from 'lucide-react';
import { MainView, User } from '../types';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";

interface NavbarProps {
  user: User;
  activeView: MainView;
  setActiveView: (view: MainView) => void;
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

const Navbar: React.FC<NavbarProps> = ({ user, activeView, setActiveView, isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    // 1. Audit Pending
    const q1 = query(collection(db, 'users'), where('status', 'in', ['aguardando_validacao', 'pendente']));
    const unsub1 = onSnapshot(q1, (snap) => {
      const pending = snap.docs.map(d => ({ 
        id: d.id, 
        type: 'audit', 
        message: `Novo aluno: ${d.data().displayName}`,
        time: d.data().createdAt 
      }));
      updateNotifs(pending, 'audit');
    });

    // 2. Support Tickets
    const q2 = query(collection(db, 'tickets'), where('status', '==', 'Pendente'));
    const unsub2 = onSnapshot(q2, (snap) => {
      const tickets = snap.docs.map(d => ({ 
        id: d.id, 
        type: 'ticket', 
        message: `Ticket aberto: ${d.data().user}`,
        time: d.data().createdAt 
      }));
      updateNotifs(tickets, 'ticket');
    });

    return () => { unsub1(); unsub2(); };
  }, []);

  const updateNotifs = (newItems: any[], type: string) => {
    setNotifications(prev => {
      const filtered = prev.filter(n => n.type !== type);
      return [...filtered, ...newItems].sort((a,b) => (b.time?.seconds||0) - (a.time?.seconds||0));
    });
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'professor', label: 'Área do Professor', icon: <BookOpen size={18} /> },
    { id: 'alunos', label: 'Alunos', icon: <GraduationCap size={18} /> },
    { id: 'secretaria', label: 'Secretaria', icon: <MessageSquare size={18} /> },
    { id: 'configuracoes', label: 'Configurações', icon: <Settings size={18} /> },
  ];

  return (
    <nav className="sticky top-0 z-[100] bg-slate-900 text-slate-300 h-16 shadow-2xl border-b border-slate-800">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-1.5 rounded-lg shadow-lg shadow-indigo-600/20">
            <BookOpen size={20} />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-white text-sm tracking-tight leading-none uppercase italic">EB-EAD</span>
            <span className="text-[9px] font-bold text-indigo-400 tracking-[0.2em] uppercase leading-none mt-0.5">Gestão Master</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-0.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as MainView)}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeView === item.id 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' 
                  : 'hover:bg-slate-800 hover:text-slate-100'
              }`}
            >
              <span className={activeView === item.id ? 'text-white' : 'text-slate-500'}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <button 
              onClick={() => setShowNotifications(!showNotifications)}
              className={`p-2.5 rounded-xl transition-all relative ${notifications.length > 0 ? 'bg-indigo-600/10 text-indigo-400 animate-pulse' : 'text-slate-500 hover:bg-slate-800'}`}
            >
              <Bell size={20} />
              {notifications.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-slate-900 shadow-lg">
                  {notifications.length}
                </span>
              )}
            </button>
            
            {showNotifications && (
              <div className="absolute top-14 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-0 animate-in slide-in-from-top-2 text-slate-900 z-[101] overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-100">
                  <h4 className="text-[10px] font-black uppercase text-indigo-600 italic flex items-center gap-2">
                    <AlertCircle size={14}/> Notificações ({notifications.length})
                  </h4>
                </div>
                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <p className="p-6 text-center text-[10px] text-slate-400 italic">Sem novas notificações.</p>
                  ) : (
                    notifications.map((n, i) => (
                      <button 
                        key={i} 
                        onClick={() => { 
                          setShowNotifications(false); 
                          setActiveView('secretaria'); 
                        }}
                        className="w-full text-left p-4 border-b border-slate-50 hover:bg-indigo-50 transition-all flex items-start gap-3 group"
                      >
                        <div className={`p-2 rounded-lg ${n.type === 'ticket' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>
                          {n.type === 'ticket' ? <Ticket size={14}/> : <GraduationCap size={14}/>}
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-800 leading-tight group-hover:text-indigo-600 transition-colors">{n.message}</p>
                          <p className="text-[9px] text-slate-400 mt-1 italic">Clique para resolver na Secretaria</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="hidden sm:flex flex-col items-end pr-4 border-r border-slate-800">
            <span className="text-xs font-bold text-white leading-none uppercase italic">{user.displayName}</span>
            <span className="text-[10px] font-bold uppercase text-indigo-500 tracking-wider mt-0.5">{user.role}</span>
          </div>
          
          <button 
            onClick={() => auth.signOut()}
            className="p-2.5 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-all text-slate-400"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
