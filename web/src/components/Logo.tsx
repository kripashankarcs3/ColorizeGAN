type LogoMarkProps = {
  /** Rendered width and height in CSS pixels. */
  size?: number
  className?: string
  /** Accessible name. Leave empty when the mark sits next to visible "ColorizeGAN" text. */
  title?: string
}

/**
 * The ColorizeGAN mark: a print split by a before/after handle. The left half
 * is the luminance-matched grey of the amber right half, so it reads as the
 * same photo before and after colour. Colours come from the --logo-* tokens
 * in index.css and the knob uses currentColor, so it follows the theme.
 * Keep in sync with public/logo.svg.
 */
export function LogoMark({ size = 24, className, title }: LogoMarkProps) {
  const labelled = Boolean(title)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
      role={labelled ? 'img' : undefined}
      aria-label={labelled ? title : undefined}
      aria-hidden={labelled ? undefined : true}
      focusable="false"
    >
      <path
        fill="var(--logo-grey)"
        d="M15 0H7a7 7 0 0 0-7 7v18a7 7 0 0 0 7 7h8v-10.08A6 6 0 1 1 15 10.08Z"
      />
      <path
        fill="var(--logo-tone)"
        d="M17 0h8a7 7 0 0 1 7 7v18a7 7 0 0 1-7 7h-8v-10.08A6 6 0 1 0 17 10.08Z"
      />
      <circle fill="currentColor" cx="16" cy="16" r="4" />
    </svg>
  )
}
