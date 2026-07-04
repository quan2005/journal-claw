#!/usr/bin/env node
/**
 * Clean up stale JournalClaw dev processes that hold the fixed ports used by
 * `bun run --filter @journal/desktop dev`.
 *
 * This prevents the misleading `[app] exited with code SIGTERM` error from
 * `concurrently -k` when the Vite renderer (1420) or daemon (17510) cannot
 * start because an orphaned instance from a previous session is still bound.
 *
 * Supports macOS / Linux (Unix) and Windows.
 */
import { execFileSync } from 'node:child_process'
import { platform } from 'node:os'

const PORTS = [1420, 17510]
const KILL_SIGNALS = ['SIGTERM', 'SIGKILL']
const JOURNAL_MARKERS = [
  'vite',
  'journal',
  '@journal',
  'apps/daemon',
  'dist/cli.js',
  'node_modules/.bin/../vite',
]

const IS_WIN = platform() === 'win32'

function log(message) {
  // eslint-disable-next-line no-console
  console.log(`[desktop:dev:clean] ${message}`)
}

function getPidsOnPortUnix(port) {
  try {
    // lsof -t prints only PIDs, one per line. -iTCP:<port> restricts to IPv4/IPv6 TCP.
    const output = execFileSync('lsof', ['-t', '-i', `TCP:${port}`], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => Number(line))
      .filter(Number.isFinite)
  } catch {
    // lsof exits with code 1 when nothing is listening on the port.
    return []
  }
}

function getPidsOnPortWindows(port) {
  try {
    const output = execFileSync('netstat', ['-ano'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const lines = output.split('\r\n')
    const pids = new Set()
    for (const line of lines) {
      // Match lines like:
      //   TCP    127.0.0.1:1420         0.0.0.0:0              LISTENING       12345
      const match = line.match(new RegExp(`TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)$`))
      if (match) pids.add(Number(match[1]))
    }
    return Array.from(pids)
  } catch {
    return []
  }
}

function getPidsOnPort(port) {
  return IS_WIN ? getPidsOnPortWindows(port) : getPidsOnPortUnix(port)
}

function getCommandUnix(pid) {
  try {
    // Use `args` (full command line) rather than `comm` (executable name only)
    // so we can match against script paths such as `dist/cli.js` or `vite`.
    const output = execFileSync('ps', ['-o', 'args=', '-p', String(pid)], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return output.trim()
  } catch {
    return ''
  }
}

function getCommandWindows(pid) {
  try {
    const output = execFileSync('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/V'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const lines = output.split('\r\n').filter(Boolean)
    if (lines.length < 2) return ''
    // CSV header: "Image Name","PID","Session Name","Session#","Mem Usage","Status","User Name","CPU Time","Window Title","Command Line"
    const header = lines[0].split(',').map((s) => s.replace(/^"|"$/g, ''))
    const values = parseCsvLine(lines[1])
    const commandLineIndex = header.indexOf('Command Line')
    if (commandLineIndex >= 0 && values[commandLineIndex]) {
      return values[commandLineIndex]
    }
    // Fallback to image name if command line is unavailable.
    const imageIndex = header.indexOf('Image Name')
    return imageIndex >= 0 ? values[imageIndex] : ''
  } catch {
    return ''
  }
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let insideQuotes = false
  for (const char of line) {
    if (char === '"') {
      insideQuotes = !insideQuotes
    } else if (char === ',' && !insideQuotes) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function getCommand(pid) {
  return IS_WIN ? getCommandWindows(pid) : getCommandUnix(pid)
}

function isJournalProcess(pid) {
  const command = getCommand(pid)
  if (!command) return false
  const lower = command.toLowerCase()
  return JOURNAL_MARKERS.some((marker) => lower.includes(marker.toLowerCase()))
}

function killProcessUnix(pid, signal) {
  try {
    process.kill(pid, signal)
    return true
  } catch {
    return false
  }
}

function killTreeUnix(pid) {
  // Recursively collect descendant PIDs so we clean up the whole orphan tree
  // (e.g. bun -> node -> vite -> esbuild).
  const descendants = []
  function collect(parentPid) {
    try {
      const output = execFileSync('pgrep', ['-P', String(parentPid)], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const children = output
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map(Number)
        .filter(Number.isFinite)
      for (const child of children) {
        descendants.push(child)
        collect(child)
      }
    } catch {
      // No children.
    }
  }
  collect(pid)

  const targets = [...descendants, pid]
  for (const signal of KILL_SIGNALS) {
    let anyAlive = false
    for (const target of targets) {
      if (killProcessUnix(target, signal)) {
        anyAlive = true
      }
    }
    if (!anyAlive) break
    // Give the processes a moment to exit before escalating to SIGKILL.
    if (signal === 'SIGTERM') {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
  }
}

function killTreeWindows(pid) {
  // taskkill /T terminates the process and all of its children.
  try {
    execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
  } catch {
    // Process may already be gone.
  }
}

function killTree(pid) {
  IS_WIN ? killTreeWindows(pid) : killTreeUnix(pid)
}

let cleaned = 0
for (const port of PORTS) {
  const pids = getPidsOnPort(port)
  const journalPids = pids.filter(isJournalProcess)
  if (journalPids.length === 0) continue

  log(`freeing port ${port}: ${journalPids.join(', ')}`)
  for (const pid of journalPids) {
    killTree(pid)
  }
  cleaned += journalPids.length
}

if (cleaned === 0) {
  log('no stale journal processes found')
} else {
  log(`reclaimed ${cleaned} stale process(es)`)
}
