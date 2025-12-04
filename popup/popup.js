// Popup JavaScript

let currentListId = 'default';
let currentTab = 'list';
let searchQuery = '';

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    // Load default list ID from settings
    const { settings } = await chrome.storage.sync.get(['settings']);
    if (settings && settings.defaultListId) {
        currentListId = settings.defaultListId;
    }

    await loadLists();
    await loadAllCounts();  // Load all counts first
    await loadContent();
    setupEventListeners();
    updateDefaultListIndicator(); // Call on load to set initial state
});

// Setup event listeners
function setupEventListeners() {
    // List selector
    document.getElementById('listSelect').addEventListener('change', async (e) => {
        currentListId = e.target.value;
        await loadContent();
        updateDefaultListIndicator();
    });

    // New list button
    document.getElementById('newListBtn').addEventListener('click', () => {
        showModal('newListModal');
    });

    // Add current page button
    document.getElementById('addCurrentPageBtn').addEventListener('click', async () => {
        await addCurrentPageToCurrentList();
    });

    // Set default list button
    document.getElementById('setDefaultBtn').addEventListener('click', async () => {
        await setDefaultList(currentListId);
    });

    // Delete list button
    document.getElementById('deleteListBtn').addEventListener('click', async () => {
        await deleteList();
    });

    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // Search
    document.getElementById('searchInput').addEventListener('input', async (e) => {
        searchQuery = e.target.value.toLowerCase();
        await loadContent();
    });

    // Tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            const tabName = e.currentTarget.dataset.tab;
            switchTab(tabName);
        });
    });

    // Export buttons
    document.getElementById('exportMarkdownBtn').addEventListener('click', async () => {
        await exportList('markdown');
    });

    document.getElementById('exportHTMLBtn').addEventListener('click', async () => {
        await exportList('html');
    });

    // Modal actions
    document.getElementById('createListBtn').addEventListener('click', async () => {
        await createList();
    });

    document.getElementById('cancelListBtn').addEventListener('click', () => {
        hideModal('newListModal');
    });

    document.getElementById('newListInput').addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            await createList();
        }
    });

    // Batch controls event listeners
    setupBatchControlListeners();
}

// Load lists into dropdown
async function loadLists() {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const select = document.getElementById('listSelect');

    select.innerHTML = '';

    Object.entries(lists || {}).forEach(([id, list]) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = list.name;
        if (id === currentListId) option.selected = true;
        select.appendChild(option);
    });
}

// Load all tab counts (without loading content)
async function loadAllCounts() {
    const { lists, visitHistory, copyHistory } = await chrome.storage.sync.get(['lists', 'visitHistory', 'copyHistory']);

    // Update list count
    const list = lists[currentListId];
    document.getElementById('listCount').textContent = (list?.items?.length || 0).toString();

    // Update visit history count
    document.getElementById('visitCount').textContent = (visitHistory?.length || 0).toString();

    // Update copy history count
    document.getElementById('copyCount').textContent = (copyHistory?.length || 0).toString();
}

// Load content based on current tab
async function loadContent() {
    switch (currentTab) {
        case 'list':
            await loadListItems();
            break;
        case 'visit':
            await loadVisitHistory();
            break;
        case 'copy':
            await loadCopyHistory();
            break;
    }
}

