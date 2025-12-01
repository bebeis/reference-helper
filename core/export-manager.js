// Export Manager - Handle markdown/HTML conversion and export

const ExportManager = {
    /**
     * Export items as markdown
     */
    async exportAsMarkdown(items, template = null) {
        const settings = await StorageManager.getSettings();
        const listTemplate = template || settings.markdownTemplate;
        const itemTemplate = settings.markdownItemTemplate;

        // Assign reference numbers if auto-numbering is enabled
        if (settings.autoNumbering) {
            items = items.map((item, index) => {
                if (!item.refNumber) {
                    item.refNumber = index + 1;
                }
                return item;
            });
        }

        // Convert items to markdown
        const itemsMarkdown = items
            .map(item => {
                const refItem = item instanceof ReferenceItem ? item : new ReferenceItem(item);
                return refItem.toMarkdown(itemTemplate);
            })
            .join('\n');

        // Replace {{items}} in list template
        const result = listTemplate.replace('{{items}}', itemsMarkdown);

        return result;
    },

    /**
     * Export items as HTML
     */
    async exportAsHTML(items, template = null) {
        const settings = await StorageManager.getSettings();
        const listTemplate = template || settings.htmlTemplate;
        const itemTemplate = settings.htmlItemTemplate;

        // Assign reference numbers if auto-numbering is enabled
        if (settings.autoNumbering) {
            items = items.map((item, index) => {
                if (!item.refNumber) {
                    item.refNumber = index + 1;
                }
                return item;
            });
        }

        // Convert items to HTML
        const itemsHTML = items
            .map(item => {
                const refItem = item instanceof ReferenceItem ? item : new ReferenceItem(item);
                return refItem.toHTML(itemTemplate);
            })
            .join('\n');

        // Replace {{items}} in list template
        const result = listTemplate.replace('{{items}}', itemsHTML);

        return result;
    },

    /**
     * Export items as plain text
     */
    async exportAsPlainText(items) {
        return items
            .map((item, index) => {
                const refItem = item instanceof ReferenceItem ? item : new ReferenceItem(item);
                return `${index + 1}. ${refItem.toPlainText()}`;
            })
            .join('\n\n');
    },

    /**
     * Export items as JSON
     */
    exportAsJSON(items) {
        return JSON.stringify(items, null, 2);
    },

    /**
     * Copy to clipboard
     */
    async copyToClipboard(text) {
        // Notify that this is an internal copy operation
        document.dispatchEvent(new CustomEvent('ref-helper-internal-copy'));

        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (e) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
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
     * Download as file
     */
    downloadAsFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Get preview of export
     */
    async getPreview(items, format = 'markdown') {
        switch (format) {
            case 'markdown':
                return await this.exportAsMarkdown(items);
            case 'html':
                return await this.exportAsHTML(items);
            case 'plaintext':
                return await this.exportAsPlainText(items);
            case 'json':
                return this.exportAsJSON(items);
            default:
                return '';
        }
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportManager;
}
