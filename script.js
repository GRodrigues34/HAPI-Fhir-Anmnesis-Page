function alternarModulo(mod) {
    document.getElementById('modulo-cadastro').style.display = mod === 'cadastro' ? 'block' : 'none';
    document.getElementById('modulo-anamnese').style.display = mod === 'anamnese' ? 'block' : 'none';
    const buttons = document.querySelectorAll('#mainNav .nav-link');
    buttons[0].classList.toggle('active', mod === 'cadastro');
    buttons[1].classList.toggle('active', mod === 'anamnese');
}

const getBaseUrl = () => document.getElementById('serverUrl').value.replace(/\/$/, "");

async function salvarPaciente(e) {
    e.preventDefault();
    const id = document.getElementById('pacienteId').value;
    const body = {
        resourceType: "Patient",
        name: [{ family: document.getElementById('inputSobrenome').value, given: [document.getElementById('inputNome').value] }]
    };
    if (id) body.id = id;

    const res = await fetch(`${getBaseUrl()}/Patient${id ? '/' + id : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(body)
    });
    if (res.ok) {
        alert("Paciente salvo com sucesso!");
        document.getElementById('formCadastro').reset();
        document.getElementById('pacienteId').value = "";
        listarPacientes();
    } else {
        const text = await res.text();
        alert(`Erro ao salvar paciente: ${res.status} ${res.statusText}\n${text}`);
    }
}

async function listarPacientes() {
    const res = await fetch(`${getBaseUrl()}/Patient?_sort=-_lastUpdated&_count=10&_t=${Date.now()}`);
    const data = await res.json();
    const tbody = document.getElementById('tabelaPacientes');
    tbody.innerHTML = data.entry ? data.entry.map(e => `
        <tr>
            <td>${e.resource.id}</td>
            <td>${e.resource.name[0].given[0]} ${e.resource.name[0].family}</td>
            <td>
                <button onclick="prepararEdicao('${e.resource.id}')" class="btn btn-sm btn-warning">Editar</button>
                <button onclick="mostrarProntuario('${e.resource.id}')" class="btn btn-sm btn-info">Prontuário</button>
            </td>
        </tr>`).join('') : "";
}


async function mostrarProntuario(id) {
    const base = getBaseUrl();
    const pres = await fetch(`${base}/Patient/${id}`);
    if (!pres.ok) { alert('Paciente não encontrado'); return; }
    const p = await pres.json();
    document.getElementById('modalPacId').textContent = p.id;
    document.getElementById('modalPacName').textContent = `${p.name?.[0]?.given?.[0] || ''} ${p.name?.[0]?.family || ''}`;

    // wire the resource link items
    const items = document.querySelectorAll('#modalLinks .list-group-item');
    items.forEach(item => {
        const resource = item.dataset.resource;
        const params = item.dataset.params || '';
        item.onclick = (ev) => { ev.preventDefault(); const url = `${base}/${resource}?subject=Patient/${encodeURIComponent(id)}${params}`; window.open(url, '_blank'); };
    });

    // helper to fetch & return entries (paths provided include the trailing '?')
    const fetchRes = async (path) => {
        const url = `${base}/${path}subject=Patient/${encodeURIComponent(id)}&_sort=-_lastUpdated&_t=${Date.now()}`;
        const res = await fetch(url);
        const j = await res.json();
        return j.entry || [];
    };

    // populate small summary lists (non-blocking, show modal immediately)
    const modalEl = document.getElementById('modalProntuario');
    const modal = new bootstrap.Modal(modalEl);
    modal.show();

    (async () => {
        try {
            const q = await fetchRes('Condition?');
            document.getElementById('modalQueixas').innerHTML = q.map(e => `<div class="p-1 border-bottom small">${e.resource.code?.text || ''}</div>`).join('');

            const i = await fetchRes('Encounter?class=IMP&');
            document.getElementById('modalInternacoes').innerHTML = i.map(e => `<div class="p-1 border-bottom small">${e.resource.period?.start || ''}: ${e.resource.reasonCode ? e.resource.reasonCode[0].text : ''}</div>`).join('');

            const a = await fetchRes('ServiceRequest?');
            document.getElementById('modalAcomp').innerHTML = a.map(e => `<div class="p-1 border-bottom small">${e.resource.note?.[0]?.text || ''}</div>`).join('');

            const v = await fetchRes('Encounter?class=AMB&');
            document.getElementById('modalVisitas').innerHTML = v.map(e => `<div class="p-1 border-bottom small">${e.resource.serviceType?.text || ''}</div>`).join('');

            const c = await fetchRes('Procedure?');
            document.getElementById('modalCirurgias').innerHTML = c.map(e => `\n                <div class="p-2 border-bottom">\n                    <strong>${e.resource.code?.text || ''}</strong><br>\n                    <span class="text-muted">Motivo: ${e.resource.reasonCode ? e.resource.reasonCode[0].text : 'N/A'}</span>\n                </div>\n            `).join('');
        } catch (err) {
            console.warn('Erro ao carregar sumário do prontuário', err);
        }
    })();
}


async function prepararEdicao(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/Patient/${encodeURIComponent(id)}`);
        if (!res.ok) {
            const txt = await res.text();
            alert(`Erro ao carregar paciente: ${res.status} ${res.statusText}\n${txt}`);
            return;
        }
        const p = await res.json();
        document.getElementById('inputNome').value = p.name?.[0]?.given?.[0] || '';
        document.getElementById('inputSobrenome').value = p.name?.[0]?.family || '';
        document.getElementById('pacienteId').value = p.id || id;
        alternarModulo('cadastro');
        // focus first input for quick editing
        document.getElementById('inputNome').focus();
    } catch (err) {
        console.error('prepararEdicao error', err);
        alert('Erro ao carregar paciente — veja o console para mais detalhes.');
    }
}

