// Theme: follow the system until the toggle is used, then remember the choice.
const root = document.documentElement
const themeButton = document.getElementById('theme')
const stored = localStorage.getItem('gingit-site-theme')
if (stored) root.dataset.theme = stored

function currentTheme() {
  return root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
}

// Screenshots and the logo have a light and a dark version. The <source>
// follows the OS; once the toggle is used it must step aside and the script picks.
function applyShot() {
  const dark = currentTheme() === 'dark'
  for (const img of document.querySelectorAll('img[data-light]')) {
    const src = dark ? img.dataset.dark : img.dataset.light
    img.src = src
    if (img.srcset) img.srcset = `${src} 1x, ${src.replace('.webp', '@2x.webp')} 2x`
    if (root.dataset.theme) img.previousElementSibling.media = 'not all'
  }
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

// Screenshot slider: scroll-snap does the moving, this keeps the dots honest.
const slides = document.getElementById('slides')
const figures = [...slides.children]
const dots = [...document.querySelectorAll('.dot')]
const step = () => figures[1].offsetLeft - figures[0].offsetLeft
const current = () => Math.round(slides.scrollLeft / step())
const go = (i) => slides.scrollTo({ left: ((i + figures.length) % figures.length) * step(), behavior: 'smooth' })
dots.forEach((dot, i) => dot.addEventListener('click', () => go(i)))
for (const button of document.querySelectorAll('[data-step]')) button.addEventListener('click', () => go(current() + Number(button.dataset.step)))
slides.addEventListener('scroll', () => { const c = current(); dots.forEach((dot, i) => dot.classList.toggle('active', i === c)) }, { passive: true })