// Load list items
async function loadListItems() {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const list = lists[currentListId];
    const container = document.getElementById('listItems');

    if (!list || !list.items || list.items.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-text">
          아직 참고 자료가 없습니다.<br>
          웹 페이지에서 텍스트를 선택하고<br>
          우클릭하여 추가해보세요!
        </div>
      </div>
    `;
        document.getElementById('listCount').textContent = '0';
        updateBatchControlsVisibility('list', false);
        return;
    }

    // Filter items by search query
    let items = list.items;
    if (searchQuery) {
        items = items.filter(item =>
            item.title.toLowerCase().includes(searchQuery) ||
            item.url.toLowerCase().includes(searchQuery) ||
            (item.selectedText && item.selectedText.toLowerCase().includes(searchQuery))
        );
    }

    document.getElementById('listCount').textContent = list.items.length;

    container.innerHTML = items.map(item => createItemCard(item, 'list')).join('');

    // Show batch controls and attach event listeners
    updateBatchControlsVisibility('list', items.length > 0);
    attachItemEventListeners(container, 'list');
}

// Load visit history
async function loadVisitHistory() {
    const { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
    const container = document.getElementById('visitItems');

    if (!visitHistory || visitHistory.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🌐</div>
        <div class="empty-text">방문 기록이 없습니다.</div>
      </div>
    `;
        document.getElementById('visitCount').textContent = '0';
        updateBatchControlsVisibility('visit', false);
        return;
    }

    // Filter by search query
    let items = visitHistory;
    if (searchQuery) {
        items = items.filter(item =>
            item.title.toLowerCase().includes(searchQuery) ||
            item.url.toLowerCase().includes(searchQuery)
        );
    }

    document.getElementById('visitCount').textContent = visitHistory.length;

    container.innerHTML = items.map(item => createItemCard(item, 'visit')).join('');

    updateBatchControlsVisibility('visit', items.length > 0);
    attachItemEventListeners(container, 'visit');
}

// Load copy history
async function loadCopyHistory() {
    const { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
    const container = document.getElementById('copyItems');

    if (!copyHistory || copyHistory.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <div class="empty-text">복사 기록이 없습니다.</div>
      </div>
    `;
        document.getElementById('copyCount').textContent = '0';
        updateBatchControlsVisibility('copy', false);
        return;
    }

    // Filter by search query
    let items = copyHistory;
    if (searchQuery) {
        items = items.filter(item =>
            item.title.toLowerCase().includes(searchQuery) ||
            item.url.toLowerCase().includes(searchQuery) ||
            (item.selectedText && item.selectedText.toLowerCase().includes(searchQuery))
        );
    }

    document.getElementById('copyCount').textContent = copyHistory.length;

    container.innerHTML = items.map(item => createItemCard(item, 'copy')).join('');

    updateBatchControlsVisibility('copy', items.length > 0);
    attachItemEventListeners(container, 'copy');
}

// Create item card HTML
function createItemCard(item, type) {
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=32`;
    const relativeTime = getRelativeTime(item.timestamp);

    let actions = '';

    if (type === 'list') {
        // List items: move, delete, copy, move up/down
        actions = `
      <button class="item-move-up" data-id="${item.id}" title="위로">↑</button>
      <button class="item-move-down" data-id="${item.id}" title="아래로">↓</button>
      <button class="item-move-to-list" data-id="${item.id}">이동</button>
      <button class="item-copy" data-id="${item.id}">복사</button>
      <button class="item-delete danger" data-id="${item.id}">삭제</button>
    `;
    } else if (type === 'visit') {
        // Visit history: add to list, delete
        actions = `
      <button class="item-add" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>목록에 추가</button>
      <button class="item-delete-visit danger" data-id="${item.id}">삭제</button>
    `;
    } else if (type === 'copy') {
        // Copy history: add to list, delete
        actions = `
      <button class="item-add" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}'>목록에 추가</button>
      <button class="item-delete-copy danger" data-id="${item.id}">삭제</button>
    `;
    }

    return `
    <div class="item-card" data-id="${item.id}">
      <div class="item-header">
        <div class="item-checkbox-container">
          <input type="checkbox" class="item-checkbox" data-id="${item.id}" aria-label="${escapeHtml(item.title)} 선택">
        </div>
        <img src="${faviconUrl}" class="item-favicon" onerror="this.style.display='none'">
        <div class="item-title">${escapeHtml(item.title)}</div>
      </div>
      <div class="item-url">${escapeHtml(item.url)}</div>
      ${item.selectedText ? `<div class="item-excerpt">"${escapeHtml(item.selectedText.substring(0, 100))}${item.selectedText.length > 100 ? '...' : ''}"</div>` : ''}
      <div class="item-meta">${relativeTime}</div>
      <div class="item-actions">
        ${actions}
      </div>
    </div>
  `;
}

// Attach event listeners to item cards
function attachItemEventListeners(container, tabType) {
    // Individual checkbox change listeners for batch delete
    container.querySelectorAll('.item-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            updateBatchDeleteButton(tabType);
        });
        // Prevent card click when clicking checkbox
        cb.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    });

    // Delete buttons (list items)
    container.querySelectorAll('.item-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await deleteItem(itemId);
        });
    });

    // Delete visit history
    container.querySelectorAll('.item-delete-visit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await deleteFromVisitHistory(itemId);
        });
    });

    // Delete copy history
    container.querySelectorAll('.item-delete-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await deleteFromCopyHistory(itemId);
        });
    });

    // Move to list buttons
    container.querySelectorAll('.item-move-to-list').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await showMoveToListDialog(itemId);
        });
    });

    // Move up buttons
    container.querySelectorAll('.item-move-up').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await moveItem(itemId, 'up');
        });
    });

    // Move down buttons
    container.querySelectorAll('.item-move-down').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await moveItem(itemId, 'down');
        });
    });

    // Copy buttons
    container.querySelectorAll('.item-copy').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            await copyItem(itemId);
        });
    });

    // Add to list buttons
    container.querySelectorAll('.item-add').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const item = JSON.parse(btn.dataset.item);
            await addToList(item);
        });
    });
}

