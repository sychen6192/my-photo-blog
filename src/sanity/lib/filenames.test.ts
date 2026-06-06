import { describe, it, expect } from 'vitest';
import { expandRange, parseFilenameList } from './filenames';

describe('expandRange', () => {
  it('expands an inclusive numeric range with the extension', () => {
    expect(expandRange('DSCF', '4825', '4827', '.JPG')).toEqual([
      'DSCF4825.JPG',
      'DSCF4826.JPG',
      'DSCF4827.JPG',
    ]);
  });

  it('zero-pads to the width of the start number and accepts ext without a dot', () => {
    expect(expandRange('IMG_', '0008', '0010', 'JPG')).toEqual([
      'IMG_0008.JPG',
      'IMG_0009.JPG',
      'IMG_0010.JPG',
    ]);
  });

  it('returns empty when end is before start or inputs are not numeric', () => {
    expect(expandRange('DSCF', '4827', '4825', '.JPG')).toEqual([]);
    expect(expandRange('DSCF', '', '4827', '.JPG')).toEqual([]);
    expect(expandRange('DSCF', 'ab', 'cd', '.JPG')).toEqual([]);
  });
});

describe('parseFilenameList', () => {
  it('splits on newlines, trims, and drops blank lines', () => {
    expect(parseFilenameList('  DSCF4825.JPG \n\nDSCF4826.JPG\n  ')).toEqual([
      'DSCF4825.JPG',
      'DSCF4826.JPG',
    ]);
  });
});
