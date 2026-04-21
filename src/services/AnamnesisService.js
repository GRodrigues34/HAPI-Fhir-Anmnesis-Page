// FILE: src/services/AnamnesisService.js
import { FhirClient } from '../api/fhir-client.js';
import { AuditService } from './AuditService.js';

export class AnamnesisService {
    /**
     * MHD / QEDm compliant: groups clinical resources into a single FHIR Transaction Bundle.
     * Prevents sequential REST calls for a single anamnesis session.
     * @param {Object[]} resources - Array of FHIR resources to submit
     * @param {string} patientId - For audit logging
     */
    static async submitTransaction(resources, patientId) {
        if (!resources || resources.length === 0) return null;

        const bundle = {
            resourceType: "Bundle",
            type: "transaction",
            entry: resources.map(res => {
                const isUpdate = !!res.id;
                const method = isUpdate ? 'PUT' : 'POST';
                const url = isUpdate ? `${res.resourceType}/${res.id}` : res.resourceType;
                
                return {
                    resource: res,
                    request: {
                        method: method,
                        url: url
                    }
                };
            })
        };

        const result = await FhirClient.post('/', bundle);
        
        // Log ATNA audit event for the transaction as a whole
        await AuditService.logAuditEvent('E', 'Bundle', patientId, result.id || 'transaction');
        
        return result;
    }

    /**
     * Submit a single clinical record wrapped in a transaction bundle 
     * to enforce the Transaction pattern even for granular UI updates.
     */
    static async submitClinicalRecord(resource, patientId) {
        return this.submitTransaction([resource], patientId);
    }

    /**
     * Delete a clinical record and log audit
     */
    static async deleteClinicalRecord(resourceType, resourceId, patientId) {
        await FhirClient.delete(`/${resourceType}/${encodeURIComponent(resourceId)}`);
        await AuditService.logAuditEvent('D', resourceType, patientId, resourceId);
    }

    /**
     * Generic fetcher for Anamnesis history elements.
     */
    static async fetchHistoryList(resourceType, patientId, additionalParams = "") {
        const response = await FhirClient.get(`/${resourceType}?subject=Patient/${patientId}${additionalParams}&_sort=-_lastUpdated&_t=${Date.now()}`);
        return response?.entry || [];
    }

    static async getResourceById(resourceType, id) {
        return await FhirClient.get(`/${resourceType}/${encodeURIComponent(id)}`);
    }
}
