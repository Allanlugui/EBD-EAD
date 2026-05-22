
export type TicketStatus =
  | "Pendente"
  | "Ativo"
  | "Encaminhado"
  | "Resolvido"
  | "Finalizado"
  | "Arquivado"
  | "Em Atendimento";

export interface Ticket {
  id: string;
  protocolo?: string;
  user?: string;
  senderId?: string;
  status: TicketStatus;
  lastMessage?: string;
  createdAt?: any;
  updatedAt?: any;
  specialistJoined?: boolean;
}

export interface TicketMessage {
  id: string;
  text: string;
  sender: "Aluno" | "Secretaria" | "Sistema";
  isBot?: boolean;
  options?: string[];
  createdAt?: any;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentMimeType?: string;
  attachmentStoragePath?: string;
}

export type FileItemType = "folder" | "file";

export interface FileItem {
  id: string;
  name: string;
  type: FileItemType;
  parentId: string;
  mimeType?: string;
  url?: string; // downloadURL
  storagePath?: string; // caminho no Storage (pra deletar)
  size?: number;
  createdAt?: any;
  createdBy?: string;
  updatedAt?: any;
  studentId?: string;
  docType?: string;
  docData?: any;
}

export interface StudentUser {
  uid: string;
  role: string;
  displayName?: string;
  email?: string;
  cpf?: string;
  academicId?: string;
  cursoInicial?: string;
  status?: string;
}
