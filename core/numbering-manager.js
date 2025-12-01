// Numbering Manager - Handle reference numbering system

const NumberingManager = {
    /**
     * Generate placeholder for reference number
     */
    generatePlaceholder(number) {
        return `[[${number}]]`;
    },

    /**
     * Get next reference number for a list
     */
    async getNextNumber(listId) {
        const list = await StorageManager.getList(listId);
        if (!list) return 1;

        // Find highest reference number
        let maxNumber = 0;
        list.items.forEach(item => {
            if (item.refNumber && item.refNumber > maxNumber) {
                maxNumber = item.refNumber;
            }
        });

        return maxNumber + 1;
    },

    /**
     * Add item with auto-generated placeholder
     */
    async addWithPlaceholder(listId, item) {
        const number = await this.getNextNumber(listId);
        const placeholder = this.generatePlaceholder(number);

        // Update item with reference number
        item.refNumber = number;

        // Add to storage
        await StorageManager.addItem(listId, item);

        // Copy placeholder to clipboard
        await this.copyPlaceholder(placeholder);

        return {
            item,
            placeholder,
            number
        };
    },

    /**
     * Copy placeholder to clipboard
     */
    async copyPlaceholder(placeholder) {
        try {
            await navigator.clipboard.writeText(placeholder);
            return true;
        } catch (e) {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = placeholder;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            const success = document.execCommand('copy');
            document.body.removeChild(textarea);
            return success;
        }
    },

    /**
     * Scan document for placeholders
     */
    scanPlaceholders(text) {
        const regex = /\[\[(\d+)\]\]/g;
        const placeholders = [];
        let match;

        while ((match = regex.exec(text)) !== null) {
            placeholders.push({
                placeholder: match[0],
                number: parseInt(match[1]),
                index: match.index
            });
        }

        return placeholders;
    },

    /**
     * Replace placeholders with actual references
     */
    async replacePlaceholders(text, listId, format = 'markdown') {
        const list = await StorageManager.getList(listId);
        if (!list) return text;

        const placeholders = this.scanPlaceholders(text);
        let result = text;

        // Create a map of reference numbers to items
        const numberMap = {};
        list.items.forEach(item => {
            if (item.refNumber) {
                numberMap[item.refNumber] = item;
            }
        });

        // Replace placeholders in reverse order to maintain indices
        for (let i = placeholders.length - 1; i >= 0; i--) {
            const ph = placeholders[i];
            const item = numberMap[ph.number];

            if (item) {
                const refItem = new ReferenceItem(item);
                let replacement;

                if (format === 'markdown') {
                    replacement = `[${refItem.title}](${refItem.url})`;
                } else if (format === 'html') {
                    replacement = `<a href="${refItem.url}">${refItem.title}</a>`;
                } else {
                    replacement = refItem.title;
                }

                result = result.substring(0, ph.index) + replacement + result.substring(ph.index + ph.placeholder.length);
            }
        }

        return result;
    },

    /**
     * Renumber items after deletion
     */
    async renumberList(listId) {
        const list = await StorageManager.getList(listId);
        if (!list) return;

        // Sort items by reference number
        const itemsWithNumbers = list.items
            .filter(item => item.refNumber !== null)
            .sort((a, b) => a.refNumber - b.refNumber);

        // Reassign numbers sequentially
        itemsWithNumbers.forEach((item, index) => {
            item.refNumber = index + 1;
        });

        // Update storage
        await chrome.storage.sync.set({ lists: { ...await StorageManager.getLists(), [listId]: list } });
    },

    /**
     * Get items by reference number
     */
    async getItemByNumber(listId, number) {
        const list = await StorageManager.getList(listId);
        if (!list) return null;

        return list.items.find(item => item.refNumber === number) || null;
    },

    /**
     * Generate reference list from document
     * Scans document for placeholders and creates reference list
     */
    async generateReferenceList(text, listId, format = 'markdown') {
        const placeholders = this.scanPlaceholders(text);
        const list = await StorageManager.getList(listId);

        if (!list) return '';

        // Get unique reference numbers
        const numbers = [...new Set(placeholders.map(ph => ph.number))].sort((a, b) => a - b);

        // Get items for those numbers
        const items = numbers
            .map(num => list.items.find(item => item.refNumber === num))
            .filter(item => item !== undefined);

        // Export based on format
        if (format === 'markdown') {
            return await ExportManager.exportAsMarkdown(items);
        } else if (format === 'html') {
            return await ExportManager.exportAsHTML(items);
        } else {
            return await ExportManager.exportAsPlainText(items);
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NumberingManager;
}
