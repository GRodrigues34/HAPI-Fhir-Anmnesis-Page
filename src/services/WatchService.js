/**
 * WatchService.js
 * 
 * Serviço de sincronização do smartwatch.
 * Orquestra: FastAPI fetch → verificação de Device → construção FHIR → submissão ao HAPI-FHIR
 */

import { FhirClient } from '../api/fhir-client.js';
import { DeviceObservationMapper } from '../mappers/DeviceObservationMapper.js';
import { AuditService } from './AuditService.js';

const WATCH_API_URL = 'http://localhost:8000';

// Identificador do dispositivo para busca no HAPI-FHIR
const DEVICE_IDENTIFIER_SYSTEM = 'urn:oid:1.2.840.10004.1.1.1.0.0.1.0.0.1.2680';
const DEVICE_IDENTIFIER_VALUE = 'redmi-watch-5-active-local';

// MDC code para MDS Device
const MDC_MDS_CODE = '528384';
const MDC_SYSTEM = 'urn:iso:std:iso:11073:10101';

// MDC codes para identificar DeviceMetrics
const MDC_HR_CODE = '149530';
const MDC_SPO2_CODE = '150456';

export class WatchService {

    // ============================================================
    // 1. Buscar dados do FastAPI (smartwatch)
    // ============================================================

