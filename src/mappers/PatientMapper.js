// FILE: src/mappers/PatientMapper.js

/**
 * @typedef {Object} UI_PatientFormData
 * @property {string} id
 * @property {string} nome
 * @property {string} sobrenome
 */

/**
 * @typedef {Object} FHIR_Patient
 * @property {string} resourceType
 * @property {string} [id]
 * @property {Array<{family: string, given: string[]}>} name
 */

export class PatientMapper {
    /**
     * Maps UI form data to a FHIR Patient resource.
     * @param {UI_PatientFormData} formData 
     * @returns {FHIR_Patient}
     */
    static toFHIR(formData) {
        const resource = {
            resourceType: "Patient",
            name: [{
                family: formData.sobrenome,
                given: [formData.nome]
            }]
        };

        if (formData.id) {
            resource.id = formData.id;
        }

        return resource;
    }

    /**
     * Maps a FHIR Patient resource to UI form data format.
     * @param {FHIR_Patient} fhirResource 
     * @returns {UI_PatientFormData}
     */
    static toUI(fhirResource) {
        return {
            id: fhirResource.id || '',
            nome: fhirResource.name?.[0]?.given?.[0] || '',
            sobrenome: fhirResource.name?.[0]?.family || ''
        };
    }
}
