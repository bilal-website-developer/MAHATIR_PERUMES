import React, { useEffect, useRef, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { DemoDataBanner } from './DemoDataBanner';
import { ContactButton } from './ContactButton';
import { ArrowUp } from 'lucide-react';

export const AppLayout: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const scrollContainer = mainRef.current;
    if (!scrollContainer) return undefined;

    const handleScroll = () => {
      const scrollableHeight = scrollContainer.scrollHeight - scrollContainer.clientHeight;
      const progress = scrollableHeight > 0 ? (scrollContainer.scrollTop / scrollableHeight) * 100 : 0;
      setIsScrolled(scrollContainer.scrollTop > 8);
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <a
        href="#main-content"
        className="sr-only fixed left-4 top-4 z-[60] rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground shadow-lg focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-accent"
      >
        Skip to content
      </a>
      <div className="flex min-h-screen min-w-0 overflow-x-hidden bg-background text-foreground">
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 bg-transparent"
          aria-hidden="true"
        >
          <div
            className="h-full bg-accent transition-[width] duration-150"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
        {/* Sidebar */}
        <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />

        {/* Main Content Area */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar isScrolled={isScrolled} onMenuOpen={() => setIsMenuOpen(true)} />
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 w-full max-w-7xl mx-auto overflow-y-auto p-6 outline-none md:p-8"
          >
            <DemoDataBanner />
            <Outlet />
          </main>
        </div>
        {isScrolled && (
          <button
            type="button"
            aria-label="Back to top"
            title="Back to top"
            onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 z-30 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-lg transition-transform hover:-translate-y-0.5 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-28 md:right-8"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
        <ContactButton />
      </div>
    </>
  );
};
