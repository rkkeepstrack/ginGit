export const focus = (selector: string) => (document.querySelector(selector) as HTMLElement | null)?.focus()

/** daisyUI dropdowns open on focus; blurring the trigger closes them. */
export const closeDropdown = () => (document.activeElement as HTMLElement | null)?.blur()
