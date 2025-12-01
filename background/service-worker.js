// Background Service Worker for Reference Helper Extension

// Context menu IDs
const MENU_IDS = {
    ADD_TO_DEFAULT: 'add-to-default',
    ADD_TO_CUSTOM: 'add-to-custom-',
    CREATE_LIST: 'create-new-list'
};

// Initialize extension on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Reference Helper installed');

    // Initialize default storage
    const storage = await chrome.storage.sync.get(['lists', 'settings']);

    if (!storage.lists) {
        await chrome.storage.sync.set({
            lists: {
                'default': {
                    name: '기본 목록',
                    items: []
                }
            },
            visitHistory: [],
            copyHistory: [],
            settings: {
                markdownTemplate: '## 참고\n{{items}}',
                htmlTemplate: '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>',
                markdownItemTemplate: '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}',
                htmlItemTemplate: '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>',
                autoNumbering: true,
                trackCopy: true,
                trackVisit: true,
                showBlogPopup: false,  // Popup feature removed
                autoOpenPopup: true,  // Auto-open popup on writing pages
                excludedDomains: [],  // Patterns like '*.amazon.com', '*.shopping.*'
                visitHistoryDays: 14,  // Keep visit history for 14 days
                defaultListId: 'default'  // Default list for keyboard shortcuts
            }
        });
    }

    // Create context menus
    await createContextMenus();
});

