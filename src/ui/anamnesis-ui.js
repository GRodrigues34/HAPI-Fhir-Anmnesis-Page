// FILE: src/ui/anamnesis-ui.js
import { AnamnesisService } from '../services/AnamnesisService.js';
import { AnamnesisMapper } from '../mappers/AnamnesisMapper.js';
import { EncounterMapper } from '../mappers/EncounterMapper.js';
import { MedicationMapper } from '../mappers/MedicationMapper.js';
import { alteracaoModulo } from './main.js';

let selectedMedications = [];

export function initAnamnesisUI() {
    document.getElementById('btnVincularPaciente')?.addEventListener('click', vincularPaciente);

    // Form Submits
    document.getElementById('formQueixa')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildQueixaFHIR, 'queixaId', 'formQueixa'));
    document.getElementById('formInternacao')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildInternacaoFHIR, 'internacaoId', 'formInternacao'));
    document.getElementById('formAcompanhamento')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildAcompanhamentoFHIR, 'acompId', 'formAcompanhamento'));
    document.getElementById('formVisita')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildVisitaFHIR, 'visitaId', 'formVisita'));
    document.getElementById('formCirurgia')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildCirurgiaFHIR, 'cirurgiaId', 'formCirurgia'));
    document.getElementById('formTabagismo')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildTabagismoFHIR, 'tabagismoId', 'formTabagismo'));
    document.getElementById('formEtilismo')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildEtilismoFHIR, 'etilismoId', 'formEtilismo'));
    document.getElementById('formOrientacoes')?.addEventListener('submit', (e) => handleAnamnesisSubmit(e, buildOrientacaoFHIR, 'orientacoesId', 'formOrientacoes'));
    document.getElementById('formMedicacao')?.addEventListener('submit', handleMedicationSubmit);

    // Medications autocomplete logic
    setupMedicationAutocomplete();

    // Delegation for edit/delete buttons in Anamnesis sections
    setupDelegatedActions();
}

async function vincularPaciente() {
    const id = document.getElementById('idBuscaClinica').value;
    try {
        const res = await fetch(`${document.getElementById('serverUrl')?.value.replace(/\/$/, "") || 'http://localhost:8080/fhir'}/Patient/${id}`);
        if (!res.ok) throw new Error();
        const p = await res.json();
        document.getElementById('nomePacienteClinico').textContent = `${p.name[0].given[0]} ${p.name[0].family}`;
        document.getElementById('interfaceClinica').style.display = 'block';
        atualizarHistoricoTotal(id);
    } catch {
        alert("Erro: Paciente não encontrado!");
    }
}

// Data Builders mapping UI -> FHIR
const buildQueixaFHIR = () => AnamnesisMapper.toConditionFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('queixaId').value,
    queixa: document.getElementById('txtQueixa').value,
    satisfacao: document.getElementById('selSatisfacao').value
});
const buildInternacaoFHIR = () => EncounterMapper.toInpatientEncounterFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('internacaoId').value,
    dataInternacao: document.getElementById('dataInternacao').value,
    motivoInternacao: document.getElementById('motivoInternacao').value
});
const buildAcompanhamentoFHIR = () => AnamnesisMapper.toAcompanhamentoFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('acompId').value,
    local: document.getElementById('localAcomp').value,
    necessita: document.getElementById('selAcomp').value
});
const buildVisitaFHIR = () => EncounterMapper.toOutpatientEncounterFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('visitaId').value,
    servicoProcurado: document.getElementById('servicoProcurado').value,
    motivoVisita: document.getElementById('motivoVisita').value
});
const buildCirurgiaFHIR = () => EncounterMapper.toProcedureFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('cirurgiaId').value,
    cirurgia: document.getElementById('txtCirurgia').value,
    motivoCirurgia: document.getElementById('motivoCirurgia').value,
    complicacao: document.getElementById('txtComplicacao')?.value || ''
});
const buildTabagismoFHIR = () => AnamnesisMapper.toTobaccoObservationFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('tabagismoId').value,
    status: document.getElementById('selFumante').value,
    obs: document.getElementById('txtTabagismo').value
});
const buildEtilismoFHIR = () => AnamnesisMapper.toAlcoholObservationFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('etilismoId').value,
    status: document.getElementById('selEtilismo').value,
    obs: document.getElementById('txtEtilismo').value
});
const buildOrientacaoFHIR = () => AnamnesisMapper.toHealthGuidanceObservationFHIR({
    patientId: document.getElementById('idBuscaClinica').value,
    id: document.getElementById('orientacoesId').value,
    orientacoes: document.getElementById('txtOrientacoes').value,
    consegueFazer: document.querySelector('input[name="consegueOrientacoes"]:checked')?.value || 'no',
    porque: document.getElementById('porqueOrientacoes').value
});

