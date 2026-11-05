import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DAY = 86_400_000
/** Leitner boxes: a wrong answer comes back after 1 day, then 3, then 7; after that it is learned. */
export const SRS_DAYS = [1, 3, 7]

export interface SrsItem {
  box: number
  due: number
}

interface TheoryState {
  lesson?: string
  read: Record<string, number>
  quizBest: Record<string, number>
  examBest: Record<string, number>
  interviewBest: Record<string, number>
  srs: Record<string, SrsItem>
  open: (lessonId: string) => void
  markRead: (lessonId: string) => void
  quizDone: (key: string, pct: number, kind: 'quiz' | 'exam') => void
  interviewDone: (id: string, pct: number) => void
  /** record one answer for spaced repetition */
  answer: (qid: string, ok: boolean, now?: number) => void
  reset: () => void
}

export const useTheory = create<TheoryState>()(
  persist(
    (set) => ({
      read: {},
      quizBest: {},
      examBest: {},
      interviewBest: {},
      srs: {},
      open: (lesson) => set({ lesson }),
      markRead: (id) => set((s) => ({ read: { ...s.read, [id]: Date.now() } })),
      quizDone: (key, pct, kind) =>
        set((s) => (kind === 'quiz' ? { quizBest: { ...s.quizBest, [key]: Math.max(pct, s.quizBest[key] ?? 0) } } : { examBest: { ...s.examBest, [key]: Math.max(pct, s.examBest[key] ?? 0) } })),
      interviewDone: (id, pct) => set((s) => ({ interviewBest: { ...s.interviewBest, [id]: Math.max(pct, s.interviewBest[id] ?? 0) } })),
      answer: (qid, ok, now = Date.now()) => set((s) => ({ srs: srsNext(s.srs, qid, ok, now) })),
      reset: () => set({ read: {}, quizBest: {}, examBest: {}, interviewBest: {}, srs: {} }),
    }),
    { name: 'fox.theory.v1', partialize: (s) => ({ lesson: s.lesson, read: s.read, quizBest: s.quizBest, examBest: s.examBest, interviewBest: s.interviewBest, srs: s.srs }) },
  ),
)

/** Wrong → box 0, due in 1 day. Right while in the queue → next box; past the last box → removed (learned). */
export function srsNext(srs: Record<string, SrsItem>, qid: string, ok: boolean, now: number): Record<string, SrsItem> {
  const cur = srs[qid]
  const next = { ...srs }
  if (!ok) next[qid] = { box: 0, due: now + SRS_DAYS[0] * DAY }
  else if (cur) {
    if (now < cur.due) return srs // answered early (e.g. in a lesson quiz): keep the schedule
    const box = cur.box + 1
    if (box >= SRS_DAYS.length) delete next[qid]
    else next[qid] = { box, due: now + SRS_DAYS[box] * DAY }
  }
  return next
}

export const dueIds = (srs: Record<string, SrsItem>, now = Date.now()) =>
  Object.entries(srs)
    .filter(([, v]) => v.due <= now)
    .map(([k]) => k)
