// FILE: src/api/fhir-client.js

/**
 * Base FHIR Client wrapper for HTTP requests.
 * Centralizes OperationOutcome handling and headers.
 */
export class FhirClient {
    /**
     * Gets the current base URL from the DOM or uses a default.
     * @returns {string} The base FHIR URL
     */
    static getBaseUrl() {
        const urlInput = document.getElementById('serverUrl');
        return urlInput ? urlInput.value.replace(/\/$/, "") : 'http://localhost:8080/fhir';
    }

    /**
     * Generic fetch wrapper that standardizes headers and handles FHIR OperationOutcomes
     * @param {string} endpoint 
     * @param {RequestInit} options 
     */
    static async request(endpoint, options = {}) {
        const url = `${this.getBaseUrl()}${endpoint}`;
        const headers = {
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json',
            ...options.headers
        };

        try {
            const response = await fetch(url, { ...options, headers });
            
            if (!response.ok) {
                let errorMessage = `HTTP ${response.status} ${response.statusText}`;
                try {
                    const errorBody = await response.json();
                    if (errorBody.resourceType === 'OperationOutcome') {
                        const issues = errorBody.issue.map(i => i.diagnostics || i.details?.text).join('; ');
                        errorMessage += ` \nFHIR Details: ${issues}`;
                    } else {
                        errorMessage += ` \nDetails: ${JSON.stringify(errorBody)}`;
                    }
                } catch (e) {
                    const text = await response.text();
                    errorMessage += ` \nDetails: ${text}`;
                }
                throw new Error(errorMessage);
            }

            // Return text if 204 No Content, otherwise parse JSON
            if (response.status === 204) return null;
            
            const textResponse = await response.text();
            return textResponse ? JSON.parse(textResponse) : null;
        } catch (error) {
            console.error('[FhirClient Error]', error);
            throw error;
        }
    }

    static get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    }

    static post(endpoint, body) {
        return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) });
    }

    static put(endpoint, body) {
        return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) });
    }

    static delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
}
