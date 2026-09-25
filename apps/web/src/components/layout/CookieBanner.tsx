import React, { useState } from 'react';

const COOKIE_KEY = 'mahatir-cookie-choice';

export const CookieBanner: React.FC = () => {
    const [visible, setVisible] = useState(() => !window.localStorage.getItem(COOKIE_KEY));

    const choose = (choice: 'accepted' | 'rejected') => {
        window.localStorage.setItem(COOKIE_KEY, choice);
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <aside className="no-print fixed bottom-3 left-3 z-[75] w-[calc(100%-1.5rem)] max-w-sm rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md sm:bottom-4 sm:left-4 sm:p-4" aria-label="Cookie preferences">
            <p className="text-xs font-semibold text-foreground sm:text-sm">Privacy preferences</p>
            <p className="mt-1 max-w-prose text-[11px] leading-snug text-muted sm:text-xs sm:leading-relaxed">We use essential local storage for your theme and session preferences. No advertising cookies are used.</p>
            <div className="mt-2 flex justify-end gap-2 sm:mt-3">
                <button type="button" onClick={() => choose('rejected')} className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-muted hover:bg-surface hover:text-foreground sm:px-3 sm:py-1.5 sm:text-xs">
                    Reject
                </button>
                <button type="button" onClick={() => choose('accepted')} className="rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground hover:brightness-105 sm:px-3 sm:py-1.5 sm:text-xs">
                    Accept
                </button>
            </div>
        </aside>
    );
};
