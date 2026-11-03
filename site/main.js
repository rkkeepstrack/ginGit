// Theme: follow the system until the toggle is used, then remember the choice.
const root = document.documentElement
const themeButton = document.getElementById('theme')
const stored = localStorage.getItem('gingit-site-theme')
if (stored) root.dataset.theme = stored

function currentTheme() {
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

function applyShot() {
  const dark = currentTheme() === 'dark'
  const shot = document.getElementById('shot')
  const source = document.getElementById('shot-dark')
  shot.src = dark ? 'img/review-dark.png' : 'img/review-light.png'
  // The <source> only switches with the OS; once the toggle is used it must step aside.
  if (root.dataset.theme) source.media = 'not all'
}

themeButton.addEventListener('click', () => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark'
  root.dataset.theme = next
  localStorage.setItem('gingit-site-theme', next)
  applyShot()
})
applyShot()

// Copy the build commands.
for (const button of document.querySelectorAll('.copy')) {
  button.addEventListener('click', async () => {
    const text = document.getElementById(button.dataset.copy).textContent
    try {
      await navigator.clipboard.writeText(text)
      button.textContent = 'Copied'
      setTimeout(() => (button.textContent = 'Copy'), 1500)
    } catch {
      button.textContent = 'Select and copy'
    }
  })
}

// Latest release, if there is one; the page works without it.
fetch('https://api.github.com/repos/rkkeepstrack/ginGit/releases/latest')
  .then((r) => (r.ok ? r.json() : null))
  .then((release) => {
    if (!release) return
    const mac = (release.assets || []).find((a) => a.name.includes('macos'))
    if (mac) document.getElementById('download').href = mac.browser_download_url
    document.getElementById('version').textContent = `Latest release ${release.tag_name}`
  })
  .catch(() => {})
