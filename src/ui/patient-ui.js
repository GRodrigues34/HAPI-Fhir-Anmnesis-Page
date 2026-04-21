// FILE: src/ui/patient-ui.js
import { PatientService } from '../services/PatientService.js';
import { alteracaoModulo } from './main.js';

export function initPatientUI() {
    document.getElementById('formCadastro')?.addEventListener('submit', handleSavePatient);
    
    // Attach edit and chart events via delegation since rows are dynamically created
    document.getElementById('tabelaPacientes')?.addEventListener('click', (e) => {
        const btnEditar = e.target.closest('.btn-editar-pac');
        if (btnEditar) prepararEdicao(btnEditar.dataset.id);

        const btnPronto = e.target.closest('.btn-prontuario-pac');
        if (btnPronto) mostrarProntuario(btnPronto.dataset.id);
    });

    listarPacientes();
}

async function handleSavePatient(e) {
    e.preventDefault();
    const id = document.getElementById('pacienteId').value;
    const formData = {
        id: id,
        nome: document.getElementById('inputNome').value,
        sobrenome: document.getElementById('inputSobrenome').value
    };

    try {
        await PatientService.savePatient(formData);
        alert("Paciente salvo com sucesso!");
        document.getElementById('formCadastro').reset();
        document.getElementById('pacienteId').value = "";
        listarPacientes();
    } catch (err) {
        alert(`Erro ao salvar paciente:\n${err.message}`);
    }
}

export async function listarPacientes() {
    try {
        const pacientes = await PatientService.listPatients();
        const tbody = document.getElementById('tabelaPacientes');
        if (!tbody) return;
        
        tbody.innerHTML = pacientes.map(p => `
            <tr>
                <td>${p.uiData.id}</td>
                <td>${p.uiData.nome} ${p.uiData.sobrenome}</td>
                <td>
                    <button data-id="${p.uiData.id}" class="btn btn-sm btn-warning btn-editar-pac">Editar</button>
                    <button data-id="${p.uiData.id}" class="btn btn-sm btn-info btn-prontuario-pac">Prontuário</button>
                </td>
            </tr>`).join('');
    } catch (err) {
        console.error('Erro ao listar pacientes:', err);
    }
}

async function prepararEdicao(id) {
    try {
        const p = await PatientService.getPatientById(id);
        document.getElementById('inputNome').value = p.uiData.nome;
        document.getElementById('inputSobrenome').value = p.uiData.sobrenome;
        document.getElementById('pacienteId').value = p.uiData.id;
        alteracaoModulo('cadastro');
        document.getElementById('inputNome').focus();
    } catch (err) {
        alert('Erro ao carregar paciente — veja o console para mais detalhes.');
    }
}

async function mostrarProntuario(id) {
    try {
        const p = await PatientService.getPatientById(id);
        document.getElementById('modalPacId').textContent = p.uiData.id;
        document.getElementById('modalPacName').textContent = `${p.uiData.nome} ${p.uiData.sobrenome}`;

        const base = document.getElementById('serverUrl')?.value.replace(/\/$/, "") || 'http://localhost:8080/fhir';
        const items = document.querySelectorAll('#modalLinks .list-group-item');
        items.forEach(item => {
            const resource = item.dataset.resource;
            const params = item.dataset.params || '';
            item.onclick = (ev) => {
                ev.preventDefault();
                window.open(`${base}/${resource}?subject=Patient/${encodeURIComponent(id)}${params}`, '_blank');
            };
        });

        const modalEl = document.getElementById('modalProntuario');
        if (modalEl) {
            // Check if bootstrap is available
            if (window.bootstrap) {
                new window.bootstrap.Modal(modalEl).show();
            } else {
                modalEl.style.display = 'block'; // basic fallback
                modalEl.classList.add('show');
            }
        }

        // The legacy code pulls summaries dynamically into the modal.
        // For simplicity inside Patient UI, we can trigger an event or call service again
        // Here we replicate the quick list fetcher just for visual completion:
        const fetchSum = async (path) => (await PatientService.listPatients(1).then(() => fetch(`${base}/${path}subject=Patient/${encodeURIComponent(id)}&_sort=-_lastUpdated&_t=${Date.now()}`))).json().then(j=>j.entry||[]).catch(()=>[]);
        
        fetchSum('Condition?').then(q => document.getElementById('modalQueixas').innerHTML = q.map(e => `<div class="p-1 border-bottom small">${e.resource.code?.text || ''}</div>`).join(''));
        fetchSum('Encounter?class=IMP&').then(i => document.getElementById('modalInternacoes').innerHTML = i.map(e => `<div class="p-1 border-bottom small">${e.resource.period?.start || ''}: ${e.resource.reasonCode?.[0]?.text || ''}</div>`).join(''));
        fetchSum('ServiceRequest?').then(a => document.getElementById('modalAcomp').innerHTML = a.map(e => `<div class="p-1 border-bottom small">${e.resource.note?.[0]?.text || e.resource.locationReference?.[0]?.display || ''}</div>`).join(''));
        fetchSum('Encounter?class=AMB&').then(v => document.getElementById('modalVisitas').innerHTML = v.map(e => `<div class="p-1 border-bottom small">${e.resource.serviceType?.text || ''}</div>`).join(''));
        fetchSum('Procedure?').then(c => document.getElementById('modalCirurgias').innerHTML = c.map(e => `<div class="p-2 border-bottom"><strong>${e.resource.code?.text || ''}</strong><br><span class="text-muted">Motivo: ${e.resource.reasonCode?.[0]?.text || 'N/A'}</span></div>`).join(''));

    } catch (err) {
        alert('Paciente não encontrado ou erro na rede.');
    }
}
