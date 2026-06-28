export interface QuestionSection {
  id: string;
  type: 'NAT' | 'MSQ' | 'MCQ';
  count: number;
  startQ: number;
}

export type AnswerKeyValue = string | string[] | string[][];
export type AnswerKeyMap = Record<string, Record<string, AnswerKeyValue>>;

export function parseRange(valStr: string): [number, number] | null {
  const clean = valStr.toLowerCase().replace(/\s+/g, '');
  
  // Match range like "6to6.5", "-470to-480" or "470-480"
  const match = clean.match(/^(-?[0-9.]+)(?:to|-)(-?[0-9.]+)$/);
  if (match) {
    const min = parseFloat(match[1]);
    const max = parseFloat(match[2]);
    return isNaN(min) || isNaN(max) ? null : [min, max];
  }
  
  // Match single value
  const val = parseFloat(clean);
  return isNaN(val) ? null : [val, val];
}

export function evaluateNat(userAns: string, officialAns: string): boolean {
  if (!userAns || !officialAns) return false;
  
  const userVal = parseFloat(userAns.trim());
  if (isNaN(userVal)) return false;
  
  const range = parseRange(officialAns);
  if (!range) return false;
  
  const [min, max] = range;
  return userVal >= min && userVal <= max;
}

export function evaluateMsq(userOpts: string[], officialOpts: string[]): { isCorrect: boolean; marks: number } {
  if (!userOpts || userOpts.length === 0) return { isCorrect: false, marks: 0 };
  if (!officialOpts || officialOpts.length === 0) return { isCorrect: false, marks: 0 };
  
  // Sort for comparison
  const userSet = new Set(userOpts.map(o => o.toUpperCase()));
  const officialSet = new Set(officialOpts.map(o => o.toUpperCase()));
  
  // Check if user selected any option that is not in official set
  let hasIncorrect = false;
  for (const opt of userSet) {
    if (!officialSet.has(opt)) {
      hasIncorrect = true;
      break;
    }
  }
  
  if (hasIncorrect) {
    return { isCorrect: false, marks: -1 }; // Negative marking
  }
  
  // User selected only correct options
  if (userSet.size === officialSet.size) {
    return { isCorrect: true, marks: 4 }; // All correct
  }
  
  // Partial marks award logic:
  // +3: 3 correct selected out of 4 correct
  // +2: 2 correct selected out of 3 or 4 correct
  // +1: 1 correct selected out of 2, 3, or 4 correct
  const k = userSet.size;
  const N = officialSet.size;
  
  if (k === 3 && N === 4) return { isCorrect: false, marks: 3 };
  if (k === 2 && (N === 3 || N === 4)) return { isCorrect: false, marks: 2 };
  if (k === 1 && (N === 2 || N === 3 || N === 4)) return { isCorrect: false, marks: 1 };
  
  return { isCorrect: false, marks: 0 };
}

export function evaluateMcq(userAns: string, officialAns: string, examType: 'CEED' | 'UCEED'): { isCorrect: boolean; marks: number } {
  if (!userAns) return { isCorrect: false, marks: 0 };
  if (!officialAns) return { isCorrect: false, marks: 0 };
  
  const userClean = userAns.trim().toUpperCase();
  const officialClean = officialAns.trim().toUpperCase();
  
  if (officialClean === 'DROPPED') {
    return { isCorrect: true, marks: 3 }; // Awarded to all
  }
  
  if (userClean === officialClean) {
    return { isCorrect: true, marks: 3 };
  } else {
    const penalty = examType === 'CEED' ? -0.5 : -0.71;
    return { isCorrect: false, marks: penalty };
  }
}

export function calculateScore(
  answers: { [questionId: string]: string | string[] },
  sections: QuestionSection[],
  keys: AnswerKeyMap | null,
  examType: 'CEED' | 'UCEED'
): { score: number | null; totalMarks: number; totalAnswered: number; totalQuestions: number } {
  let totalAnswered = 0;
  let totalQuestions = 0;
  let totalMarks = 0;
  
  // Max possible marks calculation:
  // CEED: 8 NAT * 4 = 32, 10 MSQ * 4 = 40, 26 MCQ * 3 = 78. Total = 150.
  // UCEED: 14 NAT * 4 = 56, 15 MSQ * 4 = 60, 28 MCQ * 3 = 84. Total = 200.
  sections.forEach(sec => {
    totalQuestions += sec.count;
    if (sec.type === 'NAT') totalMarks += sec.count * 4;
    else if (sec.type === 'MSQ') totalMarks += sec.count * 4;
    else if (sec.type === 'MCQ') totalMarks += sec.count * 3;
  });

  // If answer keys are not available, score cannot be calculated
  if (!keys) {
    // Just count how many answered
    Object.keys(answers).forEach(qid => {
      const ans = answers[qid];
      if (ans && (typeof ans === 'string' ? ans.trim() !== '' : ans.length > 0)) {
        totalAnswered++;
      }
    });
    return { score: null, totalMarks, totalAnswered, totalQuestions };
  }

  let calculatedScore = 0;
  
  sections.forEach(sec => {
    const secKeys = keys[sec.type] || {};
    
    for (let i = 0; i < sec.count; i++) {
      const qNum = sec.startQ + i;
      const qid = String(qNum);
      const userAns = answers[qid];
      const correctAns = secKeys[qid];
      
      const isAttempted = userAns && (typeof userAns === 'string' ? userAns.trim() !== '' : userAns.length > 0);
      if (isAttempted) {
        totalAnswered++;
      }
      
      if (!correctAns) continue; // Key missing for this question

      if (sec.type === 'NAT') {
        const userStr = typeof userAns === 'string' ? userAns : '';
        const isCorrect = evaluateNat(userStr, String(correctAns));
        if (isCorrect) {
          calculatedScore += 4;
        }
      } else if (sec.type === 'MSQ') {
        const userOpts = Array.isArray(userAns) ? userAns : [];
        // MSQ key can be a simple array of strings e.g. ["A", "B"] 
        // or a list of multiple accepted arrays e.g. [["B", "C"], ["B", "C", "D"]]
        let bestScore = -1;
        
        if (Array.isArray(correctAns) && Array.isArray(correctAns[0])) {
          // List of arrays (multiple accepted answer key sets)
          (correctAns as string[][]).forEach(keyOption => {
            const res = evaluateMsq(userOpts, keyOption);
            if (res.marks > bestScore) {
              bestScore = res.marks;
            }
          });
        } else if (Array.isArray(correctAns)) {
          // Single accepted answer key array
          const res = evaluateMsq(userOpts, correctAns as string[]);
          bestScore = res.marks;
        }
        
        if (bestScore > -1) {
          calculatedScore += bestScore;
        }
      } else if (sec.type === 'MCQ') {
        const userStr = typeof userAns === 'string' ? userAns : '';
        const res = evaluateMcq(userStr, String(correctAns), examType);
        calculatedScore += res.marks;
      }
    }
  });

  return { 
    score: Math.max(calculatedScore, -50), // Let's cap minimum score at a reasonable value or allow negative
    totalMarks, 
    totalAnswered, 
    totalQuestions 
  };
}
