// Writing Page Detector - Auto-open popup on writing pages

(function () {
    'use strict';

    // Check if popup auto-open is enabled in settings
    chrome.runtime.sendMessage({ type: 'GET_STORAGE', keys: ['settings'] }, (response) => {
        const settings = response?.settings;

        // Check if auto-open is enabled (default: true)
        if (settings && settings.autoOpenPopup === false) {
            console.log('[Writing Page] Popup auto-open is disabled');
            return;
        }

        // Wait a bit for page to stabilize, then open popup
        setTimeout(() => {
            chrome.runtime.sendMessage({ type: 'OPEN_POPUP_ON_WRITING_PAGE' });
        }, 1000);
    });

})();
