// FILE: src/mappers/MedicationMapper.js

/**
 * @typedef {Object} UI_MedicationData
 * @property {string} patientId
 * @property {string} [id]
 * @property {string[]} medicamentos
 * @property {string} consegueTomar
 * @property {string} porque
 * @property {string} usouMedicamento
 * @property {string} detalhes
 */

export class MedicationMapper {
    /**
     * Maps UI medication data to FHIR MedicationStatement without JSON Stringify anti-pattern.
     * Use dosage instruction and extensions for data rather than stringified notes.
     * @param {UI_MedicationData} data 
     * @returns {Object}
     */
    static toFHIR(data) {
        const resource = {
            resourceType: "MedicationStatement",
            status: "completed",
            subject: { reference: `Patient/${data.patientId}` },
            category: [{ 
                coding: [{ 
                    system: "http://terminology.hl7.org/CodeSystem/medication-statement-category", 
                    code: "patientreported" 
                }] 
            }],
            // Extract the first medication for the medicationCodeableConcept, or 'Unknown'
            medicationCodeableConcept: {
                text: data.medicamentos?.[0] || 'Unknown Medication'
            },
            // The rest of medications can go as additional coding/text or handled differently,
            // but normally a MedicationStatement is per medication. For a composite ui form mapping:
            note: [],
            // Structured dosage to store 'detalhes'
            dosage: [{
                text: data.detalhes || '',
                patientInstruction: `Consegue tomar: ${data.consegueTomar}. Usou: ${data.usouMedicamento}. Por que: ${data.porque}`
            }],
            extension: [
                {
                    url: "http://example.org/fhir/StructureDefinition/medication-compliance",
                    valueBoolean: data.consegueTomar === 'yes'
                },
                {
                    url: "http://example.org/fhir/StructureDefinition/medication-compliance-reason",
                    valueString: data.porque || ''
                },
                {
                    url: "http://example.org/fhir/StructureDefinition/medication-used-recently",
                    valueBoolean: data.usouMedicamento === 'yes'
                }
            ]
        };

        if (data.id) {
            resource.id = data.id;
        }

        // If multiple medications, we store them as a combined text for now or create a bundle of MedicationStatements
        // in AnamnesisService. Since the UI groups them, we place them in note as plain text.
        if (data.medicamentos?.length > 1) {
             resource.note.push({
                 text: `Outros medicamentos relatados: ${data.medicamentos.slice(1).join(', ')}`
             });
        }

        return resource;
    }

    /**
     * Maps FHIR MedicationStatement to UI Data.
     * @param {Object} resource 
     * @returns {UI_MedicationData}
     */
    static toUI(resource) {
        const primaryMed = resource.medicationCodeableConcept?.text || '';
        let medicamentos = primaryMed && primaryMed !== 'Unknown Medication' ? [primaryMed] : [];
        
        let consegueTomar = 'no';
        let porque = '';
        let usouMedicamento = 'no';
        let detalhes = resource.dosage?.[0]?.text || '';

        resource.extension?.forEach(ext => {
            if (ext.url.includes("medication-compliance") && !ext.url.includes("reason")) {
                consegueTomar = ext.valueBoolean ? 'yes' : 'no';
            }
            if (ext.url.includes("medication-compliance-reason")) {
                porque = ext.valueString || '';
            }
            if (ext.url.includes("medication-used-recently")) {
                usouMedicamento = ext.valueBoolean ? 'yes' : 'no';
            }
        });

        // Fallback or additional info in notes
        const noteText = resource.note?.[0]?.text || '';
        if (noteText.includes('Outros medicamentos relatados:')) {
            const othersStr = noteText.replace('Outros medicamentos relatados: ', '');
            const others = othersStr.split(', ').map(s => s.trim()).filter(Boolean);
            medicamentos = medicamentos.concat(...others);
        }

        return {
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            id: resource.id || '',
            medicamentos,
            consegueTomar,
            usouMedicamento,
            porque,
            detalhes
        };
    }
}
