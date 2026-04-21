// FILE: src/ui/main.js
import { initPatientUI } from './patient-ui.js';
import { initAnamnesisUI } from './anamnesis-ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // Top-level Navigation Listeners (replacing inline onclick="alternarModulo(...)")
    document.getElementById('btnNavCadastro')?.addEventListener('click', () => alteracaoModulo('cadastro'));
    document.getElementById('btnNavAnamnese')?.addEventListener('click', () => alteracaoModulo('anamnese'));

    // Initialize module UIs
    initPatientUI();
    initAnamnesisUI();
});

export function alteracaoModulo(mod) {
    const modCadastro = document.getElementById('modulo-cadastro');
    const modAnamnese = document.getElementById('modulo-anamnese');
    
    if (modCadastro && modAnamnese) {
        modCadastro.style.display = mod === 'cadastro' ? 'block' : 'none';
        modAnamnese.style.display = mod === 'anamnese' ? 'block' : 'none';
        
        const btnNavCadastro = document.getElementById('btnNavCadastro');
        const btnNavAnamnese = document.getElementById('btnNavAnamnese');
        if (btnNavCadastro) btnNavCadastro.classList.toggle('active', mod === 'cadastro');
        if (btnNavAnamnese) btnNavAnamnese.classList.toggle('active', mod === 'anamnese');
    }
}
