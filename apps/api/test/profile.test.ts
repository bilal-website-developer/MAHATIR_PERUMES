import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const roles = ['demo-admin', 'demo-production', 'demo-inventory', 'demo-sales'] as const;

describe('Personal profile API', () => {
    const app = createApp();

    it.each(roles)('allows %s to read and update only their own profile details', async (token) => {
        const server = app.listen(0);
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 4000;
        const headers = { Authorization: `Bearer ${token}` };

        try {
            const profileResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile`, { headers });
            const profileBody = await profileResponse.json();
            expect(profileResponse.status).toBe(200);
            expect(profileBody.data.id).toBeTruthy();
            expect(profileBody.data).toHaveProperty('phone');

            const updateResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ display_title: 'Personal Profile Test', bio: 'A short profile bio.' }),
            });
            const updateBody = await updateResponse.json();
            expect(updateResponse.status).toBe(200);
            expect(updateBody.data.display_title).toBe('Personal Profile Test');
            expect(updateBody.data.bio).toBe('A short profile bio.');

            const protectedResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile`, {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: 'admin', branch_id: '00000000-0000-0000-0000-000000000001', is_active: false }),
            });
            expect(protectedResponse.status).toBe(400);
            const protectedBody = await protectedResponse.json();
            expect(protectedBody.error.code).toBe('INVALID_PROFILE');
        } finally {
            server.close();
        }
    });

    it('validates avatar type and size before storage', async () => {
        const server = app.listen(0);
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 4000;

        try {
            const invalidForm = new FormData();
            invalidForm.append('file', new Blob(['not an image'], { type: 'text/plain' }), 'avatar.txt');
            const invalidResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile/avatar`, {
                method: 'POST',
                headers: { Authorization: 'Bearer demo-sales' },
                body: invalidForm,
            });
            expect(invalidResponse.status).toBe(400);

            const validForm = new FormData();
            validForm.append('file', new Blob(['small image placeholder'], { type: 'image/png' }), 'avatar.png');
            const uploadResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile/avatar`, {
                method: 'POST',
                headers: { Authorization: 'Bearer demo-sales' },
                body: validForm,
            });
            const uploadBody = await uploadResponse.json();
            expect(uploadResponse.status).toBe(200);
            expect(uploadBody.data.avatar_url).toContain('data:image/png');

            const deleteResponse = await fetch(`http://127.0.0.1:${port}/api/v1/me/profile/avatar`, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer demo-sales' },
            });
            expect(deleteResponse.status).toBe(200);
            expect((await deleteResponse.json()).data.avatar_url).toBeNull();
        } finally {
            server.close();
        }
    });
});
