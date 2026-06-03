/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'

// ═══════════════════════════════════════════════════════════════════════════
// Device Density Context
// ═══════════════════════════════════════════════════════════════════════════

type Density = 'default' | 'compact' | 'presentation'

const DeviceDensityContext = createContext<Density>('default')

export function useDeviceDensity(): Density {
  return useContext(DeviceDensityContext)
}

// ═══════════════════════════════════════════════════════════════════════════
// PhonePreview — Pure CSS iPhone 15 Pro shell
// ═══════════════════════════════════════════════════════════════════════════

export interface PhonePreviewProps {
  src?: string
  alt?: string
  children?: ReactNode
  model?: 'iphone-15-pro' | 'iphone-15' | 'generic'
  size?: 'sm' | 'md' | 'lg' | 'auto'
  tone?: 'graphite' | 'titanium' | 'black'
  density?: Density
  showIsland?: boolean
  showButtons?: boolean
  showSpeaker?: boolean
  screenPadding?: 'none' | 'sm' | 'md' | 'lg'
  fit?: 'contain' | 'cover'
  className?: string
}

const sizeMap: Record<string, string> = {
  sm: '280px',
  md: '320px',
  lg: '380px',
  auto: '100%',
}

export function PhonePreview({
  src,
  alt,
  children,
  size = 'md',
  density = 'default',
  showIsland = true,
  showButtons = true,
  showSpeaker = true,
  fit = 'contain',
  className,
}: PhonePreviewProps) {
  const deviceWidth = sizeMap[size]

  return (
    <DeviceDensityContext.Provider value={density}>
      <div
        className={`mdx-device-v2 ${className ?? ''}`}
        data-density={density}
        style={{ '--device-width': deviceWidth } as React.CSSProperties}
      >
        <div className="device-frame-v2">
          {/* Side buttons */}
          {showButtons && (
            <>
              <div className="device-btn-v2 device-btn-v2--left-top" />
              <div className="device-btn-v2 device-btn-v2--left-mid" />
              <div className="device-btn-v2 device-btn-v2--left-bottom" />
              <div className="device-btn-v2 device-btn-v2--right" />
            </>
          )}

          <div className="device-screen-v2">
            {/* Dynamic Island */}
            {showIsland && (
              <div className="device-island-v2">
                {showSpeaker && <div className="device-speaker-v2" />}
              </div>
            )}

            {/* Screen content */}
            <div className="device-content-v2">
              {src ? (
                <img
                  src={src}
                  alt={alt ?? ''}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: fit,
                    objectPosition: 'top',
                  }}
                />
              ) : (
                children
              )}
            </div>
          </div>
        </div>
      </div>
    </DeviceDensityContext.Provider>
  )
}
