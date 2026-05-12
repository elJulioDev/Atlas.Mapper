// Almacén central reactivo. Todos los módulos importan desde aquí.

export const state = {
    // Assets (múltiples spritesheets)
    assets: {},           // { assetId: { fileName, imgObject, url } }
    activeAssetId: null,  // ID del asset visible en el canvas principal

    // Frames base
    allFrames: {},        // { frameId: { assetId, x, y, w, h, px, py } }

    // Animaciones
    animations: {},       // { name: { fps, type, next_anim, loop_start, outro_start, timeline[] } }

    // Selección activa
    activeAnim: null,
    selectedBaseFrameId: null,
    selectedTLIndex: null,

    // Canvas / zoom
    currentMode: 'draw',
    currentZoom: 1,
    autoSlicedBoxes: [],

    // Cajas de colisión
    selectedCollisionBox: null, // { type: 'hitbox'|'hurtbox', idx }
    activeBoxType: null,
    activeProject: null,
    hurtboxSyncMode: false,

    // Moveset
    movesetConfig: [],

    // Char config
    charConfig: {
        name: '', displayName: '', folder: '',
        stats: { hp: 1000, ki: 100, speed: 5, weight: 70, attack: 1.0, defense: 1.0 },
        transformations: []
    }
};

// Helpers

/** Devuelve el objeto Image del asset activo, o null. */
export function activeImage() {
    const a = state.assets[state.activeAssetId];
    return a ? a.imgObject : null;
}

/** Devuelve el objeto Image de un frame específico, o null. */
export function imageForFrame(frameId) {
    const f = state.allFrames[frameId];
    if (!f) return null;
    const a = state.assets[f.assetId];
    return a ? a.imgObject : null;
}

/** Devuelve el ImageObject de un asset por ID, o null. */
export function imageById(assetId) {
    const a = state.assets[assetId];
    return a ? a.imgObject : null;
}

// Persistencia

export function saveToLocal() {
    const { allFrames, animations, movesetConfig, charConfig, assets } = state;
    // Guardamos metadatos de assets (no las imágenes, son binarios)
    const assetsMeta = {};
    for (const id in assets) {
        assetsMeta[id] = { fileName: assets[id].fileName, dataUrl: assets[id].dataUrl };
    }
    try {
        localStorage.setItem('atlas_backup', JSON.stringify({
            allFrames, animations, movesetConfig, charConfig, assetsMeta,
            activeAssetId: state.activeAssetId
        }));
    } catch(e) {}
}

export function loadFromLocal() {
    try {
        const data = JSON.parse(localStorage.getItem('atlas_backup'));
        if (!data) return false;
        state.allFrames     = data.allFrames    || {};
        state.animations    = data.animations   || {};
        state.movesetConfig = data.movesetConfig || [];
        if (data.charConfig) Object.assign(state.charConfig, data.charConfig);
        // Reconstruimos entradas de asset sin imágenes (quedan como pendientes)
        if (data.assetsMeta) {
            for (const id in data.assetsMeta) {
                const meta = data.assetsMeta[id];
                const img = new Image();
                state.assets[id] = {
                    fileName: meta.fileName,
                    imgObject: img,
                    url: meta.dataUrl || null,
                    dataUrl: meta.dataUrl || null
                };
                if (meta.dataUrl) {
                    // Cuando termine de cargar de la caché, forzamos un redibujado
                    img.onload = () => { if (window.__refreshMainCanvas) window.__refreshMainCanvas(); };
                    img.src = meta.dataUrl;
                }
            }
            state.activeAssetId = data.activeAssetId || null;
        }
        return true;
    } catch(e) { return false; }
}