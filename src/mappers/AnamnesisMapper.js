// FILE: src/mappers/AnamnesisMapper.js

export class AnamnesisMapper {
    /**
     * Map Queixa FormData to Condition
     */
    static toConditionFHIR(data) {
        const resource = {
            resourceType: "Condition",
            code: { text: data.queixa },
            clinicalStatus: { 
                coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] 
            },
            subject: { reference: `Patient/${data.patientId}` },
            // Represent satisfaction cleanly in an extension or specific note system
            extension: [{
                url: "http://example.org/fhir/StructureDefinition/patient-satisfaction",
                valueString: data.satisfacao
            }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toConditionUI(resource) {
        let satisfacao = 'neutral';
        const satisfacaoExt = resource.extension?.find(e => e.url === "http://example.org/fhir/StructureDefinition/patient-satisfaction");
        if (satisfacaoExt) satisfacao = satisfacaoExt.valueString;
        // fallback for legacy logic
        else if (resource.note?.[0]?.text?.includes('Satisfação:')) {
            satisfacao = resource.note[0].text.replace('Satisfação: ', '');
        }

        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            queixa: resource.code?.text || '',
            satisfacao
        };
    }

    /**
     * Map Tobacco Observation, resolving string concatenation anti-pattern.
     */
    static toTobaccoObservationFHIR(data) {
        const resource = {
            resourceType: "Observation",
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] }],
            code: { coding: [{ system: "http://loinc.org", code: "72166-2", display: "Tobacco smoking status" }], text: "Tabagismo" },
            subject: { reference: `Patient/${data.patientId}` },
            valueCodeableConcept: {
                text: data.status,
                coding: [{ system: "http://example.org/fhir/CodeSystem/smoking-status", code: data.status }]
            },
            note: [{ text: data.obs || '' }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toTobaccoObservationUI(resource) {
        let status = 'Never smoked';
        let obs = resource.note?.[0]?.text || '';
        if (resource.valueCodeableConcept) {
            status = resource.valueCodeableConcept.text;
        } else if (resource.valueString) {
            // legacy fallback
            const statusMatch = resource.valueString.match(/Status: (.*?)\./);
            if (statusMatch) status = statusMatch[1];
            obs = resource.valueString.split("Obs: ")[1] || "";
        }
        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            status,
            obs
        };
    }

    /**
     * Map Alcohol Observation, resolving string concatenation anti-pattern.
     */
    static toAlcoholObservationFHIR(data) {
        const resource = {
            resourceType: "Observation",
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] }],
            code: { coding: [{ system: "http://loinc.org", code: "74205-6", display: "Alcohol use" }], text: "Etilismo" },
            subject: { reference: `Patient/${data.patientId}` },
            valueCodeableConcept: {
                text: data.status,
                coding: [{ system: "http://example.org/fhir/CodeSystem/alcohol-status", code: data.status }]
            },
            note: [{ text: data.obs || '' }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toAlcoholObservationUI(resource) {
        let status = 'None';
        let obs = resource.note?.[0]?.text || '';
        if (resource.valueCodeableConcept) {
            status = resource.valueCodeableConcept.text;
        } else if (resource.valueString) {
            // legacy fallback
            const statusMatch = resource.valueString.match(/Status: (.*?)\./);
            if (statusMatch) status = statusMatch[1];
            obs = resource.valueString.split("Obs: ")[1] || "";
        }
        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            status,
            obs
        };
    }

    /**
     * Map ServiceRequest for Acompanhamento
     */
    static toAcompanhamentoFHIR(data) {
        const resource = {
            resourceType: "ServiceRequest",
            status: "active",
            intent: "plan",
            subject: { reference: `Patient/${data.patientId}` },
            locationReference: [{ display: data.local }],
            extension: [{
                url: "http://example.org/fhir/StructureDefinition/service-needs-followup",
                valueBoolean: data.necessita === 'yes'
            }]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toAcompanhamentoUI(resource) {
        let local = resource.locationReference?.[0]?.display || '';
        let necessita = 'no';
        
        const necessitaExt = resource.extension?.find(e => e.url === "http://example.org/fhir/StructureDefinition/service-needs-followup");
        if (necessitaExt) {
            necessita = necessitaExt.valueBoolean ? 'yes' : 'no';
        } else if (resource.note?.[0]?.text) {
            // legacy
            const note = resource.note[0].text;
            const localMatch = note.match(/Onde:\s*(.*?)\.\s*/);
            const needsMatch = note.match(/Necessita:\s*(.*)/);
            local = localMatch ? localMatch[1] : note;
            if (needsMatch) necessita = needsMatch[1];
        }

        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            local,
            necessita
        };
    }

    /**
     * Map Health Guidance (Orientações de Saúde), removing JSON.stringify from notes.
     */
    static toHealthGuidanceObservationFHIR(data) {
        const resource = {
            resourceType: "Observation",
            status: "final",
            category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs" }] }], // Retaining legacy category coding though social-history makes more sense
            code: { coding: [{ system: "custom", code: "health-guidance" }], text: "Orientações de Saúde" },
            subject: { reference: `Patient/${data.patientId}` },
            valueString: data.orientacoes,
            extension: [
                {
                    url: "http://example.org/fhir/StructureDefinition/able-to-follow-guidance",
                    valueBoolean: data.consegueFazer === 'yes'
                },
                {
                    url: "http://example.org/fhir/StructureDefinition/unable-to-follow-reason",
                    valueString: data.porque || ''
                }
            ]
        };
        if (data.id) resource.id = data.id;
        return resource;
    }

    static toHealthGuidanceObservationUI(resource) {
        let orientacoes = resource.valueString || '';
        let consegueFazer = 'no';
        let porque = '';

        resource.extension?.forEach(ext => {
             if (ext.url.includes("able-to-follow-guidance")) {
                 consegueFazer = ext.valueBoolean ? 'yes' : 'no';
             }
             if (ext.url.includes("unable-to-follow-reason")) {
                 porque = ext.valueString || '';
             }
        });

        if (resource.note?.[0]?.text) {
            // legacy parse json fallback
            try {
                const parsed = JSON.parse(resource.note[0].text);
                orientacoes = parsed.orientacoes || orientacoes;
                consegueFazer = parsed.consegueFazer || consegueFazer;
                porque = parsed.porque || porque;
            } catch(e) {}
        }

        return {
            id: resource.id || '',
            patientId: resource.subject?.reference?.split('/')?.[1] || '',
            orientacoes,
            consegueFazer,
            porque
        };
    }
}
