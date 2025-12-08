// Capture Handler - Handle text selection and keyboard shortcuts for adding references

(function () {
    'use strict';

    let selectedText = '';
    let lastCopyTime = 0;
    let isInternalCopy = false;  // Flag for internal operations

    // Sensitive data detector is loaded from utils/sensitive-data-detector.js via manifest.json
    // Uses global isSensitiveData() function

    // Listen for internal copy operations
    document.addEventListener('ref-helper-internal-copy', () => {
        isInternalCopy = true;
        // Reset flag after a short delay
        setTimeout(() => {
            isInternalCopy = false;
        }, 100);
    });

    // Listen for text selection
    document.addEventListener('mouseup', handleSelection);
    document.addEventListener('keyup', handleSelection);

    async function handleSelection() {
        const selection = window.getSelection();
        selectedText = selection.toString().trim();
    }

    // Listen for copy events
    document.addEventListener('copy', async (e) => {
        // Skip if this is an internal copy operation
        if (isInternalCopy) return;

        const settings = await getSettings();
        if (!settings.trackCopy) return;

        // Skip if copying from editable elements (textarea, input, contenteditable)
        const activeElement = document.activeElement;
        if (activeElement) {
            const tagName = activeElement.tagName;
            const isEditable = activeElement.isContentEditable || activeElement.contentEditable === 'true';
            const isInput = tagName === 'TEXTAREA' || tagName === 'INPUT';

            // Don't track copies from editable fields
            if (isEditable || isInput) {
                return;
            }
        }

        const copiedText = window.getSelection().toString().trim();
        if (!copiedText) return;

        // Check if text contains sensitive information
        if (settings.filterSensitiveData !== false && isSensitiveData(copiedText)) {
            // Don't save sensitive data to copy history
            console.log('[Reference Helper] Sensitive data detected, not saving to copy history');
            // Optionally show a subtle notification (can be enabled in settings)
            if (settings.notifySensitiveDataFiltered) {
                showToast('🔒 민감 정보는 복사 이력에 저장되지 않습니다', 2000);
            }
            return;
        }

        // Avoid duplicates in quick succession
        const now = Date.now();
        if (now - lastCopyTime < 1000) return;
        lastCopyTime = now;

        // Add to copy history
        const metadata = extractPageMetadata();
        const item = {
            title: document.title,
            url: window.location.href,
            selectedText: copiedText.substring(0, 200), // Limit length
            description: metadata.description,
            author: metadata.author,
            timestamp: Date.now()
        };

        // Send to background to add to copy history
        chrome.runtime.sendMessage({
            type: 'ADD_TO_COPY_HISTORY',
            data: item
        });
    });

    // Listen for messages from background (keyboard shortcut)
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'REFERENCE_ADDED') {
            // Background already sends SHOW_TOAST with specific message
            sendResponse({ success: true });
        }

        if (request.type === 'SHOW_TOAST') {
            showToast(request.message);
            sendResponse({ success: true });
        }

        if (request.type === 'PASTE_REFERENCES') {
            pasteReferences().then(sendResponse);
            return true;
        }

        if (request.type === 'GET_SELECTED_TEXT') {
            sendResponse({ selectedText: window.getSelection().toString().trim() });
        }

        if (request.type === 'GET_PAGE_INFO') {
            const metadata = extractPageMetadata();
            sendResponse({
                title: document.title,
                url: window.location.href,
                metadata: metadata
            });
        }
    });

    // Paste references as Markdown
    async function pasteReferences() {
        try {
            // Get default list
            const response = await chrome.runtime.sendMessage({
                type: 'GET_STORAGE',
                keys: ['lists', 'settings']
            });

            const lists = response?.lists;
            const settings = response?.settings;
            const defaultListId = settings?.defaultListId || 'default';
            const targetList = lists?.[defaultListId];

            if (!targetList || !targetList.items || targetList.items.length === 0) {
                const listName = targetList?.name || '기본 목록';
                showToast(`"${listName}"이(가) 비어있습니다`);
                return { success: false };
            }

            // Convert to Markdown
            const template = settings?.markdownTemplate || '## 참고\n{{items}}';
            const itemTemplate = settings?.markdownItemTemplate || '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}';

            const items = targetList.items;
            const itemsMarkdown = items.map((item, index) => {
                let itemStr = itemTemplate;
                itemStr = itemStr.replace(/\{\{number\}\}/g, (index + 1).toString());
                itemStr = itemStr.replace(/\{\{title\}\}/g, item.title || 'Untitled');
                itemStr = itemStr.replace(/\{\{url\}\}/g, item.url);

                if (item.selectedText && item.selectedText.trim()) {
                    itemStr = itemStr.replace(/\{\{#selectedText\}\}(.*?)\{\{\/selectedText\}\}/g, (match, content) => {
                        return content.replace(/\{\{selectedText\}\}/g, item.selectedText);
                    });
                } else {
                    itemStr = itemStr.replace(/\{\{#selectedText\}\}.*?\{\{\/selectedText\}\}/g, '');
                }

                return itemStr;
            }).join('\n');

            const markdown = template.replace('{{items}}', itemsMarkdown);

            // Try to paste into active element
            const activeElement = document.activeElement;

            if (activeElement && (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT')) {
                // Insert into textarea/input
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                const value = activeElement.value;

                activeElement.value = value.substring(0, start) + markdown + value.substring(end);
                activeElement.selectionStart = activeElement.selectionEnd = start + markdown.length;

                activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                showToast('✓ 참고 목록을 붙여넣었습니다');
                return { success: true };
            } else if (activeElement && activeElement.isContentEditable) {
                // Insert into contenteditable
                document.execCommand('insertText', false, markdown);
                showToast('✓ 참고 목록을 붙여넣었습니다');
                return { success: true };
            } else {
                // Fallback: copy to clipboard
                await navigator.clipboard.writeText(markdown);
                showToast('참고 목록을 클립보드에 복사했습니다');
                return { success: true };
            }
        } catch (error) {
            console.error('Failed to paste references:', error);
            showToast('붙여넣기 실패');
            return { success: false };
        }
    }

    // Get settings from storage
    async function getSettings() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_STORAGE', keys: ['settings'] }, (response) => {
                resolve(response.settings || {});
            });
        });
    }

    // Show toast notification
    function showToast(message, duration = 3000) {
        // Remove existing toast if any
        const existingToast = document.querySelector('.ref-helper-toast');
        if (existingToast) {
            existingToast.remove();
        }

        const toast = document.createElement('div');
        toast.className = 'ref-helper-toast';
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background-color: #323232;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideInUp 0.3s ease-out;
    `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutDown 0.3s ease-out';
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, duration);
    }

})();
