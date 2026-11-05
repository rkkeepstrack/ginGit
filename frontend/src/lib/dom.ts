export const focus = (selector: string) => (document.querySelector(selector) as HTMLElement | null)?.focus()

/** Focuses an input with its text selected, so typing replaces it. */
export const focusSelected = (selector: string) => (document.querySelector(selector) as HTMLInputElement | null)?.select()

/** daisyUI dropdowns open on focus; blurring the trigger closes them. */
export const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur()
