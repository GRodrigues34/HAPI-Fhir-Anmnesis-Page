export const CONFIG = {
    patientId: 'watch-patient-001',       // The known FHIR Patient ID
    patientName: {
        given: 'Watch',                   // First name for auto-creation
        family: 'User'                    // Last name for auto-creation
    },
    patientIdentifierSystem: 'urn:local:sisapec:patient', // Identifier system for auto-creation
    defaultServerUrl: 'http://localhost:8080/fhir'
};
