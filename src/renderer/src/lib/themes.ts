import { themeById, type Theme } from '@shared/themes'
export { THEMES, themeById } from '@shared/themes'
export type { Theme, TerminalColors } from '@shared/themes'

/** Push a theme's variables onto :root. styles.css keeps matching fallbacks. */
export function applyTheme(id: string): Theme {
  const theme = themeById(id)
  const root = document.documentElement
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v)
  root.dataset.theme = theme.id
  root.style.colorScheme = theme.id === 'paper' ? 'light' : 'dark'
  return theme
}
