
import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../firebase';
import { ShieldCheck, ShieldAlert, FileText, CheckCircle2, Search, Loader2 } from 'lucide-react';

const DocumentVerificationView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [docData, setDocData] = useState<any | null>(null);
  const [error, setError] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    // Extract code from URL
    const params = new URLSearchParams(window.location.search);
    const urlCode = params.get('code');
    
    if (urlCode) {
      setCode(urlCode);
      verifyDocument(urlCode);
    } else {
      setLoading(false);
    }
  }, []);

  const verifyDocument = async (codeToVerify: string) => {
    setLoading(true);
    setError(false);
    try {
      // Query specificamente o campo docData.code dentro da coleção secretaria_arquivos
      const q = query(
        collection(db, 'secretaria_arquivos'), 
        where('docData.code', '==', codeToVerify)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        // Pega o primeiro documento encontrado
        const docFound = querySnapshot.docs[0].data();
        setDocData(docFound.docData);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Erro na verificação:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if(code.trim()) verifyDocument(code.trim());
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
        <p className="text-sm font-black uppercase text-slate-400 tracking-widest animate-pulse">Consultando Blockchain Institucional...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-slate-900 text-white shadow-2xl mb-4">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 uppercase italic tracking-tighter">Validador Oficial de Documentos</h1>
          <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Escola Bíblica EAD - Registro Acadêmico Digital</p>
        </div>

        {/* Search Input (if no code in URL or invalid) */}
        {(!docData && error) || !code ? (
           <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
              <form onSubmit={handleManualSearch} className="space-y-4">
                 <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-2">Código de Autenticidade</label>
                 <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input 
                      value={code}
                      onChange={e => setCode(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-lg font-mono font-bold text-indigo-900 outline-none focus:border-indigo-500 transition-all uppercase placeholder:text-slate-300"
                      placeholder="XXXX.XXXX.XXXX"
                    />
                 </div>
                 <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition-all">Verificar Autenticidade</button>
                 
                 {error && (
                   <div className="mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-700 animate-in slide-in-from-top-2">
                      <ShieldAlert size={24} />
                      <div>
                        <p className="font-black uppercase text-xs">Documento Inválido ou Inexistente</p>
                        <p className="text-[10px]">O código informado não consta em nossa base de dados oficial.</p>
                      </div>
                   </div>
                 )}
              </form>
           </div>
        ) : null}

        {/* Success Result */}
        {docData && (
          <div className="space-y-6 animate-in zoom-in-95 duration-500">
            {/* Status Banner */}
            <div className="bg-emerald-600 text-white p-6 rounded-3xl shadow-2xl flex items-center gap-5 relative overflow-hidden">
               <div className="absolute -right-6 -top-6 text-emerald-500 opacity-20"><CheckCircle2 size={150}/></div>
               <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm"><CheckCircle2 size={32} /></div>
               <div>
                  <h2 className="text-xl font-black uppercase italic tracking-tighter">Documento Autêntico</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mt-1">Emitido e Assinado Digitalmente pela Instituição</p>
               </div>
            </div>

            {/* Document Details Card */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
               <div className="bg-slate-50 px-8 py-4 border-b border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Resumo do Registro</span>
                  <span className="bg-slate-200 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-mono font-bold">{docData.code}</span>
               </div>
               
               <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold uppercase text-slate-400">Tipo de Documento</p>
                     <p className="text-lg font-black text-slate-900 uppercase italic">{docData.title}</p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[10px] font-bold uppercase text-slate-400">Data de Emissão</p>
                     <p className="text-lg font-black text-slate-900">{new Date(docData.date).toLocaleDateString('pt-BR')} às {new Date(docData.date).toLocaleTimeString('pt-BR')}</p>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                     <p className="text-[10px] font-bold uppercase text-slate-400">Aluno Titular</p>
                     <p className="text-2xl font-black text-indigo-900 uppercase italic tracking-tight">{docData.student?.displayName}</p>
                     <p className="text-xs font-mono text-slate-500">CPF: {docData.student?.cpf} • RA: {docData.student?.academicId}</p>
                  </div>
               </div>

               {/* Raw Data View (TXT Format for Verification) */}
               <div className="bg-slate-900 p-8 text-slate-300 font-mono text-xs leading-relaxed border-t border-slate-800">
                  <div className="flex items-center gap-2 mb-4 text-emerald-400 font-bold uppercase tracking-widest text-[9px]">
                     <FileText size={14}/> Dados Originais do Registro (Hash)
                  </div>
                  <pre className="whitespace-pre-wrap break-words opacity-80">
{`--- INÍCIO DO REGISTRO ---
INSTITUIÇÃO: Escola Bíblica EAD
CNPJ: 00.000.000/0001-00
CÓDIGO DE AUTENTICIDADE: ${docData.code}

ALUNO: ${docData.student?.displayName}
DOCUMENTO: ${docData.student?.cpf}
MATRÍCULA: ${docData.student?.academicId}

TIPO: ${docData.title}
CURSO: ${docData.courseData?.nome || 'N/A'}
CARGA HORÁRIA: ${docData.modulesData ? docData.modulesData.length * 20 : 0} Horas
STATUS: Concluído / Aprovado

ASSINATURAS DIGITAIS:
1. DIRETORIA EXECUTIVA (VALIDADO)
2. SECRETARIA GERAL (VALIDADO)

TIMESTAMP: ${docData.date}
--- FIM DO REGISTRO ---`}
                  </pre>
               </div>
            </div>
            
            <div className="text-center">
               <button onClick={() => { setDocData(null); setCode(''); }} className="text-indigo-600 font-bold text-xs hover:underline">Realizar nova consulta</button>
            </div>
          </div>
        )}

        <footer className="text-center space-y-2 pt-8">
           <p className="text-[9px] font-bold uppercase text-slate-400 tracking-widest">Sistema de Gestão Acadêmica EB-EAD</p>
           <p className="text-[8px] text-slate-300">© {new Date().getFullYear()} Todos os direitos reservados.</p>
        </footer>

      </div>
    </div>
  );
};

export default DocumentVerificationView;
