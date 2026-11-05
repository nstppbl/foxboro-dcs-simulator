import { create } from 'zustand'

export type View = 'architecture' | 'control' | 'engineering' | 'operator' | 'faults' | 'curriculum'

interface NavState {
  view: View
  go: (v: View) => void
}

export const useNav = create<NavState>()((set) => ({
  view: 'architecture',
  go: (view) => set({ view }),
}))