// Switch tab
function switchTab(tabName) {
    currentTab = tabName;

    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');

    loadContent();
}

// Create new list
async function createList() {
    const input = document.getElementById('newListInput');
    const name = input.value.trim();

    if (!name) return;

    const { lists } = await chrome.storage.sync.get(['lists']);
    const listId = 'list-' + Date.now();

    lists[listId] = {
        name: name,
        items: []
    };

    await chrome.storage.sync.set({ lists });
    chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

    currentListId = listId;
    await loadLists();
    await loadContent();
    updateDefaultListIndicator();

    input.value = '';
    hideModal('newListModal');
}

// Delete current list
async function deleteList() {
    if (currentListId === 'default') {
        showNotification('기본 목록은 삭제할 수 없습니다');
        return;
    }

    const { lists } = await chrome.storage.sync.get(['lists']);
    const listName = lists[currentListId]?.name || '목록';

    if (!confirm(`"${listName}"을(를) 정말 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    delete lists[currentListId];
    await chrome.storage.sync.set({ lists });
    chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

    currentListId = 'default';
    await loadLists();
    await loadAllCounts();
    await loadContent();
    updateDefaultListIndicator();

    showNotification('목록이 삭제되었습니다');
}

// Delete item
async function deleteItem(itemId) {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const list = lists[currentListId];

    list.items = list.items.filter(item => item.id !== itemId);
    lists[currentListId] = list;

    await chrome.storage.sync.set({ lists });
    await loadContent();
}

// Move item up or down
async function moveItem(itemId, direction) {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const list = lists[currentListId];

    if (!list || !list.items) return;

    const index = list.items.findIndex(item => item.id === itemId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
        // Swap with previous item
        [list.items[index - 1], list.items[index]] = [list.items[index], list.items[index - 1]];
    } else if (direction === 'down' && index < list.items.length - 1) {
        // Swap with next item
        [list.items[index], list.items[index + 1]] = [list.items[index + 1], list.items[index]];
    } else {
        return; // Can't move
    }

    lists[currentListId] = list;
    await chrome.storage.sync.set({ lists });
    await loadContent();
}

// Show move to list dialog
async function showMoveToListDialog(itemId) {
    const { lists } = await chrome.storage.sync.get(['lists']);

    // Get other lists (exclude current list)
    const otherLists = Object.entries(lists).filter(([id]) => id !== currentListId);

    if (otherLists.length === 0) {
        showNotification('이동할 다른 목록이 없습니다');
        return;
    }

    // Create simple dialog
    const listOptions = otherLists.map(([id, list]) =>
        `<option value="${id}">${list.name}</option>`
    ).join('');

    const result = prompt(
        `이동할 목록을 선택하세요:\n\n` +
        otherLists.map(([id, list], index) => `${index + 1}. ${list.name}`).join('\n') +
        `\n\n번호를 입력하세요 (1-${otherLists.length}):`
    );

    if (!result) return;

    const index = parseInt(result) - 1;
    if (isNaN(index) || index < 0 || index >= otherLists.length) {
        showNotification('잘못된 번호입니다');
        return;
    }

    const targetListId = otherLists[index][0];
    await moveItemToList(itemId, targetListId);
}

// Move item to another list
async function moveItemToList(itemId, targetListId) {
    const { lists } = await chrome.storage.sync.get(['lists']);

    // Find item in current list
    const sourceList = lists[currentListId];
    const itemIndex = sourceList.items.findIndex(item => item.id === itemId);

    if (itemIndex === -1) {
        showNotification('항목을 찾을 수 없습니다');
        return;
    }

    // Remove from source list
    const [item] = sourceList.items.splice(itemIndex, 1);

    // Update listId
    item.listId = targetListId;

    // Add to target list
    lists[targetListId].items.push(item);

    // Save
    await chrome.storage.sync.set({ lists });

    showNotification(`${lists[targetListId].name}(으)로 이동했습니다`);
    await loadContent();
}

// Update default list indicator (star button)
async function updateDefaultListIndicator() {
    const { settings } = await chrome.storage.sync.get(['settings']);
    const defaultListId = settings?.defaultListId || 'default';
    const starBtn = document.getElementById('setDefaultBtn');

    if (!starBtn) return;

    if (currentListId === defaultListId) {
        starBtn.classList.add('active');
        starBtn.title = '현재 기본 목록입니다';
    } else {
        starBtn.classList.remove('active');
        starBtn.title = '기본 목록으로 설정 (단축키용)';
    }
}

// Set current list as default
async function setDefaultList(listId) {
    const { settings } = await chrome.storage.sync.get(['settings']);
    const updatedSettings = {
        ...settings,
        defaultListId: listId
    };

    await chrome.storage.sync.set({ settings: updatedSettings });

    const { lists } = await chrome.storage.sync.get(['lists']);
    const listName = lists[listId]?.name || '목록';

    showNotification(`"${listName}"을(를) 기본 목록으로 설정했습니다`);
    updateDefaultListIndicator();
}

// Delete from visit history
async function deleteFromVisitHistory(itemId) {
    let { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
    if (!visitHistory) return;

    visitHistory = visitHistory.filter(item => item.id !== itemId);
    await chrome.storage.sync.set({ visitHistory });

    await loadAllCounts();
    await loadContent();
    showNotification('방문 기록에서 삭제되었습니다');
}

// Delete from copy history
async function deleteFromCopyHistory(itemId) {
    let { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
    if (!copyHistory) return;

    copyHistory = copyHistory.filter(item => item.id !== itemId);
    await chrome.storage.sync.set({ copyHistory });

    await loadAllCounts();
    await loadContent();
    showNotification('복사 기록에서 삭제되었습니다');
}

// Copy single item
async function copyItem(itemId) {
    const { lists } = await chrome.storage.sync.get(['lists']);
    const item = lists[currentListId].items.find(i => i.id === itemId);

    if (!item) return;

    const markdown = `[${item.title}](${item.url})`;
    await navigator.clipboard.writeText(markdown);

    showNotification('복사되었습니다!');
}

// Add from history to current list
async function addToList(item) {
    const { lists } = await chrome.storage.sync.get(['lists']);

    // Check for duplicates across ALL lists
    let isDuplicate = false;
    let duplicateListName = '';

    if (lists) {
        for (const [listId, list] of Object.entries(lists)) {
            if (list.items && list.items.some(i => i.url === item.url)) {
                isDuplicate = true;
                duplicateListName = list.name;
                break;
            }
        }
    }

    if (isDuplicate) {
        showNotification(`⚠️ 이미 "${duplicateListName}"에 있는 페이지입니다`);
        return;
    }

    const newItem = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
        title: item.title,
        url: item.url,
        selectedText: item.selectedText || '',
        timestamp: Date.now(),
        listId: currentListId
    };

    lists[currentListId].items.push(newItem);
    await chrome.storage.sync.set({ lists });

    showNotification(`✓ "${lists[currentListId].name}"에 추가했습니다`);

    if (currentTab === 'list') {
        await loadContent();
    }
}

// Add current page to current list
async function addCurrentPageToCurrentList() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab) {
            showNotification('⚠️ 현재 페이지 정보를 가져올 수 없습니다');
            return;
        }

        const { lists } = await chrome.storage.sync.get(['lists']);

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
            showNotification(`⚠️ 이미 "${duplicateListName}"에 있는 페이지입니다`);
            return;
        }

        const newItem = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            title: tab.title,
            url: tab.url,
            selectedText: '',
            timestamp: Date.now(),
            listId: currentListId
        };

        lists[currentListId].items.push(newItem);
        await chrome.storage.sync.set({ lists });

        showNotification(`✓ "${lists[currentListId].name}"에 추가했습니다`);

        if (currentTab === 'list') {
            await loadContent();
        }
    } catch (error) {
        console.error('[Popup] Failed to add current page:', error);
        showNotification('⚠️ 페이지 추가 실패');
    }
}

// Export list
async function exportList(format) {
    const { lists, settings } = await chrome.storage.sync.get(['lists', 'settings']);
    const list = lists[currentListId];

    if (!list || !list.items || list.items.length === 0) {
        showNotification('내보낼 항목이 없습니다!');
        return;
    }

    let content = '';
    const items = list.items;

    if (format === 'markdown') {
        const template = settings.markdownTemplate || '## 참고\n{{items}}';
        const itemTemplate = settings.markdownItemTemplate || '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}';

        const itemsMarkdown = items.map((item, index) => {
            let itemStr = itemTemplate;
            itemStr = itemStr.replace(/\{\{number\}\}/g, (index + 1).toString());
            itemStr = itemStr.replace(/\{\{title\}\}/g, item.title);
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

        content = template.replace('{{items}}', itemsMarkdown);
    } else if (format === 'html') {
        const template = settings.htmlTemplate || '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>';
        const itemTemplate = settings.htmlItemTemplate || '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>';

        const itemsHTML = items.map(item => {
            let itemStr = itemTemplate;
            itemStr = itemStr.replace(/\{\{title\}\}/g, escapeHtml(item.title));
            itemStr = itemStr.replace(/\{\{url\}\}/g, item.url);

            if (item.selectedText && item.selectedText.trim()) {
                itemStr = itemStr.replace(/\{\{#selectedText\}\}(.*?)\{\{\/selectedText\}\}/g, (match, content) => {
                    return content.replace(/\{\{selectedText\}\}/g, escapeHtml(item.selectedText));
                });
            } else {
                itemStr = itemStr.replace(/\{\{#selectedText\}\}.*?\{\{\/selectedText\}\}/g, '');
            }

            return itemStr;
        }).join('\n');

        content = template.replace('{{items}}', itemsHTML);
    }

    await navigator.clipboard.writeText(content);
    showNotification(`${format.toUpperCase()}로 복사되었습니다!`);
}

// Utility functions
function showModal(id) {
    document.getElementById(id).classList.add('show');
}

function hideModal(id) {
    document.getElementById(id).classList.remove('show');
}

function showNotification(message) {
    // Simple notification - you could enhance this with a toast
    const notification = document.createElement('div');
    notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #323232;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 14px;
    z-index: 2000;
  `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 2000);
}

function getDomain(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return '';
    }
}

