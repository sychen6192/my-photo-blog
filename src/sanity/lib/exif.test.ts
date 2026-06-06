import { describe, it, expect } from 'vitest';
import { formatExif, formatFocalLength, formatAperture, formatShutter, r2Url } from './exif';

describe('r2Url', () => {
  it('builds a plain URL for a root-level filename', () => {
    expect(r2Url('DSCF4825.JPG')).toBe('https://assets.sychen6192.org/DSCF4825.JPG');
  });
  it('keeps folder slashes but encodes them as path segments', () => {
    expect(r2Url('tottori/DSCF4825.JPG')).toBe('https://assets.sychen6192.org/tottori/DSCF4825.JPG');
  });
  it('encodes unsafe characters within a segment while preserving slashes', () => {
    expect(r2Url('izu/my photo.jpg')).toBe('https://assets.sychen6192.org/izu/my%20photo.jpg');
  });
});

describe('format helpers', () => {
  it('applies Fujifilm 1.5x crop when no 35mm value is present', () => {
    expect(formatFocalLength(35)).toBe('53mm'); // round(35 * 1.5) = 53
  });
  it('prefers an explicit 35mm-equivalent focal length', () => {
    expect(formatFocalLength(35, 50)).toBe('50mm');
  });
  it('formats aperture with no decimal for whole stops', () => {
    expect(formatAperture(2)).toBe('f/2');
    expect(formatAperture(2.8)).toBe('f/2.8');
  });
  it('formats sub-second shutter as a reciprocal', () => {
    expect(formatShutter(0.004)).toBe('1/250s');
    expect(formatShutter(2)).toBe('2s');
  });
});

describe('formatExif', () => {
  it('returns an empty object for null exif', () => {
    expect(formatExif(null)).toEqual({});
  });

  it('builds camera/lens/exif strings and strips the make from the model', () => {
    expect(
      formatExif({
        Make: 'FUJIFILM',
        Model: 'FUJIFILM X-T50',
        LensModel: 'XF16-55mmF2.8 R LM WR II',
        FocalLength: 35,
        FNumber: 2.8,
        ExposureTime: 0.004,
        ISO: 400,
      })
    ).toEqual({
      camera: 'FUJIFILM X-T50',
      lens: 'XF16-55mmF2.8 R LM WR II',
      exif: '53mm, f/2.8, 1/250s, ISO 400',
    });
  });

  it('omits fields that are absent', () => {
    expect(formatExif({ Make: 'FUJIFILM', Model: 'X-T50' })).toEqual({
      camera: 'FUJIFILM X-T50',
    });
  });
});
