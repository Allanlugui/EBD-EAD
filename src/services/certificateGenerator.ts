
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import { fetchAsDataURL } from "./pdfAssets";
import { uploadBlobToStorage, safeName } from "./storageService";
import { db } from "../firebase";
import { addDoc, collection, serverTimestamp, updateDoc, doc, setDoc, query, where, getDocs } from "firebase/firestore";

// =====================
// CLEAN PDF DESIGN SYSTEM
// =====================
const PDF_THEME = {
  textMain: [30, 41, 59] as [number, number, number],   // slate-900 (Dark)
  textSec: [100, 116, 139] as [number, number, number], // slate-500 (Gray)
  accent: [184, 134, 11] as [number, number, number],   // Gold/Bronze lines
  lineColor: [203, 213, 225] as [number, number, number]// Light gray lines
};

const safeText = (v: any) => (v ?? "").toString().trim();

const drawClassicBorder = (doc: any) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 5; 

  doc.setDrawColor(...PDF_THEME.textMain);
  doc.setLineWidth(0.3);
  doc.rect(margin, margin, w - (margin * 2), h - (margin * 2));

  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(0.8);
  doc.rect(margin + 1.5, margin + 1.5, w - (margin * 2) - 3, h - (margin * 2) - 3);
};

const drawWatermark = (doc: any, logoDataUrl?: string | null) => {
  if (!logoDataUrl) return;
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  try {
    const gState = (doc as any).GState ? new (doc as any).GState({ opacity: 0.04 }) : null;
    if (gState && (doc as any).setGState) (doc as any).setGState(gState);
    const size = 100;
    doc.addImage(logoDataUrl, "PNG", (w/2) - (size/2), (h/2) - (size/2), size, size);
    if ((doc as any).setGState) (doc as any).setGState(new (doc as any).GState({ opacity: 1 }));
  } catch {}
};

const drawCleanHeader = (doc: any, title: string, logoDataUrl?: string | null) => {
  const w = doc.internal.pageSize.getWidth();
  const yStart = 20;

  doc.setFont("times", "bold");
  doc.setFontSize(22);
  doc.setTextColor(...PDF_THEME.textMain);
  
  if (logoDataUrl) {
    const logoSize = 18;
    const textWidth = doc.getTextWidth(title.toUpperCase());
    const totalWidth = logoSize + 4 + textWidth; 
    const startX = (w - totalWidth) / 2;

    try {
      doc.addImage(logoDataUrl, "PNG", startX, yStart - 6, logoSize, logoSize);
    } catch {}
    
    doc.text(title.toUpperCase(), startX + logoSize + 4, yStart + 6);
  } else {
    doc.text(title.toUpperCase(), w / 2, yStart + 6, { align: "center" });
  }

  doc.setDrawColor(...PDF_THEME.lineColor);
  doc.setLineWidth(0.2);
  doc.line(20, yStart + 16, w - 20, yStart + 16);
};

// --- DATA HELPERS ---
const dataUriToBase64 = (dataUri: string) => {
  const idx = dataUri.indexOf("base64,");
  return idx >= 0 ? dataUri.substring(idx + 7) : dataUri;
};

const splitIntoChunks = (str: string, chunkSize = 800_000) => {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += chunkSize) out.push(str.slice(i, i + chunkSize));
  return out;
};

