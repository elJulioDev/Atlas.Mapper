import { state, saveToLocal } from './state.js';
import { drawMainCanvas }     from '../canvas/renderer.js';
import { updateUI }           from '../main.js';

/** Genera un ID único para un nuevo asset. */
function genId() { return 'asset_' + Date.now().toString(36); }

/**
 * Carga un File de imagen y lo registra en state.assets.
 * Si assetId se pasa, re-carga sobre ese ID existente.
 */
export function loadImageFile(file, assetId = null) {
    const id = assetId || genId();

    if (state.assets[id] && state.assets[id].url) {
        URL.revokeObjectURL(state.assets[id].url);
    }

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
        state.assets[id] = { fileName: file.name, imgObject: img, url };
        state.activeAssetId = id;
        saveToLocal();
        updateUI();
        drawMainCanvas();
        renderAssetPanel();
    };

    img.src = url;
    // Entrada optimista inmediata para que el panel la muestre como "cargando"
    if (!state.assets[id]) {
        state.assets[id] = { fileName: file.name, imgObject: img, url: null };
    }
    renderAssetPanel();
}

/** Elimina un asset. Limpia frames huérfanos de ese asset. */
export function removeAsset(id) {
    if (!state.assets[id]) return;
    if (!confirm(`¿Eliminar "${state.assets[id].fileName}" y sus frames?`)) return;

    URL.revokeObjectURL(state.assets[id].url);
    delete state.assets[id];

    // Limpiar frames que pertenecen a este asset
    for (const fid in state.allFrames) {
        if (state.allFrames[fid].assetId === id) delete state.allFrames[fid];
    }
    // Limpiar referencias en timelines
    for (const aname in state.animations) {
        const anim = state.animations[aname];
        anim.timeline = anim.timeline.filter(t => state.allFrames[t.frameId]);
    }

    if (state.activeAssetId === id) {
        const remaining = Object.keys(state.assets);
        state.activeAssetId = remaining.length ? remaining[0] : null;
    }

    saveToLocal();
    updateUI();
    drawMainCanvas();
    renderAssetPanel();
}

/** Cambia el asset activo (lo que se muestra en el canvas principal). */
export function setActiveAsset(id) {
    if (!state.assets[id]) return;
    state.activeAssetId = id;
    drawMainCanvas();
    renderAssetPanel();
}

/** Renderiza el panel de la lista de assets en el panel izquierdo. */
export function renderAssetPanel() {
    const container = document.getElementById('asset-list');
    if (!container) return;

    const ids = Object.keys(state.assets);

    if (!ids.length) {
        container.innerHTML = '<div class="hint-empty">Sin spritesheets<br>Carga una imagen</div>';
        return;
    }

    container.innerHTML = '';
    ids.forEach(id => {
        const a   = state.assets[id];
        const act = state.activeAssetId === id;
        const el  = document.createElement('div');
        el.className = 'asset-item' + (act ? ' active' : '');
        el.innerHTML = `
            <span class="asset-dot" style="color:${act ? 'var(--accent)' : 'var(--dim)'};">▶</span>
            <span class="asset-name" title="${a.fileName}">${a.fileName}</span>
            <button class="btn btn-danger btn-sm" style="padding:1px 5px;flex-shrink:0;"
                    onclick="event.stopPropagation();window.__assetMgr.removeAsset('${id}')">✕</button>
        `;
        el.addEventListener('click', () => setActiveAsset(id));
        container.appendChild(el);
    });
}

// Expone al HTML inline el removeAsset (por simplicidad sin bundler)
window.__assetMgr = { removeAsset };