function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}일 전`;
    if (hours > 0) return `${hours}시간 전`;
    if (minutes > 0) return `${minutes}분 전`;
    return '방금 전';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Batch control functions
function setupBatchControlListeners() {
    // List tab batch controls
    document.getElementById('listSelectAll').addEventListener('change', (e) => {
        toggleAllCheckboxes('listItems', e.target.checked);
        updateBatchDeleteButton('list');
    });

    document.getElementById('listBatchDelete').addEventListener('click', async () => {
        await batchDeleteListItems();
    });

    // Visit tab batch controls
    document.getElementById('visitSelectAll').addEventListener('change', (e) => {
        toggleAllCheckboxes('visitItems', e.target.checked);
        updateBatchDeleteButton('visit');
    });

    document.getElementById('visitBatchDelete').addEventListener('click', async () => {
        await batchDeleteVisitHistory();
    });

    // Copy tab batch controls
    document.getElementById('copySelectAll').addEventListener('change', (e) => {
        toggleAllCheckboxes('copyItems', e.target.checked);
        updateBatchDeleteButton('copy');
    });

    document.getElementById('copyBatchDelete').addEventListener('click', async () => {
        await batchDeleteCopyHistory();
    });
}

// Toggle all checkboxes in a container
function toggleAllCheckboxes(containerId, checked) {
    const container = document.getElementById(containerId);
    const checkboxes = container.querySelectorAll('.item-checkbox');
    checkboxes.forEach(cb => cb.checked = checked);
}

// Update batch controls visibility based on item count
function updateBatchControlsVisibility(tabType, hasItems) {
    const controlsId = `${tabType}BatchControls`;
    const controls = document.getElementById(controlsId);
    if (controls) {
        controls.classList.toggle('show', hasItems);
        // Reset select all checkbox when hiding
        if (!hasItems) {
            const selectAllId = `${tabType}SelectAll`;
            const selectAll = document.getElementById(selectAllId);
            if (selectAll) selectAll.checked = false;
        }
    }
}

// Update batch delete button state
function updateBatchDeleteButton(tabType) {
    const containerId = `${tabType}Items`;
    const container = document.getElementById(containerId);
    const checkedCount = container.querySelectorAll('.item-checkbox:checked').length;

    const buttonId = `${tabType}BatchDelete`;
    const button = document.getElementById(buttonId);

    if (button) {
        button.disabled = checkedCount === 0;
        if (checkedCount > 0) {
            button.textContent = `🗑️ ${checkedCount}개 삭제`;
        } else {
            button.textContent = '🗑️ 선택 삭제';
        }
    }

    // Update select all checkbox state
    const allCheckboxes = container.querySelectorAll('.item-checkbox');
    const selectAllId = `${tabType}SelectAll`;
    const selectAll = document.getElementById(selectAllId);
    if (selectAll && allCheckboxes.length > 0) {
        selectAll.checked = checkedCount === allCheckboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < allCheckboxes.length;
    }
}

// Batch delete list items
async function batchDeleteListItems() {
    const container = document.getElementById('listItems');
    const checkedBoxes = container.querySelectorAll('.item-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);

    if (selectedIds.length === 0) return;

    if (!confirm(`${selectedIds.length}개의 항목을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    const { lists } = await chrome.storage.sync.get(['lists']);
    const list = lists[currentListId];
    if (!list) return;

    list.items = list.items.filter(item => !selectedIds.includes(item.id));
    lists[currentListId] = list;

    await chrome.storage.sync.set({ lists });

    document.getElementById('listSelectAll').checked = false;
    await loadContent();
    showNotification(`${selectedIds.length}개 항목이 삭제되었습니다`);
}

