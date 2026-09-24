import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import { DilutionService } from '../src/services/dilution.service.js';
import { InventoryService } from '../src/services/inventory.service.js';
import { FormulaService } from '../src/services/formula.service.js';
import { BatchService } from '../src/services/batch.service.js';

describe('Phase 7: Dilution Calculator and Studio Presets', () => {
  it('1. Retrieves industry-standard dilution presets (Extrait, EDP, EDT, EDC)', async () => {
    const presets = await DilutionService.getPresets();
    expect(presets.length).toBeGreaterThanOrEqual(5);

    const extrait = presets.find((p) => p.concentration_type === 'extrait');
    const edp = presets.find((p) => p.concentration_type === 'edp');
    const edt = presets.find((p) => p.concentration_type === 'edt');

    expect(extrait).toBeDefined();
    expect(edp).toBeDefined();
    expect(edt).toBeDefined();

    expect(Number(extrait!.oil_percentage)).toBeGreaterThanOrEqual(30);
    expect(Number(edp!.oil_percentage)).toBe(20);
    expect(Number(edt!.oil_percentage)).toBe(10);
  });

  it('2. Acceptance Criteria 1: 100 ml at 20% gives exactly 20 ml oil and 80 ml ethanol', async () => {
    const result = await DilutionService.calculate({
      target_volume: 100,
      concentration_type: 'edp',
      oil_percentage: 20,
    });

    expect(result.target_volume_ml).toBe('100.0000');
    expect(result.oil_percentage).toBe('20.0000');
    expect(result.alcohol_percentage).toBe('80.0000');
    expect(result.total_percentage).toBe('100.0000');

    const oilComp = result.components.find((c) => c.component_type === 'oil');
    const alcComp = result.components.find((c) => c.component_type === 'alcohol');

    expect(oilComp).toBeDefined();
    expect(alcComp).toBeDefined();

    // 100 ml * 20% = 20 ml
    expect(oilComp!.required_volume_ml).toBe('20.0000');
    // 100 ml * 80% = 80 ml
    expect(alcComp!.required_volume_ml).toBe('80.0000');

    // Cost verification
    const expectedCost = new Decimal(oilComp!.line_cost).plus(alcComp!.line_cost);
    expect(result.total_cost).toBe(expectedCost.toFixed(4));
    expect(result.cost_per_ml).toBe(expectedCost.div(100).toFixed(4));
  });

  it('3. Acceptance Criteria 1: Additives calculation (30% oil + 5% fixative = 65% ethanol)', async () => {
    const materials = await InventoryService.getRawMaterials();
    const fixativeMat = materials.data.find((m) => m.category === 'fixative');
    expect(fixativeMat).toBeDefined();

    const targetMl = 500;
    const result = await DilutionService.calculate({
      target_volume: targetMl,
      concentration_type: 'extrait',
      oil_percentage: 30,
      additives: [
        {
          raw_material_id: fixativeMat!.id,
          percentage: 5,
          notes: 'Ambroxan fixative booster',
        },
      ],
    });

    expect(result.target_volume_ml).toBe('500.0000');
    expect(result.oil_percentage).toBe('30.0000');
    expect(result.alcohol_percentage).toBe('65.0000'); // 100 - 30 - 5 = 65%
    expect(result.total_percentage).toBe('100.0000');

    const oilComp = result.components.find((c) => c.component_type === 'oil');
    const fixComp = result.components.find((c) => c.component_type === 'fixative');
    const alcComp = result.components.find((c) => c.component_type === 'alcohol');

    expect(oilComp!.required_volume_ml).toBe('150.0000'); // 500 * 30%
    expect(fixComp!.required_volume_ml).toBe('25.0000'); // 500 * 5%
    expect(alcComp!.required_volume_ml).toBe('325.0000'); // 500 * 65%
  });

  it('4. Rejects invalid concentration: oil + additives > 100%', async () => {
    await expect(
      DilutionService.calculate({
        target_volume: 100,
        concentration_type: 'custom',
        oil_percentage: 95,
        additives: [
          {
            raw_material_id: 'rm-00000001-0000-0000-0000-000000000004',
            percentage: 10, // 95 + 10 = 105% > 100%
          },
        ],
      }),
    ).rejects.toThrow(/cannot exceed 100%/);
  });

  it('5. Acceptance Criteria 2: Save as Formula works without re-entering data', async () => {
    const calc = await DilutionService.calculate({
      target_volume: 250,
      concentration_type: 'edp',
      oil_percentage: 22,
    });

    const formula = await DilutionService.saveAsFormula(
      {
        perfume_name: 'Santal Royal EDP Studio Blend',
        code: 'FOR-SANTAL-EDP-01',
        description: 'Formulated via Dilution Calculator with 22% oil concentration',
        calculation: calc,
      },
      'usr-prod-mgr',
    );

    expect(formula).toBeDefined();
    expect(formula.perfume_name).toBe('Santal Royal EDP Studio Blend');
    expect(formula.version_label).toBe('V1');
    expect(formula.target_concentration).toBe('EDP');
    expect(formula.ingredients?.length).toBe(calc.components.length);

    // Sum of percentage ingredients must equal 100%
    const sum = formula.ingredients!.reduce((acc, curr) => acc.plus(curr.value), new Decimal(0));
    expect(sum.toNumber()).toBe(100);

    // Retrieve via FormulaService to confirm persistence
    const saved = await FormulaService.getFormulaById(formula.id);
    expect(saved).not.toBeNull();
    expect(saved!.code).toBe('FOR-SANTAL-EDP-01');
  });

  it('6. Acceptance Criteria 2: Convert to Batch creates draft batch with target volume', async () => {
    const calc = await DilutionService.calculate({
      target_volume: 1000,
      concentration_type: 'extrait',
      oil_percentage: 35,
    });

    const batch = await DilutionService.convertToBatch(
      {
        perfume_name: 'Ambergris Extrait Prestige',
        code: 'FOR-AMB-EXT-01',
        target_volume: 1000,
        calculation: calc,
        notes: 'Direct batch conversion from Dilution Calculator studio',
      },
      'usr-prod-mgr',
    );

    expect(batch).toBeDefined();
    expect(batch.batch_code).toMatch(/^BAT-2026-\d{4}$/);
    expect(batch.expected_volume).toBe('1000.0000');
    expect(batch.status).toBe('draft');
    expect(Number(batch.total_cost)).toBeGreaterThan(0);

    // Verify batch is in BatchService registry
    const fetched = BatchService.getBatchByIdSync(batch.id);
    expect(fetched).toBeDefined();
    expect(fetched!.expected_volume).toBe('1000.0000');
  });
});
