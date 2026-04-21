// FILE: src/services/AuditService.js
import { FhirClient } from '../api/fhir-client.js';

export class AuditService {
    /**
     * Triggers an AuditEvent (ATNA ITI-20 equivalent) for creating/deleting sensitive data.
     * @param {string} action - 'C' (Create), 'R' (Read), 'U' (Update), 'D' (Delete), 'E' (Execute)
     * @param {string} entityType - The type of resource being audited
     * @param {string} patientId - The associated patient
     * @param {string} resourceId - The affected resource ID
     */
    static async logAuditEvent(action, entityType, patientId, resourceId) {
        const auditEvent = {
            resourceType: "AuditEvent",
            type: {
                system: "http://dicom.nema.org/resources/ontology/DCM",
                code: "110110",
                display: "Patient Record"
            },
            action: action,
            recorded: new Date().toISOString(),
            outcome: "0",
            agent: [{
                requestor: true,
                role: [{
                    coding: [{ system: "http://terminology.hl7.org/CodeSystem/v3-RoleClass", code: "PROV" }]
                }]
            }],
            source: {
                observer: { display: "SisAPEC Frontend application" }
            },
            entity: []
        };

        if (patientId) {
            auditEvent.entity.push({
                what: { reference: `Patient/${patientId}` },
                type: { system: "http://terminology.hl7.org/CodeSystem/audit-entity-type", code: "1", display: "Person" },
                role: { system: "http://terminology.hl7.org/CodeSystem/object-role", code: "1", display: "Patient" }
            });
        }

        if (resourceId) {
            auditEvent.entity.push({
                what: { reference: `${entityType}/${resourceId}` },
                type: { system: "http://terminology.hl7.org/CodeSystem/audit-entity-type", code: "2", display: "System Object" }
            });
        }

        try {
            await FhirClient.post('/AuditEvent', auditEvent);
            console.info(`[ATNA] AuditEvent logged for ${action} on ${entityType}/${resourceId || 'new'}`);
        } catch (err) {
            console.error('[ATNA] Failed to log AuditEvent. Security implication.', err);
        }
    }
}
