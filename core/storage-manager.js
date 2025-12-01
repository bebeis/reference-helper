// Storage Manager - Handle all data persistence operations

const StorageManager = {
    /**
     * Get all lists
     */
    async getLists() {
        const { lists } = await chrome.storage.sync.get(['lists']);
        return lists || {};
    },

    /**
     * Get a specific list by ID
     */
    async getList(listId) {
        const lists = await this.getLists();
        return lists[listId] || null;
    },

    /**
     * Create a new list
     */
    async createList(name) {
        const lists = await this.getLists();
        const listId = 'list-' + Date.now();

        lists[listId] = {
            name: name,
            items: []
        };

        await chrome.storage.sync.set({ lists });

        // Notify background to update context menus
        chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

        return listId;
    },

    /**
     * Delete a list
     */
    async deleteList(listId) {
        if (listId === 'default') {
            throw new Error('Cannot delete default list');
        }

        const lists = await this.getLists();
        delete lists[listId];

        await chrome.storage.sync.set({ lists });

        // Notify background to update context menus
        chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });
    },

    /**
     * Rename a list
     */
    async renameList(listId, newName) {
        const lists = await this.getLists();

        if (!lists[listId]) {
            throw new Error('List not found');
        }

        lists[listId].name = newName;
        await chrome.storage.sync.set({ lists });

        // Notify background to update context menus
        chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });
    },

    /**
     * Add item to list
     */
    async addItem(listId, item) {
        const lists = await this.getLists();

        if (!lists[listId]) {
            throw new Error('List not found');
        }

        // Ensure item has required fields
        if (!item.id) {
            item.id = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        }
        if (!item.timestamp) {
            item.timestamp = Date.now();
        }
        if (!item.listId) {
            item.listId = listId;
        }

        lists[listId].items.push(item);
        await chrome.storage.sync.set({ lists });

        return item;
    },

    /**
     * Remove item from list
     */
    async removeItem(listId, itemId) {
        const lists = await this.getLists();

        if (!lists[listId]) {
            throw new Error('List not found');
        }

        lists[listId].items = lists[listId].items.filter(item => item.id !== itemId);
        await chrome.storage.sync.set({ lists });
    },

    /**
     * Move item to another list
     */
    async moveItem(fromListId, toListId, itemId) {
        const lists = await this.getLists();

        if (!lists[fromListId] || !lists[toListId]) {
            throw new Error('List not found');
        }

        const itemIndex = lists[fromListId].items.findIndex(item => item.id === itemId);
        if (itemIndex === -1) {
            throw new Error('Item not found');
        }

        const [item] = lists[fromListId].items.splice(itemIndex, 1);
        item.listId = toListId;
        lists[toListId].items.push(item);

        await chrome.storage.sync.set({ lists });
    },

    /**
     * Update item
     */
    async updateItem(listId, itemId, updates) {
        const lists = await this.getLists();

        if (!lists[listId]) {
            throw new Error('List not found');
        }

        const item = lists[listId].items.find(item => item.id === itemId);
        if (!item) {
            throw new Error('Item not found');
        }

        Object.assign(item, updates);
        await chrome.storage.sync.set({ lists });

        return item;
    },

    /**
     * Get all items from all lists
     */
    async getAllItems() {
        const lists = await this.getLists();
        const allItems = [];

        Object.entries(lists).forEach(([listId, list]) => {
            allItems.push(...list.items);
        });

        return allItems;
    },

    /**
     * Get visit history
     */
    async getVisitHistory() {
        const { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
        return visitHistory || [];
    },

    /**
     * Add to visit history
     */
    async addToVisitHistory(item) {
        let { visitHistory } = await chrome.storage.sync.get(['visitHistory']);
        if (!visitHistory) visitHistory = [];

        // Check if URL already exists
        const existingIndex = visitHistory.findIndex(v => v.url === item.url);
        if (existingIndex !== -1) {
            // Update timestamp
            visitHistory[existingIndex].timestamp = Date.now();
        } else {
            visitHistory.unshift({
                ...item,
                id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
                timestamp: Date.now()
            });

            // Keep only last 100 items
            if (visitHistory.length > 100) {
                visitHistory = visitHistory.slice(0, 100);
            }
        }

        await chrome.storage.sync.set({ visitHistory });
    },

    /**
     * Get copy history
     */
    async getCopyHistory() {
        const { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
        return copyHistory || [];
    },

    /**
     * Add to copy history
     */
    async addToCopyHistory(item) {
        let { copyHistory } = await chrome.storage.sync.get(['copyHistory']);
        if (!copyHistory) copyHistory = [];

        copyHistory.unshift({
            ...item,
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9),
            timestamp: Date.now()
        });

        // Keep only last 100 items
        if (copyHistory.length > 100) {
            copyHistory = copyHistory.slice(0, 100);
        }

        await chrome.storage.sync.set({ copyHistory });
    },

    /**
     * Get settings
     */
    async getSettings() {
        const { settings } = await chrome.storage.sync.get(['settings']);
        return settings || {
            markdownTemplate: '## 참고\n{{items}}',
            htmlTemplate: '<h2>참고</h2>\n<ol>\n{{items}}\n</ol>',
            markdownItemTemplate: '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}',
            htmlItemTemplate: '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>',
            autoNumbering: true,
            trackCopy: true,
            trackVisit: true,
            showBlogPopup: true
        };
    },

    /**
     * Update settings
     */
    async updateSettings(updates) {
        const settings = await this.getSettings();
        Object.assign(settings, updates);
        await chrome.storage.sync.set({ settings });
    },

    /**
     * Clear all data
     */
    async clearAllData() {
        await chrome.storage.sync.clear();

        // Reinitialize with default data
        await chrome.storage.sync.set({
            lists: {
                'default': {
                    name: '기본 목록',
                    items: []
                }
            },
            visitHistory: [],
            copyHistory: [],
            settings: await this.getSettings()
        });
    },

    /**
     * Export all data as JSON
     */
    async exportData() {
        const data = await chrome.storage.sync.get(null);
        return JSON.stringify(data, null, 2);
    },

    /**
     * Import data from JSON
     */
    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            await chrome.storage.sync.set(data);

            // Notify background to update context menus
            chrome.runtime.sendMessage({ type: 'UPDATE_CONTEXT_MENUS' });

            return true;
        } catch (e) {
            throw new Error('Invalid JSON data');
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageManager;
}
