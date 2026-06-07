// FILE: src/services/PatientService.js
import { FhirClient } from '../api/fhir-client.js';
import { PatientMapper } from '../mappers/PatientMapper.js';
import { AuditService } from './AuditService.js';
import { CONFIG } from '../config.js';

export class PatientService {
    /**
     * Connects to a patient on the FHIR server, or creates one if it doesn't exist.
     * @returns {Promise<Object>} The Patient resource and its UI data
     */
    static async bootstrapPatient() {
        try {
            // 1. Try to fetch patient by ID
            return await this.getPatientById(CONFIG.patientId);
        } catch (error) {
            // If the server itself is completely offline, it will fail to PUT as well and bubble up the error.
            console.log(`Patient ${CONFIG.patientId} not found or error fetching: ${error.message}. Attempting to create...`);
            
            const formData = {
                id: CONFIG.patientId,
                nome: CONFIG.patientName.given,
                sobrenome: CONFIG.patientName.family
            };
            
            const fhirResource = PatientMapper.toFHIR(formData);
            
            // Add identifier
            if (CONFIG.patientIdentifierSystem) {
                fhirResource.identifier = [{
                    system: CONFIG.patientIdentifierSystem,
                    value: CONFIG.patientId
                }];
            }
            
            // Create via PUT to enforce the configured ID
            const result = await FhirClient.put(`/Patient/${CONFIG.patientId}`, fhirResource);
            await AuditService.logAuditEvent('C', 'Patient', CONFIG.patientId, CONFIG.patientId);
            
            return {
                resource: result,
                uiData: PatientMapper.toUI(result)
            };
        }
    }

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
