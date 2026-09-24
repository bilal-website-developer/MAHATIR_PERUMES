import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { NotificationService, AlertSeverity, AlertType } from '../services/notification.service.js';

export const notificationsRouter = Router();

notificationsRouter.use(requireAuth);

// GET /api/v1/notifications
notificationsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { is_read, severity, type } = req.query as {
      is_read?: string;
      severity?: AlertSeverity;
      type?: AlertType;
    };

    const isReadBool = is_read !== undefined ? is_read === 'true' : undefined;

    const result = await NotificationService.getNotifications({
      is_read: isReadBool,
      severity,
      type,
    });

    return sendSuccess(res, result.data, {
      total: result.total,
      unread_count: result.unread_count,
    });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/v1/notifications/unread-count
notificationsRouter.get('/unread-count', async (_req: Request, res: Response) => {
  try {
    const unreadCount = await NotificationService.getUnreadCount();
    return sendSuccess(res, { unread_count: unreadCount });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/v1/notifications/:id/read
notificationsRouter.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const userId = (req as any).user?.id;
    const updated = await NotificationService.markAsRead(id, userId);

    if (!updated) {
      return sendError(res, 'Notification not found or already read', 404);
    }

    return sendSuccess(res, { success: true, id });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/v1/notifications/read-all
notificationsRouter.post('/read-all', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const count = await NotificationService.markAllAsRead(userId);
    return sendSuccess(res, { success: true, marked_read: count });
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// POST /api/v1/notifications/scan (manual trigger for low stock sweep)
notificationsRouter.post('/scan', async (_req: Request, res: Response) => {
  try {
    const result = await NotificationService.triggerAlertScan();
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});

// GET /api/v1/system/integrity-check (Negative Stock Guard Review)
notificationsRouter.get('/integrity-check', async (_req: Request, res: Response) => {
  try {
    const result = await NotificationService.checkStockIntegrity();
    return sendSuccess(res, result);
  } catch (err: any) {
    return sendError(res, err.message, 500);
  }
});
