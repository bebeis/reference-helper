// URL Helper Utilities

/**
 * Blog platform detection patterns
 */
const BLOG_PLATFORMS = {
    TISTORY: {
        name: 'Tistory',
        patterns: [/https?:\/\/.*\.tistory\.com/],
        writePatterns: [
            /https?:\/\/.*\.tistory\.com\/manage\/newpost/  // Both new and edit (e.g., /manage/newpost/479)
        ]
    },
    VELOG: {
        name: 'Velog',
        patterns: [/https?:\/\/velog\.io/],
        writePatterns: [
            /https?:\/\/velog\.io\/write/,  // Includes /write?id=...
            /https?:\/\/velog\.io\/@.*\/edit/
        ]
    },
    BRUNCH: {
        name: 'Brunch',
        patterns: [/https?:\/\/brunch\.co\.kr/],
        writePatterns: [
            /https?:\/\/brunch\.co\.kr\/@@.*\/write/
        ]
    },
    MEDIUM: {
        name: 'Medium',
        patterns: [/https?:\/\/.*medium\.com/],
        writePatterns: [
            /https?:\/\/.*medium\.com\/p\/.*\/edit/,
            /https?:\/\/.*medium\.com\/new-story/
        ]
    }
};

/**
 * Detect if current URL is a blog platform
 */
function detectBlogPlatform(url = window.location.href) {
    for (const [key, platform] of Object.entries(BLOG_PLATFORMS)) {
        if (platform.patterns.some(pattern => pattern.test(url))) {
            return {
                id: key,
                name: platform.name,
                isWritePage: platform.writePatterns.some(pattern => pattern.test(url))
            };
        }
    }
    return null;
}

/**
 * Check if current page is a blog writing page
 */
function isWritingPage(url = window.location.href) {
    const platform = detectBlogPlatform(url);
    return platform ? platform.isWritePage : false;
}

/**
 * Extract page metadata
 */
function extractPageMetadata() {
    const metadata = {
        title: document.title,
        url: window.location.href,
        description: '',
        author: '',
        publishedDate: '',
        image: ''
    };

    // Open Graph tags
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const ogDescription = document.querySelector('meta[property="og:description"]');
    const ogImage = document.querySelector('meta[property="og:image"]');
    const ogAuthor = document.querySelector('meta[property="og:author"]');
    const ogPublishedTime = document.querySelector('meta[property="article:published_time"]');

    if (ogTitle) metadata.title = ogTitle.content;
    if (ogDescription) metadata.description = ogDescription.content;
    if (ogImage) metadata.image = ogImage.content;
    if (ogAuthor) metadata.author = ogAuthor.content;
    if (ogPublishedTime) metadata.publishedDate = ogPublishedTime.content;

    // Twitter Card tags
    if (!metadata.description) {
        const twitterDescription = document.querySelector('meta[name="twitter:description"]');
        if (twitterDescription) metadata.description = twitterDescription.content;
    }

    if (!metadata.image) {
        const twitterImage = document.querySelector('meta[name="twitter:image"]');
        if (twitterImage) metadata.image = twitterImage.content;
    }

    // Meta description
    if (!metadata.description) {
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) metadata.description = metaDescription.content;
    }

    // Author from meta tag
    if (!metadata.author) {
        const metaAuthor = document.querySelector('meta[name="author"]');
        if (metaAuthor) metadata.author = metaAuthor.content;
    }

    return metadata;
}

/**
 * Normalize URL (remove tracking params, fragments)
 */
function normalizeUrl(url) {
    try {
        const urlObj = new URL(url);

        // Remove common tracking parameters
        const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid'];
        trackingParams.forEach(param => {
            urlObj.searchParams.delete(param);
        });

        // Remove fragment
        urlObj.hash = '';

        return urlObj.toString();
    } catch (e) {
        return url;
    }
}

/**
 * Get domain from URL
 */
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname;
    } catch (e) {
        return '';
    }
}

/**
 * Check if URL is valid
 */
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Get favicon URL for a domain
 */
function getFaviconUrl(url) {
    try {
        const urlObj = new URL(url);
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
    } catch (e) {
        return '';
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BLOG_PLATFORMS,
        detectBlogPlatform,
        isWritingPage,
        extractPageMetadata,
        normalizeUrl,
        getDomain,
        isValidUrl,
        getFaviconUrl
    };
}
