// External links used in more than one place.
export const GITHUB_URL = 'https://github.com/kripashankarcs3/ColorizeGAN'
export const REMEMORY_URL = 'https://github.com/deepraj-07/ReMemory-AI'
export const COLOR_CRAFT_URL = 'https://github.com/Asirwad/Color-Craft-GAN'

/** Bundled sample photos in public/samples/. */
const base = import.meta.env.BASE_URL
export const SAMPLES = [
  {
    id: 'building',
    file: 'building_GL.jpg',
    url: `${base}samples/building_GL.jpg`,
    title: 'Courtyard building',
    description: 'Brick facades, ivy, street lamps and a cobbled square: lots of fine structure.',
    size: '150 x 150 px',
  },
  {
    id: 'dog',
    file: 'Dog_GL.jpg',
    url: `${base}samples/Dog_GL.jpg`,
    title: 'Puppy portrait',
    description: 'Soft fur against a blurred background: a classic portrait test.',
    size: '332 x 300 px',
  },
] as const