    /**
     * Busca os dados mais recentes do smartwatch via FastAPI
     * @returns {Promise<Object|null>} Dados do smartwatch ou null se indisponível
     */
    static async fetchWatchData() {
        try {
            const response = await fetch(`${WATCH_API_URL}/fitness-data`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`FastAPI retornou status ${response.status}`);
            }

            const data = await response.json();

            // Verificar se há pelo menos uma leitura disponível
            if (!data.latest?.hr && !data.latest?.spo2) {
                return null;
            }

            return data;
        } catch (error) {
            console.error('Erro ao conectar ao FastAPI do smartwatch:', error);
            throw new Error(
                'Não foi possível conectar ao servidor do smartwatch. ' +
                'Verifique se o log_reader.py está rodando (python log_reader.py --mock)'
            );
        }
    }

    // ============================================================
    // 2. Verificar se o dispositivo já existe no HAPI-FHIR
    // ============================================================

    /**
     * Busca o dispositivo MDS existente no servidor FHIR pelo identifier
     * Se encontrado, busca também os DeviceMetrics associados
     * 
     * @returns {Promise<Object|null>} IDs existentes ou null
     *   { mdsId, vmdId, channelId, metricHrId, metricSpo2Id }
     */
    static async findExistingDevice() {
        try {
            // Buscar MDS Device pelo identifier
            const deviceBundle = await FhirClient.get(
                `/Device?identifier=${DEVICE_IDENTIFIER_SYSTEM}|${DEVICE_IDENTIFIER_VALUE}`
            );

            if (!deviceBundle?.entry?.length) {
                return null;
            }

            const mdsDevice = deviceBundle.entry[0].resource;
            const mdsId = mdsDevice.id;

            // Buscar dispositivos filhos (VMD e Channel)
            const childrenBundle = await FhirClient.get(
                `/Device?_has:Device:parent:_id=${mdsId}&_count=10`
            );

            let vmdId = null;
            let channelId = null;

            if (childrenBundle?.entry) {
                for (const entry of childrenBundle.entry) {
                    const device = entry.resource;
                    const typeCode = device.type?.coding?.[0]?.code;

                    if (typeCode === MDC_MDS_CODE) continue;

                    // VMD tem type coding, Channel não tem
                    if (device.type?.coding?.length > 0) {
                        vmdId = device.id;
                    } else {
                        channelId = device.id;
                    }
                }
            }

            // Se não encontrou via _has, tentar busca direta pelo parent
            if (!vmdId) {
                const vmdBundle = await FhirClient.get(`/Device?parent=Device/${mdsId}`);
                if (vmdBundle?.entry) {
                    for (const entry of vmdBundle.entry) {
                        const device = entry.resource;
                        if (device.type?.coding?.[0]?.code) {
                            vmdId = device.id;
                        } else {
                            channelId = device.id;
                        }
                    }
                }
            }

            // Buscar DeviceMetrics pelo source (MDS Device)
            let metricHrId = null;
            let metricSpo2Id = null;

            const metricsBundle = await FhirClient.get(
                `/DeviceMetric?source=Device/${mdsId}`
            );

            if (metricsBundle?.entry) {
                for (const entry of metricsBundle.entry) {
                    const metric = entry.resource;
                    const metricCode = metric.type?.coding?.[0]?.code;

                    if (metricCode === MDC_HR_CODE) {
                        metricHrId = metric.id;
                    } else if (metricCode === MDC_SPO2_CODE) {
                        metricSpo2Id = metric.id;
                    }
                }
            }

            return {
                mdsId,
                vmdId,
                channelId,
                metricHrId,
                metricSpo2Id,
            };

        } catch (error) {
            console.warn('Erro ao buscar dispositivo existente:', error);
            return null;
        }
    }

    // ============================================================
    // 3. Sincronização principal
    // ============================================================

    /**
     * Executa a sincronização completa: fetch → check → build → submit
     * 
     * @param {string} patientId - ID do paciente vinculado
     * @returns {Promise<Object>} Resultado { success, watchData, observationIds, isFirstSync }
     */
    static async syncWatchData(patientId) {
        if (!patientId) {
            throw new Error('Nenhum paciente vinculado. Vincule um paciente antes de sincronizar.');
        }

        // 1. Buscar dados do smartwatch
        const watchData = await this.fetchWatchData();
        if (!watchData) {
            throw new Error(
                'Nenhum dado disponível do smartwatch. ' +
                'Verifique se o relógio está conectado ou use o modo mock.'
            );
        }

        // 2. Verificar se o dispositivo já existe
        const existingDevice = await this.findExistingDevice();
        const isFirstSync = !existingDevice || !existingDevice.metricHrId;

        let bundle;
        if (isFirstSync) {
            // Primeira sincronização — criar hierarquia completa + observações
            bundle = DeviceObservationMapper.buildDeviceSetupBundle(watchData, patientId);
        } else {
            // Sincronizações subsequentes — apenas observações
            bundle = DeviceObservationMapper.buildObservationBundle(watchData, patientId, existingDevice);
        }

        // 3. Submeter ao HAPI-FHIR
        const result = await FhirClient.post('/', bundle);

        // 4. Extrair IDs das observações criadas
        const observationIds = [];
        if (result?.entry) {
            for (const entry of result.entry) {
                const location = entry.response?.location || '';
                if (location.startsWith('Observation/')) {
                    observationIds.push(location.split('/')[1]);
                }
            }
        }

        // 5. Registrar AuditEvent
        try {
            await AuditService.log(
                'C',
                patientId,
                observationIds[0] || 'unknown',
                'Observation'
            );
        } catch (auditError) {
            console.warn('Erro ao registrar AuditEvent:', auditError);
        }

        return {
            success: true,
            watchData,
            observationIds,
            isFirstSync,
        };
    }

    // ============================================================
    // 4. Histórico de observações do smartwatch
    // ============================================================

    /**
     * Busca observações do smartwatch já salvas no HAPI-FHIR
     * Filtra por LOINC codes de HR e SpO2 por pulse oximetry
     * 
     * @param {string} patientId
     * @returns {Promise<Array>} Lista de observações formatadas para UI
     */
    static async fetchWatchHistory(patientId) {
        try {
            const bundle = await FhirClient.get(
                `/Observation?subject=Patient/${patientId}` +
                `&code=8889-8,59408-5` +
                `&_sort=-_lastUpdated` +
                `&_count=20`
            );

            if (!bundle?.entry?.length) {
                return [];
            }

            return bundle.entry.map(entry =>
                DeviceObservationMapper.observationToUI(entry.resource)
            );
        } catch (error) {
            console.error('Erro ao buscar histórico do smartwatch:', error);
            return [];
        }
    }
}