async function handleAnamnesisSubmit(e, buildFHIRFn, idField, formId) {
    e.preventDefault();
    const patientId = document.getElementById('idBuscaClinica').value;
    const resource = buildFHIRFn();

    try {
        await AnamnesisService.submitClinicalRecord(resource, patientId);
        document.getElementById(formId).reset();
        document.getElementById(idField).value = "";
        atualizarHistoricoTotal(patientId);
        alert('Registro salvo com sucesso!');
    } catch (err) {
        alert(`Erro ao salvar:\n${err.message}`);
    }
}

async function handleMedicationSubmit(e) {
    e.preventDefault();
    const patientId = document.getElementById('idBuscaClinica').value;

    const resource = MedicationMapper.toFHIR({
        patientId: patientId,
        id: document.getElementById('medicacaoId').value,
        medicamentos: selectedMedications,
        consegueTomar: document.querySelector('input[name="consegueTomar"]:checked')?.value || 'no',
        porque: document.getElementById('porqueMedicacao').value,
        usouMedicamento: document.querySelector('input[name="usouMedicamento"]:checked')?.value || 'no',
        detalhes: document.getElementById('detalheMedicacao').value
    });

    try {
        await AnamnesisService.submitClinicalRecord(resource, patientId);
        document.getElementById('formMedicacao').reset();
        document.getElementById('medicacaoId').value = "";
        selectedMedications = [];
        renderMedicationChips();
        atualizarHistoricoTotal(patientId);
        alert('Medicação salva com sucesso!');
    } catch (err) {
        alert(`Erro ao salvar medicação:\n${err.message}`);
    }
}

function setupMedicationAutocomplete() {
    const input = document.getElementById('inputMedicacao');
    const suggestDiv = document.getElementById('medicationSuggestions');
    if (!input) return;

    input.addEventListener('keyup', async (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
            suggestDiv.style.display = 'none';
            return;
        }
        try {
            const base = document.getElementById('serverUrl')?.value.replace(/\/$/, "") || 'http://localhost:8080/fhir';
            const res = await fetch(`${base}/Medication?name=${encodeURIComponent(query)}&_count=10&_t=${Date.now()}`);
            const data = await res.json();
            const suggestions = data.entry || [];

            if (suggestions.length === 0) {
                suggestDiv.innerHTML = `<div class="p-2"><small class="text-muted">Nenhum medicamento encontrado. Digite para criar um novo.</small></div>`;
            } else {
                suggestDiv.innerHTML = suggestions.map(e =>
                    `<div class="p-2 border-bottom sugg-item" data-name="${e.resource.code?.coding?.[0]?.display || e.resource.name || ''}" style="cursor:pointer;">${e.resource.code?.coding?.[0]?.display || e.resource.name || ''}</div>`
                ).join('');
            }
            suggestDiv.style.display = 'block';
        } catch { }
    });

    input.addEventListener('blur', () => setTimeout(() => suggestDiv.style.display = 'none', 200));

    suggestDiv.addEventListener('click', (e) => {
        const item = e.target.closest('.sugg-item');
        if (item) {
            addMedicationChip(item.dataset.name);
        }
    });

    document.getElementById('btnAddMedication')?.addEventListener('click', () => {
        addMedicationChip(input.value);
    });
}

function addMedicationChip(nameStr) {
    const name = nameStr.trim();
    if (!name || selectedMedications.includes(name)) return;
    selectedMedications.push(name);
    document.getElementById('inputMedicacao').value = '';
    document.getElementById('medicationSuggestions').style.display = 'none';
    renderMedicationChips();
}

export function renderMedicationChips() {
    const chipsDiv = document.getElementById('medicationChips');
    if (!chipsDiv) return;
    chipsDiv.innerHTML = selectedMedications.map((med, idx) =>
        `<span class="badge bg-primary">${med} <button type="button" class="btn-close btn-close-white ms-1" style="font-size:0.7rem;" data-idx="${idx}"></button></span>`
    ).join('');
    chipsDiv.style.display = selectedMedications.length > 0 ? 'flex' : 'none';
}

