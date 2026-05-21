import {
  centavosToPesos,
  formatPeso,
  formatPesoNoSymbol,
  pesosToCentavos,
} from '@/lib/money';

describe('formatPeso', () => {
  it('formats zero', () => {
    expect(formatPeso(0)).toBe('₱0.00');
  });

  it('formats one peso', () => {
    expect(formatPeso(100)).toBe('₱1.00');
  });

  it('formats with two decimal places', () => {
    expect(formatPeso(24950)).toBe('₱249.50');
  });

  it('formats with thousands separator', () => {
    expect(formatPeso(2490000)).toBe('₱24,900.00');
  });

  it('pads single-digit centavos', () => {
    expect(formatPeso(105)).toBe('₱1.05');
  });
});

describe('formatPesoNoSymbol', () => {
  it('omits the peso sign', () => {
    expect(formatPesoNoSymbol(24950)).toBe('249.50');
  });

  it('still uses thousands separator', () => {
    expect(formatPesoNoSymbol(2490000)).toBe('24,900.00');
  });
});

describe('pesosToCentavos', () => {
  it('converts whole pesos', () => {
    expect(pesosToCentavos(249.5)).toBe(24950);
  });

  it('rounds to avoid float drift', () => {
    expect(pesosToCentavos(0.1 + 0.2)).toBe(30);
  });

  it('rounds typical retail prices cleanly', () => {
    expect(pesosToCentavos(99.99)).toBe(9999);
    expect(pesosToCentavos(249.5)).toBe(24950);
  });
});

describe('centavosToPesos', () => {
  it('divides by 100', () => {
    expect(centavosToPesos(24950)).toBe(249.5);
  });
});
