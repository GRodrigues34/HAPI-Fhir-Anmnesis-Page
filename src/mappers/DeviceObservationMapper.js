/**
 * DeviceObservationMapper.js
 * 
 * Constrói a hierarquia completa IHE PCD (Patient Care Device) em FHIR R4,
 * seguindo o HL7 Point-of-Care Device Implementation Guide (PoCD).
 * 
 * Hierarquia IEEE 11073:
 *   MDS Device → VMD Device → Channel Device → DeviceMetric → Observation
 * 
 * Codificação:
 *   - IEEE 11073 MDC (urn:iso:std:iso:11073:10101)
 *   - LOINC (http://loinc.org) 
 *   - UCUM (http://unitsofmeasure.org)
 */

// ============================================================
// Constantes — Códigos e Perfis IHE PCD
// ============================================================

const MDC_SYSTEM = 'urn:iso:std:iso:11073:10101';
const LOINC_SYSTEM = 'http://loinc.org';
const UCUM_SYSTEM = 'http://unitsofmeasure.org';
const OBS_CATEGORY_SYSTEM = 'http://terminology.hl7.org/CodeSystem/observation-category';

const POCD_PROFILES = {
    mdsDevice:          'http://hl7.org/fhir/uv/pocd/StructureDefinition/MdsDevice',
    vmdDevice:          'http://hl7.org/fhir/uv/pocd/StructureDefinition/VmdDevice',
    channelDevice:      'http://hl7.org/fhir/uv/pocd/StructureDefinition/ChannelDevice',
    numericDeviceMetric:'http://hl7.org/fhir/uv/pocd/StructureDefinition/NumericDeviceMetric',
    numericObservation: 'http://hl7.org/fhir/uv/pocd/StructureDefinition/NumericObservation',
};

const MDC_CODES = {
    mds:      { code: '528384',  display: 'MDC_MOC_VMS_MDS_SIMP' },
    vmd:      { code: '528388',  display: 'MDC_DEV_SPEC_PROFILE_PULS_OXIM' },
    hrMetric: { code: '149530',  display: 'MDC_PULS_OXIM_PULS_RATE' },
    spo2Metric:{ code: '150456', display: 'MDC_PULS_OXIM_SAT_O2' },
};