// Resource-specific edit preparers
async function prepararEdicaoQueixa(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/Condition/${encodeURIComponent(id)}`);
        if (!res.ok) { alert('Erro ao carregar queixa'); return; }
        const r = await res.json();
        document.getElementById('idBuscaClinica').value = r.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        document.getElementById('txtQueixa').value = r.code?.text || '';
        const note = r.note?.[0]?.text || '';
        document.getElementById('selSatisfacao').value = note.replace('Satisfação: ', '') || 'satisfied';
        document.getElementById('queixaId').value = r.id;
        // open anamnese module and first section
        alternarModulo('anamnese');
        document.querySelector('#accAnamnese #sec1 .accordion-button')?.click();
    } catch (err) { console.error(err); alert('Erro ao preparar edição de queixa'); }
}

async function prepararEdicaoInternacao(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/Encounter/${encodeURIComponent(id)}`);
        if (!res.ok) { alert('Erro ao carregar internação'); return; }
        const r = await res.json();
        document.getElementById('idBuscaClinica').value = r.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        document.getElementById('dataInternacao').value = r.period?.start?.split('T')?.[0] || '';
        document.getElementById('motivoInternacao').value = r.reasonCode?.[0]?.text || '';
        document.getElementById('internacaoId').value = r.id;
        alternarModulo('anamnese');
        document.querySelector('#accAnamnese #sec2 .accordion-button')?.click();
    } catch (err) { console.error(err); alert('Erro ao preparar edição de internação'); }
}