function setupDelegatedActions() {
    // Chips deletion
    document.getElementById('medicationChips')?.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-close')) {
            selectedMedications.splice(e.target.dataset.idx, 1);
            renderMedicationChips();
        }
    });

    // We can use a global delegate tracker, or bind per list
    const lists = [
        'listQueixas', 'listInternacoes', 'listAcomp', 'listVisitas', 'listCirurgias',
        'listTabagismo', 'listEtilismo', 'listMedicacao', 'listOrientacoes'
    ];

    lists.forEach(listId => {
        document.getElementById(listId)?.addEventListener('click', async (e) => {
            const btnEdit = e.target.closest('.btn-edit');
            const btnDel = e.target.closest('.btn-delete');

            if (btnEdit) {
                const { id, type } = btnEdit.dataset;
                prepararEdicaoAnamnese(type, id);
            }
            if (btnDel) {
                const { id, type } = btnDel.dataset;
                if (confirm('Confirma exclusão deste registro?')) {
                    const patientId = document.getElementById('idBuscaClinica').value;
                    try {
                        await AnamnesisService.deleteClinicalRecord(type, id, patientId);
                        atualizarHistoricoTotal(patientId);
                        alert('Excluído com sucesso');
                    } catch (err) { alert('Erro ao excluir'); }
                }
            }
        });
    });

    // Char counters
    const counters = [
        { input: 'detalheMedicacao', cnt: 'charCountMedicacao' },
        { input: 'porqueMedicacao', cnt: 'charCountMotivo' },
        { input: 'txtOrientacoes', cnt: 'charCountOrientacoes' },
        { input: 'porqueOrientacoes', cnt: 'charCountPorque' }
    ];
    counters.forEach(c => {
        document.getElementById(c.input)?.addEventListener('input', e => {
            document.getElementById(c.cnt).textContent = e.target.value.length + '/500';
        });
    });
}

