// FILE: src/ui/main.js
import { PatientService } from '../services/PatientService.js';
import { initWatchUI, loadWatchHistory } from './anamnesis-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize Watch UI (binds sync button click, etc.)
    initWatchUI();

    // Bind retry button connection attempt (delegated through connectionStatus container)
    document.getElementById('connectionStatus')?.addEventListener('click', (e) => {
        if (e.target.id === 'btnRetryConnection') {
            connectPatient();
        }
    });

    // Start connection flow
    connectPatient();
});

async function connectPatient() {
    const statusDiv = document.getElementById('connectionStatus');
    const watchModule = document.getElementById('modulo-watch');

    if (statusDiv) {
        statusDiv.innerHTML = `
            <div class="spinner-border spinner-border-sm text-primary" role="status"></div>
            <span class="text-muted ms-2 small">Conectando ao paciente...</span>
        `;
    }

    if (watchModule) {
        watchModule.style.display = 'none';
    }

    try {
        const { resource, uiData } = await PatientService.bootstrapPatient();

        if (statusDiv) {
            statusDiv.innerHTML = `
                <span class="text-success small">✅ Conectado: <strong>${uiData.nome} ${uiData.sobrenome}</strong> (ID: ${uiData.id})</span>
            `;
        }

        // Show patient name on the watch UI banner too
        const nomePacienteClinico = document.getElementById('nomePacienteClinico');
        if (nomePacienteClinico) {
            nomePacienteClinico.textContent = `${uiData.nome} ${uiData.sobrenome}`;
        }

        if (watchModule) {
            watchModule.style.display = 'block';
        }

        // Load initial watch history
        await loadWatchHistory(uiData.id);
    } catch (err) {
        console.error('Erro na inicialização do paciente:', err);
        if (statusDiv) {
            statusDiv.innerHTML = `
                <span class="text-danger small">❌ Falha na conexão com FHIR.</span>
                <button type="button" id="btnRetryConnection" class="btn btn-sm btn-danger ms-2" style="font-size: 0.75rem; padding: 2px 8px;">Tentar Novamente</button>
            `;
        }
    }
}
