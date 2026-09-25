import React from 'react';
import { MessageCircle } from 'lucide-react';

export const ContactButton: React.FC = () => {
    return (
        <a
            href="mailto:contact@mahatirperfumes.com?subject=Mahatir%20Perfumes%20ERP%20Support"
            data-print-hidden="true"
            aria-label="Contact Mahatir Perfumes support"
            title="Contact support"
            className="fixed bottom-6 right-6 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg shadow-accent/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background md:bottom-8 md:right-8"
        >
            <MessageCircle className="h-5 w-5" />
        </a>
    );
};
