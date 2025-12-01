// Writing Panel - Floating panel for blog writing pages

(function () {
    'use strict';

    let panel = null;
    let currentListId = null;  // Will be set from settings
    let searchQuery = '';

    // Initialize panel when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    async function init() {
        // Check if we're on a writing page
        if (!isWritingPage()) {
            return;
        }

        // Check if floating panel is enabled in settings
        chrome.runtime.sendMessage({ type: 'GET_STORAGE', keys: ['settings'] }, (response) => {
            const settings = response?.settings;

            if (settings && settings.showFloatingPanel === false) {
                console.log('[Writing Panel] Floating panel is disabled in settings');
                return;
            }

            // Set current list to default list from settings
            currentListId = settings?.defaultListId || 'default';

            // Initialize the panel
            initializePanel();
        });
    }

    function initializePanel() {
        // Wait a bit for page to stabilize
        setTimeout(createPanel, 1500);
    }

    function createPanel() {
        //Remove existing panel if any
        if (panel) panel.remove();

        panel = document.createElement('div');
        panel.className = 'ref-helper-panel';
        panel.innerHTML = `
      <div class="ref-helper-panel-header">
        <div class="ref-helper-panel-title">
          📚 참고 자료
        </div>
        <div class="ref-helper-panel-controls">
          <button id="addCurrentPageBtn" title="현재 페이지 추가" style="background: #667eea; color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer; font-size: 11px; margin-right: 4px;">+ 현재 페이지</button>
          <button id="minimizeBtn" title="최소화">−</button>
          <button id="closeBtn" title="닫기">×</button>
        </div>
      </div>
      
      <div class="ref-helper-panel-body">
        <!-- Search -->
        <div class="ref-helper-search">
          <input type="text" id="panelSearchInput" placeholder="검색..." class="ref-helper-search-input">
          <span class="ref-helper-search-icon">🔍</span>
        </div>
        
        <!-- List Selector -->
        <div style="margin-bottom: 12px;">
          <select id="panelListSelect" style="width: 100%; padding: 8px; border: 2px solid #e0e0e0; border-radius: 6px; font-size: 13px;">
            <option value="default">기본 목록</option>
          </select>
        </div>
        
        <!-- Tabs -->
        <div class="ref-helper-tabs">
          <button class="ref-helper-tab active" data-tab="list">내 목록</button>
          <button class="ref-helper-tab" data-tab="visit">방문</button>
          <button class="ref-helper-tab" data-tab="copy">복사</button>
        </div>
        
        <!-- Items Container -->
        <div id="panelItemsContainer" class="ref-helper-items-container"></div>
      </div>
      
      <div class="ref-helper-panel-footer">
        <button id="insertMarkdownBtn" class="ref-helper-btn-primary">📝 Markdown 삽입</button>
        <button id="insertHTMLBtn" class="ref-helper-btn-secondary">🌐 HTML 삽입</button>
      </div>
    `;

        document.body.appendChild(panel);

        // Make panel draggable
        makeDraggable(panel, panel.querySelector('.ref-helper-panel-header'));

        // Setup event listeners
        setupPanelEventListeners();

        // Load initial data
        loadPanelLists();
        loadPanelItems();
    }

    function setupPanelEventListeners() {
        // Add current page button
        panel.querySelector('#addCurrentPageBtn').addEventListener('click', async () => {
            await addCurrentPageToList();
        });

        // Minimize button
        panel.querySelector('#minimizeBtn').addEventListener('click', () => {
            panel.classList.toggle('minimized');
        });

        // Close button
        panel.querySelector('#closeBtn').addEventListener('click', () => {
            panel.remove();
        });

        // List selector
        panel.querySelector('#panelListSelect').addEventListener('change', (e) => {
            currentListId = e.target.value;
            loadPanelItems();
        });

        // Search
        panel.querySelector('#panelSearchInput').addEventListener('input', (e) => {
            searchQuery = e.target.value.toLowerCase();
            loadPanelItems();
        });

        // Tabs
        panel.querySelectorAll('.ref-helper-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                panel.querySelectorAll('.ref-helper-tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                loadPanelItems();
            });
        });

        // Insert buttons
        panel.querySelector('#insertMarkdownBtn').addEventListener('click', () => {
            insertReferences('markdown');
        });

        panel.querySelector('#insertHTMLBtn').addEventListener('click', () => {
            insertReferences('html');
        });
    }

    async function loadPanelLists() {
        const { lists } = await chrome.storage.sync.get(['lists']);
        const select = panel.querySelector('#panelListSelect');

        select.innerHTML = '';

        Object.entries(lists || {}).forEach(([id, list]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = list.name;
            if (id === currentListId) option.selected = true;
            select.appendChild(option);
        });
    }

    async function loadPanelItems() {
        const activeTab = panel.querySelector('.ref-helper-tab.active')?.dataset.tab || 'list';
        const container = panel.querySelector('#panelItemsContainer');

        let items = [];

        if (activeTab === 'list') {
            const { lists } = await chrome.storage.sync.get(['lists']);
            const list = lists[currentListId];
            items = list?.items || [];
        } else if (activeTab === 'visit') {
            const { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
            items = visitHistory || [];
        } else if (activeTab === 'copy') {
            const { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
            items = copyHistory || [];
        }

        // Filter by search
        if (searchQuery) {
            items = items.filter(item =>
                item.title.toLowerCase().includes(searchQuery) ||
                item.url.toLowerCase().includes(searchQuery) ||
                (item.selectedText && item.selectedText.toLowerCase().includes(searchQuery))
            );
        }

        if (items.length === 0) {
            container.innerHTML = `
        <div class="ref-helper-empty">
          <div class="ref-helper-empty-icon">📝</div>
          <div class="ref-helper-empty-text">참고 자료가 없습니다</div>
        </div>
      `;
            return;
        }

        container.innerHTML = items.map(item => createPanelCard(item, activeTab)).join('');

        // Attach event listeners
        if (activeTab !== 'list') {
            container.querySelectorAll('.add-to-list-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const itemData = JSON.parse(btn.dataset.item);
                    await addToCurrentList(itemData);
                });
            });
        }
    }

    function createPanelCard(item, type) {
        const faviconUrl = `https://www.google.com/s2/favicons?domain=${getDomain(item.url)}&sz=32`;

        const addButton = type !== 'list' ? `
      <button class="add-to-list-btn" data-item='${JSON.stringify(item).replace(/'/g, "&#39;")}' 
        style="padding: 4px 8px; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">
        + 추가
      </button>
    ` : '';

        return `
      <div class="ref-helper-card">
        <div class="ref-helper-card-header">
          <img src="${faviconUrl}" class="ref-helper-card-favicon" onerror="this.style.display='none'">
          <div class="ref-helper-card-title">${escapeHtml(item.title)}</div>
        </div>
        <div class="ref-helper-card-url">${escapeHtml(item.url)}</div>
        ${item.selectedText ? `<div class="ref-helper-card-excerpt">"${escapeHtml(item.selectedText.substring(0, 80))}${item.selectedText.length > 80 ? '...' : ''}"</div>` : ''}
        ${addButton}
      </div>
    `;
    }

    async function addCurrentPageToList() {
        try {
            // Get current tab info
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab) {
                showToast('⚠️ 현재 페이지 정보를 가져올 수 없습니다');
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
                showToast(`⚠️ 이미 "${duplicateListName}"에 있는 페이지입니다`);
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

            showToast(`✓ "${lists[currentListId].name}"에 추가했습니다`);

            // Reload if on list tab
            const activeTab = panel.querySelector('.ref-helper-tab.active')?.dataset.tab;
            if (activeTab === 'list') {
                await loadPanelItems();
            }
        } catch (error) {
            console.error('[Writing Panel] Failed to add current page:', error);
            showToast('⚠️ 페이지 추가 실패');
        }
    }

    async function addToCurrentList(itemData) {
        const { lists } = await chrome.storage.sync.get(['lists']);

        const newItem = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            title: itemData.title,
            url: itemData.url,
            selectedText: itemData.selectedText || '',
            timestamp: Date.now(),
            listId: currentListId
        };

        lists[currentListId].items.push(newItem);
        await chrome.storage.sync.set({ lists });

        showToast('✓ 목록에 추가되었습니다');

        // Reload if on list tab
        const activeTab = panel.querySelector('.ref-helper-tab.active')?.dataset.tab;
        if (activeTab === 'list') {
            await loadPanelItems();
        }
    }

    async function insertReferences(format) {
        const { lists, settings } = await chrome.storage.sync.get(['lists', 'settings']);
        const list = lists[currentListId];

        if (!list || !list.items || list.items.length === 0) {
            showToast('⚠️ 삽입할 항목이 없습니다');
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

            content = '\n\n' + template.replace('{{items}}', itemsMarkdown);
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

            content = '\n\n' + template.replace('{{items}}', itemsHTML);
        }

        // Try to insert into editor
        const inserted = await insertIntoEditor(content);

        if (inserted) {
            showToast(`✓ ${format.toUpperCase()}로 삽입되었습니다`);
        } else {
            // Fallback: copy to clipboard
            await navigator.clipboard.writeText(content);
            showToast(`⚠️ 자동 삽입 실패. 클립보드에 복사되었습니다`);
        }
    }

    async function insertIntoEditor(text) {
        // Send message to editor integration script
        return new Promise((resolve) => {
            document.dispatchEvent(new CustomEvent('ref-helper-insert', {
                detail: { text }
            }));

            // If no response in 500ms, assume failure
            setTimeout(() => resolve(false), 500);
        });
    }

    // Utility functions
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function getDomain(url) {
        try {
            return new URL(url).hostname;
        } catch {
            return '';
        }
    }

})();
