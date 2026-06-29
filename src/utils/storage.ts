import localforage from 'localforage';

// Configure localForage
localforage.config({
  name: 'DesignPrepCanvas',
  storeName: 'workspace_state',
  description: 'Persists user session state, drawings, and OMR inputs'
});

export interface Point {
  x: number; // percentage of width (0 to 1)
  y: number; // percentage of height (0 to 1)
}

export interface Stroke {
  points: Point[];
  color: string;
  width: number;
}

export interface UserSessionState {
  answers: { [questionId: string]: string | string[] };
  verifiedSections: string[];
  pageNumber: number;
}

// Storage Keys
const ANSWERS_KEY_PREFIX = 'answers_';
const VERIFIED_SECTIONS_KEY_PREFIX = 'verified_';
const DRAWING_KEY_PREFIX = 'drawing_';
const PAGE_KEY_PREFIX = 'page_';
const ACTIVE_PAPER_KEY = 'active_paper_id';
const QUESTION_TIMES_KEY_PREFIX = 'qtimes_';

export const storage = {
  // Active Paper
  async getActivePaperId(): Promise<string | null> {
    return localforage.getItem<string>(ACTIVE_PAPER_KEY);
  },
  async setActivePaperId(paperId: string): Promise<string> {
    return localforage.setItem(ACTIVE_PAPER_KEY, paperId);
  },

  // Answers State
  async getAnswers(paperId: string): Promise<{ [questionId: string]: string | string[] }> {
    const data = await localforage.getItem<{ [questionId: string]: string | string[] }>(ANSWERS_KEY_PREFIX + paperId);
    return data || {};
  },
  async saveAnswers(paperId: string, answers: { [questionId: string]: string | string[] }): Promise<void> {
    await localforage.setItem(ANSWERS_KEY_PREFIX + paperId, answers);
  },
  async saveAnswer(paperId: string, questionId: string, value: string | string[]): Promise<void> {
    const answers = await this.getAnswers(paperId);
    answers[questionId] = value;
    await this.saveAnswers(paperId, answers);
  },

  // Verified Sections (OMR submitted status)
  async getVerifiedSections(paperId: string): Promise<string[]> {
    const data = await localforage.getItem<string[]>(VERIFIED_SECTIONS_KEY_PREFIX + paperId);
    return data || [];
  },
  async saveVerifiedSections(paperId: string, sections: string[]): Promise<void> {
    await localforage.setItem(VERIFIED_SECTIONS_KEY_PREFIX + paperId, sections);
  },

  // Page Navigation
  async getPageNumber(paperId: string): Promise<number> {
    const val = await localforage.getItem<number>(PAGE_KEY_PREFIX + paperId);
    return val || 1;
  },
  async savePageNumber(paperId: string, pageNumber: number): Promise<void> {
    await localforage.setItem(PAGE_KEY_PREFIX + paperId, pageNumber);
  },

  // Drawing Canvas Strokes
  async getDrawingStrokes(paperId: string, pageNumber: number): Promise<Stroke[]> {
    const data = await localforage.getItem<Stroke[]>(`${DRAWING_KEY_PREFIX}${paperId}_page_${pageNumber}`);
    return data || [];
  },
  async saveDrawingStrokes(paperId: string, pageNumber: number, strokes: Stroke[]): Promise<void> {
    await localforage.setItem(`${DRAWING_KEY_PREFIX}${paperId}_page_${pageNumber}`, strokes);
  },
  async clearDrawingStrokes(paperId: string, pageNumber: number): Promise<void> {
    await localforage.removeItem(`${DRAWING_KEY_PREFIX}${paperId}_page_${pageNumber}`);
  },

  // Question Times (elapsed time spent per question)
  async getQuestionTimes(paperId: string): Promise<{ [questionId: string]: number }> {
    const data = await localforage.getItem<{ [questionId: string]: number }>(QUESTION_TIMES_KEY_PREFIX + paperId);
    return data || {};
  },
  async saveQuestionTimes(paperId: string, times: { [questionId: string]: number }): Promise<void> {
    await localforage.setItem(QUESTION_TIMES_KEY_PREFIX + paperId, times);
  },

  // Submission Status
  async getSubmitted(paperId: string): Promise<boolean> {
    const val = await localforage.getItem<boolean>('submitted_' + paperId);
    return val || false;
  },
  async saveSubmitted(paperId: string, submitted: boolean): Promise<void> {
    await localforage.setItem('submitted_' + paperId, submitted);
  },

  // Flagged Questions
  async getFlaggedQuestions(paperId: string): Promise<string[]> {
    const data = await localforage.getItem<string[]>('flagged_' + paperId);
    return data || [];
  },
  async saveFlaggedQuestions(paperId: string, flagged: string[]): Promise<void> {
    await localforage.setItem('flagged_' + paperId, flagged);
  },

  // Reset Session
  async resetSession(paperId: string): Promise<void> {
    await localforage.removeItem(ANSWERS_KEY_PREFIX + paperId);
    await localforage.removeItem(VERIFIED_SECTIONS_KEY_PREFIX + paperId);
    await localforage.removeItem(PAGE_KEY_PREFIX + paperId);
    await localforage.removeItem(QUESTION_TIMES_KEY_PREFIX + paperId);
    await localforage.removeItem('submitted_' + paperId);
    await localforage.removeItem('flagged_' + paperId);
    
    // Clear all drawing keys for this paper
    const keys = await localforage.keys();
    const paperDrawPrefix = `${DRAWING_KEY_PREFIX}${paperId}_page_`;
    for (const key of keys) {
      if (key.startsWith(paperDrawPrefix)) {
        await localforage.removeItem(key);
      }
    }
  }
};
