import {
  Braces, FileArchive, FileCode2, FileCog, FileImage, FileJson2, FileLock2, FileSpreadsheet,
  FileTerminal, FileText, FileType2, Film, Music, Package, type LucideIcon,
} from 'lucide-react'

const byExt: Record<string, LucideIcon> = {
  // code
  ts: FileCode2, tsx: FileCode2, js: FileCode2, jsx: FileCode2, mjs: FileCode2, cjs: FileCode2,
  go: FileCode2, rs: FileCode2, py: FileCode2, rb: FileCode2, java: FileCode2, kt: FileCode2, kts: FileCode2,
  swift: FileCode2, c: FileCode2, h: FileCode2, cc: FileCode2, cpp: FileCode2, hpp: FileCode2, cs: FileCode2,
  php: FileCode2, scala: FileCode2, dart: FileCode2, lua: FileCode2, ex: FileCode2, exs: FileCode2, erl: FileCode2,
  hs: FileCode2, clj: FileCode2, el: FileCode2, vue: FileCode2, svelte: FileCode2, astro: FileCode2,
  html: FileCode2, htm: FileCode2, css: Braces, scss: Braces, sass: Braces, less: Braces, sql: FileCode2,
  // data / config
  json: FileJson2, jsonc: FileJson2, json5: FileJson2,
  yml: FileCog, yaml: FileCog, toml: FileCog, ini: FileCog, cfg: FileCog, conf: FileCog, env: FileCog,
  properties: FileCog, plist: FileCog, xml: FileCode2, gradle: FileCog, editorconfig: FileCog,
  csv: FileSpreadsheet, tsv: FileSpreadsheet, xlsx: FileSpreadsheet,
  // text
  md: FileText, mdx: FileText, txt: FileText, rst: FileText, adoc: FileText, log: FileText, pdf: FileType2,
  // shell
  sh: FileTerminal, bash: FileTerminal, zsh: FileTerminal, fish: FileTerminal, ps1: FileTerminal, bat: FileTerminal,
  // media
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, svg: FileImage, webp: FileImage, ico: FileImage, icns: FileImage,
  mp4: Film, mov: Film, webm: Film, mp3: Music, wav: Music, ogg: Music,
  zip: FileArchive, gz: FileArchive, tar: FileArchive, tgz: FileArchive, jar: FileArchive, bundle: FileArchive,
  lock: FileLock2,
}

const byName: Record<string, LucideIcon> = {
  dockerfile: FileTerminal, makefile: FileTerminal, 'package.json': Package, 'go.mod': Package, 'go.sum': FileLock2,
  'cargo.toml': Package, 'cargo.lock': FileLock2, 'package-lock.json': FileLock2, 'yarn.lock': FileLock2,
  'pnpm-lock.yaml': FileLock2, 'bun.lock': FileLock2, 'bun.lockb': FileLock2, 'gemfile': Package, 'gemfile.lock': FileLock2,
  '.gitignore': FileCog, '.gitattributes': FileCog, '.editorconfig': FileCog, '.env': FileCog, 'license': FileText, 'readme': FileText,
}

/** Picks a lucide glyph for a path. Always returns something. */
export function iconFor(path: string): LucideIcon {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  if (byName[name]) return byName[name]
  if (name.endsWith('.lock')) return FileLock2
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1) : ''
  return byExt[ext] ?? FileText
}