const LOINC_CODES = {
    hr:   { code: '8889-8',  display: 'Heart rate by Pulse oximetry' },
    spo2: { code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' },
};

const UCUM_UNITS = {
    hr:   { unit: '/min', code: '/min' },
    spo2: { unit: '%',    code: '%' },
};

const DEVICE_INFO = {
    manufacturer: 'Xiaomi',
    modelNumber:  'Redmi Watch 5 Active',
    identifier:   'redmi-watch-5-active-local',
    identifierSystem: 'urn:oid:1.2.840.10004.1.1.1.0.0.1.0.0.1.2680',
};

// ============================================================
// Utilitário — Gerar UUID v4
// ============================================================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// ============================================================
// Construtores de Recursos FHIR
// ============================================================

export class DeviceObservationMapper {

    /**
     * MDS Device — Nível raiz da hierarquia IEEE 11073
     * Representa o dispositivo físico (Redmi Watch 5 Active)
     */
    static buildMdsDevice() {
        return {
            resourceType: 'Device',
            meta: { profile: [POCD_PROFILES.mdsDevice] },
            identifier: [{
                system: DEVICE_INFO.identifierSystem,
                value: DEVICE_INFO.identifier,
            }],
            type: {
                coding: [{
                    system: MDC_SYSTEM,
                    code: MDC_CODES.mds.code,
                    display: MDC_CODES.mds.display,
                }],
            },
            specialization: [{
                systemType: {
                    coding: [{
                        system: MDC_SYSTEM,
                        code: MDC_CODES.vmd.code,
                        display: MDC_CODES.vmd.display,
                    }],
                },
                version: '1',
            }],
            manufacturer: DEVICE_INFO.manufacturer,
            modelNumber: DEVICE_INFO.modelNumber,
            deviceName: [{
                name: DEVICE_INFO.modelNumber,
                type: 'model-name',
            }],
        };
    }

    /**
     * VMD Device — Virtual Medical Device (Pulse Oximeter)
     * @param {string} mdsRef - Referência ao MDS Device (ex: "Device/123" ou "urn:uuid:...")
     */
    static buildVmdDevice(mdsRef) {
        return {
            resourceType: 'Device',
            meta: { profile: [POCD_PROFILES.vmdDevice] },
            type: {
                coding: [{
                    system: MDC_SYSTEM,
                    code: MDC_CODES.vmd.code,
                    display: MDC_CODES.vmd.display,
                }],
            },
            parent: { reference: mdsRef },
        };
    }

    /**
     * Channel Device — Canal do Pulse Oximeter
     * @param {string} vmdRef - Referência ao VMD Device
     */
    static buildChannelDevice(vmdRef) {
        return {
            resourceType: 'Device',
            meta: { profile: [POCD_PROFILES.channelDevice] },
            parent: { reference: vmdRef },
        };
    }

    /**
     * DeviceMetric — Métrica numérica (HR ou SpO2)
     * @param {'hr'|'spo2'} metricType - Tipo da métrica
     * @param {string} channelRef - Referência ao Channel Device
     * @param {string} mdsRef - Referência ao MDS Device (source)
     */
    static buildDeviceMetric(metricType, channelRef, mdsRef) {
        const mdcCode = metricType === 'hr' ? MDC_CODES.hrMetric : MDC_CODES.spo2Metric;

        return {
            resourceType: 'DeviceMetric',
            meta: { profile: [POCD_PROFILES.numericDeviceMetric] },
            type: {
                coding: [{
                    system: MDC_SYSTEM,
                    code: mdcCode.code,
                    display: mdcCode.display,
                }],
            },
            source: { reference: mdsRef },
            parent: { reference: channelRef },
            category: 'measurement',
            operationalStatus: 'on',
        };
    }

    /**
     * NumericObservation — Observação vital (HR ou SpO2)
     * Inclui codificação dupla: IEEE 11073 MDC + LOINC
     * Unidades em UCUM
     * 
     * @param {'hr'|'spo2'} metricType
     * @param {number} value - Valor da leitura
     * @param {string} timestamp - ISO 8601 datetime
     * @param {string} patientId - ID do paciente no HAPI-FHIR
     * @param {string} metricRef - Referência ao DeviceMetric (ex: "DeviceMetric/123")
     */
    static buildObservation(metricType, value, timestamp, patientId, metricRef) {
        const mdcCode = metricType === 'hr' ? MDC_CODES.hrMetric : MDC_CODES.spo2Metric;
        const loincCode = LOINC_CODES[metricType];
        const ucumUnit = UCUM_UNITS[metricType];

        return {
            resourceType: 'Observation',
            meta: { profile: [POCD_PROFILES.numericObservation] },
            status: 'final',
            category: [{
                coding: [{
                    system: OBS_CATEGORY_SYSTEM,
                    code: 'vital-signs',
                    display: 'Vital Signs',
                }],
            }],
            code: {
                coding: [
                    {
                        system: MDC_SYSTEM,
                        code: mdcCode.code,
                        display: mdcCode.display,
                    },
                    {
                        system: LOINC_SYSTEM,
                        code: loincCode.code,
                        display: loincCode.display,
                    },
                ],
            },
            subject: { reference: `Patient/${patientId}` },
            device: { reference: metricRef },
            effectiveDateTime: timestamp,
            valueQuantity: {
                value: value,
                unit: ucumUnit.unit,
                system: UCUM_SYSTEM,
                code: ucumUnit.code,
            },
        };
    }

    // ============================================================
    // Construtores de Transaction Bundles
    // ============================================================

    /**
     * Bundle completo para primeira sincronização:
     * Cria toda a hierarquia de dispositivo + métricas + observações
     * Usa urn:uuid para referências cruzadas internas
     * 
     * @param {Object} watchData - Dados do FastAPI { latest: { hr, spo2 }, device_info }
     * @param {string} patientId - ID do paciente
     * @returns {Object} FHIR Transaction Bundle
     */
    static buildDeviceSetupBundle(watchData, patientId) {
        // Gerar UUIDs temporários para referências cruzadas
        const uuids = {
            mds:        `urn:uuid:${generateUUID()}`,
            vmd:        `urn:uuid:${generateUUID()}`,
            channel:    `urn:uuid:${generateUUID()}`,
            metricHr:   `urn:uuid:${generateUUID()}`,
            metricSpo2: `urn:uuid:${generateUUID()}`,
            obsHr:      `urn:uuid:${generateUUID()}`,
            obsSpo2:    `urn:uuid:${generateUUID()}`,
        };

        const entries = [];

        // 1. MDS Device (raiz)
        entries.push({
            fullUrl: uuids.mds,
            resource: this.buildMdsDevice(),
            request: { method: 'POST', url: 'Device' },
        });

        // 2. VMD Device (filho do MDS)
        entries.push({
            fullUrl: uuids.vmd,
            resource: this.buildVmdDevice(uuids.mds),
            request: { method: 'POST', url: 'Device' },
        });

        // 3. Channel Device (filho do VMD)
        entries.push({
            fullUrl: uuids.channel,
            resource: this.buildChannelDevice(uuids.vmd),
            request: { method: 'POST', url: 'Device' },
        });

        // 4. DeviceMetric — Frequência Cardíaca
        entries.push({
            fullUrl: uuids.metricHr,
            resource: this.buildDeviceMetric('hr', uuids.channel, uuids.mds),
            request: { method: 'POST', url: 'DeviceMetric' },
        });

        // 5. DeviceMetric — SpO2
        entries.push({
            fullUrl: uuids.metricSpo2,
            resource: this.buildDeviceMetric('spo2', uuids.channel, uuids.mds),
            request: { method: 'POST', url: 'DeviceMetric' },
        });

        // 6. Observation — Frequência Cardíaca (se disponível)
        if (watchData.latest.hr) {
            entries.push({
                fullUrl: uuids.obsHr,
                resource: this.buildObservation(
                    'hr',
                    watchData.latest.hr.value,
                    watchData.latest.hr.timestamp,
                    patientId,
                    uuids.metricHr
                ),
                request: { method: 'POST', url: 'Observation' },
            });
        }

        // 7. Observation — SpO2 (se disponível)
        if (watchData.latest.spo2) {
            entries.push({
                fullUrl: uuids.obsSpo2,
                resource: this.buildObservation(
                    'spo2',
                    watchData.latest.spo2.value,
                    watchData.latest.spo2.timestamp,
                    patientId,
                    uuids.metricSpo2
                ),
                request: { method: 'POST', url: 'Observation' },
            });
        }

        return {
            resourceType: 'Bundle',
            type: 'transaction',
            entry: entries,
        };
    }

    /**
     * Bundle apenas com Observations (sincronizações subsequentes)
     * Referencia Device/DeviceMetric já existentes pelos IDs reais
     * 
     * @param {Object} watchData - Dados do FastAPI
     * @param {string} patientId - ID do paciente
     * @param {Object} existingIds - IDs existentes { metricHrId, metricSpo2Id }
     * @returns {Object} FHIR Transaction Bundle
     */
    static buildObservationBundle(watchData, patientId, existingIds) {
        const entries = [];

        if (watchData.latest.hr && existingIds.metricHrId) {
            entries.push({
                fullUrl: `urn:uuid:${generateUUID()}`,
                resource: this.buildObservation(
                    'hr',
                    watchData.latest.hr.value,
                    watchData.latest.hr.timestamp,
                    patientId,
                    `DeviceMetric/${existingIds.metricHrId}`
                ),
                request: { method: 'POST', url: 'Observation' },
            });
        }

        if (watchData.latest.spo2 && existingIds.metricSpo2Id) {
            entries.push({
                fullUrl: `urn:uuid:${generateUUID()}`,
                resource: this.buildObservation(
                    'spo2',
                    watchData.latest.spo2.value,
                    watchData.latest.spo2.timestamp,
                    patientId,
                    `DeviceMetric/${existingIds.metricSpo2Id}`
                ),
                request: { method: 'POST', url: 'Observation' },
            });
        }

        return {
            resourceType: 'Bundle',
            type: 'transaction',
            entry: entries,
        };
    }

    // ============================================================
    // Extrator — Observation FHIR → UI
    // ============================================================

    /**
     * Converte uma Observation FHIR em dados para exibição na UI
     * @param {Object} resource - FHIR Observation resource
     * @returns {Object} { type, value, unit, timestamp, loincCode, loincDisplay }
     */
    static observationToUI(resource) {
        const loincCoding = resource.code?.coding?.find(c => c.system === LOINC_SYSTEM);
        const mdcCoding = resource.code?.coding?.find(c => c.system === MDC_SYSTEM);

        let type = 'unknown';
        if (loincCoding?.code === LOINC_CODES.hr.code || mdcCoding?.code === MDC_CODES.hrMetric.code) {
            type = 'hr';
        } else if (loincCoding?.code === LOINC_CODES.spo2.code || mdcCoding?.code === MDC_CODES.spo2Metric.code) {
            type = 'spo2';
        }

        return {
            type,
            value: resource.valueQuantity?.value,
            unit: resource.valueQuantity?.unit,
            timestamp: resource.effectiveDateTime,
            loincCode: loincCoding?.code || '',
            loincDisplay: loincCoding?.display || '',
            id: resource.id,
        };
    }
}
