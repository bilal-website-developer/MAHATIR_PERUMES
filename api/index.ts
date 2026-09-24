import type { Request, Response } from 'express';
import { createApp } from '../apps/api/src/app.js';

const app = createApp();

export default function handler(req: Request, res: Response) {
    if (req.url?.startsWith('/api')) {
        req.url = req.url.slice('/api'.length) || '/';
    }

    return app(req, res);
}
