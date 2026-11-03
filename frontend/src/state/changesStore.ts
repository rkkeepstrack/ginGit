import { create } from 'zustand'
import type { ChangeSet } from '../lib/types'

/** The current consolidated change set and the file order the tree shows. */
interface ChangesState {
  changeSet: ChangeSet | null
  paths: string[]
  set: (changeSet: ChangeSet | null, paths: string[]) => void
}

export const useChanges = create<ChangesState>()((set) => ({
  changeSet: null,
  paths: [],
  set: (changeSet, paths) => set({ changeSet, paths }),
}))