async function prepararEdicaoAcompanhamento(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/ServiceRequest/${encodeURIComponent(id)}`);
        if (!res.ok) { alert('Erro ao carregar acompanhamento'); return; }
        const r = await res.json();
        document.getElementById('idBuscaClinica').value = r.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        const note = r.note?.[0]?.text || '';
        const localMatch = note.match(/Onde:\s*(.*?)\.\s*/);
        const needsMatch = note.match(/Necessita:\s*(.*)/);
        document.getElementById('localAcomp').value = localMatch ? localMatch[1] : note;
        if (needsMatch) document.getElementById('selAcomp').value = needsMatch[1];
        document.getElementById('acompId').value = r.id;
        alternarModulo('anamnese');
        document.querySelector('#accAnamnese #sec3 .accordion-button')?.click();
    } catch (err) { console.error(err); alert('Erro ao preparar edição de acompanhamento'); }
}

async function prepararEdicaoVisita(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/Encounter/${encodeURIComponent(id)}`);
        if (!res.ok) { alert('Erro ao carregar visita'); return; }
        const r = await res.json();
        document.getElementById('idBuscaClinica').value = r.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        // service may be in serviceType (CodeableConcept) with text or coding
        let servico = '';
        if (r.serviceType) {
            // serviceType can be an object or array
            const st = Array.isArray(r.serviceType) ? r.serviceType[0] : r.serviceType;
            servico = st.text || (st.coding && st.coding[0] && (st.coding[0].display || st.coding[0].code)) || '';
        }
        // fallback: serviceProvider display/name
        if (!servico && r.serviceProvider) {
            servico = r.serviceProvider.display || r.serviceProvider.reference || '';
        }
        document.getElementById('servicoProcurado').value = servico || '';

        // reason may be stored in several places (reasonCode[].text, reasonCode[].coding[].display/code, reason[].text)
        let motivo = '';
        if (r.reasonCode && r.reasonCode.length) {
            const rc = r.reasonCode[0];
            motivo = rc.text || (rc.coding && rc.coding[0] && (rc.coding[0].display || rc.coding[0].code)) || '';
        }
        if (!motivo && r.reason && r.reason.length) {
            motivo = r.reason[0].text || '';
        }
        document.getElementById('motivoVisita').value = motivo;
        document.getElementById('visitaId').value = r.id;
        alternarModulo('anamnese');
        document.querySelector('#accAnamnese #sec4 .accordion-button')?.click();
    } catch (err) { console.error(err); alert('Erro ao preparar edição de visita'); }
}

async function prepararEdicaoCirurgia(id) {
    try {
        const res = await fetch(`${getBaseUrl()}/Procedure/${encodeURIComponent(id)}`);
        if (!res.ok) { alert('Erro ao carregar cirurgia'); return; }
        const r = await res.json();
        document.getElementById('idBuscaClinica').value = r.subject?.reference?.split('/')?.[1] || document.getElementById('idBuscaClinica').value;
        document.getElementById('txtCirurgia').value = r.code?.text || '';
        document.getElementById('motivoCirurgia').value = r.reasonCode?.[0]?.text || '';
        document.getElementById('txtComplicacao').value = r.complication?.[0]?.text || '';
        document.getElementById('cirurgiaId').value = r.id;
        alternarModulo('anamnese');
        document.querySelector('#accAnamnese #sec5 .accordion-button')?.click();
    } catch (err) { console.error(err); alert('Erro ao preparar edição de cirurgia'); }
}

// Delete handlers for resources
async function deletarQueixa(id) {
    if (!confirm('Confirma exclusão desta queixa?')) return;
    const pacienteId = document.getElementById('idBuscaClinica').value || document.getElementById('modalPacId')?.textContent;
    try {
        const res = await fetch(`${getBaseUrl()}/Condition/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) { alert('Queixa excluída'); if (pacienteId) atualizarHistoricoTotal(pacienteId); }
        else { const txt = await res.text(); alert(`Erro ao excluir queixa: ${res.status} ${res.statusText}\n${txt}`); }
    } catch (err) { console.error(err); alert('Erro ao excluir queixa'); }
}

async function deletarInternacao(id) {
    if (!confirm('Confirma exclusão desta internação?')) return;
    const pacienteId = document.getElementById('idBuscaClinica').value || document.getElementById('modalPacId')?.textContent;
    try {
        const res = await fetch(`${getBaseUrl()}/Encounter/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) { alert('Internação excluída'); if (pacienteId) atualizarHistoricoTotal(pacienteId); }
        else { const txt = await res.text(); alert(`Erro ao excluir internação: ${res.status} ${res.statusText}\n${txt}`); }
    } catch (err) { console.error(err); alert('Erro ao excluir internação'); }
}

