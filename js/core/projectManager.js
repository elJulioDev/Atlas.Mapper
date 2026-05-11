import { state } from './state.js';

const KEY = 'atlas_projects';

function _read() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch { return {}; }
}

function _write(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); } catch(e) {}
}

export function listProjects() {
    const p = _read();
    return Object.entries(p)
        .map(([name, d]) => ({ name, savedAt: d.savedAt || 0, charName: d.charConfig?.name || name }))
        .sort((a, b) => b.savedAt - a.savedAt);
}

export function saveProject(name) {
    const p = _read();
    const assetsMeta = {};
    for (const id in state.assets) {
        assetsMeta[id] = { fileName: state.assets[id].fileName, dataUrl: state.assets[id].dataUrl };
    }
    p[name] = {
        allFrames:    state.allFrames,
        animations:   state.animations,
        movesetConfig: state.movesetConfig,
        charConfig:   JSON.parse(JSON.stringify(state.charConfig)),
        assetsMeta,
        activeAssetId: state.activeAssetId,
        savedAt: Date.now()
    };
    _write(p);
    state.activeProject = name;
}

export function loadProject(name) {
    const d = _read()[name];
    if (!d) return false;
    for (const id in state.assets) if (state.assets[id].url) URL.revokeObjectURL(state.assets[id].url);
    state.assets              = {};
    state.allFrames           = d.allFrames    || {};
    state.animations          = d.animations   || {};
    state.movesetConfig       = d.movesetConfig || [];
    state.charConfig          = Object.assign(
        { name:'', displayName:'', folder:'', stats:{ hp:1000, ki:100, speed:5, weight:70, attack:1.0, defense:1.0 }, transformations:[] },
        d.charConfig || {}
    );
    state.activeAssetId       = d.activeAssetId || null;
    state.activeAnim          = null;
    state.selectedBaseFrameId = null;
    state.selectedTLIndex     = null;
    state.autoSlicedBoxes     = [];
    state.selectedCollisionBox = null;
    state.activeProject       = name;
    if (d.assetsMeta) {
        for (const id in d.assetsMeta) {
            const meta = d.assetsMeta[id];
            const img = new Image();
            state.assets[id] = { fileName: meta.fileName, imgObject: img, url: meta.dataUrl || null, dataUrl: meta.dataUrl || null };
            if (meta.dataUrl) {
                img.onload = () => { if (window.__refreshMainCanvas) window.__refreshMainCanvas(); };
                img.src = meta.dataUrl;
            }
        }
    }
    return true;
}

export function deleteProject(name) {
    const p = _read();
    delete p[name];
    _write(p);
    if (state.activeProject === name) state.activeProject = null;
}

export function newProject() {
    for (const id in state.assets) if (state.assets[id].url) URL.revokeObjectURL(state.assets[id].url);
    state.assets              = {};
    state.activeAssetId       = null;
    state.allFrames           = {};
    state.animations          = {};
    state.movesetConfig       = [];
    state.charConfig          = { name:'', displayName:'', folder:'', stats:{ hp:1000, ki:100, speed:5, weight:70, attack:1.0, defense:1.0 }, transformations:[] };
    state.activeAnim          = null;
    state.selectedBaseFrameId = null;
    state.selectedTLIndex     = null;
    state.autoSlicedBoxes     = [];
    state.selectedCollisionBox = null;
    state.activeProject       = null;
}