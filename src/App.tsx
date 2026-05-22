
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from './firebase';
import { UserRole, MainView, User, ProfessorSubView } from './types';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import DashboardView from './views/DashboardView';
import ProfessorView from './views/ProfessorView';
import StudentsView from './views/StudentsView';
import SecretariatView from './views/SecretariatView';
import SettingsView from './views/SettingsView';
import LoginView from './views/LoginView';
import StudentView from './views/StudentView';
import DocumentVerificationView from './views/DocumentVerificationView';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<MainView>('dashboard');
  const [activeProfessorSubView, setActiveProfessorSubView] = useState<ProfessorSubView>('cursos');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // State for public verification mode
  const [isVerificationMode, setIsVerificationMode] = useState(false);

  useEffect(() => {
    // Check URL parameters for verification code
    const params = new URLSearchParams(window.location.search);
    if (params.get('code')) {
      setIsVerificationMode(true);
      setLoading(false); // Stop main loading to show verification
      return; // Skip auth check if verifying
    }

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setLoading(true);
      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          let userDoc = await getDoc(userRef);
          
          let role: UserRole = 'aluno';
          let displayName = user.displayName || 'Usuário';
          let status = 'aguardando_validacao';

          if (userDoc.exists()) {
            const userData = userDoc.data();
            role = (userData?.role as UserRole) || 'aluno';
            displayName = userData?.nome || userData?.displayName || displayName;
            status = userData?.status || 'aguardando_validacao';
          } else {
            const initialData = {
              uid: user.uid,
              email: user.email,
              role: 'aluno',
              status: 'aguardando_validacao',
              createdAt: new Date(),
              sincronizado: true
            };
            
            await setDoc(userRef, initialData, { merge: true });
            
            userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const mergedData = userDoc.data();
                displayName = mergedData.nome || mergedData.displayName || displayName;
            }
          }

          setCurrentUser({
            uid: user.uid,
            email: user.email,
            displayName: displayName,
            role: role,
            photoURL: user.photoURL || undefined,
            status: status
          });
        } catch (error) {
          console.error("Erro na auditoria de perfil master:", error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const navigateToSubView = (main: MainView, sub?: ProfessorSubView) => {
    setActiveView(main);
    if (sub) setActiveProfessorSubView(sub);
  };

  // 1. Check Verification Mode First
  if (isVerificationMode) {
    return <DocumentVerificationView />;
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-8 animate-in fade-in duration-1000">
          <div className="relative">
             <div className="h-20 w-20 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent shadow-[0_0_40px_rgba(79,70,229,0.3)]"></div>
             <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 bg-indigo-500 rounded-full animate-ping"></div>
             </div>
          </div>
          <div className="text-center space-y-3">
            <p className="text-white text-[12px] font-black uppercase tracking-[0.6em] italic animate-pulse">Sincronização SSL Ativa</p>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest italic leading-none">Aguardando Resposta do Firestore Cloud</p>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) return <LoginView />;

  // Fluxo do Aluno
  if (currentUser.role === 'aluno') {
    return <StudentView user={currentUser} />;
  }

  // Painel Administrativo Master
  const renderView = () => {
    switch (activeView) {
      case 'dashboard': return <DashboardView onNavigate={navigateToSubView} />;
      case 'professor': return <ProfessorView user={currentUser} activeSubView={activeProfessorSubView} />;
      case 'alunos': return <StudentsView />;
      case 'secretaria': return <SecretariatView user={currentUser} />;
      case 'configuracoes': return <SettingsView />;
      default: return <DashboardView onNavigate={navigateToSubView} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar 
        user={currentUser} 
        activeView={activeView} 
        setActiveView={(v) => { setActiveView(v); setIsMobileMenuOpen(false); }}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />
      
      <div className="flex-1 flex overflow-hidden">
        {(activeView === 'professor') && (
          <Sidebar 
            activeSub={activeProfessorSubView} 
            setActiveSub={setActiveProfessorSubView} 
          />
        )}
        
        <main className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
          <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10 h-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {renderView()}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
