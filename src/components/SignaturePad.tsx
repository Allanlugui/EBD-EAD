
import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, X } from 'lucide-react';

interface SignaturePadProps {
  onSave: (base64: string) => void;
  onCancel: () => void;
  title: string;
}

const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, title }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e) ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = ('touches' in e) ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.moveTo(x, y);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      onSave(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">{title}</h3>
          <button onClick={onCancel} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20}/></button>
        </div>
        
        <p className="text-xs text-slate-500 mb-6 font-medium">Utilize o mouse ou tela touch para realizar sua assinatura oficial. Ela será utilizada nos certificados de conclusão.</p>

        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl overflow-hidden cursor-crosshair relative">
          <canvas
            ref={canvasRef}
            width={500}
            height={200}
            className="w-full h-[200px]"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseOut={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className="flex gap-4 mt-8">
          <button onClick={clear} className="flex items-center gap-2 px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl text-[10px] font-black uppercase hover:bg-slate-200 transition-all">
            <Eraser size={16}/> Limpar
          </button>
          <button onClick={handleSave} className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">
            <Check size={16}/> Salvar Assinatura Digital
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignaturePad;
