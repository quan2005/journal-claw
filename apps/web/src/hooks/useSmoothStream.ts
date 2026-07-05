import { useCallback, useEffect, useRef, useState } from 'react'

type StreamPreset = 'balanced' | 'realtime' | 'silky'

interface PresetConfig {
  activeInputWindowMs: number
  defaultCps: number
  emaAlpha: number
  flushCps: number
  largeAppendChars: number
  maxActiveCps: number
  maxCps: number
  maxFlushCps: number
  minCps: number
  settleAfterMs: number
  settleDrainMaxMs: number
  settleDrainMinMs: number
  targetBufferMs: number
}

const PRESETS: Record<StreamPreset, PresetConfig> = {
  balanced: {
    activeInputWindowMs: 220,
    defaultCps: 38,
    emaAlpha: 0.2,
    flushCps: 120,
    largeAppendChars: 120,
    maxActiveCps: 132,
    maxCps: 72,
    maxFlushCps: 280,
    minCps: 18,
    settleAfterMs: 360,
    settleDrainMaxMs: 520,
    settleDrainMinMs: 180,
    targetBufferMs: 120,
  },
  realtime: {
    activeInputWindowMs: 140,
    defaultCps: 50,
    emaAlpha: 0.3,
    flushCps: 170,
    largeAppendChars: 180,
    maxActiveCps: 180,
    maxCps: 96,
    maxFlushCps: 360,
    minCps: 24,
    settleAfterMs: 260,
    settleDrainMaxMs: 360,
    settleDrainMinMs: 140,
    targetBufferMs: 40,
  },
  silky: {
    activeInputWindowMs: 320,
    defaultCps: 28,
    emaAlpha: 0.14,
    flushCps: 96,
    largeAppendChars: 100,
    maxActiveCps: 102,
    maxCps: 56,
    maxFlushCps: 220,
    minCps: 14,
    settleAfterMs: 460,
    settleDrainMaxMs: 680,
    settleDrainMinMs: 240,
    targetBufferMs: 170,
  },
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const now = () => (typeof performance === 'undefined' ? Date.now() : performance.now())
const countChars = (s: string) => [...s].length

interface UseSmoothStreamOptions {
  enabled?: boolean
  preset?: StreamPreset
}

export function useSmoothStream(
  content: string,
  { enabled = true, preset = 'balanced' }: UseSmoothStreamOptions = {},
): string {
  const cfg = PRESETS[preset]
  const [displayed, setDisplayed] = useState(content)

  const displayedRef = useRef(content)
  const displayedCountRef = useRef(countChars(content))

  const targetContentRef = useRef(content)
  const targetCharsRef = useRef([...content])
  const targetCountRef = useRef(targetCharsRef.current.length)

  const emaCpsRef = useRef(cfg.defaultCps)
  const lastInputTsRef = useRef(0)
  const lastInputCountRef = useRef(targetCountRef.current)
  const chunkSizeEmaRef = useRef(1)
  const arrivalCpsEmaRef = useRef(cfg.defaultCps)

  const rafRef = useRef<number | null>(null)
  const lastFrameTsRef = useRef<number | null>(null)
  const wakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearWake = useCallback(() => {
    if (wakeTimerRef.current !== null) {
      clearTimeout(wakeTimerRef.current)
      wakeTimerRef.current = null
    }
  }, [])

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    lastFrameTsRef.current = null
  }, [])

  const stopAll = useCallback(() => {
    stopLoop()
    clearWake()
  }, [clearWake, stopLoop])

  const startLoopRef = useRef<() => void>(() => {})

  const scheduleWake = useCallback(
    (delayMs: number) => {
      clearWake()
      wakeTimerRef.current = setTimeout(
        () => {
          wakeTimerRef.current = null
          startLoopRef.current()
        },
        Math.max(1, Math.ceil(delayMs)),
      )
    },
    [clearWake],
  )

  const syncImmediate = useCallback(
    (next: string) => {
      stopAll()
      const chars = [...next]
      targetContentRef.current = next
      targetCharsRef.current = chars
      targetCountRef.current = chars.length
      displayedRef.current = next
      displayedCountRef.current = chars.length
      setDisplayed(next)
      emaCpsRef.current = cfg.defaultCps
      chunkSizeEmaRef.current = 1
      arrivalCpsEmaRef.current = cfg.defaultCps
      lastInputTsRef.current = now()
      lastInputCountRef.current = chars.length
    },
    [cfg.defaultCps, stopAll],
  )

  const startLoop = useCallback(() => {
    clearWake()
    if (rafRef.current !== null) return

    const tick = (ts: number) => {
      if (lastFrameTsRef.current === null) {
        lastFrameTsRef.current = ts
        rafRef.current = requestAnimationFrame(tick)
        return
      }

      const frameMs = Math.max(0, ts - lastFrameTsRef.current)
      const dt = Math.max(0.001, Math.min(frameMs / 1000, 0.05))
      lastFrameTsRef.current = ts

      const targetCount = targetCountRef.current
      const dispCount = displayedCountRef.current
      const backlog = targetCount - dispCount

      if (backlog <= 0) {
        stopLoop()
        return
      }

      const t = now()
      const idleMs = t - lastInputTsRef.current
      const inputActive = idleMs <= cfg.activeInputWindowMs
      const settling = !inputActive && idleMs >= cfg.settleAfterMs

      const baseCps = clamp(emaCpsRef.current, cfg.minCps, cfg.maxCps)
      const baseLag = Math.max(1, Math.round((baseCps * cfg.targetBufferMs) / 1000))
      const lagUpper = Math.max(baseLag + 2, baseLag * 3)
      const targetLag = inputActive
        ? Math.round(clamp(baseLag + chunkSizeEmaRef.current * 0.35, baseLag, lagUpper))
        : 0
      const desiredDisp = Math.max(0, targetCount - targetLag)

      let cps: number
      if (inputActive) {
        const bp = targetLag > 0 ? backlog / targetLag : 1
        const cp = targetLag > 0 ? chunkSizeEmaRef.current / targetLag : 1
        const ap = arrivalCpsEmaRef.current / Math.max(baseCps, 1)
        const combined = clamp(bp * 0.6 + cp * 0.25 + ap * 0.15, 1, 4.5)
        const activeCap = clamp(
          cfg.maxActiveCps + chunkSizeEmaRef.current * 6,
          cfg.maxActiveCps,
          cfg.maxFlushCps,
        )
        cps = clamp(baseCps * combined, cfg.minCps, activeCap)
      } else if (settling) {
        const drainMs = clamp(backlog * 8, cfg.settleDrainMinMs, cfg.settleDrainMaxMs)
        cps = clamp((backlog * 1000) / drainMs, cfg.flushCps, cfg.maxFlushCps)
      } else {
        const idleCps = Math.max(cfg.flushCps, baseCps * 1.8, arrivalCpsEmaRef.current * 0.8)
        cps = clamp(idleCps, cfg.flushCps, cfg.maxFlushCps)
      }

      const urgent = inputActive && targetLag > 0 && backlog > targetLag * 2.2
      const bursty = inputActive && chunkSizeEmaRef.current >= targetLag * 0.9
      const minReveal = inputActive ? (urgent || bursty ? 2 : 1) : 2
      let reveal = Math.max(minReveal, Math.round(cps * dt))

      if (inputActive) {
        const shortfall = desiredDisp - dispCount
        if (shortfall <= 0) {
          stopLoop()
          scheduleWake(cfg.activeInputWindowMs - idleMs)
          return
        }
        reveal = Math.min(reveal, shortfall, backlog)
      } else {
        reveal = Math.min(reveal, backlog)
      }

      const nextCount = dispCount + reveal
      const segment = targetCharsRef.current.slice(dispCount, nextCount).join('')

      if (segment) {
        const nextDisp = displayedRef.current + segment
        displayedRef.current = nextDisp
        displayedCountRef.current = nextCount
        setDisplayed(nextDisp)
      } else {
        displayedRef.current = targetContentRef.current
        displayedCountRef.current = targetCount
        setDisplayed(targetContentRef.current)
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }, [
    clearWake,
    cfg.activeInputWindowMs,
    cfg.flushCps,
    cfg.maxActiveCps,
    cfg.maxCps,
    cfg.maxFlushCps,
    cfg.minCps,
    cfg.settleAfterMs,
    cfg.settleDrainMaxMs,
    cfg.settleDrainMinMs,
    cfg.targetBufferMs,
    scheduleWake,
    stopLoop,
  ])
  startLoopRef.current = startLoop

  useEffect(() => {
    if (!enabled) {
      syncImmediate(content)
      return
    }

    const prev = targetContentRef.current
    if (content === prev) return

    if (!content.startsWith(prev)) {
      syncImmediate(content)
      return
    }

    const appended = content.slice(prev.length)
    const appendedChars = [...appended]
    const appendedCount = appendedChars.length

    if (appendedCount > cfg.largeAppendChars) {
      syncImmediate(content)
      return
    }

    targetContentRef.current = content
    targetCharsRef.current = [...targetCharsRef.current, ...appendedChars]
    targetCountRef.current += appendedCount

    const t = now()
    const deltaChars = targetCountRef.current - lastInputCountRef.current
    const deltaMs = Math.max(1, t - lastInputTsRef.current)

    if (deltaChars > 0) {
      const instantCps = (deltaChars * 1000) / deltaMs
      const normCps = clamp(instantCps, cfg.minCps, cfg.maxFlushCps * 2)
      const alpha = 0.35
      chunkSizeEmaRef.current = chunkSizeEmaRef.current * (1 - alpha) + appendedCount * alpha
      arrivalCpsEmaRef.current = arrivalCpsEmaRef.current * (1 - alpha) + normCps * alpha
      const clampedCps = clamp(instantCps, cfg.minCps, cfg.maxActiveCps)
      emaCpsRef.current = emaCpsRef.current * (1 - cfg.emaAlpha) + clampedCps * cfg.emaAlpha
    }

    lastInputTsRef.current = t
    lastInputCountRef.current = targetCountRef.current

    startLoop()
  }, [
    cfg.emaAlpha,
    cfg.largeAppendChars,
    cfg.maxActiveCps,
    cfg.maxCps,
    cfg.maxFlushCps,
    cfg.minCps,
    content,
    enabled,
    startLoop,
    syncImmediate,
  ])

  useEffect(() => {
    return () => stopAll()
  }, [stopAll])

  return displayed
}
