import type { ReactNode } from 'react'

interface ManualMockupProps {
  caption?: string
  imageSrc?: string
  imageAlt?: string
  children?: ReactNode
}

export function ManualMockup({ caption, imageSrc, imageAlt, children }: ManualMockupProps) {
  return (
    <figure className="my-4">
      <div className="relative rounded-md border bg-muted/30 overflow-hidden">
        {imageSrc ? (
          <img src={imageSrc} alt={imageAlt ?? caption ?? ''} className="block w-full" />
        ) : (
          children
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 text-xs text-muted-foreground italic">
          {caption}
        </figcaption>
      )}
    </figure>
  )
}

interface MockupHotspotProps {
  n: number
  top: string
  left: string
  label?: string
}

export function MockupHotspot({ n, top, left, label }: MockupHotspotProps) {
  return (
    <div
      className="absolute z-10 flex items-center gap-1.5 pointer-events-none"
      style={{ top, left }}
    >
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-md ring-2 ring-background">
        {n}
      </span>
      {label && (
        <span className="rounded bg-background/95 px-1.5 py-0.5 text-[11px] font-medium text-foreground shadow-sm border">
          {label}
        </span>
      )}
    </div>
  )
}
