// FILE: src/services/PatientService.js
import { FhirClient } from '../api/fhir-client.js';
import { PatientMapper } from '../mappers/PatientMapper.js';
import { AuditService } from './AuditService.js';

export class PatientService {
    /**
     * PDQm compliant patient search (ITI-78)
     * Matches patients by sorting by last modified, limited count.
     * Could also add exact search parameters if requested.
     */
    static async listPatients(limit = 10) {
        const response = await FhirClient.get(`/Patient?_sort=-_lastUpdated&_count=${limit}&_t=${Date.now()}`);
        return (response?.entry || []).map(e => ({
            resource: e.resource,
            uiData: PatientMapper.toUI(e.resource)
        }));
    }

    /**
     * Fetch a specific patient by ID
     */
    static async getPatientById(id) {
        const resource = await FhirClient.get(`/Patient/${encodeURIComponent(id)}`);
        if (!resource) throw new Error('Patient not found');
        AuditService.logAuditEvent('R', 'Patient', id, id);
        return { resource, uiData: PatientMapper.toUI(resource) };
    }

    /**
     * Create or update a patient
     */
    static async savePatient(formData) {
        const fhirResource = PatientMapper.toFHIR(formData);
        let result;

        if (fhirResource.id) {
            result = await FhirClient.put(`/Patient/${fhirResource.id}`, fhirResource);
            AuditService.logAuditEvent('U', 'Patient', fhirResource.id, fhirResource.id);
        } else {
            result = await FhirClient.post('/Patient', fhirResource);
            const newId = result.id || 'unknown';
            AuditService.logAuditEvent('C', 'Patient', newId, newId);
        }

        return result;
    }
}
