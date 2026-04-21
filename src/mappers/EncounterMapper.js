// FILE: src/mappers/EncounterMapper.js

export class EncounterMapper {
    /**
     * Maps Internacao (Inpatient) Data to FHIR Encounter
     */
    static toInpatientEncounterFHIR(data) {
        const resource = {
            resourceType: "Encounter",
            status: "finished",
            class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP" },
            subject: { reference: `Patient/${data.patientId}` },
            period: { start: data.dataInternacao },
            reasonCode: [{ text: data.motivoInternacao }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toInpatientEncounterUI(resource) {
        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            dataInternacao: resource.period?.start?.split('T')?.[0] || '',
            motivoInternacao: resource.reasonCode?.[0]?.text || ''
        };
    }

    /**
     * Maps Visita (Ambulatory) Data to FHIR Encounter
     */
    static toOutpatientEncounterFHIR(data) {
        const resource = {
            resourceType: "Encounter",
            status: "finished",
            class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" },
            subject: { reference: `Patient/${data.patientId}` },
            serviceType: { text: data.servicoProcurado },
            reasonCode: [{ text: data.motivoVisita }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toOutpatientEncounterUI(resource) {
        let servico = '';
        if (resource.serviceType) {
            const st = Array.isArray(resource.serviceType) ? resource.serviceType[0] : resource.serviceType;
            servico = st.text || (st.coding && st.coding[0] && (st.coding[0].display || st.coding[0].code)) || '';
        } else if (resource.serviceProvider) {
            servico = resource.serviceProvider.display || resource.serviceProvider.reference || '';
        }

        let motivo = '';
        if (resource.reasonCode?.length) {
            const rc = resource.reasonCode[0];
            motivo = rc.text || (rc.coding && rc.coding[0] && (rc.coding[0].display || rc.coding[0].code)) || '';
        } else if (resource.reason?.length) {
            motivo = resource.reason[0].text || '';
        }

        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            servicoProcurado: servico,
            motivoVisita: motivo
        };
    }

    /**
     * Maps Procedure (Cirurgia) Data to FHIR
     */
    static toProcedureFHIR(data) {
        const resource = {
            resourceType: "Procedure",
            status: "completed",
            category: {
                coding: [{ system: "http://terminology.hl7.org/CodeSystem/procedure-category", code: "24642003", display: "Surgical procedure" }]
            },
            code: { text: data.cirurgia },
            subject: { reference: `Patient/${data.patientId}` },
            reasonCode: [{ text: data.motivoCirurgia }]
        };
        if (data.complicacao) {
            resource.complication = [{ text: data.complicacao }];
        }
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toProcedureUI(resource) {
        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            cirurgia: resource.code?.text || '',
            motivoCirurgia: resource.reasonCode?.[0]?.text || '',
            complicacao: resource.complication?.[0]?.text || ''
        };
    }
}
