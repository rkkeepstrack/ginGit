import AudioLines from '@lucide/svelte/icons/audio-lines'
import Braces from '@lucide/svelte/icons/braces'
import FileArchive from '@lucide/svelte/icons/file-archive'
import FileCode from '@lucide/svelte/icons/file-code'
import FileCog from '@lucide/svelte/icons/file-cog'
import FileImage from '@lucide/svelte/icons/file-image'
import FileLock from '@lucide/svelte/icons/file-lock'
import FileSpreadsheet from '@lucide/svelte/icons/file-spreadsheet'
import FileTerminal from '@lucide/svelte/icons/file-terminal'
import FileText from '@lucide/svelte/icons/file-text'
import FileType from '@lucide/svelte/icons/file-type'
import Film from '@lucide/svelte/icons/film'
import Package from '@lucide/svelte/icons/package'
import type { Component } from 'svelte'

export type Icon = Component<{ size?: number | string; strokeWidth?: number | string; class?: string }>
export type FileCategory = 'code' | 'style' | 'data' | 'text' | 'shell' | 'media' | 'lock'

const byExt: Record<string, Icon> = {
  // code
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode, mjs: FileCode, cjs: FileCode,
  go: FileCode, rs: FileCode, py: FileCode, rb: FileCode, java: FileCode, kt: FileCode, kts: FileCode,
  swift: FileCode, c: FileCode, h: FileCode, cc: FileCode, cpp: FileCode, hpp: FileCode, cs: FileCode,
  php: FileCode, scala: FileCode, dart: FileCode, lua: FileCode, ex: FileCode, exs: FileCode, erl: FileCode,
  hs: FileCode, clj: FileCode, el: FileCode, vue: FileCode, svelte: FileCode, astro: FileCode,
  html: FileCode, htm: FileCode, css: Braces, scss: Braces, sass: Braces, less: Braces, sql: FileCode,
  // data / config
  json: Braces, jsonc: Braces, json5: Braces,
  yml: FileCog, yaml: FileCog, toml: FileCog, ini: FileCog, cfg: FileCog, conf: FileCog, env: FileCog,
  properties: FileCog, plist: FileCog, xml: FileCode, gradle: FileCog, editorconfig: FileCog,
  csv: FileSpreadsheet, tsv: FileSpreadsheet, xlsx: FileSpreadsheet,
  // text
  md: FileText, mdx: FileText, txt: FileText, rst: FileText, adoc: FileText, log: FileText, pdf: FileType,
  // shell
  sh: FileTerminal, bash: FileTerminal, zsh: FileTerminal, fish: FileTerminal, ps1: FileTerminal, bat: FileTerminal,
  // media
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, svg: FileImage, webp: FileImage, ico: FileImage, icns: FileImage,
  mp4: Film, mov: Film, webm: Film, mp3: AudioLines, wav: AudioLines, ogg: AudioLines,
  zip: FileArchive, gz: FileArchive, tar: FileArchive, tgz: FileArchive, jar: FileArchive, bundle: FileArchive,
  lock: FileLock,
}

const byName: Record<string, Icon> = {
  dockerfile: FileTerminal, makefile: FileTerminal, 'package.json': Package, 'go.mod': Package, 'go.sum': FileLock,
  'cargo.toml': Package, 'cargo.lock': FileLock, 'package-lock.json': FileLock, 'yarn.lock': FileLock,
  'pnpm-lock.yaml': FileLock, 'bun.lock': FileLock, 'bun.lockb': FileLock, 'gemfile': Package, 'gemfile.lock': FileLock,
  '.gitignore': FileCog, '.gitattributes': FileCog, '.editorconfig': FileCog, '.env': FileCog, 'license': FileText, 'readme': FileText,
}

const category = new Map<Icon, FileCategory>([
  [FileCode, 'code'], [Braces, 'style'], [FileCog, 'data'], [FileSpreadsheet, 'data'], [Package, 'data'],
  [FileText, 'text'], [FileType, 'text'], [FileTerminal, 'shell'],
  [FileImage, 'media'], [Film, 'media'], [AudioLines, 'media'], [FileArchive, 'media'], [FileLock, 'lock'],
])

/** A lucide glyph for a path and the category it is tinted by. Always returns something. */
export function fileIcon(path: string): { Icon: Icon; category: FileCategory } {
  const name = (path.split('/').pop() ?? path).toLowerCase()
  const dot = name.lastIndexOf('.')
  const Icon = byName[name] ?? (name.endsWith('.lock') ? FileLock : byExt[dot >= 0 ? name.slice(dot + 1) : ''] ?? FileText)
  return { Icon, category: category.get(Icon) ?? 'text' }
}
