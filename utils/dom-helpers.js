// DOM Helper Utilities

/**
 * Create element with attributes and children
 */
function createElement(tag, attributes = {}, children = []) {
    const element = document.createElement(tag);

    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            element.addEventListener(key.substring(2).toLowerCase(), value);
        } else {
            element.setAttribute(key, value);
        }
    });

    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });

    return element;
}

/**
 * Create shadow root for isolated styles
 */
function createShadowRoot(hostElement, styles = '') {
    const shadow = hostElement.attachShadow({ mode: 'open' });

    if (styles) {
        const styleElement = document.createElement('style');
        styleElement.textContent = styles;
        shadow.appendChild(styleElement);
    }

    return shadow;
}

/**
 * Find cursor position in contenteditable or textarea
 */
function getCursorPosition(element) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        return {
            start: element.selectionStart,
            end: element.selectionEnd
        };
    }

    // For contenteditable
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return {
            range: range,
            node: range.startContainer,
            offset: range.startOffset
        };
    }

    return null;
}

/**
 * Insert text at cursor position
 */
function insertTextAtCursor(element, text) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        const start = element.selectionStart;
        const end = element.selectionEnd;
        const value = element.value;

        element.value = value.substring(0, start) + text + value.substring(end);
        element.selectionStart = element.selectionEnd = start + text.length;

        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    // For contenteditable
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const textNode = document.createTextNode(text);
        range.insertNode(textNode);

        // Move cursor to end of inserted text
        range.setStartAfter(textNode);
        range.setEndAfter(textNode);
        selection.removeAllRanges();
        selection.addRange(range);

        // Trigger input event
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

/**
 * Insert text at end of element
 */
function insertTextAtEnd(element, text) {
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
        element.value += '\n' + text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    // For contenteditable
    const textNode = document.createTextNode('\n' + text);
    element.appendChild(textNode);
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Wait for element to exist in DOM
 */
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const element = document.querySelector(selector);
            if (element) {
                observer.disconnect();
                resolve(element);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            reject(new Error('Element not found: ' + selector));
        }, timeout);
    });
}

/**
 * Make element draggable
 */
function makeDraggable(element, handleElement = null) {
    const handle = handleElement || element;
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.style.cursor = 'move';
    handle.addEventListener('mousedown', dragMouseDown);

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;

        document.addEventListener('mouseup', closeDragElement);
        document.addEventListener('mousemove', elementDrag);
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        element.style.top = (element.offsetTop - pos2) + 'px';
        element.style.left = (element.offsetLeft - pos1) + 'px';
    }

    function closeDragElement() {
        document.removeEventListener('mouseup', closeDragElement);
        document.removeEventListener('mousemove', elementDrag);
    }
}

/**
 * Show toast notification
 */
function showToast(message, duration = 3000) {
    const toast = createElement('div', {
        className: 'ref-helper-toast',
        style: {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            backgroundColor: '#323232',
            color: 'white',
            padding: '16px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            zIndex: 999999,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease-out'
        }
    }, [message]);

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, duration);
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        createElement,
        createShadowRoot,
        getCursorPosition,
        insertTextAtCursor,
        insertTextAtEnd,
        waitForElement,
        makeDraggable,
        showToast
    };
}
