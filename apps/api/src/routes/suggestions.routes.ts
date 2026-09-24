import { Router, Request, Response } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { SuggestionService } from '../services/suggestion.service.js';

export const suggestionsRouter = Router();

suggestionsRouter.use(requireAuth);

// GET /api/v1/suggestions/production
suggestionsRouter.get(
  '/production',
  requireRole('admin', 'production_manager', 'inventory_manager'),
  async (req: Request, res: Response) => {
    try {
      const runwayDays = req.query.runway_days ? parseInt(req.query.runway_days as string, 10) : 30;
      const result = await SuggestionService.getProductionSuggestions(isNaN(runwayDays) ? 30 : runwayDays);

      return sendSuccess(res, result.data, {
        total: result.total,
        urgent_count: result.summary.urgent_count,
        total_skus: result.summary.total_skus,
      });
    } catch (err: any) {
      return sendError(res, err.message, 500);
    }
  }
);
