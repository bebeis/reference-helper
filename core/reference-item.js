// Reference Item - Data model and utility methods

class ReferenceItem {
    constructor(data = {}) {
        this.id = data.id || Date.now().toString() + '-' + Math.random().toString(36).substr(2, 9);
        this.title = data.title || '';
        this.url = data.url || '';
        this.selectedText = data.selectedText || '';
        this.timestamp = data.timestamp || Date.now();
        this.listId = data.listId || 'default';
        this.refNumber = data.refNumber || null;
        this.description = data.description || '';
        this.author = data.author || '';
        this.favicon = data.favicon || '';
    }

    /**
     * Convert to markdown format
     */
    toMarkdown(template = null) {
        const defaultTemplate = '{{number}}. [{{title}}]({{url}}){{#selectedText}} - "{{selectedText}}"{{/selectedText}}';
        const tmpl = template || defaultTemplate;

        return this.renderTemplate(tmpl);
    }

    /**
     * Convert to HTML format
     */
    toHTML(template = null) {
        const defaultTemplate = '<li><a href="{{url}}">{{title}}</a>{{#selectedText}} - "{{selectedText}}"{{/selectedText}}</li>';
        const tmpl = template || defaultTemplate;

        return this.renderTemplate(tmpl);
    }

    /**
     * Convert to plain text
     */
    toPlainText() {
        let text = this.title;
        if (this.selectedText) {
            text += ` - "${this.selectedText}"`;
        }
        text += `\n${this.url}`;
        return text;
    }

    /**
     * Render template with data
     */
    renderTemplate(template) {
        let result = template;

        // Replace simple variables
        result = result.replace(/\{\{title\}\}/g, this.escapeHtml(this.title));
        result = result.replace(/\{\{url\}\}/g, this.url);
        result = result.replace(/\{\{description\}\}/g, this.escapeHtml(this.description));
        result = result.replace(/\{\{author\}\}/g, this.escapeHtml(this.author));
        result = result.replace(/\{\{number\}\}/g, this.refNumber || '');

        // Handle conditional blocks (e.g., {{#selectedText}}...{{/selectedText}})
        const conditionalRegex = /\{\{#(\w+)\}\}(.*?)\{\{\/\1\}\}/gs;
        result = result.replace(conditionalRegex, (match, field, content) => {
            if (this[field] && this[field].trim()) {
                return content.replace(new RegExp(`\\{\\{${field}\\}\\}`, 'g'), this.escapeHtml(this[field]));
            }
            return '';
        });

        return result;
    }

    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Get formatted date
     */
    getFormattedDate() {
        const date = new Date(this.timestamp);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    }

    /**
     * Get relative time (e.g., "2 hours ago")
     */
    getRelativeTime() {
        const now = Date.now();
        const diff = now - this.timestamp;

        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}일 전`;
        if (hours > 0) return `${hours}시간 전`;
        if (minutes > 0) return `${minutes}분 전`;
        return '방금 전';
    }

    /**
     * Get domain from URL
     */
    getDomain() {
        try {
            const urlObj = new URL(this.url);
            return urlObj.hostname;
        } catch (e) {
            return '';
        }
    }

    /**
     * Get favicon URL
     */
    getFaviconUrl() {
        if (this.favicon) {
            return this.favicon;
        }

        try {
            const urlObj = new URL(this.url);
            return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
        } catch (e) {
            return '';
        }
    }

    /**
     * Create from page metadata
     */
    static fromPageMetadata(metadata, listId = 'default') {
        return new ReferenceItem({
            title: metadata.title || document.title,
            url: metadata.url || window.location.href,
            description: metadata.description || '',
            author: metadata.author || '',
            favicon: metadata.image || '',
            listId: listId
        });
    }

    /**
     * Create from selected text
     */
    static fromSelection(selection, listId = 'default') {
        return new ReferenceItem({
            title: document.title,
            url: window.location.href,
            selectedText: selection,
            listId: listId
        });
    }

    /**
     * Validate item
     */
    validate() {
        const errors = [];

        if (!this.title || this.title.trim() === '') {
            errors.push('Title is required');
        }

        if (!this.url || this.url.trim() === '') {
            errors.push('URL is required');
        }

        try {
            new URL(this.url);
        } catch (e) {
            errors.push('Invalid URL format');
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Clone item
     */
    clone() {
        return new ReferenceItem(this);
    }

    /**
     * Serialize to JSON
     */
    toJSON() {
        return {
            id: this.id,
            title: this.title,
            url: this.url,
            selectedText: this.selectedText,
            timestamp: this.timestamp,
            listId: this.listId,
            refNumber: this.refNumber,
            description: this.description,
            author: this.author,
            favicon: this.favicon
        };
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ReferenceItem;
}
