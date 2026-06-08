// file: src/shells.js
// Chuc nang: Resolver allowlist shell Windows -> executable + args.
// Cung cap resolveShell (tra file+args cho pty.spawn), detectAvailableShells (liet ke shell kha dung),
// va expandHome (mo rong ~ thanh homedir).

import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { homedir } from 'node:os';

// ===== Allowlist shell Windows =====
const SHELL_MAP = {
  cmd: { file: 'cmd.exe', args: [] },
  PowerShell: { file: 'powershell.exe', args: ['-NoLogo'] },
  pwsh: { file: 'pwsh.exe', args: ['-NoLogo'] },
  wsl: { file: 'wsl.exe', args: [] },
  // gitbash xu ly rieng trong resolveShell (can tim path dong)
};

// Cac duong dan pho bien de kiem tra ton tai
const PWSH_PATHS = [
  'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
  'C:\\Program Files (x86)\\PowerShell\\7\\pwsh.exe',
];
const WSL_PATHS = [
  'C:\\Windows\\System32\\wsl.exe',
];
const GITBASH_PATHS = [
  'C:\\Program Files\\Git\\bin\\bash.exe',
  'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
];

/**
 * Tim bash.exe cua Git Bash.
 * Uu tien: GIT_INSTALL_ROOT env > cac path pho bien > fallback 'bash.exe'
 * @returns {string} duong dan bash.exe
 */
function findGitBash() {
  // Thu env GIT_INSTALL_ROOT truoc
  const gitRoot = process.env.GIT_INSTALL_ROOT;
  if (gitRoot) {
    const p = join(gitRoot, 'bin', 'bash.exe');
    if (existsSync(p)) return p;
  }

  // Thu cac path pho bien
  for (const p of GITBASH_PATHS) {
    if (existsSync(p)) return p;
  }

  // Fallback — de he thong tu tim trong PATH
  return 'bash.exe';
}

/**
 * Resolve shell key thanh {file, args} de truyen vao pty.spawn.
 * Chi chap nhan key trong allowlist.
 * @param {string} key - ten shell (cmd, PowerShell, pwsh, wsl, gitbash)
 * @returns {{file: string, args: string[]}}
 */
export function resolveShell(key) {
  // Xu ly gitbash rieng (can tim duong dan dong)
  if (key === 'gitbash') {
    return { file: findGitBash(), args: ['--login', '-i'] };
  }

  const entry = SHELL_MAP[key];
  if (!entry) {
    throw new Error(`Shell not allowed: ${key}`);
  }

  return { file: entry.file, args: [...entry.args] };
}

/**
 * Kiem tra exe co ton tai khong (qua path hoac 'where' command).
 * Nuot moi loi, tra boolean.
 * @param {string} exe - ten executable
 * @param {string[]} knownPaths - cac duong dan pho bien de kiem tra
 * @returns {boolean}
 */
function exeExists(exe, knownPaths) {
  // Kiem tra cac path cu the truoc
  for (const p of knownPaths) {
    if (existsSync(p)) return true;
  }

  // Thu 'where' command (Windows equivalent cua 'which')
  try {
    execFileSync('where', [exe], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Tra ve mang cac shell key kha dung tren may hien tai.
 * 'cmd' va 'PowerShell' luon co mat (Windows dam bao).
 * @returns {string[]}
 */
export function detectAvailableShells() {
  // cmd va PowerShell luon co tren Windows
  const available = ['cmd', 'PowerShell'];

  // Kiem tra pwsh (PowerShell 7)
  if (exeExists('pwsh.exe', PWSH_PATHS)) {
    available.push('pwsh');
  }

  // Kiem tra wsl
  if (exeExists('wsl.exe', WSL_PATHS)) {
    available.push('wsl');
  }

  // Kiem tra gitbash
  const gitBashPath = findGitBash();
  if (gitBashPath !== 'bash.exe' || exeExists('bash.exe', GITBASH_PATHS)) {
    available.push('gitbash');
  }

  return available;
}

/**
 * Mo rong ky tu ~ thanh home directory cua user.
 * @param {*} p - duong dan can xu ly
 * @returns {*} duong dan da mo rong hoac gia tri goc neu khong phai string/rong
 */
export function expandHome(p) {
  // Khong phai string hoac rong -> tra nguyen
  if (typeof p !== 'string' || p === '') return p;

  // Chi la '~' -> tra homedir
  if (p === '~') return homedir();

  // Bat dau bang '~/' hoac '~\' -> thay the
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return homedir() + p.slice(1);
  }

  // Mac dinh: tra nguyen
  return p;
}
