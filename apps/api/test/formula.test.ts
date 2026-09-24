import { describe, it, expect, beforeEach } from 'vitest';
import { Decimal } from 'decimal.js';
import { FormulaService } from '../src/services/formula.service.js';

describe('Phase 3: Formula & BOM Engine', () => {
  describe('Formula 100% Percentage Validation', () => {
    it('accepts a valid formula where percentage ingredients sum to exactly 100%', () => {
      const validIngredients = [
        { quantity_type: 'fixed_ml' as const, value: 20 },
        { quantity_type: 'percent' as const, value: 80 },
        { quantity_type: 'percent' as const, value: 20 },
      ];

      const result = FormulaService.validateIngredients(validIngredients);
      expect(result.isValid).toBe(true);
      expect(result.fixedSum.toNumber()).toBe(20);
      expect(result.percentSum.toNumber()).toBe(100);
    });

    it('rejects a formula where percentage ingredients do not sum to 100%', () => {
      const invalidIngredients = [
        { quantity_type: 'fixed_ml' as const, value: 20 },
        { quantity_type: 'percent' as const, value: 75 },
        { quantity_type: 'percent' as const, value: 20 }, // 95% total
      ];

      const result = FormulaService.validateIngredients(invalidIngredients);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/must sum to exactly 100%/);
    });

    it('rejects any non-positive ingredient quantity', () => {
      const invalidIngredients = [
        { quantity_type: 'fixed_ml' as const, value: 0 },
        { quantity_type: 'percent' as const, value: 100 },
      ];

      const result = FormulaService.validateIngredients(invalidIngredients);
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/greater than zero/);
    });
  });

  describe('Scaling Math Across Batch Volumes (Acceptance Criteria)', () => {
    it('accurately scales 20 ml fixed base + 80% alcohol + 20% fixative to 500 ml', async () => {
      // Formula: Sultani Rose & Oud (f-00000001-0000-0000-0000-000000000001)
      // Fixed: 20 ml Rose Absolute
      // Remaining: 500 - 20 = 480 ml
      // Alcohol: 80% of 480 = 384 ml
      // Fixative: 20% of 480 = 96 ml
      // Total = 20 + 384 + 96 = 500 ml exactly!
      const scale = await FormulaService.scaleFormula(
        'f-00000001-0000-0000-0000-000000000001',
        500,
      );

      expect(scale.target_total_ml).toBe('500.0000');
      expect(scale.fixed_ml_total).toBe('20.0000');
      expect(scale.remaining_ml).toBe('480.0000');

      const rose = scale.ingredients.find((i) => i.name.includes('Rose'));
      const alcohol = scale.ingredients.find((i) => i.name.includes('Ethanol'));
      const fixative = scale.ingredients.find((i) => i.name.includes('Ambroxan'));

      expect(new Decimal(rose!.required_quantity).toNumber()).toBe(20);
      expect(new Decimal(alcohol!.required_quantity).toNumber()).toBe(384);
      expect(new Decimal(fixative!.required_quantity).toNumber()).toBe(96);

      const totalCalculated = new Decimal(rose!.required_quantity)
        .plus(new Decimal(alcohol!.required_quantity))
        .plus(new Decimal(fixative!.required_quantity));
      expect(totalCalculated.toNumber()).toBe(500);
    });

    it('accurately scales 20 ml fixed base + 80% alcohol + 20% fixative to 10,000 ml', async () => {
      // Target: 10,000 ml
      // Fixed: 20 ml
      // Remaining: 9,980 ml
      // Alcohol (80%): 9,980 * 0.8 = 7,984 ml
      // Fixative (20%): 9,980 * 0.2 = 1,996 ml
      // Total = 20 + 7,984 + 1,996 = 10,000 ml
      const scale = await FormulaService.scaleFormula(
        'f-00000001-0000-0000-0000-000000000001',
        10000,
      );

      expect(scale.target_total_ml).toBe('10000.0000');
      expect(scale.fixed_ml_total).toBe('20.0000');
      expect(scale.remaining_ml).toBe('9980.0000');

      const alcohol = scale.ingredients.find((i) => i.name.includes('Ethanol'));
      const fixative = scale.ingredients.find((i) => i.name.includes('Ambroxan'));

      expect(new Decimal(alcohol!.required_quantity).toNumber()).toBe(7984);
      expect(new Decimal(fixative!.required_quantity).toNumber()).toBe(1996);
    });

    it('flags warehouse stock shortage when required batch quantity exceeds inventory', async () => {
      // Scale to massive batch: 100,000 ml (Alcohol current_stock is ~50,000 ml)
      const scale = await FormulaService.scaleFormula(
        'f-00000001-0000-0000-0000-000000000001',
        100000,
      );

      expect(scale.is_fulfillable).toBe(false);
      const alcohol = scale.ingredients.find((i) => i.name.includes('Ethanol'));
      expect(new Decimal(alcohol!.shortage).toNumber()).toBeGreaterThan(0);
    });

    it('rejects target volume smaller than total fixed ingredients', async () => {
      // Fixed is 20 ml, target is 10 ml
      await expect(
        FormulaService.scaleFormula('f-00000001-0000-0000-0000-000000000001', 10),
      ).rejects.toThrow(/exceed target batch volume/);
    });
  });

  describe('Formula Immutability & Auto-Lock', () => {
    it('prevents editing a locked formula', async () => {
      // Imperial Cambodi Oud Extrait is locked
      await expect(
        FormulaService.updateFormula('f-00000001-0000-0000-0000-000000000002', {
          notes: 'Attempting to change secret locked formula',
        }),
      ).rejects.toThrow(/locked and cannot be edited/);
    });

    it('allows locking an unlocked formula and stamps locked_at', async () => {
      const locked = await FormulaService.lockFormula(
        'f-00000001-0000-0000-0000-000000000001',
        'Commercial batch #BAT-2026-0002 initiated',
      );

      expect(locked.is_locked).toBe(true);
      expect(locked.locked_reason).toBe('Commercial batch #BAT-2026-0002 initiated');
      expect(locked.locked_at).toBeDefined();

      // Subsequent edit must fail
      await expect(
        FormulaService.updateFormula('f-00000001-0000-0000-0000-000000000001', {
          perfume_name: 'Modified Name',
        }),
      ).rejects.toThrow(/locked and cannot be edited/);
    });
  });

  describe('Version Cloning (V+1)', () => {
    it('clones formula to V+1, preserves ingredients, and archives the previous version', async () => {
      const cloned = await FormulaService.cloneToNewVersion(
        'f-00000001-0000-0000-0000-000000000002',
        true,
        'usr-production',
      );

      expect(cloned.version).toBe(2);
      expect(cloned.version_label).toBe('V2');
      expect(cloned.status).toBe('active');
      expect(cloned.is_locked).toBe(false);
      expect(cloned.ingredients?.length).toBe(3);

      // Previous version must now be archived
      const parent = await FormulaService.getFormulaById('f-00000001-0000-0000-0000-000000000002');
      expect(parent?.status).toBe('archived');
    });
  });
});
