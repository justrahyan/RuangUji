import type { ResearchProfile, DefenseSession, HistoryItem } from '../types';

export const LATEST_RESEARCH_KEY = 'ruanguji_latest_research';
export const ACTIVE_SESSION_KEY = 'ruanguji_active_session';
export const HISTORY_KEY = 'ruanguji_history';

// --- Research ---
export function saveLatestResearch(research: ResearchProfile): void {
  try {
    localStorage.setItem(LATEST_RESEARCH_KEY, JSON.stringify(research));
  } catch (err) {
    console.error('Failed to save research', err);
  }
}

export function getLatestResearch(): ResearchProfile | null {
  try {
    const data = localStorage.getItem(LATEST_RESEARCH_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to parse research', err);
    return null;
  }
}

export function clearLatestResearch(): void {
  localStorage.removeItem(LATEST_RESEARCH_KEY);
}

// --- Active Session ---
export function saveActiveSession(session: DefenseSession): void {
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.error('Failed to save session', err);
  }
}

export function getActiveSession(): DefenseSession | null {
  try {
    const data = localStorage.getItem(ACTIVE_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.error('Failed to parse session', err);
    return null;
  }
}

export function clearActiveSession(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}

// --- History ---
export function getHistory(): HistoryItem[] {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to parse history', err);
    return [];
  }
}

export function saveHistoryItem(item: HistoryItem): void {
  try {
    const history = getHistory();
    history.unshift(item); // Add to beginning
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (err) {
    console.error('Failed to save history item', err);
  }
}

export function deleteHistoryItem(id: string): void {
  try {
    const history = getHistory();
    const updated = history.filter(item => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to delete history item', err);
  }
}

export function clearHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}
