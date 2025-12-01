// Visit Tracker - Track meaningful page visits with time threshold

(function () {
    'use strict';

    let visitTimer = null;
    let hasRecorded = false;
    const VISIT_THRESHOLD = 20000; // 20 seconds

    // Check if current page should be tracked
    async function startVisitTracking() {
        // Skip invalid URLs
        if (!shouldTrackUrl(window.location.href)) {
            return;
        }

        // Check settings
        const settings = await getSettings();
        if (!settings.trackVisit) {
            return;
        }

        // Check if URL matches excluded patterns
        if (isExcludedDomain(window.location.href, settings.excludedDomains || [])) {
            return;
        }

        // Don't track writing pages (blog editors)
        if (isWritingPage()) {
            console.log('[Visit Tracker] Skipping visit tracking for writing page');
            return;
        }

        // Start timer - record visit after 20 seconds
        visitTimer = setTimeout(async () => {
            if (!hasRecorded) {
                await recordVisit();
                hasRecorded = true;
            }
        }, VISIT_THRESHOLD);
    }

    // Check if URL should be tracked
    function shouldTrackUrl(url) {
        try {
            const urlObj = new URL(url);

            // Exclude internal Chrome pages
            if (urlObj.protocol === 'chrome:' ||
                urlObj.protocol === 'chrome-extension:' ||
                urlObj.protocol === 'file:' ||
                urlObj.protocol === 'about:') {
                return false;
            }

            // Exclude localhost
            if (urlObj.hostname === 'localhost' ||
                urlObj.hostname === '127.0.0.1' ||
                urlObj.hostname.endsWith('.local')) {
                return false;
            }

            // Exclude empty pages
            if (urlObj.href === 'about:blank' || urlObj.href === '') {
                return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    // Check if domain matches excluded patterns
    function isExcludedDomain(url, excludedPatterns) {
        if (!excludedPatterns || excludedPatterns.length === 0) {
            return false;
        }

        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;

            return excludedPatterns.some(pattern => {
                // Convert glob pattern to regex
                const regexPattern = pattern
                    .replace(/\./g, '\\.')  // Escape dots
                    .replace(/\*/g, '.*');   // Convert * to .*

                const regex = new RegExp('^' + regexPattern + '$', 'i');
                return regex.test(hostname);
            });
        } catch (e) {
            return false;
        }
    }

    // Record the visit
    async function recordVisit() {
        const metadata = extractPageMetadata();

        await chrome.runtime.sendMessage({
            type: 'ADD_TO_VISIT_HISTORY',
            data: {
                title: document.title || 'Untitled',
                url: window.location.href,
                description: metadata.description,
                author: metadata.author,
                timestamp: Date.now()
            }
        });
    }

    // Get settings from storage
    async function getSettings() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_STORAGE', keys: ['settings'] }, (response) => {
                resolve(response?.settings || {});
            });
        });
    }

    // Clean up timer on page unload
    window.addEventListener('beforeunload', () => {
        if (visitTimer) {
            clearTimeout(visitTimer);
        }
    });

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startVisitTracking);
    } else {
        startVisitTracking();
    }

})();
