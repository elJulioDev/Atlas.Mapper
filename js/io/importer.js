import { state, saveToLocal }   from '../core/state.js';
import { updateUI }             from '../main.js';
import { renderAssetPanel }     from '../core/assetManager.js';

export function importJSON() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = e => loadJSONFile(e.target.files[0]);
    inp.click();
}

export function loadJSONFile(file) {
    const r = new FileReader();
    r.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            _applyJSON(data);
            updateUI();
            renderAssetPanel();
            saveToLocal();
            alert('JSON importado correctamente.');
        } catch(err) { alert('Error al leer JSON: ' + err.message); }
    };
    r.readAsText(file);
}

function _applyJSON(data) {
    const version = parseFloat(data.version) || 6;

    // Frames base
    if (data.base_frames) state.allFrames = data.base_frames;

    // Assets: Ajustamos la validación para que reconozca la v1.0 como actual
    if ((version === 1.0 || version >= 7) && data.textures) {
        for (const id in data.textures) {
            if (!state.assets[id]) {
                state.assets[id] = { fileName: data.textures[id], imgObject: new Image(), url: null };
            }
        }
        for (const fid in state.allFrames) {
            if (!state.allFrames[fid].assetId) state.allFrames[fid].assetId = Object.keys(data.textures)[0] || 'sheet_0';
        }
        if (!state.activeAssetId && Object.keys(state.assets).length) state.activeAssetId = Object.keys(state.assets)[0];
    } else if (data.spritesheet) {
        // v6 — LÓGICA MEJORADA DE VINCULACIÓN
        const assetKeys = Object.keys(state.assets);
        // 1. Buscar si la imagen ya está cargada con el nombre exacto
        let id = assetKeys.find(k => state.assets[k].fileName === data.spritesheet);
        
        // 2. Si no coincide el nombre, pero hay EXACTAMENTE 1 imagen cargada, forzamos la vinculación
        if (!id && assetKeys.length === 1) id = assetKeys[0];
        
        // 3. Si no hay imágenes, creamos un placeholder 'sheet_0' a la espera de que subas la imagen
        if (!id) {
            id = 'sheet_0';
            if (!state.assets[id]) {
                state.assets[id] = { fileName: data.spritesheet, imgObject: new Image(), url: null };
            }
        }
        
        state.activeAssetId = id;
        for (const fid in state.allFrames) state.allFrames[fid].assetId = id;
    }

    // Animaciones
    state.animations = {};
    let firstAnim = null; // Para auto-seleccionar y dar feedback visual

    if (data.animations) {
        for (const name in data.animations) {
            if (!firstAnim) firstAnim = name; // Guardar la primera animación encontrada
            const a    = data.animations[name];
            const anim = {
                fps: a.fps || 12,
                type: a.type || (a.loop ? 'loop' : 'simple'),
                next_anim: a.next_anim || '',
                loop_start: 1, outro_start: 2,
                timeline: []
            };
            const parseSeq = arr => (arr||[]).map(f => ({
                frameId:  f.frame_id,
                events:   (f.events||[]).join(', '),
                duration: f.duration_ms || null,
                hitboxes: f.hitboxes  || [],
                hurtboxes:f.hurtboxes || []
            }));
            if (a.phases) {
                anim.type = 'held';
                const intro = parseSeq(a.phases.intro), loop = parseSeq(a.phases.loop), outro = parseSeq(a.phases.outro);
                anim.loop_start  = intro.length;
                anim.outro_start = intro.length + loop.length;
                anim.timeline    = [...intro, ...loop, ...outro];
            } else if (a.sequence) {
                anim.timeline = parseSeq(a.sequence);
            }
            state.animations[name] = anim;
        }
    }

    // AUTO-SELECCIÓN: Cargar la primera animación en el Canvas
    if (firstAnim) {
        state.activeAnim = firstAnim;
        if (state.animations[firstAnim].timeline.length > 0) {
            state.selectedTLIndex = 0;
            state.selectedBaseFrameId = state.animations[firstAnim].timeline[0].frameId;
        } else {
            state.selectedTLIndex = null;
            state.selectedBaseFrameId = null;
        }
        // Reseteamos el preview si existe la función global
        if (typeof window.__resetPreview === 'function') window.__resetPreview();
    }
}

export function importMovesetJSON() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.json';
    inp.onchange = e => {
        const r = new FileReader();
        r.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (data.combos) { state.movesetConfig = data.combos; }
                if (typeof window.__renderMovesetPanel === 'function') window.__renderMovesetPanel();
                saveToLocal(); alert('✓ Moveset importado.');
            } catch(err) { alert('Error: ' + err.message); }
        };
        r.readAsText(e.target.files[0]);
    };
    inp.click();
}

export function clearAll() {
    if (!confirm('¿Limpiar todo el trabajo actual?')) return;
    for (const id in state.assets) { if (state.assets[id].url) URL.revokeObjectURL(state.assets[id].url); }
    state.assets         = {};
    state.activeAssetId  = null;
    state.allFrames      = {};
    state.animations     = {};
    state.autoSlicedBoxes = [];
    state.movesetConfig  = [];
    state.activeAnim     = null;
    state.selectedBaseFrameId = null;
    state.selectedTLIndex     = null;
    localStorage.removeItem('atlas_backup');
    renderAssetPanel();
    updateUI();
}