async function deletarAcompanhamento(id) {
    if (!confirm('Confirma exclusão deste acompanhamento?')) return;
    const pacienteId = document.getElementById('idBuscaClinica').value || document.getElementById('modalPacId')?.textContent;
    try {
        const res = await fetch(`${getBaseUrl()}/ServiceRequest/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) { alert('Acompanhamento excluído'); if (pacienteId) atualizarHistoricoTotal(pacienteId); }
        else { const txt = await res.text(); alert(`Erro ao excluir acompanhamento: ${res.status} ${res.statusText}\n${txt}`); }
    } catch (err) { console.error(err); alert('Erro ao excluir acompanhamento'); }
}

async function deletarVisita(id) {
    if (!confirm('Confirma exclusão desta visita?')) return;
    const pacienteId = document.getElementById('idBuscaClinica').value || document.getElementById('modalPacId')?.textContent;
    try {
        const res = await fetch(`${getBaseUrl()}/Encounter/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) { alert('Visita excluída'); if (pacienteId) atualizarHistoricoTotal(pacienteId); }
        else { const txt = await res.text(); alert(`Erro ao excluir visita: ${res.status} ${res.statusText}\n${txt}`); }
    } catch (err) { console.error(err); alert('Erro ao excluir visita'); }
}

async function deletarCirurgia(id) {
    if (!confirm('Confirma exclusão desta cirurgia?')) return;
    const pacienteId = document.getElementById('idBuscaClinica').value || document.getElementById('modalPacId')?.textContent;
    try {
        const res = await fetch(`${getBaseUrl()}/Procedure/${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (res.ok) { alert('Cirurgia excluída'); if (pacienteId) atualizarHistoricoTotal(pacienteId); }
        else { const txt = await res.text(); alert(`Erro ao excluir cirurgia: ${res.status} ${res.statusText}\n${txt}`); }
    } catch (err) { console.error(err); alert('Erro ao excluir cirurgia'); }
}

async function vincularPacienteClinico() {
    const id = document.getElementById('idBuscaClinica').value;
    const res = await fetch(`${getBaseUrl()}/Patient/${id}`);
    if (res.ok) {
        const p = await res.json();
        document.getElementById('nomePacienteClinico').textContent = `${p.name[0].given[0]} ${p.name[0].family}`;
        document.getElementById('interfaceClinica').style.display = 'block';
        atualizarHistoricoTotal(id);
    } else { alert("Erro: Paciente não encontrado!"); }
}

document.getElementById('formQueixa').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('idBuscaClinica').value;
    const queixaId = document.getElementById('queixaId').value;
    const body = {
        resourceType: "Condition",
        code: { text: document.getElementById('txtQueixa').value },
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        subject: { reference: `Patient/${pacienteId}` },
        note: [{ text: "Satisfação: " + document.getElementById('selSatisfacao').value }]
    };
    const url = `${getBaseUrl()}/Condition${queixaId ? '/' + encodeURIComponent(queixaId) : ''}`;
    const method = queixaId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(queixaId ? { ...body, id: queixaId } : body) });
    if (!res.ok) { alert('Erro ao salvar queixa'); return; }
    document.getElementById('txtQueixa').value = "";
    document.getElementById('queixaId').value = "";
    atualizarHistoricoTotal(pacienteId);
});

document.getElementById('formInternacao').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('idBuscaClinica').value;
    const internacaoId = document.getElementById('internacaoId').value;
    const body = {
        resourceType: "Encounter",
        status: "finished",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "IMP" },
        subject: { reference: `Patient/${pacienteId}` },
        period: { start: document.getElementById('dataInternacao').value },
        reasonCode: [{ text: document.getElementById('motivoInternacao').value }]
    };
    const url = `${getBaseUrl()}/Encounter${internacaoId ? '/' + encodeURIComponent(internacaoId) : ''}`;
    const method = internacaoId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(internacaoId ? { ...body, id: internacaoId } : body) });
    if (!res.ok) { alert('Erro ao salvar internação'); return; }
    document.getElementById('motivoInternacao').value = "";
    document.getElementById('internacaoId').value = "";
    atualizarHistoricoTotal(pacienteId);
});

document.getElementById('formAcompanhamento').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('idBuscaClinica').value;
    const acompId = document.getElementById('acompId').value;
    const body = {
        resourceType: "ServiceRequest",
        status: "active",
        intent: "plan",
        subject: { reference: `Patient/${pacienteId}` },
        note: [{ text: `Onde: ${document.getElementById('localAcomp').value}. Necessita: ${document.getElementById('selAcomp').value}` }]
    };
    const url = `${getBaseUrl()}/ServiceRequest${acompId ? '/' + encodeURIComponent(acompId) : ''}`;
    const method = acompId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(acompId ? { ...body, id: acompId } : body) });
    if (!res.ok) { alert('Erro ao salvar acompanhamento'); return; }
    document.getElementById('localAcomp').value = "";
    document.getElementById('acompId').value = "";
    atualizarHistoricoTotal(pacienteId);
});

document.getElementById('formVisita').addEventListener('submit', async (e) => {
    e.preventDefault();
    const pacienteId = document.getElementById('idBuscaClinica').value;
    const visitaId = document.getElementById('visitaId').value;
    const body = {
        resourceType: "Encounter",
        status: "finished",
        class: { system: "http://terminology.hl7.org/CodeSystem/v3-ActCode", code: "AMB" },
        subject: { reference: `Patient/${pacienteId}` },
        serviceType: { text: document.getElementById('servicoProcurado').value },
        reasonCode: [{ text: document.getElementById('motivoVisita').value }]
    };
    const url = `${getBaseUrl()}/Encounter${visitaId ? '/' + encodeURIComponent(visitaId) : ''}`;
    const method = visitaId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(visitaId ? { ...body, id: visitaId } : body) });
    if (!res.ok) { alert('Erro ao salvar visita'); return; }
    document.getElementById('servicoProcurado').value = "";
    document.getElementById('motivoVisita').value = "";
    document.getElementById('visitaId').value = "";
    atualizarHistoricoTotal(pacienteId);
});

document.getElementById('formCirurgia').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('idBuscaClinica').value;
    const baseUrl = getBaseUrl();
    const cirurgiaId = document.getElementById('cirurgiaId').value;

    const procedure = {
        resourceType: "Procedure",
        status: "completed",
        category: {
            coding: [{ system: "http://terminology.hl7.org/CodeSystem/procedure-category", code: "24642003", display: "Surgical procedure" }]
        },
        code: { text: document.getElementById('txtCirurgia').value },
        subject: { reference: `Patient/${id}` },
        reasonCode: [{ text: document.getElementById('motivoCirurgia').value }],
        complication: [{ text: document.getElementById('txtComplicacao').value }]
    };

    const url = `${baseUrl}/Procedure${cirurgiaId ? '/' + encodeURIComponent(cirurgiaId) : ''}`;
    const method = cirurgiaId ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/fhir+json' }, body: JSON.stringify(cirurgiaId ? { ...procedure, id: cirurgiaId } : procedure) });

    if (res.ok) {
        alert(cirurgiaId ? "Cirurgia atualizada!" : "Cirurgia registrada!");
        document.getElementById('formCirurgia').reset();
        document.getElementById('cirurgiaId').value = "";
        atualizarHistoricoTotal(id);
    } else {
        const txt = await res.text();
        alert(`Erro ao salvar cirurgia: ${res.status} ${res.statusText}\n${txt}`);
    }
});

async function atualizarHistoricoTotal(pacId) {
    const fetchRes = async (path) => (await (await fetch(`${getBaseUrl()}/${path}&subject=Patient/${pacId}&_sort=-_lastUpdated&_t=${Date.now()}`)).json()).entry || [];

    const formatTS = (ts) => {
        if (!ts) return '';
        const d = new Date(ts);
        if (isNaN(d)) return '';
        const dd = String(d.getDate()).padStart(2,'0');
        const mm = String(d.getMonth()+1).padStart(2,'0');
        const yy = String(d.getFullYear()).slice(-2);
        const hh = String(d.getHours()).padStart(2,'0');
        const min = String(d.getMinutes()).padStart(2,'0');
        return `${dd}/${mm}/${yy} ${hh}:${min}`;
    };

    const getTimestampFromEntry = (e) => {
        const r = e.resource || {};
        // prefer meta.lastUpdated, fallback to period.start or recordedDate
        return r.meta?.lastUpdated || r.period?.start || r.recordedDate || r.authoredOn || r.date || r.started || r.issued || null;
    };

    const q = await fetchRes("Condition?");
    document.getElementById('listQueixas').innerHTML = q.map(e => {
        const ts = formatTS(getTimestampFromEntry(e));
        return `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${ts}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoQueixa('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletarQueixa('${e.resource.id}')">Excluir</button>
            </div>
        </div>`
    }).join('');

    const i = await fetchRes("Encounter?class=IMP");
    document.getElementById('listInternacoes').innerHTML = i.map(e => {
        const ts = formatTS(getTimestampFromEntry(e));
        return `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${ts}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoInternacao('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletarInternacao('${e.resource.id}')">Excluir</button>
            </div>
        </div>`
    }).join('');

    const a = await fetchRes("ServiceRequest?");
    document.getElementById('listAcomp').innerHTML = a.map(e => {
        const ts = formatTS(getTimestampFromEntry(e));
        return `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${ts}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoAcompanhamento('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletarAcompanhamento('${e.resource.id}')">Excluir</button>
            </div>
        </div>`
    }).join('');

    const v = await fetchRes("Encounter?class=AMB");
    document.getElementById('listVisitas').innerHTML = v.map(e => {
        const ts = formatTS(getTimestampFromEntry(e));
        return `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${ts}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoVisita('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletarVisita('${e.resource.id}')">Excluir</button>
            </div>
        </div>`
    }).join('');

    const c = await fetchRes("Procedure?");
    document.getElementById('listCirurgias').innerHTML = c.map(e => {
        const ts = formatTS(getTimestampFromEntry(e));
        return `
        <div class="d-flex justify-content-between align-items-center p-2 border-bottom">
            <div>
                <div>${ts}</div>
                <span class="text-muted small">${e.resource.code?.text || ''}</span>
            </div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoCirurgia('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletarCirurgia('${e.resource.id}')">Excluir</button>
            </div>
        </div>`
    }).join('');

    // --- BUSCAR TABAGISMO (LOINC 72166-2) ---
    const tab = await fetchRes("Observation?code=72166-2&");
    document.getElementById('listTabagismo').innerHTML = tab.map(e => `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${e.resource.valueString}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoTabagismo('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="excluirRecurso('Observation', '${e.resource.id}')">Excluir</button>
            </div>
        </div>`).join('');

    // --- BUSCAR ETILISMO (LOINC 74205-6) ---
    const eti = await fetchRes("Observation?code=74205-6&");
    document.getElementById('listEtilismo').innerHTML = eti.map(e => `
        <div class="d-flex justify-content-between align-items-center p-1 border-bottom small">
            <div>${e.resource.valueString}</div>
            <div>
                <button class="btn btn-sm btn-outline-secondary" onclick="prepararEdicaoEtilismo('${e.resource.id}')">Editar</button>
                <button class="btn btn-sm btn-outline-danger ms-1" onclick="excluirRecurso('Observation', '${e.resource.id}')">Excluir</button>
            </div>
        </div>`).join('');
}

// Função genérica para salvar Tabagismo e Etilismo
async function salvarHabito(tipo, loincCode, loincDisplay, selId, txtId, recIdField, formId) {
    const pacId = document.getElementById('idBuscaClinica').value;
    const recId = document.getElementById(recIdField).value;
    
    const observation = {
        resourceType: "Observation",
        status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "social-history" }] }],
        code: { coding: [{ system: "http://loinc.org", code: loincCode, display: loincDisplay }], text: tipo },
        subject: { reference: `Patient/${pacId}` },
        valueString: `Status: ${document.getElementById(selId).value}. Obs: ${document.getElementById(txtId).value}`
    };

    if (recId) observation.id = recId;

    const res = await fetch(`${getBaseUrl()}/Observation${recId ? '/' + recId : ''}`, {
        method: recId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/fhir+json' },
        body: JSON.stringify(observation)
    });

    if (res.ok) {
        alert(`${tipo} salvo com sucesso!`);
        document.getElementById(formId).reset();
        document.getElementById(recIdField).value = "";
        atualizarHistoricoTotal(pacId);
    }
}

// Listeners para os formulários
document.getElementById('formTabagismo').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarHabito('Tabagismo', '72166-2', 'Tobacco smoking status', 'selFumante', 'txtTabagismo', 'tabagismoId', 'formTabagismo');
});

document.getElementById('formEtilismo').addEventListener('submit', (e) => {
    e.preventDefault();
    salvarHabito('Etilismo', '74205-6', 'Alcohol use', 'selEtilismo', 'txtEtilismo', 'etilismoId', 'formEtilismo');
});

async function prepararEdicaoTabagismo(id) {
    const res = await fetch(`${getBaseUrl()}/Observation/${id}`);
    const r = await res.json();
    const val = r.valueString || "";
    
    document.getElementById('tabagismoId').value = r.id;
    // Extrai o que está depois de "Obs: " para o campo de texto
    document.getElementById('txtTabagismo').value = val.split("Obs: ")[1] || "";
    // Extrai o status para o Select
    const statusMatch = val.match(/Status: (.*?)\./);
    if (statusMatch) document.getElementById('selFumante').value = statusMatch[1];
    
    // Abre a aba do acordeão se estiver fechada
    document.querySelector('#sec6 .accordion-button').click();
}

async function excluirRecurso(recurso, id) {
    if (!confirm(`Confirma a exclusão deste registro de ${recurso}?`)) return;
    
    const res = await fetch(`${getBaseUrl()}/${recurso}/${id}`, {
        method: 'DELETE'
    });
    
    if (res.ok) {
        alert("Registro excluído!");
        const pacId = document.getElementById('idBuscaClinica').value;
        atualizarHistoricoTotal(pacId);
    } else {
        alert("Erro ao excluir registro.");
    }
}

async function prepararEdicaoEtilismo(id) {
    const res = await fetch(`${getBaseUrl()}/Observation/${id}`);
    const r = await res.json();
    const val = r.valueString || "";
    
    document.getElementById('etilismoId').value = r.id;
    document.getElementById('txtEtilismo').value = val.split("Obs: ")[1] || "";
    const statusMatch = val.match(/Status: (.*?)\./);
    if (statusMatch) document.getElementById('selEtilismo').value = statusMatch[1];
    
    document.querySelector('#sec7 .accordion-button').click();
}

document.getElementById('formCadastro').addEventListener('submit', salvarPaciente);
listarPacientes();
