import { Router, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { supabaseAdmin } from '../config/supabase.js';
import { DEMO_USERS, requireAuth } from '../middleware/auth.js';
import { sendError, sendSuccess } from '../utils/response.js';

export const profileRouter = Router();
profileRouter.use(requireAuth);

const profilePatchSchema = z.object({
    display_title: z.string().trim().max(120).nullable().optional(),
    phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9 ()-]{7,25}$/, 'Phone number format is invalid')
        .nullable()
        .optional(),
    bio: z.string().trim().max(200, 'Bio must be 200 characters or fewer').nullable().optional(),
}).strict();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
        callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
    },
});

const demoProfiles = new Map(Object.values(DEMO_USERS).map((user) => [user.id, {
    id: user.id,
    email: user.email,
    full_name: user.fullName,
    role: user.role,
    branch_id: user.branchId,
    is_active: true,
    avatar_url: null as string | null,
    display_title: user.role === 'admin' ? 'Founder & Master Perfumer' : null as string | null,
    phone: null as string | null,
    bio: null as string | null,
    updated_at: new Date().toISOString(),
}]));

function isDemoUser(id: string): boolean {
    return demoProfiles.has(id);
}

function getDemoProfile(id: string) {
    return demoProfiles.get(id) || null;
}

function profileForResponse(profile: Record<string, any>) {
    return {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        role: profile.role,
        branch_id: profile.branch_id,
        is_active: profile.is_active,
        avatar_url: profile.avatar_url || null,
        display_title: profile.display_title || null,
        phone: profile.phone || null,
        bio: profile.bio || null,
        updated_at: profile.updated_at,
    };
}

profileRouter.get('/me/profile', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (isDemoUser(userId)) return sendSuccess(res, profileForResponse(getDemoProfile(userId)!));

    const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).single();
    if (error || !data) return sendError(res, error?.message || 'Profile not found', 404, 'PROFILE_NOT_FOUND');
    return sendSuccess(res, profileForResponse(data));
});

profileRouter.patch('/me/profile', async (req: Request, res: Response) => {
    const parsed = profilePatchSchema.safeParse(req.body);
    if (!parsed.success) return sendError(res, parsed.error.issues[0]?.message || 'Invalid profile payload', 400, 'INVALID_PROFILE');
    const updates = parsed.data;
    const userId = req.user!.id;

    if (isDemoUser(userId)) {
        const current = getDemoProfile(userId)!;
        const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
        demoProfiles.set(userId, updated);
        return sendSuccess(res, profileForResponse(updated));
    }

    const { data, error } = await supabaseAdmin.from('profiles').update(updates).eq('id', userId).select('*').single();
    if (error || !data) return sendError(res, error?.message || 'Profile update failed', 400, 'PROFILE_UPDATE_FAILED');
    return sendSuccess(res, profileForResponse(data));
});

profileRouter.post('/me/profile/avatar', upload.single('file'), async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) return sendError(res, 'Upload a JPG, PNG, or WebP image no larger than 2MB', 400, 'INVALID_AVATAR');
    const userId = req.user!.id;
    const extension = file.mimetype === 'image/jpeg' ? 'jpg' : file.mimetype.split('/')[1];
    const path = `${userId}/avatar.${extension}`;

    if (isDemoUser(userId)) {
        const avatarUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
        const current = getDemoProfile(userId)!;
        const updated = { ...current, avatar_url: avatarUrl, updated_at: new Date().toISOString() };
        demoProfiles.set(userId, updated);
        return sendSuccess(res, { avatar_url: avatarUrl });
    }

    const storage = supabaseAdmin.storage.from('avatars');
    await storage.remove(['jpg', 'jpeg', 'png', 'webp'].map((ext) => `${userId}/avatar.${ext}`));
    const { error: uploadError } = await storage.upload(path, file.buffer, {
        contentType: file.mimetype,
        cacheControl: '3600',
        upsert: true,
    });
    if (uploadError) return sendError(res, uploadError.message, 400, 'AVATAR_UPLOAD_FAILED');

    const { data: publicUrl } = storage.getPublicUrl(path);
    const avatarUrl = publicUrl.publicUrl;
    const { error: profileError } = await supabaseAdmin.from('profiles').update({ avatar_url: avatarUrl }).eq('id', userId);
    if (profileError) return sendError(res, profileError.message, 400, 'PROFILE_UPDATE_FAILED');
    return sendSuccess(res, { avatar_url: avatarUrl });
});

profileRouter.delete('/me/profile/avatar', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    if (isDemoUser(userId)) {
        const current = getDemoProfile(userId)!;
        const updated = { ...current, avatar_url: null, updated_at: new Date().toISOString() };
        demoProfiles.set(userId, updated);
        return sendSuccess(res, { avatar_url: null });
    }

    const storage = supabaseAdmin.storage.from('avatars');
    const { error: storageError } = await storage.remove(['jpg', 'jpeg', 'png', 'webp'].map((ext) => `${userId}/avatar.${ext}`));
    if (storageError) return sendError(res, storageError.message, 400, 'AVATAR_DELETE_FAILED');
    const { error } = await supabaseAdmin.from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (error) return sendError(res, error.message, 400, 'PROFILE_UPDATE_FAILED');
    return sendSuccess(res, { avatar_url: null });
});
