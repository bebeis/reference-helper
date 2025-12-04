// Sensitive Data Detector - Detect potentially sensitive information patterns

/**
 * Detects if the given text contains potentially sensitive information
 * @param {string} text - Text to analyze
 * @returns {boolean} - True if sensitive data is detected
 */
function isSensitiveData(text) {
    if (!text || typeof text !== 'string') {
        return false;
    }

    // Trim and normalize
    const normalized = text.trim();

    // Skip very short text (likely not sensitive)
    if (normalized.length < 8) {
        return false;
    }

    // Check for various sensitive patterns
    return (
        isApiKey(normalized) ||
        isJwtToken(normalized) ||
        isBearerToken(normalized) ||
        isPassword(normalized) ||
        isCreditCard(normalized) ||
        isPrivateKey(normalized) ||
        isAccessToken(normalized)
    );
}

/**
 * Detect common API key patterns
 */
function isApiKey(text) {
    const apiKeyPatterns = [
        /^sk-[a-zA-Z0-9]{20,}$/i,  // Stripe secret key
        /^pk-[a-zA-Z0-9]{20,}$/i,  // Stripe public key
        /^AIza[a-zA-Z0-9_-]{35,}$/,  // Google API key
        /^ya29\.[a-zA-Z0-9_-]{50,}$/,  // Google OAuth token
        /^[a-zA-Z0-9]{32,}$/,  // Generic 32+ char alphanumeric (common for API keys)
        /^xox[baprs]-[a-zA-Z0-9-]{10,}$/,  // Slack tokens
        /^ghp_[a-zA-Z0-9]{36,}$/,  // GitHub personal access token
        /^gho_[a-zA-Z0-9]{36,}$/,  // GitHub OAuth token
        /^github_pat_[a-zA-Z0-9]{22,}_[a-zA-Z0-9]{59}$/,  // GitHub fine-grained PAT
        /^glpat-[a-zA-Z0-9_-]{20,}$/,  // GitLab personal access token
        /^AKIA[a-zA-Z0-9]{16}$/,  // AWS access key ID
        /^[a-zA-Z0-9/+=]{40}$/,  // AWS secret access key
        /^key-[a-zA-Z0-9]{32,}$/i,  // Generic key- prefix
        /^api[_-]?key[_-]?[a-zA-Z0-9]{16,}$/i,  // api_key or api-key prefix
        /^secret[_-]?[a-zA-Z0-9]{16,}$/i,  // secret prefix
    ];

    return apiKeyPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect JWT tokens
 */
function isJwtToken(text) {
    // JWT format: header.payload.signature (all base64)
    const jwtPattern = /^eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/;
    return jwtPattern.test(text);
}

/**
 * Detect Bearer tokens
 */
function isBearerToken(text) {
    const bearerPattern = /^Bearer\s+[a-zA-Z0-9_\-\.=]+$/i;
    return bearerPattern.test(text);
}

/**
 * Detect password-like patterns
 */
function isPassword(text) {
    // Look for high entropy strings that might be passwords
    // Characteristics: mix of upper, lower, numbers, special chars

    // Skip if it looks like normal text (has spaces, common words)
    if (/\s/.test(text)) {
        return false;
    }

    const hasUpper = /[A-Z]/.test(text);
    const hasLower = /[a-z]/.test(text);
    const hasNumber = /[0-9]/.test(text);
    const hasSpecial = /[^a-zA-Z0-9]/.test(text);

    // Count how many character types are present
    const charTypes = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

    // If it has 3+ character types and is 10+ chars, likely a password
    if (charTypes >= 3 && text.length >= 10) {
        return true;
    }

    // Also check for common password patterns
    const passwordPatterns = [
        /^[a-zA-Z0-9!@#$%^&*()_+\-=\[\]{}|;:,.<>?]{12,}$/,  // 12+ chars with typical password chars
    ];

    return passwordPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect credit card numbers
 */
function isCreditCard(text) {
    // Remove spaces and dashes
    const cleaned = text.replace(/[\s-]/g, '');

    // Check if it's 13-19 digits (standard CC length)
    if (!/^\d{13,19}$/.test(cleaned)) {
        return false;
    }

    // Luhn algorithm check
    return luhnCheck(cleaned);
}

/**
 * Luhn algorithm for credit card validation
 */
function luhnCheck(cardNumber) {
    let sum = 0;
    let isEven = false;

    for (let i = cardNumber.length - 1; i >= 0; i--) {
        let digit = parseInt(cardNumber[i], 10);

        if (isEven) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        isEven = !isEven;
    }

    return sum % 10 === 0;
}

/**
 * Detect private keys (PEM format)
 */
function isPrivateKey(text) {
    const privateKeyPatterns = [
        /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/i,
        /-----BEGIN\s+OPENSSH\s+PRIVATE\s+KEY-----/i,
        /-----BEGIN\s+EC\s+PRIVATE\s+KEY-----/i,
        /-----BEGIN\s+DSA\s+PRIVATE\s+KEY-----/i,
    ];

    return privateKeyPatterns.some(pattern => pattern.test(text));
}

/**
 * Detect OAuth access tokens
 */
function isAccessToken(text) {
    const accessTokenPatterns = [
        /^[a-zA-Z0-9_-]{40,}$/,  // Generic long token
        /access[_-]?token[=:]\s*[a-zA-Z0-9_-]{20,}/i,  // access_token= or access-token:
    ];

    return accessTokenPatterns.some(pattern => pattern.test(text));
}

/**
 * Get a safe description of why text was flagged (for logging/debugging)
 * @param {string} text - Text that was detected as sensitive
 * @returns {string} - Reason description
 */
function getSensitiveDataType(text) {
    if (isApiKey(text)) return 'API Key';
    if (isJwtToken(text)) return 'JWT Token';
    if (isBearerToken(text)) return 'Bearer Token';
    if (isPrivateKey(text)) return 'Private Key';
    if (isCreditCard(text)) return 'Credit Card Number';
    if (isPassword(text)) return 'Password-like String';
    if (isAccessToken(text)) return 'Access Token';
    return 'Sensitive Data';
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        isSensitiveData,
        getSensitiveDataType
    };
}