// Create context menus
async function createContextMenus() {
    await chrome.contextMenus.removeAll();

    // View lists option (always visible)
    chrome.contextMenus.create({
        id: 'view-lists',
        title: '📚 목록 보기',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: 'separator-1',
        type: 'separator',
        contexts: ['all']
    });

    // Paste references
    chrome.contextMenus.create({
        id: 'paste-references',
        title: '📋 참고 목록 붙여넣기',
        contexts: ['editable']
    });

    chrome.contextMenus.create({
        id: 'separator-paste',
        type: 'separator',
        contexts: ['all']
    });

    // Add to reference (parent)
    chrome.contextMenus.create({
        id: 'add-to-reference',
        title: '📌 참고 목록에 추가',
        contexts: ['all']
    });

    // Get lists
    const { lists } = await chrome.storage.sync.get(['lists']);

    // Add submenu items for each list
    if (lists) {
        for (const [listId, list] of Object.entries(lists)) {
            chrome.contextMenus.create({
                id: `add-to-${listId}`,
                parentId: 'add-to-reference',
                title: list.name,
                contexts: ['all']
            });
        }
    }

    // Separator and "New list" option
    chrome.contextMenus.create({
        id: 'separator-2',
        parentId: 'add-to-reference',
        type: 'separator',
        contexts: ['all']
    });

    chrome.contextMenus.create({
        id: MENU_IDS.CREATE_LIST,
        parentId: 'add-to-reference',
        title: '+ 새 목록 만들기',
        contexts: ['all']
    });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'view-lists') {
        // Open popup - in Manifest V3, openPopup requires user interaction
        chrome.action.openPopup().catch(() => {
            // If popup fails, open as new tab
            chrome.tabs.create({
                url: chrome.runtime.getURL('popup/popup.html'),
                active: true
            });
        });
        return;
    }

    if (info.menuItemId === 'paste-references') {
        // Paste default list as Markdown
        chrome.tabs.sendMessage(tab.id, {
            type: 'PASTE_REFERENCES'
        }).catch(() => {
            console.error('Failed to paste references');
        });
        return;
    }

    if (info.menuItemId === MENU_IDS.CREATE_LIST) {
        // Open popup to create new list
        chrome.action.openPopup();
        return;
    }

    // Handle add-to-{listId}
    if (info.menuItemId.toString().startsWith('add-to-')) {
        const listId = info.menuItemId.toString().replace('add-to-', '');
        const targetUrl = info.linkUrl || tab.url;

        // Check for duplicates across ALL lists
        const { lists } = await chrome.storage.sync.get(['lists']);

        let isDuplicate = false;
        let duplicateListName = '';

        if (lists) {
            for (const [id, list] of Object.entries(lists)) {
                if (list.items && list.items.some(item => item.url === targetUrl)) {
                    isDuplicate = true;
                    duplicateListName = list.name;
                    break;
                }
            }
        }

        if (isDuplicate) {
            // Show duplicate notification with list name
            chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_TOAST',
                message: `⚠️ 이미 "${duplicateListName}"에 있는 페이지입니다`
            }).catch(() => { });
            return;
        }

        if (lists && lists[listId]) {
            // Get page info
            const referenceItem = {
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                title: tab.title,
                url: targetUrl,
                selectedText: info.selectionText || '',
                timestamp: Date.now(),
                listId: listId,
                refNumber: null
            };

            lists[listId].items.push(referenceItem);
            await chrome.storage.sync.set({ lists });

            // Show success notification with list name
            chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_TOAST',
                message: `✓ "${lists[listId].name}"에 추가했습니다`
            }).catch(() => { });

            // Notify content script
            chrome.tabs.sendMessage(tab.id, {
                type: 'REFERENCE_ADDED',
                data: { referenceItem, listId }
            }).catch(() => {
                // Ignore errors if content script is not loaded
            });
        }
    }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener(async (command) => {
    if (command === 'add-to-references') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab) {
            // Get default list ID from settings
            const { lists, settings } = await chrome.storage.sync.get(['lists', 'settings']);
            const defaultListId = settings?.defaultListId || 'default';

            // Check for duplicates across ALL lists
            let isDuplicate = false;
            let duplicateListName = '';

            if (lists) {
                for (const [listId, list] of Object.entries(lists)) {
                    if (list.items && list.items.some(item => item.url === tab.url)) {
                        isDuplicate = true;
                        duplicateListName = list.name;
                        break;
                    }
                }
            }

            if (isDuplicate) {
                // Show duplicate notification with list name
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SHOW_TOAST',
                    message: `⚠️ 이미 "${duplicateListName}"에 있는 페이지입니다`
                }).catch(() => { });
                return;
            }

            const referenceItem = {
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                title: tab.title,
                url: tab.url,
                selectedText: '',
                timestamp: Date.now(),
                listId: defaultListId,
                refNumber: null
            };

            // Add to default list
            if (lists && lists[defaultListId]) {
                lists[defaultListId].items.push(referenceItem);
                await chrome.storage.sync.set({ lists });

                // Show success notification with list name
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SHOW_TOAST',
                    message: `✓ "${lists[defaultListId].name}"에 추가했습니다`
                }).catch(() => { });

                // Notify content script
                chrome.tabs.sendMessage(tab.id, {
                    type: 'REFERENCE_ADDED',
                    data: { referenceItem, listId: defaultListId }
                }).catch(() => {
                    // Ignore errors
                });
            }
        }
    }
    if (command === 'open-popup') {
        // Open popup
        chrome.action.openPopup().catch(() => {
            // If popup fails, open as new tab
            chrome.tabs.create({
                url: chrome.runtime.getURL('popup/popup.html'),
                active: true
            });
        });
    }

    if (command === 'paste-references') {
        const { lists, settings } = await chrome.storage.sync.get(['lists', 'settings']);
        const defaultListId = settings?.defaultListId || 'default';
        const targetList = lists?.[defaultListId];
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (tab) {
            // Check if list is empty
            if (!targetList || !targetList.items || targetList.items.length === 0) {
                const listName = targetList?.name || '기본 목록';
                chrome.tabs.sendMessage(tab.id, {
                    type: 'SHOW_TOAST',
                    message: `⚠️ "${listName}"이(가) 비어있습니다`
                }).catch(() => { });
                return;
            }

            chrome.tabs.sendMessage(tab.id, {
                type: 'PASTE_REFERENCES'
            }).catch(() => {
                console.error('Failed to paste references');
            });
        }
    }
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'GET_STORAGE') {
        chrome.storage.sync.get(request.keys || null).then(sendResponse);
        return true; // Keep channel open for async response
    }

    if (request.type === 'SET_STORAGE') {
        chrome.storage.sync.set(request.data).then(() => {
            sendResponse({ success: true });

            // Update context menus if lists changed
            if (request.data.lists) {
                createContextMenus();
            }
        });
        return true;
    }

    if (request.type === 'ADD_REFERENCE') {
        handleAddReference(request.data, sender.tab).then(sendResponse);
        return true;
    }

    if (request.type === 'UPDATE_CONTEXT_MENUS') {
        createContextMenus().then(() => {
            sendResponse({ success: true });
        });
        return true;
    }

    if (request.type === 'ADD_TO_COPY_HISTORY') {
        handleAddToCopyHistory(request.data).then(sendResponse);
        return true;
    }

    if (request.type === 'OPEN_POPUP_ON_WRITING_PAGE') {
        chrome.action.openPopup().catch(() => {
            console.log('[Service Worker] Failed to auto-open popup');
        });
        sendResponse({ success: true });
        return true;
    }

    if (request.type === 'ADD_TO_VISIT_HISTORY') {
        handleAddToVisitHistory(request.data).then(sendResponse);
        return true;
    }
});

