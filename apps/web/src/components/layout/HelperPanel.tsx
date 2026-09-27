import React, { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { apiClient } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

interface HelperMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    fallback?: boolean;
    localWelcome?: boolean;
}

interface HelperResponse {
    conversation_id: string;
    reply: string;
    fallback?: boolean;
}

const STORAGE_KEY = 'mahatir_helper_session';

const HELPER_WELCOME_ID = 'helper-local-welcome';
const HELPER_GREETING = "Hi, I'm Helper 👋 — click me anytime you need help.";

function loadSession(): { open: boolean; messages: HelperMessage[]; conversationId?: string } {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) return JSON.parse(saved) as { open: boolean; messages: HelperMessage[]; conversationId?: string };
    } catch {
        // Ignore unavailable or malformed browser storage.
    }
    return { open: false, messages: [], conversationId: undefined };
}

export const HelperPanel: React.FC = () => {
    const { user } = useAuth();
    const location = useLocation();
    const initialSession = loadSession();
    const [isOpen, setIsOpen] = useState(initialSession.open);
    const [messages, setMessages] = useState<HelperMessage[]>(initialSession.messages);
    const [conversationId, setConversationId] = useState(initialSession.conversationId);
    const [draft, setDraft] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showAutoGreeting, setShowAutoGreeting] = useState(false);
    const [isGreetingHovered, setIsGreetingHovered] = useState(false);
    const [greetingMounted, setGreetingMounted] = useState(false);
    const hoverStateRef = useRef(false);
    const hoverHideTimerRef = useRef<number | undefined>(undefined);
    const inputRef = useRef<HTMLInputElement>(null);
    const messagesRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!user || isOpen) return undefined;

        const showTimer = window.setTimeout(() => {
            setGreetingMounted(true);
            setShowAutoGreeting(true);
        }, 1200);
        const dismissTimer = window.setTimeout(() => {
            setShowAutoGreeting(false);
            window.setTimeout(() => {
                if (!hoverStateRef.current) setGreetingMounted(false);
            }, 350);
        }, 8200);
        return () => {
            window.clearTimeout(showTimer);
            window.clearTimeout(dismissTimer);
            window.clearTimeout(hoverHideTimerRef.current);
        };
    }, [user, isOpen]);

    useEffect(() => {
        if (isOpen && messages.length === 0) {
            setMessages([{ id: HELPER_WELCOME_ID, role: 'assistant', content: '', localWelcome: true }]);
        }
    }, [isOpen, messages.length]);

    useEffect(() => {
        try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ open: isOpen, messages, conversationId }));
        } catch {
            // Persistence is best-effort and must not interrupt the ERP.
        }
    }, [conversationId, isOpen, messages]);

    useEffect(() => {
        if (!isOpen) return;
        inputRef.current?.focus();
        messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight });
    }, [isOpen, messages, isSending]);

    const sendMessage = async (event?: React.FormEvent) => {
        event?.preventDefault();
        const message = draft.trim();
        if (!message || isSending) return;

        setDraft('');
        setError(null);
        setMessages((current) => [...current, { id: `user-${Date.now()}`, role: 'user', content: message }]);
        setIsSending(true);

        const response = await apiClient<HelperResponse>('/api/v1/helper/chat', {
            method: 'POST',
            body: JSON.stringify({
                message,
                conversation_id: conversationId,
                current_page: location.pathname,
            }),
        });

        if (response.data) {
            setConversationId(response.data.conversation_id);
            setMessages((current) => [
                ...current,
                {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: response.data!.reply,
                    fallback: response.data!.fallback,
                },
            ]);
        } else {
            setError(response.error?.message || 'Helper could not respond right now.');
        }
        setIsSending(false);
    };

    const resetConversation = () => {
        setMessages([]);
        setConversationId(undefined);
        setError(null);
    };

    const openHelper = () => {
        setShowAutoGreeting(false);
        setIsGreetingHovered(false);
        hoverStateRef.current = false;
        setGreetingMounted(false);
        setIsOpen(true);
    };

    const showGreetingOnHover = () => {
        window.clearTimeout(hoverHideTimerRef.current);
        hoverStateRef.current = true;
        setIsGreetingHovered(true);
        setGreetingMounted(true);
    };

    const hideGreetingOnHover = () => {
        hoverStateRef.current = false;
        setIsGreetingHovered(false);
        window.clearTimeout(hoverHideTimerRef.current);
        hoverHideTimerRef.current = window.setTimeout(() => {
            if (!showAutoGreeting && !hoverStateRef.current) setGreetingMounted(false);
        }, 120);
    };

    const renderMessage = (message: HelperMessage) => {
        if (message.localWelcome) {
            return (
                <div className="space-y-3">
                    <p>Hi! I'm Helper, your assistant inside Mahatir's ERP.</p>
                    <p>I can help you:</p>
                    <ul className="list-disc space-y-1 pl-5">
                        <li>Find things — stock levels, batch costs, past sales</li>
                        <li>Understand a screen — just ask "what does this do?"</li>
                        <li>Get started on a task — I'll open a form pre-filled, you always confirm before anything is saved</li>
                    </ul>
                    <p>I can't create, delete, or confirm anything on my own — you're always in control. What can I help with?</p>
                </div>
            );
        }
        return <>{message.content}{message.fallback && <p className="mt-1 text-[11px] opacity-75">You can continue using the ERP normally.</p>}</>;
    };

    return (
        <>
            {isOpen && (
                <section
                    role="dialog"
                    aria-modal="false"
                    aria-labelledby="helper-title"
                    className="fixed bottom-24 right-4 z-40 flex h-[min(38rem,calc(100vh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-accent/30 bg-card shadow-2xl shadow-accent/10 md:bottom-24 md:right-8"
                >
                    <header className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 id="helper-title" className="text-sm font-semibold text-foreground">Helper</h2>
                            <p className="truncate text-[11px] text-muted">Mahatir ERP assistant</p>
                        </div>
                        <button type="button" onClick={resetConversation} className="rounded p-1.5 text-muted hover:bg-card hover:text-foreground" aria-label="Reset Helper conversation" title="Reset conversation">
                            <span className="text-[11px] font-semibold">Reset</span>
                        </button>
                        <button type="button" onClick={() => setIsOpen(false)} className="rounded p-1.5 text-muted hover:bg-card hover:text-foreground" aria-label="Close Helper">
                            <X className="h-4 w-4" />
                        </button>
                    </header>

                    <div ref={messagesRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
                        {messages.length === 0 && (
                            <div className="rounded-xl border border-accent/20 bg-accent-soft p-4 text-sm text-foreground">
                                <div className="mb-2 flex items-center gap-2 font-semibold"><Bot className="h-4 w-4 text-accent" /> How can I help?</div>
                                <p className="text-xs leading-5 text-muted">Ask about this ERP screen or request an explanation. Verify important numbers before acting.</p>
                            </div>
                        )}
                        {messages.map((message) => (
                            <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[88%] rounded-xl px-3 py-2 text-sm leading-5 ${message.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-surface text-foreground'}`}>
                                    {renderMessage(message)}
                                </div>
                            </div>
                        ))}
                        {isSending && <div className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Helper is thinking...</div>}
                        {error && <p className="text-xs text-danger">{error}</p>}
                    </div>

                    <form onSubmit={sendMessage} className="border-t border-border bg-surface p-3">
                        <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 focus-within:border-accent/70">
                            <input
                                ref={inputRef}
                                value={draft}
                                onChange={(event) => setDraft(event.target.value)}
                                placeholder="Ask Helper..."
                                aria-label="Message Helper"
                                disabled={isSending}
                                className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-foreground placeholder-muted focus:outline-none"
                            />
                            <button type="submit" disabled={!draft.trim() || isSending} aria-label="Send message" className="erp-primary-button rounded-lg bg-accent p-2 text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40">
                                <Send className="h-4 w-4" />
                            </button>
                        </div>
                        <p className="mt-2 text-center text-[10px] text-muted">Helper can make mistakes. Verify important information.</p>
                    </form>
                </section>
            )}
            {greetingMounted && user && (
                <button
                    type="button"
                    onMouseDown={(event) => event.stopPropagation()}
                    onMouseEnter={showGreetingOnHover}
                    onMouseLeave={hideGreetingOnHover}
                    onClick={openHelper}
                    className={`fixed bottom-20 right-4 z-40 max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-accent/30 bg-card px-4 py-3 text-left text-xs leading-5 text-foreground shadow-xl shadow-accent/10 transition-opacity duration-300 motion-reduce:transition-none md:bottom-24 md:right-8 ${showAutoGreeting || isGreetingHovered ? 'opacity-100' : 'opacity-0'}`}
                >
                    <span className="block">{HELPER_GREETING}</span>
                    <span className="absolute -bottom-1.5 right-6 h-3 w-3 rotate-45 border-b border-r border-accent/30 bg-card" aria-hidden="true" />
                </button>
            )}
            <button
                type="button"
                onClick={() => (isOpen ? setIsOpen(false) : openHelper())}
                onMouseEnter={showGreetingOnHover}
                onMouseLeave={hideGreetingOnHover}
                data-print-hidden="true"
                aria-label={isOpen ? 'Close Helper' : 'Open Helper AI assistant'}
                title="Helper AI assistant"
                className="erp-primary-button fixed bottom-6 right-6 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-8 md:right-8"
            >
                {isOpen ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
            </button>
        </>
    );
};