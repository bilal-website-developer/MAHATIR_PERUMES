import React from 'react';

const DEFAULT_UTM = {
    utm_source: 'mahatir-erp',
    utm_medium: 'web-app',
    utm_campaign: 'navigation',
};

export function withUtmParams(href: string, params: Partial<typeof DEFAULT_UTM> = {}): string {
    const url = new URL(href, window.location.origin);
    const values = { ...DEFAULT_UTM, ...params };
    Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, value));
    return url.toString();
}

interface TrackedLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
    utm?: Partial<typeof DEFAULT_UTM>;
}

export const TrackedLink: React.FC<TrackedLinkProps> = ({ href = '#', utm, ...props }) => {
    const isExternal = href.startsWith('http://') || href.startsWith('https://');
    const trackedHref = isExternal ? withUtmParams(href, utm) : href;
    return <a href={trackedHref} {...props} />;
};
