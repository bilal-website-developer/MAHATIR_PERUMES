import React, { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, LogOut, Shield, Trash2, User as UserIcon, X } from 'lucide-react';
import { User } from '../../context/AuthContext';
import { apiClient } from '../../lib/api';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface Profile {
    id: string;
    email: string;
    full_name: string;
    role: User['role'];
    avatar_url: string | null;
    display_title: string | null;
    phone: string | null;
    bio: string | null;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

const Avatar: React.FC<{ profile: Pick<Profile, 'avatar_url' | 'full_name'>; large?: boolean }> = ({ profile, large = false }) => (
    <div className={`${large ? 'h-24 w-24 text-2xl' : 'h-8 w-8 text-xs'} flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-accent/40 bg-accent/15 font-semibold text-accent`}>
        {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : initials(profile.full_name || 'Staff Member') || <UserIcon className="h-4 w-4" />}
    </div>
);

export const ProfileMenu: React.FC<{ user: User; onLogout: () => void }> = ({ user, onLogout }) => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState({ display_title: '', phone: '', bio: '' });
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const loadProfile = async () => {
        const response = await apiClient<Profile>('/api/v1/me/profile');
        if (response.data) {
            setProfile(response.data);
            setDraft({
                display_title: response.data.display_title || '',
                phone: response.data.phone || '',
                bio: response.data.bio || '',
            });
        } else {
            setError(response.error?.message || 'Unable to load your profile.');
        }
    };

    useEffect(() => {
        if (isOpen) void loadProfile();
    }, [isOpen]);

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', closeOnOutsideClick);
        return () => document.removeEventListener('mousedown', closeOnOutsideClick);
    }, []);

    const displayedProfile: Profile = profile || {
        id: user.id,
        email: user.email,
        full_name: user.fullName,
        role: user.role,
        avatar_url: null,
        display_title: user.role === 'admin' ? 'Founder & Master Perfumer' : null,
        phone: null,
        bio: null,
    };

    const hasDetailsChange = profile && (
        draft.display_title !== (profile.display_title || '') ||
        draft.phone !== (profile.phone || '') ||
        draft.bio !== (profile.bio || '')
    );
    const hasAvatarChange = pendingFile !== null;

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setError('Choose a JPG, PNG, or WebP image.');
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setError('Profile photos must be 2MB or smaller.');
            return;
        }
        setError(null);
        setMessage(null);
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const saveProfile = async () => {
        setSaving(true);
        setError(null);
        setMessage(null);
        try {
            let nextProfile = profile;
            if (hasDetailsChange) {
                const response = await apiClient<Profile>('/api/v1/me/profile', {
                    method: 'PATCH',
                    body: JSON.stringify(draft),
                });
                if (!response.data) throw new Error(response.error?.message || 'Unable to save profile details.');
                nextProfile = response.data;
            }
            if (pendingFile) {
                const formData = new FormData();
                formData.append('file', pendingFile);
                const response = await apiClient<{ avatar_url: string }>('/api/v1/me/profile/avatar', { method: 'POST', body: formData });
                if (!response.data) throw new Error(response.error?.message || 'Unable to upload profile photo.');
                nextProfile = { ...(nextProfile || displayedProfile), avatar_url: response.data.avatar_url };
            }
            if (nextProfile) setProfile(nextProfile);
            setPendingFile(null);
            setPreviewUrl(null);
            setMessage('Profile saved successfully.');
            setIsEditing(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Unable to save profile.');
        } finally {
            setSaving(false);
        }
    };

    const removeAvatar = async () => {
        setSaving(true);
        setError(null);
        const response = await apiClient<{ avatar_url: null }>('/api/v1/me/profile/avatar', { method: 'DELETE' });
        if (response.data) {
            setProfile((current) => current ? { ...current, avatar_url: null } : current);
            setPreviewUrl(null);
            setPendingFile(null);
            setMessage('Profile photo removed.');
            setShowRemoveConfirm(false);
        } else {
            setError(response.error?.message || 'Unable to remove profile photo.');
        }
        setSaving(false);
    };

    return (
        <div ref={menuRef} className="relative flex items-center border-l border-border pl-2">
            <button
                type="button"
                aria-label="Open my profile"
                aria-expanded={isOpen}
                onClick={() => { setIsOpen((open) => !open); setError(null); setMessage(null); }}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                <Avatar profile={displayedProfile} />
                <span className="hidden min-w-0 sm:block">
                    <span className="block max-w-[220px] truncate text-xs font-semibold leading-tight text-foreground">{user.fullName}</span>
                    <span className="mt-0.5 flex items-center gap-1 text-[10px] font-medium text-accent">
                        <Shield className="h-2.5 w-2.5" />
                        <span>{displayedProfile.display_title || user.role}</span>
                    </span>
                </span>
            </button>

            <button type="button" onClick={onLogout} className="rounded-lg p-1.5 text-muted transition-colors hover:text-danger" title="Sign Out" aria-label="Sign Out">
                <LogOut className="h-4 w-4" />
            </button>

            {isOpen && (
                <button type="button" className="fixed inset-0 z-40 cursor-default bg-background/40 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-2 sm:h-auto sm:w-[360px] sm:rounded-xl sm:border sm:border-border sm:bg-card sm:shadow-2xl" aria-label="Close profile" onClick={() => setIsOpen(false)} />
            )}
            {isOpen && (
                <section className="fixed inset-x-0 bottom-0 z-50 max-h-[92vh] overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:w-[360px] sm:rounded-xl" role="dialog" aria-label="My profile">
                    <div className="flex items-start justify-between border-b border-border pb-4">
                        <div className="flex items-center gap-3"><Avatar profile={displayedProfile} large /><div><h2 className="font-serif text-lg font-semibold text-foreground">{user.fullName}</h2><p className="text-xs text-muted">{displayedProfile.display_title || user.role}</p></div></div>
                        <button type="button" aria-label="Close profile" onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"><X className="h-4 w-4" /></button>
                    </div>
                    {error && <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
                    {message && <p className="mt-3 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-xs text-success">{message}</p>}
                    {!isEditing ? (
                        <div className="space-y-4 pt-4"><div className="text-xs text-muted">{displayedProfile.bio || 'Manage your personal details and profile photo.'}</div><Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="w-full"><Camera className="mr-2 h-3.5 w-3.5" /> Edit Profile</Button></div>
                    ) : (
                        <div className="space-y-4 pt-4">
                            <div className="flex items-center gap-3"><div className="relative"><Avatar profile={{ ...displayedProfile, avatar_url: previewUrl || displayedProfile.avatar_url }} large /><ImagePlus className="absolute bottom-0 right-0 h-6 w-6 rounded-full bg-accent p-1 text-accent-foreground" /></div><div><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} className="hidden" /><Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>Upload photo</Button>{displayedProfile.avatar_url && !pendingFile && <button type="button" onClick={() => setShowRemoveConfirm(true)} className="ml-2 text-xs text-danger hover:underline"><Trash2 className="mr-1 inline h-3 w-3" />Remove</button>}<p className="mt-1 text-[10px] text-muted">JPG, PNG, or WebP. Maximum 2MB.</p></div></div>
                            <label className="block text-xs font-medium text-muted">Display title<input value={draft.display_title} onChange={(event) => setDraft({ ...draft, display_title: event.target.value })} maxLength={120} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" placeholder="Founder & Master Perfumer" /></label>
                            <label className="block text-xs font-medium text-muted">Phone<input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" placeholder="+92 300 1234567" /></label>
                            <label className="block text-xs font-medium text-muted">Bio<textarea value={draft.bio} onChange={(event) => setDraft({ ...draft, bio: event.target.value })} maxLength={200} rows={3} className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent" /><span className="mt-1 block text-right text-[10px] text-muted">{draft.bio.length}/200</span></label>
                            <div className="flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setPendingFile(null); setPreviewUrl(null); }}>Cancel</Button><Button size="sm" disabled={!hasDetailsChange && !hasAvatarChange} isLoading={saving} onClick={saveProfile}>Save</Button></div>
                        </div>
                    )}
                </section>
            )}
            <ConfirmDialog open={showRemoveConfirm} title="Remove profile photo?" message="Your header will return to the initials avatar." confirmLabel="Remove photo" onConfirm={removeAvatar} onCancel={() => setShowRemoveConfirm(false)} isLoading={saving} />
        </div>
    );
};