function formatTS(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return '';
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(-2)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const getTimestampFromEntry = (e) => {
    const r = e.resource || {};
    return r.meta?.lastUpdated || r.period?.start || r.recordedDate || r.authoredOn || r.date || r.started || r.issued || null;
};

function renderListItemHtml(e, label, type) {
    const ts = formatTS(getTimestampFromEntry(e));
    return `
    <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
        <div>
            <div>${ts}</div>
            ${label ? `<span class="text-muted small">${label}</span>` : ''}
        </div>
        <div>
            <button class="btn btn-sm btn-outline-secondary btn-edit" data-id="${e.resource.id}" data-type="${type}">Editar</button>
            <button class="btn btn-sm btn-outline-danger ms-2 btn-delete" data-id="${e.resource.id}" data-type="${type}">Excluir</button>
        </div>
    </div>`;
}

async function atualizarHistoricoTotal(pacId) {
    try {
        const q = await AnamnesisService.fetchHistoryList('Condition', pacId);
        document.getElementById('listQueixas').innerHTML = q.map(e => renderListItemHtml(e, e.resource.code?.text, 'Condition')).join('');

        const i = await AnamnesisService.fetchHistoryList('Encounter', pacId, '&class=IMP');
        document.getElementById('listInternacoes').innerHTML = i.map(e => renderListItemHtml(e, e.resource.reasonCode?.[0]?.text, 'EncounterIMP')).join('');

        const a = await AnamnesisService.fetchHistoryList('ServiceRequest', pacId);
        document.getElementById('listAcomp').innerHTML = a.map(e => renderListItemHtml(e, e.resource.locationReference?.[0]?.display, 'ServiceRequest')).join('');

        const v = await AnamnesisService.fetchHistoryList('Encounter', pacId, '&class=AMB');
        document.getElementById('listVisitas').innerHTML = v.map(e => renderListItemHtml(e, e.resource.serviceType?.text, 'EncounterAMB')).join('');

        const c = await AnamnesisService.fetchHistoryList('Procedure', pacId);
        document.getElementById('listCirurgias').innerHTML = c.map(e => renderListItemHtml(e, e.resource.code?.text, 'Procedure')).join('');

        const tab = await AnamnesisService.fetchHistoryList('Observation', pacId, '&code=72166-2');
        document.getElementById('listTabagismo').innerHTML = tab.map(e => renderListItemHtml(e, e.resource.valueCodeableConcept?.text || '', 'ObservationTAB')).join('');

        const eti = await AnamnesisService.fetchHistoryList('Observation', pacId, '&code=74205-6');
        document.getElementById('listEtilismo').innerHTML = eti.map(e => renderListItemHtml(e, e.resource.valueCodeableConcept?.text || '', 'ObservationETI')).join('');

        const med = await AnamnesisService.fetchHistoryList('MedicationStatement', pacId);
        document.getElementById('listMedicacao').innerHTML = med.map(e => renderListItemHtml(e, e.resource.medicationCodeableConcept?.text || 'Medication', 'MedicationStatement')).join('');

        const ori = await AnamnesisService.fetchHistoryList('Observation', pacId, '&code=health-guidance');
        document.getElementById('listOrientacoes').innerHTML = ori.map(e => renderListItemHtml(e, 'Orientações', 'ObservationORI')).join('');

    } catch (err) {
        console.error("Erro ao atualizar historico", err);
    }
}

async function prepararEdicaoAnamnese(type, id) {
    try {
        let fhirType = type;
        if (type.startsWith('Encounter')) fhirType = 'Encounter';
        if (type.startsWith('Observation')) fhirType = 'Observation';

        const req = await AnamnesisService.getResourceById(fhirType, id);
        if (!req) throw new Error();

        document.getElementById('idBuscaClinica').value = req.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        alteracaoModulo('anamnese');

        if (type === 'Condition') {
            const ui = AnamnesisMapper.toConditionUI(req);
            document.getElementById('queixaId').value = ui.id;
            document.getElementById('txtQueixa').value = ui.queixa;
            document.getElementById('selSatisfacao').value = ui.satisfacao;
            document.querySelector('#accAnamnese #sec1 .accordion-button')?.click();
        } else if (type === 'EncounterIMP') {
            const ui = EncounterMapper.toInpatientEncounterUI(req);
            document.getElementById('internacaoId').value = ui.id;
            document.getElementById('dataInternacao').value = ui.dataInternacao;
            document.getElementById('motivoInternacao').value = ui.motivoInternacao;
            document.querySelector('#accAnamnese #sec2 .accordion-button')?.click();
        } else if (type === 'ServiceRequest') {
            const ui = AnamnesisMapper.toAcompanhamentoUI(req);
            document.getElementById('acompId').value = ui.id;
            document.getElementById('localAcomp').value = ui.local;
            document.getElementById('selAcomp').value = ui.necessita;
            document.querySelector('#accAnamnese #sec3 .accordion-button')?.click();
        } else if (type === 'EncounterAMB') {
            const ui = EncounterMapper.toOutpatientEncounterUI(req);
            document.getElementById('visitaId').value = ui.id;
            document.getElementById('servicoProcurado').value = ui.servicoProcurado;
            document.getElementById('motivoVisita').value = ui.motivoVisita;
            document.querySelector('#accAnamnese #sec4 .accordion-button')?.click();
        } else if (type === 'Procedure') {
            const ui = EncounterMapper.toProcedureUI(req);
            document.getElementById('cirurgiaId').value = ui.id;
            document.getElementById('txtCirurgia').value = ui.cirurgia;
            document.getElementById('motivoCirurgia').value = ui.motivoCirurgia;
            const compEl = document.getElementById('txtComplicacao');
            if (compEl) compEl.value = ui.complicacao;
            document.querySelector('#accAnamnese #sec5 .accordion-button')?.click();
        } else if (type === 'ObservationTAB') {
            const ui = AnamnesisMapper.toTobaccoObservationUI(req);
            document.getElementById('tabagismoId').value = ui.id;
            document.getElementById('selFumante').value = ui.status;
            document.getElementById('txtTabagismo').value = ui.obs;
            document.querySelector('#accAnamnese #sec6 .accordion-button')?.click();
        } else if (type === 'ObservationETI') {
            const ui = AnamnesisMapper.toAlcoholObservationUI(req);
            document.getElementById('etilismoId').value = ui.id;
            document.getElementById('selEtilismo').value = ui.status;
            document.getElementById('txtEtilismo').value = ui.obs;
            document.querySelector('#accAnamnese #sec7 .accordion-button')?.click();
        } else if (type === 'MedicationStatement') {
            const ui = MedicationMapper.toUI(req);
            document.getElementById('medicacaoId').value = ui.id;
            selectedMedications = ui.medicamentos || [];
            renderMedicationChips();
            document.getElementById('detalheMedicacao').value = ui.detalhes;
            document.getElementById('porqueMedicacao').value = ui.porque;
            const consegueEl = document.querySelector(`input[name="consegueTomar"][value="${ui.consegueTomar}"]`);
            if (consegueEl) consegueEl.checked = true;
            const usouEl = document.querySelector(`input[name="usouMedicamento"][value="${ui.usouMedicamento}"]`);
            if (usouEl) usouEl.checked = true;
            document.querySelector('#accAnamnese #sec8 .accordion-button')?.click();
        } else if (type === 'ObservationORI') {
            const ui = AnamnesisMapper.toHealthGuidanceObservationUI(req);
            document.getElementById('orientacoesId').value = ui.id;
            document.getElementById('txtOrientacoes').value = ui.orientacoes;
            document.getElementById('porqueOrientacoes').value = ui.porque;
            const consegueEl = document.querySelector(`input[name="consegueOrientacoes"][value="${ui.consegueFazer}"]`);
            if (consegueEl) consegueEl.checked = true;
            document.querySelector('#accAnamnese #sec9 .accordion-button')?.click();
        }
    } catch (err) {
        alert('Erro ao carregar registro');
    }
}
