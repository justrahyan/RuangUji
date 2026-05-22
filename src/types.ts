export type ExaminerMode =
  | 'santai'
  | 'kritis'
  | 'killer'
  | 'metodologi'
  | 'statistik'
  | 'novelty'
  | 'implementasi';

export type SessionLength = 'cepat' | 'normal' | 'intensif';

export interface TrainingUsageStatus {
  ok: boolean;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
  windowHours: number;
  blocked: boolean;
  error?: string;
  message?: string;
}

export interface ResearchProfile {
  id: string;
  title: string;
  sessionType: string;
  field: string;
  keywords?: string;
  researchApproach: string;
  method: string;
  abstract: string;
  concern: string;
  documentText?: string;
  documentPreview?: string;
  documentName?: string;
  documentSize?: number;
  docId?: string;
  examinerMode: ExaminerMode;
  sessionLength: SessionLength;
  questionCount: number;
  createdAt: string;
}

export interface TranscriptItem {
  id: string;
  type: 'question' | 'answer' | 'feedback' | 'system';
  content: string;
  questionId?: string;
  questionText?: string;
  answerText?: string;
  feedback?: string;
  speechText?: string;
  normalizedAnswer?: string;
  score?: number;
  createdAt: string;
  timestamp?: string;
}

export interface AnswerEvaluation {
  score: number;
  strengths: string[];
  weaknesses: string[];
  suggestion: string;
  improvedAnswer?: string;
  speechText?: string;
  normalizedAnswer?: string;
  answerCategory?: string;
}

export interface QuestionBankItem {
  index: number;
  question: string;
  speechText?: string;
  category: string;
  provider?: string;
  modelUsed?: string;
  fallbackReason?: string;
  quotaMode?: boolean;
}

export interface DefenseSession {
  id: string;
  research: ResearchProfile;
  transcript: TranscriptItem[];
  currentQuestionIndex: number;
  score: number;
  status: 'active' | 'finished';
  createdAt: string;
  finishedAt?: string;
  questionBank?: QuestionBankItem[];
  quotaMode?: boolean;
  quotaModeReason?: string;
}

export interface HistoryItem {
  id: string;
  title: string;
  examinerMode: ExaminerMode;
  score: number;
  questionCount: number;
  createdAt: string;
  summary?: string;
  sessionType?: string;
  field?: string;
  method?: string;
  sessionLength?: string;
  transcript?: TranscriptItem[];
  strengths?: string[];
  weaknesses?: string[];
  nextPractice?: string[];
}