// Handle adding reference
async function handleAddReference(data, tab) {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const listId = data.listId || 'default';

    if (lists && lists[listId]) {
        const targetUrl = data.url || tab.url;

        // Check for duplicates
        const isDuplicate = lists[listId].items.some(item => item.url === targetUrl);

        if (isDuplicate) {
            return { success: false, error: 'Duplicate URL' };
        }

        const referenceItem = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            title: data.title || tab.title,
            url: targetUrl,
            selectedText: data.selectedText || '',
            timestamp: Date.now(),
            listId: listId,
            refNumber: data.refNumber || null
        };

        lists[listId].items.push(referenceItem);
        await chrome.storage.sync.set({ lists });

        return { success: true, referenceItem };
    }

    return { success: false, error: 'List not found' };
}

// Handle adding to copy history
async function handleAddToCopyHistory(data) {
    let { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
    if (!copyHistory) copyHistory = [];

    // Check if same text from same URL already exists
    const existingIndex = copyHistory.findIndex(item =>
        item.url === data.url && item.selectedText === data.selectedText
    );

    if (existingIndex !== -1) {
        // Remove existing item so it can be added to top
        copyHistory.splice(existingIndex, 1);
    }

    copyHistory.unshift({
        ...data,
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        timestamp: Date.now()
    });

    // Keep only last 100
    if (copyHistory.length > 100) {
        copyHistory = copyHistory.slice(0, 100);
    }

    await chrome.storage.sync.set({ copyHistory });
    return { success: true };
}

// Handle adding to visit history
async function handleAddToVisitHistory(data) {
    let { visitHistory, settings } = await chrome.storage.sync.get(['visitHistory', 'settings']);
    if (!visitHistory) visitHistory = [];

    const daysToKeep = settings?.visitHistoryDays || 14;
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    // Check if URL already exists
    const existingIndex = visitHistory.findIndex(v => v.url === data.url);
    if (existingIndex !== -1) {
        visitHistory[existingIndex].timestamp = Date.now();
    } else {
        visitHistory.unshift({
            ...data,
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
        });
    }

    // Remove old entries
    visitHistory = visitHistory.filter(item => item.timestamp > cutoffTime);

    // Keep only last 100
    if (visitHistory.length > 100) {
        visitHistory = visitHistory.slice(0, 100);
    }

    await chrome.storage.sync.set({ visitHistory });
    return { success: true };
}

// Listen for storage changes to sync across tabs
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        // Broadcast storage changes to all tabs
        chrome.tabs.query({}).then(tabs => {
            tabs.forEach(tab => {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'STORAGE_CHANGED',
                    changes: changes
                }).catch(() => {
                    // Ignore errors
                });
            });
        });
    }
});
