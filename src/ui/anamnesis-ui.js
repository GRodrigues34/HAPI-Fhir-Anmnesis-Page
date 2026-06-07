// FILE: src/ui/anamnesis-ui.js
import { WatchService } from '../services/WatchService.js';
import { CONFIG } from '../config.js';

export function initWatchUI() {
    // Smartwatch sync button
    document.getElementById('btnSyncWatch')?.addEventListener('click', handleWatchSync);
}

export async function handleWatchSync() {
    const patientId = CONFIG.patientId;
    if (!patientId) {
        alert('Nenhum paciente configurado.');
        return;
    }

    const btn = document.getElementById('btnSyncWatch');
    const statusDiv = document.getElementById('watchSyncStatus');
    const previewDiv = document.getElementById('watchDataPreview');

    // Estado de carregamento
    btn.disabled = true;
    btn.textContent = 'Sincronizando...';
    statusDiv.innerHTML = '<span class="text-muted">Conectando ao smartwatch...</span>';

    try {
        const result = await WatchService.syncWatchData(patientId);

        // Atualizar cards de preview
        if (result.watchData.latest.hr) {
            document.getElementById('previewHR').textContent = result.watchData.latest.hr.value;
        }
        if (result.watchData.latest.spo2) {
            document.getElementById('previewSpO2').textContent = result.watchData.latest.spo2.value;
        }
        previewDiv.style.display = 'block';

        // Status de sucesso
        const syncType = result.isFirstSync ? 'Primeira sincronização (hierarquia PCD criada)' : 'Observações registradas';
        statusDiv.innerHTML = `<span class="text-success">${syncType} — ${result.observationIds.length} observação(ões) salva(s)</span>`;

        // Atualizar histórico
        await loadWatchHistory(patientId);

    } catch (error) {
        statusDiv.innerHTML = `<span class="text-danger">${error.message}</span>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Sincronizar Dados do Smartwatch';
    }
}

export async function loadWatchHistory(patientId) {
    const listDiv = document.getElementById('listWatchObs');
    if (!listDiv) return;

    try {
        const history = await WatchService.fetchWatchHistory(patientId);

        if (history.length === 0) {
            listDiv.innerHTML = '<span class="text-muted small">Nenhum dado do smartwatch registrado.</span>';
            return;
        }

        listDiv.innerHTML = history.map(obs => {
            const label = obs.type === 'hr' ? 'FC' : 'SpO2';
            const ts = formatTS(obs.timestamp);
            return `
                <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
                    <div>
                        <span>${label}: <strong>${obs.value} ${obs.unit}</strong></span>
                        <span class="text-muted ms-2">${ts}</span>
                    </div>
                    <span class="badge bg-secondary">${obs.loincCode}</span>
                </div>`;
        }).join('');
    } catch (error) {
        console.error('Erro ao carregar histórico do smartwatch:', error);
        listDiv.innerHTML = '<span class="text-danger small">Erro ao carregar histórico.</span>';
    }
}

function formatTS(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
