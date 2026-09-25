import { describe, it, expect } from 'vitest';
import { cn, formatCurrency } from '../src/lib/utils';
import Decimal from 'decimal.js';

describe('Web Utilities & Engineering Invariants', () => {
  it('cn correctly merges class names and handles conditionals', () => {
    expect(cn('bg-black', 'text-white')).toBe('bg-black text-white');
    expect(cn('p-4', false && 'p-2', 'p-6')).toBe('p-6'); // twMerge resolves conflicts
  });

  it('formatCurrency correctly formats Pakistani Rupee values', () => {
    expect(formatCurrency(125.5)).toMatch(/Rs.*125\.50/);
    expect(formatCurrency('89.999')).toMatch(/Rs.*90\.00/);
    expect(formatCurrency('invalid')).toMatch(/Rs.*0\.00/);
  });

  it('Decimal.js behaves with high precision and avoids floating point issues', () => {
    const rawCostPerMl = new Decimal('12.4567');
    const volumeMl = new Decimal('100');
    const total = rawCostPerMl.times(volumeMl);
    expect(total.toString()).toBe('1245.67');
  });
});
