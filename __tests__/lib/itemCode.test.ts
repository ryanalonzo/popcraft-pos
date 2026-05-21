import {
  extractRenterFromCode,
  isValidItemCode,
  normalizeItemCode,
  parseItemCode,
} from '@/lib/itemCode';

describe('isValidItemCode', () => {
  it('accepts the legacy mock-catalog format', () => {
    expect(isValidItemCode('R042-00000001')).toBe(true);
  });

  it('accepts Karl-API SKUs', () => {
    expect(isValidItemCode('BDJ-STK-056')).toBe(true);
    expect(isValidItemCode('BNC-TEE-001')).toBe(true);
  });

  it('accepts numeric barcodes', () => {
    expect(isValidItemCode('0878047318412')).toBe(true);
  });

  it('accepts lowercase (normalized at lookup)', () => {
    expect(isValidItemCode('bdj-stk-056')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidItemCode('')).toBe(false);
  });

  it('rejects whitespace only', () => {
    expect(isValidItemCode('   ')).toBe(false);
  });

  it('rejects codes with spaces', () => {
    expect(isValidItemCode('BDJ STK 056')).toBe(false);
  });

  it('rejects codes longer than 64 chars', () => {
    expect(isValidItemCode('A'.repeat(65))).toBe(false);
  });
});

describe('normalizeItemCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeItemCode('  bdj-stk-056 ')).toBe('BDJ-STK-056');
  });
});

describe('parseItemCode', () => {
  it('splits a legacy code into parts', () => {
    expect(parseItemCode('R042-00000001')).toEqual({
      renter_id: 'R042',
      sequence: '00000001',
      full_code: 'R042-00000001',
    });
  });

  it('returns null for non-legacy codes (Karl SKUs and garbage alike)', () => {
    expect(parseItemCode('BDJ-STK-056')).toBeNull();
    expect(parseItemCode('nope')).toBeNull();
  });
});

describe('extractRenterFromCode', () => {
  it('returns the renter ID from a legacy code', () => {
    expect(extractRenterFromCode('R042-00000001')).toBe('R042');
  });

  it('returns null for non-legacy codes', () => {
    expect(extractRenterFromCode('BDJ-STK-056')).toBeNull();
  });
});
