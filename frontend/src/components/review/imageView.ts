import { createContext } from 'svelte'

/** Where an ImagePair is shown: in the review a click enlarges it, in the viewer it fills the window. */
export interface ImageView {
  enlarge?: (path: string) => void
  fill?: boolean
}

export const [getImageView, setImageView, hasImageView] = createContext<ImageView>()