// Batch delete visit history
async function batchDeleteVisitHistory() {
    const container = document.getElementById('visitItems');
    const checkedBoxes = container.querySelectorAll('.item-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);

    if (selectedIds.length === 0) return;

    if (!confirm(`${selectedIds.length}개의 방문 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    let { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
    if (!visitHistory) return;
    visitHistory = visitHistory.filter(item => !selectedIds.includes(item.id));

    await chrome.storage.sync.set({ visitHistory });

    document.getElementById('visitSelectAll').checked = false;
    await loadAllCounts();
    await loadContent();
    showNotification(`${selectedIds.length}개 방문 기록이 삭제되었습니다`);
}

// Batch delete copy history
async function batchDeleteCopyHistory() {
    const container = document.getElementById('copyItems');
    const checkedBoxes = container.querySelectorAll('.item-checkbox:checked');
    const selectedIds = Array.from(checkedBoxes).map(cb => cb.dataset.id);

    if (selectedIds.length === 0) return;

    if (!confirm(`${selectedIds.length}개의 복사 기록을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
    }

    let { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
    if (!copyHistory) return;
    copyHistory = copyHistory.filter(item => !selectedIds.includes(item.id));

    await chrome.storage.sync.set({ copyHistory });

    document.getElementById('copySelectAll').checked = false;
    await loadAllCounts();
    await loadContent();
    showNotification(`${selectedIds.length}개 복사 기록이 삭제되었습니다`);
}
