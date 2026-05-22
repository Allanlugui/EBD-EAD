
import React from 'react';

export type UserRole = 'diretor' | 'professor' | 'aluno';

export interface User {
  uid: string;
  email: string | null;
  displayName: string;
  role: UserRole;
  photoURL?: string;
  signatureUrl?: string;
  // Added to fix type errors and support admin/login sync
  status?: string;
  password?: string;
  // Progress tracking: { [courseId]: { [itemId]: { completed: boolean, score?: number } } }
  progress?: Record<string, Record<string, { completed: boolean, score?: number }>>; 
  matriculas?: string[]; // Array of course IDs
  academicId?: string;
  cursoInicial?: string;
  termsAccepted?: boolean;
  endereco?: any;
  telefone?: string;
  cpf?: string;
  nascimento?: string;
  emailPessoal?: string;
}

export interface ScheduledClass {
  id: string;
  courseId: string;
  professorId: string;
  title: string;
  description: string;
  date: any;
  status: 'scheduled' | 'live' | 'finished';
  createdAt: any;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  date: any;
  type: 'class_scheduled' | 'system';
  read: boolean;
  archived: boolean;
  calendarData?: any;
}

export interface Lesson {
  id: string;
  title: string;
  description?: string;
  videoUrl: string;
  materialUrl?: string;
  order: number;
}

export interface Module {
  id: string;
  courseId: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

export interface Course {
  id: string;
  nome: string;
  descricao?: string;
  tema: string;
  categoria: string;
  nivelDificuldade: 'Iniciante' | 'Intermediário' | 'Avançado';
  professorResponsavel: string;
  professorId: string;
  capaUrl: string;
  inscritos: number;
  status: 'ativo' | 'rascunho';
  createdAt: any;
  // Added missing properties identified in views/ProfessorView.tsx
  biografiaDocente?: string;
  fotoDocenteUrl?: string;
  materialApoioUrl?: string;
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctOption: number;
}

export interface Exam {
  id: string;
  title: string;
  courseId: string;
  moduleId: string;
  type: 'activity' | 'evaluation';
  passingGrade: number;
  questions: Question[];
  authorId?: string;
}

export interface Material {
  id: string;
  courseId: string;
  title: string;
  type: 'pdf' | 'video' | 'link' | 'drive';
  url: string;
}

export interface Feedback {
  id: string;
  userId: string;
  courseId: string;
  rating: number;
  comment: string;
  type: 'elogio' | 'sugestao' | 'reclamacao';
  userName?: string;
}

export type MainView = 'dashboard' | 'professor' | 'alunos' | 'secretaria' | 'configuracoes';

export type ProfessorSubView = 
  | 'cursos' 
  | 'modulos' 
  | 'materiais' 
  | 'avaliacao' 
  | 'feedback' 
  | 'diario' 
  | 'relatorio' 
  | 'frequencia' 
  | 'live';
