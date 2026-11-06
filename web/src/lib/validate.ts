// Same rule as _validate_input_path() in app/colorize.py.

export const SUPPORTED_EXTENSIONS = ['.png', '.jpg', '.jpeg'] as const

/** Accept attribute for <input type="file">. */
export const ACCEPT = '.png,.jpg,.jpeg,image/png,image/jpeg'

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot).toLowerCase()
}

export function hasSupportedExtension(name: string): boolean {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(fileExtension(name))
}

/** "photo.jpg" -> "photo_colorized.png", matching the desktop app's file name. */
export function colorizedFileName(name: string): string {
  const ext = fileExtension(name)
  const stem = ext ? name.slice(0, -ext.length) : name
  return `${stem || 'image'}_colorized.png`
}
