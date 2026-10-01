import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';
import { InventoryService } from './inventory.service.js';
import { FormulaService } from './formula.service.js';
import { BatchService } from './batch.service.js';
import { ProductService } from './product.service.js';
import { BottlingService } from './bottling.service.js';
import { SalesService } from './sales.service.js';
import { NotificationService } from './notification.service.js';

let databaseClearanceConfirmed = false;
let lastClearanceCheck = 0;
let clearanceCheck: Promise<void> | null = null;

export function markDemoDataCleared(): void {
    databaseClearanceConfirmed = true;
    InventoryService.clearDemoData();
    FormulaService.clearDemoData();
    BatchService.clearDemoData();
    ProductService.clearDemoData();
    BottlingService.clearDemoData();
    SalesService.clearDemoData();
    NotificationService.clearDemoData();
}

export async function syncDemoDataClearance(): Promise<void> {
    if (env.NODE_ENV === 'test' || databaseClearanceConfirmed) return;
    if (Date.now() - lastClearanceCheck < 5_000) return;

    if (!clearanceCheck) {
        clearanceCheck = (async () => {
            lastClearanceCheck = Date.now();
            try {
                const { data, error } = await supabaseAdmin
                    .from('demo_data_clearance')
                    .select('id')
                    .eq('id', true)
                    .maybeSingle();
                if (!error && data) markDemoDataCleared();
            } catch (_error) {
                // Leave demo fallback enabled when the clearance state cannot be read.
            }
        })().finally(() => {
            clearanceCheck = null;
        });
    }

    await clearanceCheck;
}