const generateVerificationCode = () => {
  return `${new Date().getFullYear()}.${Math.random().toString(36).substr(2, 4).toUpperCase()}.${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

export interface PdfGeneratorOptions {
  student: any;
  course: any;
  modules: any[];
  docType: 'matricula' | 'conclusao' | 'transferencia' | 'historico';
  schoolConfig: any;
  signatures: { director?: string | null; secretary?: string | null };
  issuerId: string;
}

export const generateAndSavePDF = async ({
  student, course, modules, docType, schoolConfig, signatures, issuerId
}: PdfGeneratorOptions) => {
  try {
    const code = generateVerificationCode();
    const docTitle = docType === 'matricula' ? 'DECLARAÇÃO DE MATRÍCULA' : 
                     docType === 'conclusao' ? 'CERTIFICADO DE CONCLUSÃO' : 
                     docType === 'historico' ? 'HISTÓRICO ESCOLAR' : 'GUIA DE TRANSFERÊNCIA';

    // FIX: URL should be root ?code=
    const validationUrl = `${window.location.origin}/?code=${code}`;
    const qrCodeDataUrl = await QRCode.toDataURL(validationUrl, { margin: 0, width: 150 });
    
    const loadAsset = async (url?: string) => { if (!url) return null; try { return await fetchAsDataURL(url); } catch { return null; } };
    const logoDataUrl = await loadAsset(schoolConfig.logoUrl);
    const directorSigDataUrl = await loadAsset(signatures.director || undefined);
    const secSigDataUrl = await loadAsset(signatures.secretary || undefined);

    const isLandscape = docType === 'conclusao';
    const docPdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
    const w = docPdf.internal.pageSize.getWidth();
    const h = docPdf.internal.pageSize.getHeight();

    // --- PAGE 1: FRONT ---
    drawClassicBorder(docPdf);
    drawWatermark(docPdf, logoDataUrl);
    drawCleanHeader(docPdf, docTitle, logoDataUrl);

    const marginX = 20;
    let cursorY = 55;

    if (isLandscape) {
        // CERTIFICATE LANDSCAPE CONTENT
        docPdf.setFont("times", "normal");
        docPdf.setFontSize(16);
        docPdf.setTextColor(20, 20, 20);
        docPdf.text("Certificamos que", w/2, cursorY, { align: "center" });
        cursorY += 15;

        docPdf.setFont("times", "bold");
        docPdf.setFontSize(28);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text(safeText(student.displayName).toUpperCase(), w/2, cursorY, { align: "center" });
        cursorY += 15;

        docPdf.setFont("times", "normal");
        docPdf.setFontSize(14);
        docPdf.setTextColor(40, 40, 40);
        const courseName = safeText(course.nome || student.cursoInicial || 'TEOLOGIA').toUpperCase();
        const body = `Concluiu com êxito o curso de ${courseName}, cumprindo integralmente a carga horária e os requisitos acadêmicos previstos no projeto pedagógico desta instituição.`;
        const lines = docPdf.splitTextToSize(body, w - (marginX * 3));
        docPdf.text(lines, w/2, cursorY, { align: "center" });
        cursorY += (lines.length * 8) + 15;

        const dateStr = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        docPdf.setFontSize(11);
        docPdf.setTextColor(...PDF_THEME.textSec);
        docPdf.text(`CPF: ${safeText(student.cpf)}   •   Matrícula: ${safeText(student.academicId)}`, w/2, cursorY, { align: "center" });
        cursorY += 7;
        docPdf.text(`São Paulo, ${dateStr}`, w/2, cursorY, { align: "center" });
    } else {
        // PORTRAIT CONTENT (DECLARATIONS)
        const courseName = safeText(course.nome || student.cursoInicial || 'TEOLOGIA').toUpperCase();
        
        // Student Data
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(10);
        docPdf.setTextColor(...PDF_THEME.textSec);
        docPdf.text("DADOS DO DISCENTE", marginX, cursorY);
        cursorY += 8;
        
        const drawField = (lbl: string, val: string, x: number, y: number) => {
            docPdf.setFont("helvetica", "normal");
            docPdf.setFontSize(8);
            docPdf.setTextColor(...PDF_THEME.textSec);
            docPdf.text(lbl.toUpperCase() + ":", x, y);
            const lw = docPdf.getTextWidth(lbl.toUpperCase() + ":");
            docPdf.setFont("helvetica", "bold");
            docPdf.setFontSize(9);
            docPdf.setTextColor(...PDF_THEME.textMain);
            docPdf.text(val.toUpperCase(), x + lw + 2, y);
        };

        drawField("Nome Civil", safeText(student.displayName), marginX, cursorY);
        cursorY += 7;
        drawField("CPF", safeText(student.cpf || "---"), marginX, cursorY);
        drawField("Matrícula (RA)", safeText(student.academicId || "---"), marginX + 80, cursorY);
        cursorY += 7;
        drawField("Curso", courseName, marginX, cursorY);
        cursorY += 15;

        docPdf.setDrawColor(...PDF_THEME.lineColor);
        docPdf.line(marginX, cursorY, w - marginX, cursorY);
        cursorY += 10;

        docPdf.setFont("times", "bold");
        docPdf.setFontSize(12);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text("DECLARAÇÃO", marginX, cursorY);
        cursorY += 8;

        docPdf.setFont("times", "normal");
        docPdf.setFontSize(12);
        docPdf.setTextColor(20, 20, 20);

        let body = "";
        if (docType === 'matricula') {
          body = `Declaramos, para os devidos fins, que o(a) aluno(a) acima identificado(a) encontra-se regularmente MATRICULADO(A) no curso de ${courseName} desta instituição, frequentando as atividades acadêmicas do presente período letivo.`;
        } else if (docType === 'transferencia') {
          body = `Atestamos a transferência do(a) discente, vinculado(a) ao curso de ${courseName}, estando apto(a) a prosseguir seus estudos na instituição de destino, conforme legislação vigente.`;
        } else {
          body = `Certificamos o Histórico Escolar do(a) aluno(a), referente ao curso de ${courseName}, conforme detalhamento de disciplinas e notas apresentados em anexo ou na tabela a seguir.`;
        }

        const lines = docPdf.splitTextToSize(body, w - (marginX * 2));
        docPdf.text(lines, marginX, cursorY);
        cursorY += (lines.length * 6) + 15;

        const dateStr = new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
        docPdf.text(`São Paulo, ${dateStr}.`, w - marginX, cursorY, { align: "right" });
        cursorY += 20;

        if (docType === 'historico' && modules.length > 0) {
           autoTable(docPdf, {
            startY: cursorY,
            head: [["Disciplina / Módulo", "C.H.", "Situação"]],
            body: modules.map(m => [safeText(m.title), "20h", "APROVADO"]),
            theme: "plain",
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fontStyle: "bold", fillColor: [240,240,240] },
            margin: { left: marginX, right: marginX }
           });
        }
    }

    // --- FOOTER (PAGE 1) ---
    const drawFooter = () => {
        const bottomSafeLimit = h - 5 - 2; 
        
        // School Name
        docPdf.setFont("times", "bold");
        docPdf.setFontSize(9);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text(safeText(schoolConfig.schoolName || "ESCOLA BÍBLICA EAD").toUpperCase(), w / 2, bottomSafeLimit - 5, { align: "center" });

        // QR Code
        const qrSize = 18;
        const qrY = bottomSafeLimit - 12 - qrSize;
        const qrX = 15; 

        try { docPdf.addImage(qrCodeDataUrl, "PNG", qrX, qrY, qrSize, qrSize); } catch {}

        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(7);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text("VALIDAÇÃO DIGITAL", qrX + qrSize + 3, qrY + 5);
        
        docPdf.setFont("helvetica", "normal");
        docPdf.setTextColor(...PDF_THEME.textSec);
        docPdf.text(`Cód: ${code}`, qrX + qrSize + 3, qrY + 9);
        docPdf.text("Verifique a autenticidade via QR Code", qrX + qrSize + 3, qrY + 14);

        // Signatures
        const sigY = qrY - 15;
        const sigWidth = 40;
        const sigHeight = 15;
        docPdf.setDrawColor(...PDF_THEME.textSec);
        docPdf.setLineWidth(0.2);
        
        const xSig1 = (w / 2) - sigWidth - 15;
        if (directorSigDataUrl) { try { docPdf.addImage(directorSigDataUrl, "PNG", xSig1 + 5, sigY - sigHeight + 2, sigWidth - 10, sigHeight - 2); } catch {} }
        docPdf.line(xSig1, sigY, xSig1 + sigWidth, sigY);
        docPdf.text("DIRETORIA EXECUTIVA", xSig1 + (sigWidth/2), sigY + 4, { align: "center" });

        const xSig2 = (w / 2) + 15;
        if (secSigDataUrl) { try { docPdf.addImage(secSigDataUrl, "PNG", xSig2 + 5, sigY - sigHeight + 2, sigWidth - 10, sigHeight - 2); } catch {} }
        docPdf.line(xSig2, sigY, xSig2 + sigWidth, sigY);
        docPdf.text("SECRETARIA GERAL", xSig2 + (sigWidth/2), sigY + 4, { align: "center" });
    };
    drawFooter();

    // --- PAGE 2: VERSO (CERTIFICATE ONLY) ---
    if (docType === 'conclusao') {
        docPdf.addPage();
        // Setup landscape again for page 2
        drawClassicBorder(docPdf);
        drawWatermark(docPdf, logoDataUrl);
        
        // Header Page 2
        docPdf.setFont("times", "bold");
        docPdf.setFontSize(14);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text("VERSO - CONTEÚDO PROGRAMÁTICO E HISTÓRICO", w/2, 20, { align: "center" });
        docPdf.setDrawColor(...PDF_THEME.lineColor);
        docPdf.line(20, 25, w-20, 25);

        // Columns Setup
        const colGap = 10;
        const col1X = 20;
        const col1W = (w - (2 * 20) - colGap) * 0.45; // 45% width
        const col2X = col1X + col1W + colGap;
        const col2W = (w - (2 * 20) - colGap) * 0.55; // 55% width
        let contentY = 35;

        // COLUMN 1: COURSE INFO & MODULES
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(10);
        docPdf.text("ESTRUTURA CURRICULAR", col1X, contentY);
        contentY += 8;

        docPdf.setFontSize(8);
        docPdf.setTextColor(...PDF_THEME.textSec);
        docPdf.text("CURSO:", col1X, contentY);
        docPdf.setFont("helvetica", "bold");
        docPdf.setTextColor(...PDF_THEME.textMain);
        const cName = safeText(course.nome || student.cursoInicial || 'TEOLOGIA').toUpperCase();
        const splitName = docPdf.splitTextToSize(cName, col1W);
        docPdf.text(splitName, col1X + 15, contentY);
        contentY += (splitName.length * 4) + 4;

        if (course.descricao) {
            docPdf.setFont("helvetica", "normal");
            docPdf.setTextColor(...PDF_THEME.textSec);
            const desc = docPdf.splitTextToSize(course.descricao, col1W);
            docPdf.text(desc, col1X, contentY);
            contentY += (desc.length * 3.5) + 8;
        }

        docPdf.setFont("helvetica", "bold");
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text("MÓDULOS:", col1X, contentY);
        contentY += 6;
        
        modules.forEach((m, i) => {
            docPdf.setFont("helvetica", "normal");
            docPdf.setTextColor(40,40,40);
            const mTitle = `${i+1}. ${m.title}`;
            const splitM = docPdf.splitTextToSize(mTitle, col1W);
            docPdf.text(splitM, col1X, contentY);
            contentY += (splitM.length * 4) + 1;
        });

        // COLUMN 2: TRANSCRIPT TABLE
        // Using autoTable for the transcript
        const tableBody = modules.map((m) => [
            safeText(m.title), 
            "20h", 
            "10.0", 
            "100%", 
            "APROVADO"
        ]);

        autoTable(docPdf, {
            startY: 35,
            margin: { left: col2X },
            tableWidth: col2W,
            head: [["Disciplina", "C.H.", "Nota", "Freq.", "Situação"]],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: PDF_THEME.textMain as any, fontSize: 8, fontStyle: 'bold' },
            styles: { fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
            columnStyles: {
                0: { cellWidth: 'auto' },
                1: { cellWidth: 10, halign: 'center' },
                2: { cellWidth: 10, halign: 'center' },
                3: { cellWidth: 10, halign: 'center' },
                4: { cellWidth: 20, halign: 'center' }
            }
        });

        // Draw Footer on Back Page too (Simplified)
        const bottomSafeLimit = h - 5 - 2; 
        docPdf.setFont("times", "bold");
        docPdf.setFontSize(9);
        docPdf.setTextColor(...PDF_THEME.textMain);
        docPdf.text(safeText(schoolConfig.schoolName || "ESCOLA BÍBLICA EAD").toUpperCase(), w / 2, bottomSafeLimit - 5, { align: "center" });
        
        // QR Code small on back
        try { docPdf.addImage(qrCodeDataUrl, "PNG", 20, h - 25, 15, 15); } catch {}
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(7);
        docPdf.text(`Autenticidade: ${code}`, 38, h - 18);
    }

    // --- SAVE ---
    const pdfBlob = docPdf.output('blob');
    const dataUri = docPdf.output('datauristring');
    const base64 = dataUriToBase64(dataUri);
    
    // Open in new tab
    const localUrl = URL.createObjectURL(pdfBlob);
    window.open(localUrl, '_blank');

    // Upload
    const cleanTitle = safeName(`${docTitle}-${student.displayName}.pdf`);
    const storagePath = `secretaria_docs/${student.uid}/${code}-${cleanTitle}`;
    let uploadResult: any = { ok: false, url: "", storagePath: null, fallbackReason: "forced_base64" };
    try { uploadResult = await uploadBlobToStorage(pdfBlob, storagePath, 'application/pdf'); } catch(e) { uploadResult = {ok:false}; }

    // Firestore Record
    const docRef = await addDoc(collection(db, 'secretaria_arquivos'), {
      name: `${docTitle} - ${student.displayName}.pdf`,
      type: 'file', mimeType: 'application/pdf',
      url: dataUri, // FORCE BASE64 as reliable source
      base64Chunked: false, 
      storagePath: uploadResult.ok ? uploadResult.storagePath : null,
      studentId: student.uid, 
      docType: docType, 
      createdAt: serverTimestamp(),
      createdBy: issuerId,
      docData: { 
          code, 
          title: docTitle, 
          date: new Date().toISOString(), 
          student: { 
              displayName: student.displayName, 
              cpf: student.cpf, 
              academicId: student.academicId 
          },
          courseData: { nome: course.nome },
          modulesData: modules.map(m => ({ title: m.title }))
      }
    });

    if (base64.length > 900_000) {
      const chunks = splitIntoChunks(base64, 800_000);
      await updateDoc(doc(db, "secretaria_arquivos", docRef.id), { url: null, base64Chunked: true, chunksCount: chunks.length });
      for (let i = 0; i < chunks.length; i++) { await setDoc(doc(db, "secretaria_arquivos", docRef.id, "chunks", String(i)), { index: i, data: chunks[i] }); }
    }

    return true;

  } catch (e: any) {
    console.error("Certificate Generation Error:", e);
    alert("Erro na geração do documento: " + e.message);
    return false;
  }
};
