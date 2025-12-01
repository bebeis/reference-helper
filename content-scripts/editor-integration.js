// Editor Integration - Universal editor detection and text insertion

(function () {
    'use strict';

    // Listen for insert events from writing panel
    document.addEventListener('ref-helper-insert', async (e) => {
        const { text } = e.detail;
        const success = await insertText(text);

        if (success) {
            e.detail.success = true;
        }
    });

    // Main insert function - tries multiple methods universally
    async function insertText(text) {
        try {
            console.log('[Reference Helper] Attempting to insert text, length:', text.length);

            // Try multiple insertion methods in order
            const methods = [
                () => insertIntoActiveElement(text),
                () => insertIntoCodeMirror(findCodeMirrorEditor(), text),
                () => insertIntoProseMirror(findProseMirrorEditor(), text),
                () => insertIntoTextarea(findTextarea(), text),
                () => insertIntoContentEditable(findContentEditable(), text)
            ];

            for (const method of methods) {
                try {
                    const result = await method();
                    if (result) {
                        console.log('[Reference Helper] Insert succeeded');
                        return true;
                    }
                } catch (e) {
                    // Continue to next method
                }
            }

            // All methods failed, copy to clipboard
            console.log('[Reference Helper] All insertion methods failed, copying to clipboard');
            await navigator.clipboard.writeText(text);
            return false;
        } catch (e) {
            console.error('[Reference Helper] Error during insertion:', e);
            // Last resort: copy to clipboard
            try {
                await navigator.clipboard.writeText(text);
            } catch (clipboardError) {
                console.error('[Reference Helper] Even clipboard copy failed:', clipboardError);
            }
            return false;
        }
    }

    // Insert into currently active/focused element
    function insertIntoActiveElement(text) {
        const activeElement = document.activeElement;

        if (!activeElement) return false;

        console.log('[Reference Helper] Trying active element:', activeElement.tagName);

        if (activeElement.tagName === 'TEXTAREA' || activeElement.tagName === 'INPUT') {
            return insertIntoTextarea(activeElement, text);
        }

        if (activeElement.isContentEditable || activeElement.contentEditable === 'true') {
            return insertIntoContentEditable(activeElement, text);
        }

        // Check if active element has CodeMirror
        if (activeElement.classList && activeElement.classList.contains('CodeMirror')) {
            return insertIntoCodeMirror(activeElement, text);
        }

        return false;
    }

    // Find CodeMirror editor on page
    function findCodeMirrorEditor() {
        const codeMirrors = document.querySelectorAll('.CodeMirror');
        for (const cm of codeMirrors) {
            if (cm.CodeMirror) {
                return cm;
            }
        }
        return null;
    }

    // Find ProseMirror editor
    function findProseMirrorEditor() {
        return document.querySelector('.ProseMirror');
    }

    // Find textarea
    function findTextarea() {
        return document.querySelector('textarea');
    }

    // Find contenteditable
    function findContentEditable() {
        return document.querySelector('[contenteditable="true"]');
    }

    // Insert into textarea
    function insertIntoTextarea(textarea, text) {
        if (!textarea) return false;

        try {
            console.log('[Reference Helper] Inserting into textarea');
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const value = textarea.value;

            textarea.value = value.substring(0, start) + text + value.substring(end);
            textarea.selectionStart = textarea.selectionEnd = start + text.length;

            textarea.dispatchEvent(new Event('input', { bubbles: true }));
            textarea.dispatchEvent(new Event('change', { bubbles: true }));

            console.log('[Reference Helper] Textarea insertion successful');
            return true;
        } catch (e) {
            console.error('[Reference Helper] Failed to insert into textarea', e);
            return false;
        }
    }

    // Insert into contenteditable
    function insertIntoContentEditable(element, text) {
        if (!element) return false;

        try {
            const selection = window.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);

                if (element.contains(range.commonAncestorContainer)) {
                    const textNode = document.createTextNode(text);
                    range.deleteContents();
                    range.insertNode(textNode);

                    range.setStartAfter(textNode);
                    range.setEndAfter(textNode);
                    selection.removeAllRanges();
                    selection.addRange(range);

                    element.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                }
            }

            // Fallback: append to end
            const textNode = document.createTextNode('\n\n' + text);
            element.appendChild(textNode);
            element.dispatchEvent(new Event('input', { bubbles: true }));
            return true;
        } catch (e) {
            console.error('[Reference Helper] Failed to insert into contenteditable', e);
            return false;
        }
    }

    // Insert into CodeMirror
    function insertIntoCodeMirror(element, text) {
        if (!element) return false;

        try {
            console.log('[Reference Helper] Inserting into CodeMirror');

            let cm = null;

            // Method 1: Direct property
            if (element.CodeMirror) {
                cm = element.CodeMirror;
            }

            // Method 2: Check parent elements
            if (!cm) {
                let parent = element.parentElement;
                let attempts = 0;
                while (parent && attempts < 5) {
                    if (parent.CodeMirror) {
                        cm = parent.CodeMirror;
                        break;
                    }
                    parent = parent.parentElement;
                    attempts++;
                }
            }

            // Method 3: Global search
            if (!cm) {
                const allCodeMirrors = document.querySelectorAll('.CodeMirror');
                for (const cmEl of allCodeMirrors) {
                    if (cmEl.CodeMirror) {
                        cm = cmEl.CodeMirror;
                        break;
                    }
                }
            }

            if (!cm) {
                console.warn('[Reference Helper] CodeMirror instance not found');
                return false;
            }

            console.log('[Reference Helper] Found CodeMirror instance');

            const cursor = cm.getCursor();
            cm.replaceRange(text, cursor);

            const lines = text.split('\n');
            const newCursor = {
                line: cursor.line + lines.length - 1,
                ch: lines.length > 1 ? lines[lines.length - 1].length : cursor.ch + text.length
            };
            cm.setCursor(newCursor);
            cm.focus();

            console.log('[Reference Helper] CodeMirror insertion successful');
            return true;
        } catch (e) {
            console.error('[Reference Helper] Failed to insert into CodeMirror:', e);
            return false;
        }
    }

    // Insert into ProseMirror
    function insertIntoProseMirror(element, text) {
        if (!element) return false;

        try {
            const event = new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                inputType: 'insertText',
                data: text
            });

            element.dispatchEvent(event);

            if (!event.defaultPrevented) {
                return insertIntoContentEditable(element, text);
            }

            return true;
        } catch (e) {
            console.error('[Reference Helper] Failed to insert into ProseMirror', e);
            return insertIntoContentEditable(element, text);
        }
    }

})();
