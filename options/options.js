// Options Page JavaScript

// Load settings on page load
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveSettings);
    document.getElementById('resetBtn').addEventListener('click', resetSettings);
    document.getElementById('exportDataBtn').addEventListener('click', exportData);
    document.getElementById('importDataBtn').addEventListener('click', () => {
        document.getElementById('importFileInput').click();
    });
    document.getElementById('importFileInput').addEventListener('change', importData);
    document.getElementById('clearDataBtn').addEventListener('click', clearData);
}

// Load settings from storage
async function loadSettings() {
    const { settings } = await chrome.storage.sync.get(['settings']);

    const defaultSettings = {
        markdownTemplate: '## 참고\n{{items}}',
        htmlTemplate: '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>',
        markdownItemTemplate: '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}',
        htmlItemTemplate: '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>',
        autoNumbering: true,
        trackCopy: true,
        trackVisit: true,
        showBlogPopup: false,
        autoOpenPopup: true,
        excludedDomains: [],
        visitHistoryDays: 14,
        defaultListId: 'default'
    };

    const currentSettings = { ...defaultSettings, ...settings };

    // Populate form
    document.getElementById('trackCopy').checked = currentSettings.trackCopy;
    document.getElementById('trackVisit').checked = currentSettings.trackVisit;
    // showBlogPopup removed from UI
    document.getElementById('autoOpenPopup').checked = currentSettings.autoOpenPopup;
    document.getElementById('autoNumbering').checked = currentSettings.autoNumbering;
    document.getElementById('markdownTemplate').value = currentSettings.markdownTemplate;
    document.getElementById('markdownItemTemplate').value = currentSettings.markdownItemTemplate;
    document.getElementById('htmlTemplate').value = currentSettings.htmlTemplate;
    document.getElementById('htmlItemTemplate').value = currentSettings.htmlItemTemplate;
    document.getElementById('excludedDomains').value = (currentSettings.excludedDomains || []).join('\n');
    document.getElementById('visitHistoryDays').value = currentSettings.visitHistoryDays || 14;
}

// Save settings
async function saveSettings() {
    const settings = {
        trackCopy: document.getElementById('trackCopy').checked,
        trackVisit: document.getElementById('trackVisit').checked,
        showBlogPopup: false, // Always false as feature is removed
        autoOpenPopup: document.getElementById('autoOpenPopup').checked,
        autoNumbering: document.getElementById('autoNumbering').checked,
        markdownTemplate: document.getElementById('markdownTemplate').value,
        markdownItemTemplate: document.getElementById('markdownItemTemplate').value,
        htmlTemplate: document.getElementById('htmlTemplate').value,
        htmlItemTemplate: document.getElementById('htmlItemTemplate').value,
        visitHistoryDays: parseInt(document.getElementById('visitHistoryDays').value) || 14,
        excludedDomains: document.getElementById('excludedDomains').value
            .split('\n')
            .map(d => d.trim())
            .filter(d => d.length > 0),
        defaultListId: 'default' // Preserve default list ID structure
    };

    // Get existing settings to preserve defaultListId if it was changed in popup
    const { settings: existingSettings } = await chrome.storage.sync.get(['settings']);
    if (existingSettings && existingSettings.defaultListId) {
        settings.defaultListId = existingSettings.defaultListId;
    }

    await chrome.storage.sync.set({ settings });

    showToast('✓ 설정이 저장되었습니다');
}

// Reset to default settings
async function resetSettings() {
    if (!confirm('모든 설정을 기본값으로 재설정하시겠습니까?')) {
        return;
    }

    const defaultSettings = {
        markdownTemplate: '## 참고\n{{items}}',
        htmlTemplate: '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>',
        markdownItemTemplate: '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}',
        htmlItemTemplate: '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>',
        autoNumbering: true,
        trackCopy: true,
        trackVisit: true,
        showBlogPopup: false,
        autoOpenPopup: true,
        excludedDomains: [],
        visitHistoryDays: 14,
        defaultListId: 'default'
    };

    await chrome.storage.sync.set({ settings: defaultSettings });
    await loadSettings();

    showToast('✓ 기본 설정으로 재설정되었습니다');
}

// Export all data
async function exportData() {
    const data = await chrome.storage.sync.get(null);
    const jsonString = JSON.stringify(data, null, 2);

    // Create download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reference - helper - backup - ${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('✓ 데이터가 내보내기되었습니다');
}

// Import data
async function importData(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const data = JSON.parse(event.target.result);

            if (!confirm('가져오기를 진행하면 현재 데이터가 모두 덮어씌워집니다. 계속하시겠습니까?')) {
                return;
            }

            await chrome.storage.sync.set(data);

            // Update context menus
            chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

            await loadSettings();
            showToast('✓ 데이터가 가져오기되었습니다');
        } catch (error) {
            alert('파일을 읽는 중 오류가 발생했습니다: ' + error.message);
        }
    };

    reader.readAsText(file);

    // Reset file input
    e.target.value = '';
}

// Clear all data
async function clearData() {
    if (!confirm('⚠️ 정말로 모든 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
    }

    if (!confirm('한 번 더 확인합니다. 정말로 삭제하시겠습니까?')) {
        return;
    }

    await chrome.storage.sync.clear();

    // Reinitialize with defaults
    const defaultSettings = {
        markdownTemplate: '## 참고\n{{items}}',
        htmlTemplate: '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>',
        markdownItemTemplate: '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}',
        htmlItemTemplate: '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>',
        autoNumbering: true,
        trackCopy: true,
        trackVisit: true,
        showBlogPopup: true
    };

    await chrome.storage.sync.set({
        lists: {
            'default': {
                name: '기본 목록',
                items: []
            }
        },
        visitHistory: [],
        copyHistory: [],
        settings: defaultSettings
    });

    // Update context menus
    chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

    await loadSettings();
    showToast('✓ 모든 데이터가 삭제되었습니다');
}

// Show toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
