
import React from 'react';
import { 
  Archive, 
  Layers, 
  FileText, 
  CheckSquare, 
  MessageCircle, 
  Calendar, 
  TrendingUp, 
  Users, 
  Tv,
  ChevronRight
} from 'lucide-react';
import { ProfessorSubView } from '../types';

interface SidebarProps {
  activeSub: ProfessorSubView;
  setActiveSub: (view: ProfessorSubView) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSub, setActiveSub }) => {
  const subMenuItems = [
    { id: 'cursos', label: 'Cursos', icon: <Archive size={16} /> },
    { id: 'modulos', label: 'Módulos', icon: <Layers size={16} /> },
    { id: 'materiais', label: 'Materiais', icon: <FileText size={16} /> },
    { id: 'avaliacao', label: 'Avaliação', icon: <CheckSquare size={16} /> },
    { id: 'feedback', label: 'Feedback', icon: <MessageCircle size={16} /> },
    { id: 'diario', label: 'Diário de Classe', icon: <Calendar size={16} /> },
    { id: 'relatorio', label: 'Relatório Mensal', icon: <TrendingUp size={16} /> },
    { id: 'frequencia', label: 'Frequência', icon: <Users size={16} /> },
    { id: 'live', label: 'Aula ao Vivo', icon: <Tv size={16} /> },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-white border-r border-slate-200 h-full overflow-y-auto animate-in slide-in-from-left duration-300">
      <div className="p-4 border-b border-slate-100 bg-slate-50/30">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Navegação Interna</h3>
        <p className="text-[11px] text-slate-500 font-medium">Gestão Pedagógica</p>
      </div>
      
      <nav className="flex-1 p-2 space-y-0.5">
        {subMenuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSub(item.id as ProfessorSubView)}
            className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm transition-all group ${
              activeSub === item.id 
                ? 'bg-indigo-600 text-white font-semibold shadow-md shadow-indigo-100' 
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={activeSub === item.id ? 'text-white' : 'text-slate-400 group-hover:text-indigo-500 transition-colors'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </div>
            {activeSub === item.id && <ChevronRight size={14} className="opacity-50" />}
          </button>
        ))}
      </nav>

      <div className="p-4 bg-slate-50 border-t border-slate-100">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
            EB
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-900 uppercase">EAD v1.0</p>
            <p className="text-[9px] text-slate-400">Escola Bíblica</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
