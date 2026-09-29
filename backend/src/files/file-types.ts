interface AllowedType {
  ext: string;
  maxBytes: number;
  matches: (b: Buffer) => boolean;
}

const MB = 1024 * 1024;
const ascii = (b: Buffer, offset: number, text: string) =>
  b.subarray(offset, offset + text.length).toString('latin1') === text;

export const ALLOWED_TYPES: Record<string, AllowedType> = {
  'image/png': { ext: 'png', maxBytes: 5 * MB, matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  'image/jpeg': { ext: 'jpg', maxBytes: 5 * MB, matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/gif': { ext: 'gif', maxBytes: 5 * MB, matches: (b) => ascii(b, 0, 'GIF8') },
  'image/webp': { ext: 'webp', maxBytes: 5 * MB, matches: (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') },
  'video/mp4': { ext: 'mp4', maxBytes: 50 * MB, matches: (b) => ascii(b, 4, 'ftyp') },
  'video/webm': { ext: 'webm', maxBytes: 50 * MB, matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
};

export const MAX_UPLOAD_BYTES = 50 * MB;
