import React from 'react'
import { createRoot } from 'react-dom/client'

import { NumberTicker } from './components/number-ticker'
import { Marquee } from './components/marquee'
import { BorderBeam } from './components/border-beam'
import { Pointer } from './components/pointer'
import { Safari } from './components/safari'
import { AnimatedBeam } from './components/animated-beam'
import { Highlighter } from './components/highlighter'

type MagicProps = Record<string, unknown>

const MagicNumberTickerComponent = NumberTicker as unknown as React.ComponentType<MagicProps>
const MagicMarqueeComponent = Marquee as unknown as React.ComponentType<MagicProps>
const MagicBorderBeamComponent = BorderBeam as unknown as React.ComponentType<MagicProps>
const MagicPointerComponent = Pointer as unknown as React.ComponentType<MagicProps>
const MagicSafariComponent = Safari as unknown as React.ComponentType<MagicProps>
const MagicAnimatedBeamComponent = AnimatedBeam as unknown as React.ComponentType<MagicProps>
const MagicHighlighterComponent = Highlighter as unknown as React.ComponentType<MagicProps>

/** Convert kebab-case to camelCase */
function camelize(s: string): string {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
}

/** Parse HTML attribute value to the right JS type */
function parseAttr(value: string | null): string | number | boolean | undefined {
  if (value === null) return undefined
  if (value === '') return true // boolean attribute
  const num = Number(value)
  if (!isNaN(num) && value.trim() !== '') return num
  if (value === 'true') return true
  if (value === 'false') return false
  return value
}

/** Extract React props from an HTMLElement's attributes (kebab → camelCase) */
function extractProps(el: HTMLElement): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const attr of el.getAttributeNames()) {
    // Skip attributes handled specially
    if (attr === 'class' || attr === 'style' || attr === 'id') continue
    props[camelize(attr)] = parseAttr(el.getAttribute(attr))
  }
  // Pass through className
  if (el.hasAttribute('class')) {
    props.className = el.getAttribute('class')
  }
  if (el.hasAttribute('style')) {
    props.style = el.getAttribute('style')
  }
  return props
}

/** Render innerHTML as React children via dangerouslySetInnerHTML */
function htmlChildren(html: string) {
  return { __html: html }
}

/* ===== Custom Element Definitions ===== */

// --- NumberTicker ---
class MagicNumberTicker extends HTMLElement {
  connectedCallback() {
    const props = extractProps(this)
    const root = createRoot(this)
    root.render(React.createElement(MagicNumberTickerComponent, props))
  }
}

// --- Marquee (has children) ---
class MagicMarquee extends HTMLElement {
  connectedCallback() {
    const props = extractProps(this)
    const inner = this.innerHTML
    // Defer rendering until this element is fully parsed
    requestAnimationFrame(() => {
      if (!this.isConnected) return
      const root = createRoot(this)
      root.render(
        React.createElement(
          MagicMarqueeComponent,
          props,
          React.createElement('span', {
            dangerouslySetInnerHTML: htmlChildren(inner),
          }),
        ),
      )
    })
  }
}

// --- BorderBeam (no children, just positioning) ---
class MagicBorderBeam extends HTMLElement {
  connectedCallback() {
    // Ensure parent has position:relative for absolute positioning
    const parent = this.parentElement
    if (parent) {
      const parentPos = getComputedStyle(parent).position
      if (parentPos === 'static') {
        parent.style.position = 'relative'
      }
    }
    const props = extractProps(this)
    const root = createRoot(this)
    root.render(React.createElement(MagicBorderBeamComponent, props))
  }
}

// --- Pointer ---
class MagicPointer extends HTMLElement {
  connectedCallback() {
    const hasChildren = this.innerHTML.trim().length > 0
    const props = extractProps(this)
    const root = createRoot(this)
    if (hasChildren) {
      const children = React.createElement('div', {
        dangerouslySetInnerHTML: htmlChildren(this.innerHTML),
      })
      root.render(React.createElement(MagicPointerComponent, props, children))
    } else {
      root.render(React.createElement(MagicPointerComponent, props))
    }
  }
}

// --- Safari (Device Mockup) ---
class MagicSafari extends HTMLElement {
  connectedCallback() {
    const props = extractProps(this)
    const root = createRoot(this)
    root.render(React.createElement(MagicSafariComponent, props))
  }
}

// --- AnimatedBeam (uses string element IDs instead of React refs) ---
class MagicAnimatedBeam extends HTMLElement {
  connectedCallback() {
    const props = extractProps(this)
    const fromId = this.getAttribute('from-id')
    const toId = this.getAttribute('to-id')
    const containerId = this.getAttribute('container-id')

    if (!fromId || !toId) {
      console.warn('magic-animated-beam: from-id and to-id are required')
      return
    }

    // Wait for the rest of the DOM to be ready
    requestAnimationFrame(() => {
      if (!this.isConnected) return

      const fromEl = document.getElementById(fromId)
      const toEl = document.getElementById(toId)
      const containerEl = containerId ? document.getElementById(containerId) : this.parentElement

      if (!fromEl || !toEl || !containerEl) {
        console.warn('magic-animated-beam: could not find elements by ID', {
          fromId,
          toId,
          containerId,
        })
        return
      }

      // Create ref-like objects from real DOM elements
      const containerRef = { current: containerEl }
      const fromRef = { current: fromEl }
      const toRef = { current: toEl }

      const root = createRoot(this)
      root.render(
        React.createElement(MagicAnimatedBeamComponent, {
          ...props,
          containerRef,
          fromRef,
          toRef,
        }),
      )
    })
  }
}

// --- Highlighter (wraps inline text) ---
class MagicHighlighter extends HTMLElement {
  connectedCallback() {
    const props = extractProps(this)
    const text = this.textContent || ''
    // Clear and re-render with React
    const root = createRoot(this)
    root.render(React.createElement(MagicHighlighterComponent, props, text))
  }
}

/* ===== Registration ===== */

// Wait for DOM to be parsed, then register
function registerAll() {
  if (typeof customElements === 'undefined') return

  const components: [string, CustomElementConstructor][] = [
    ['magic-number-ticker', MagicNumberTicker],
    ['magic-marquee', MagicMarquee],
    ['magic-border-beam', MagicBorderBeam],
    ['magic-pointer', MagicPointer],
    ['magic-safari', MagicSafari],
    ['magic-animated-beam', MagicAnimatedBeam],
    ['magic-highlighter', MagicHighlighter],
  ]

  for (const [name, ctor] of components) {
    if (!customElements.get(name)) {
      customElements.define(name, ctor)
    }
  }
}

// Register immediately if DOM is already interactive, otherwise wait
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  registerAll()
} else {
  document.addEventListener('DOMContentLoaded', registerAll)
}
