// Punto de entrada. Conecta todos los módulos.

import { state, saveToLocal, loadFromLocal } from './core/state.js';
import { loadImageFile, renderAssetPanel }   from './core/assetManager.js';
import { canvas, wrap, applyZoom, changeZoom, resetZoom,
         drawMainCanvas, getPos, runAutoSlice,
         getPivotForCurrentFrame, getBoxesForCurrentFrame }  from './canvas/renderer.js';
import { togglePlay, startHold, endHold, resetPreview }      from './canvas/preview.js';
import { onEditBoxMouseDown, onEditBoxMouseMove,
         onEditBoxMouseUp, showBoxEditTooltip, hideBoxEditTooltip,
         applyBoxEdit, deleteSelectedBox, closeBoxEditTooltip } from './tools/boxEditor.js';
import { selectTLFrame, addFrameToTL, removeSelectedFrame,
         duplicateActiveFrame, moveFrame, setPhaseMarker,
         renderTimelineStrip, renderRightPanel, updateUI }   from './tools/timeline.js';
import { exportJSON, exportMovesetJSON, exportCharJSON }     from './io/exporter.js';
import { importJSON, loadJSONFile, importMovesetJSON,
         clearAll }                                          from './io/importer.js';
import { listProjects, saveProject, loadProject,
         deleteProject, newProject } from './core/projectManager.js';

// Estado de dibujo (compartido con renderer)
window.__drawState = { isDrawing:false, startX:0, startY:0, curX:0, curY:0 };
const ds = window.__drawState;

// Exponer API a HTML inline y módulos cruzados
export { updateUI };

window.__tl    = { selectTLFrame, duplicateActiveFrame, removeSelectedFrame, moveFrame, setPhaseMarker };
window.__anims = { setActiveAnim, deleteAnim, dupeAnim };

// Animations API

function addAnimation() {
    const name = document.getElementById('new-anim-name').value.trim().replace(/\s+/g,'_');
    const type = document.getElementById('new-anim-type').value;
    if (!name) return;
    if (state.animations[name] && !confirm('"' + name + '" ya existe. ¿Sobrescribir?')) return;
    state.animations[name] = { fps:12, type, next_anim:'', loop_start:1, outro_start:2, timeline:[] };
    document.getElementById('new-anim-name').value = '';
    setActiveAnim(name);
    saveToLocal();
}

function setActiveAnim(name) {
    state.activeAnim = name;
    state.selectedTLIndex = null;
    resetPreview();
    updateUI();
}

function deleteAnim(name) {
    if (!confirm('¿Eliminar "' + name + '"?')) return;
    delete state.animations[name];
    if (state.activeAnim === name) { state.activeAnim = null; state.selectedTLIndex = null; }
    updateUI(); saveToLocal();
}

function dupeAnim(name) {
    let n = name + '_copy', i = 2;
    while (state.animations[n]) n = name + '_copy' + i++;
    state.animations[n] = JSON.parse(JSON.stringify(state.animations[name]));
    setActiveAnim(n); saveToLocal();
}

// Project management

export function renderProjectPanel() {
    const label   = document.getElementById('active-project-label');
    const listEl  = document.getElementById('project-list');
    if (!label || !listEl) return;

    label.textContent = state.activeProject || 'Sin guardar';
    const projects = listProjects();
    listEl.innerHTML = '';

    if (!projects.length) {
        listEl.innerHTML = '<div class="hint-empty" style="padding:10px 0;">Sin proyectos guardados</div>';
        return;
    }

    projects.forEach(({ name, savedAt, charName }) => {
        const isAct = state.activeProject === name;
        const dateObj = savedAt ? new Date(savedAt) : null;
        const date  = dateObj ? dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '—';
        
        const el    = document.createElement('div');
        el.className = 'project-item' + (isAct ? ' active' : '');
        el.innerHTML = `
            <span style="color:${isAct ? 'var(--accent)' : 'var(--dim)'}; font-size:10px;">▶</span>
            <div class="project-info">
                <span class="project-name" title="${name}">${name}${charName && charName !== name ? ' · ' + charName : ''}</span>
                <span class="project-date">${date}</span>
            </div>
            <button class="tool-btn btn-sm" style="color:#e88; padding:2px 6px; flex-shrink:0;"
                onclick="event.stopPropagation();projectDelete('${name}')" title="Eliminar proyecto">✕</button>
        `;
        el.addEventListener('click', () => projectLoad(name));
        listEl.appendChild(el);
    });
}

function projectNew() {
    if (!confirm('¿Nuevo proyecto? Se perderán los cambios no guardados.')) return;
    newProject();
    renderAssetPanel();
    updateUI();
    renderProjectPanel();
}

function projectSave() {
    if (!state.activeProject) { projectSaveAs(); return; }
    saveProject(state.activeProject);
    renderProjectPanel();
}

function projectSaveAs() {
    const name = prompt('Nombre del proyecto:', state.charConfig.name || 'nuevo_personaje');
    if (!name || !name.trim()) return;
    const key = name.trim().replace(/\s+/g, '_');
    saveProject(key);
    renderProjectPanel();
}

function projectLoad(name) {
    if (state.activeProject && state.activeProject !== name) {
        if (!confirm(`¿Cargar "${name}"? Guarda primero si tienes cambios.`)) return;
    }
    if (!loadProject(name)) { alert('No se pudo cargar el proyecto.'); return; }
    renderAssetPanel();
    updateUI();
    renderProjectPanel();
}

function projectDelete(name) {
    if (!confirm(`¿Eliminar "${name}"?`)) return;
    deleteProject(name);
    renderProjectPanel();
}

// Tool mode

function setMode(mode) {
    state.currentMode = mode;
    if (mode !== 'editbox') { state.selectedCollisionBox = null; hideBoxEditTooltip(); }
    ['draw','select','editbox','pivot','pan','hitbox','hurtbox'].forEach(m => {
        const el = document.getElementById('tool-' + m);
        if (el) el.classList.toggle('active', mode === m);
    });
    canvas.style.cursor =
        mode === 'draw'    ? 'crosshair' :
        (mode === 'hitbox' || mode === 'hurtbox') ? 'crosshair' :
        mode === 'pivot'   ? 'cell' :
        mode === 'pan'     ? 'grab' : 'default';

    const ind = document.getElementById('mode-indicator');
    if (ind) {
        if (mode === 'hitbox')   { ind.textContent='● HITBOX MODE';  ind.className='mode-indicator show mode-hitbox'; }
        else if (mode === 'hurtbox') { ind.textContent='● HURTBOX MODE'; ind.className='mode-indicator show mode-hurtbox'; }
        else if (mode === 'editbox') { ind.textContent='✎ EDITAR CAJAS'; ind.className='mode-indicator show mode-editbox'; }
        else ind.className = 'mode-indicator';
    }
    drawMainCanvas();
}

// Pivot helpers

function updateSelectedPivot() {
    if (!state.selectedBaseFrameId || !state.allFrames[state.selectedBaseFrameId]) return;
    state.allFrames[state.selectedBaseFrameId].px = parseInt(document.getElementById('prop-px').value) || 0;
    state.allFrames[state.selectedBaseFrameId].py = parseInt(document.getElementById('prop-py').value) || 0;
    drawMainCanvas(); saveToLocal();
}

function resetSelectedPivot() {
    if (!state.selectedBaseFrameId || !state.allFrames[state.selectedBaseFrameId]) return;
    const f = state.allFrames[state.selectedBaseFrameId];
    f.px = Math.floor(f.w/2); f.py = f.h;
    updateUI(); saveToLocal();
}

function updateAnimProp() {
    if (!state.activeAnim) return;
    const anim = state.animations[state.activeAnim];
    anim.fps       = parseInt(document.getElementById('prop-fps').value) || 12;
    anim.type      = document.getElementById('prop-type').value;
    anim.next_anim = document.getElementById('prop-next').value;
    if (anim.type === 'held') {
        anim.loop_start  = parseInt(document.getElementById('prop-loop-start').value)  || 1;
        anim.outro_start = parseInt(document.getElementById('prop-outro-start').value) || 2;
    }
    updateUI(); saveToLocal();
}

function updateTLFrameProps() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    tlf.events   = document.getElementById('prop-events').value;
    const d      = parseInt(document.getElementById('prop-duration').value);
    tlf.duration = isNaN(d) ? null : d;
    renderTimelineStrip(); saveToLocal();
}

// Canvas events

let isPanning = false, startPanX, startPanY, startScrollL, startScrollT;

canvas.addEventListener('mousedown', e => {
    if (!state.activeAssetId) return;
    const img = state.assets[state.activeAssetId]?.imgObject;
    if (!img || !img.naturalWidth) return;

    if (state.currentMode === 'pan' || e.button === 1) {
        e.preventDefault();
        isPanning = true;
        startPanX=e.clientX; startPanY=e.clientY;
        startScrollL=wrap.scrollLeft; startScrollT=wrap.scrollTop;
        canvas.style.cursor='grabbing'; return;
    }
    if (e.button !== 0) return;
    const p = getPos(e);

    if (state.currentMode === 'editbox') { onEditBoxMouseDown(p); return; }

    if (['draw','hitbox','hurtbox'].includes(state.currentMode)) {
        if (!state.activeAnim) { alert('Selecciona una animación primero.'); return; }
        if ((state.currentMode === 'hitbox' || state.currentMode === 'hurtbox') && state.selectedTLIndex === null) {
            alert('Selecciona un frame en la timeline primero.'); return;
        }
        ds.isDrawing=true; ds.startX=p.x; ds.startY=p.y; ds.curX=p.x; ds.curY=p.y;

    } else if (state.currentMode === 'select') {
        if (!state.activeAnim) return;
        let box = state.autoSlicedBoxes.find(b => p.x>=b.x && p.x<=b.x+b.w && p.y>=b.y && p.y<=b.y+b.h);
        if (box) {
            const id = 'slice_'+box.x+'_'+box.y;
            if (!state.allFrames[id]) state.allFrames[id] = { ...box, px:Math.floor(box.w/2), py:box.h, assetId: state.activeAssetId };
            addFrameToTL(id); return;
        }
        for (const id in state.allFrames) {
            const f = state.allFrames[id];
            if (f.assetId !== state.activeAssetId) continue;
            if (p.x>=f.x && p.x<=f.x+f.w && p.y>=f.y && p.y<=f.y+f.h) { addFrameToTL(id); return; }
        }
    } else if (state.currentMode === 'pivot') {
        if (state.selectedBaseFrameId && state.allFrames[state.selectedBaseFrameId]) {
            const f = state.allFrames[state.selectedBaseFrameId];
            if (p.x>=f.x && p.x<=f.x+f.w && p.y>=f.y && p.y<=f.y+f.h) {
                f.px=p.x-f.x; f.py=p.y-f.y; updateUI(); saveToLocal();
            }
        }
    }
});

canvas.addEventListener('mousemove', e => {
    if (isPanning) {
        wrap.scrollLeft = startScrollL - (e.clientX - startPanX);
        wrap.scrollTop  = startScrollT - (e.clientY - startPanY);
        return;
    }
    const p = getPos(e);
    document.getElementById('canvas-info').innerText = p.x + ', ' + p.y;

    if (state.currentMode === 'editbox') { onEditBoxMouseMove(p); return; }

    if (ds.isDrawing) {
        ds.curX = p.x; ds.curY = p.y;
        drawMainCanvas();
    }
});

document.addEventListener('mouseup', e => {
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = state.currentMode === 'pan' ? 'grab' : 'default';
        return;
    }
    if (state.currentMode === 'editbox') { onEditBoxMouseUp(); return; }
    if (!ds.isDrawing) return;
    ds.isDrawing = false;

    const w = Math.abs(ds.curX - ds.startX);
    const h = Math.abs(ds.curY - ds.startY);
    const x = Math.min(ds.startX, ds.curX);
    const y = Math.min(ds.startY, ds.curY);

    if (state.currentMode === 'draw') {
        if (w > 3 && h > 3) {
            const id = 'f_' + Date.now().toString(36);
            state.allFrames[id] = { x, y, w, h, px: Math.floor(w/2), py: h, assetId: state.activeAssetId };
            addFrameToTL(id);
        }
    } else if (['hitbox','hurtbox'].includes(state.currentMode) && state.activeAnim && state.selectedTLIndex !== null) {
        if (w > 2 && h > 2) {
            const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
            const f   = state.allFrames[tlf.frameId];
            if (f) {
                const box = { x: x-(f.x+f.px), y: y-(f.y+f.py), w, h };
                if (!tlf.hitboxes)  tlf.hitboxes  = [];
                if (!tlf.hurtboxes) tlf.hurtboxes = [];
                if (state.currentMode === 'hitbox') tlf.hitboxes.push(box);
                else                                tlf.hurtboxes.push(box);
                saveToLocal();
                if (document.getElementById('rp-tab-hitbox').classList.contains('tab-visible')) {
                    window.__renderHitboxPanel && window.__renderHitboxPanel();
                }
            }
        }
    }
    drawMainCanvas();
});

canvas.addEventListener('contextmenu', e => e.preventDefault());
canvas.addEventListener('mouseleave', () => { if (ds.isDrawing) { ds.isDrawing=false; drawMainCanvas(); } });

// Wheel zoom
wrap.addEventListener('wheel', e => {
    if (!state.activeAssetId) return;
    e.preventDefault();
    const prevZoom = state.currentZoom;
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    state.currentZoom = Math.max(0.25, Math.min(8, state.currentZoom + delta));
    if (state.currentZoom !== prevZoom) {
        const ratio = state.currentZoom / prevZoom;
        applyZoom();
        wrap.scrollLeft = (wrap.scrollLeft + e.clientX - wrap.getBoundingClientRect().left) * ratio - (e.clientX - wrap.getBoundingClientRect().left);
        wrap.scrollTop  = (wrap.scrollTop  + e.clientY - wrap.getBoundingClientRect().top)  * ratio - (e.clientY - wrap.getBoundingClientRect().top);
    }
}, { passive:false });

// Drag-and-drop sobre canvas wrapper
wrap.addEventListener('dragover', e => { e.preventDefault(); document.getElementById('drop-overlay').style.display='flex'; });
wrap.addEventListener('dragleave', () => { document.getElementById('drop-overlay').style.display='none'; });
wrap.addEventListener('drop', e => {
    e.preventDefault();
    document.getElementById('drop-overlay').style.display='none';
    const f = e.dataTransfer.files[0]; if (!f) return;
    if (f.type.startsWith('image/')) loadImageFile(f);
    if (f.name.endsWith('.json')) loadJSONFile(f);
});

// File inputs
document.getElementById('file-input').addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) { loadImageFile(f); e.target.value=''; }
});

// Teclado
document.addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (e.key==='d'||e.key==='D') setMode('draw');
    if (e.key==='s'||e.key==='S') setMode('select');
    if (e.key==='e'||e.key==='E') setMode('editbox');
    if (e.key==='p'||e.key==='P') setMode('pivot');
    if (e.key==='h'||e.key==='H') setMode('pan');
    if (e.key==='Delete'||e.key==='Backspace') {
        if (state.selectedCollisionBox && state.currentMode==='editbox') deleteSelectedBox();
        else removeSelectedFrame();
    }
    if ((e.ctrlKey||e.metaKey)&&(e.key==='d'||e.key==='D')) { e.preventDefault(); duplicateActiveFrame(); }
    if (e.key==='ArrowLeft'  && state.selectedTLIndex !== null) { e.preventDefault(); selectTLFrame(Math.max(0, state.selectedTLIndex-1)); }
    if (e.key==='ArrowRight' && state.selectedTLIndex !== null && state.activeAnim) {
        e.preventDefault();
        selectTLFrame(Math.min(state.animations[state.activeAnim].timeline.length-1, state.selectedTLIndex+1));
    }
    if (e.key===' ') { e.preventDefault(); togglePlay(); }
    if (e.key==='Escape') { state.selectedCollisionBox=null; hideBoxEditTooltip(); drawMainCanvas(); }
});

// Tabs
function switchRPTab(tab) {
    document.querySelectorAll('.rp-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab===tab));
    ['atlas','hitbox','moveset','char'].forEach(t => {
        const el = document.getElementById('rp-tab-'+t);
        if (el) el.classList.toggle('tab-visible', t===tab);
    });
    if (tab==='hitbox')  window.__renderHitboxPanel  && window.__renderHitboxPanel();
    if (tab==='moveset') window.__renderMovesetPanel && window.__renderMovesetPanel();
    if (tab==='char')    window.__renderCharPanel    && window.__renderCharPanel();
}

// Hitbox panel helpers (inline)
function selectBox(type, idx) {
    state.selectedCollisionBox = { type, idx };
    if (state.currentMode !== 'editbox') setMode('editbox');
    showBoxEditTooltip(); drawMainCanvas();
    window.__renderHitboxPanel && window.__renderHitboxPanel();
}

function removeBox(type, idx) {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    const arr = type==='hitbox' ? tlf.hitboxes : tlf.hurtboxes;
    if (arr) arr.splice(idx, 1);
    if (state.selectedCollisionBox && state.selectedCollisionBox.type===type && state.selectedCollisionBox.idx===idx) {
        state.selectedCollisionBox=null; hideBoxEditTooltip();
    }
    drawMainCanvas(); window.__renderHitboxPanel && window.__renderHitboxPanel(); saveToLocal();
}

function copyBoxesToNext() {
    if (!state.activeAnim || state.selectedTLIndex===null) return;
    const tl=state.animations[state.activeAnim].timeline, next=state.selectedTLIndex+1;
    if (next>=tl.length) { alert('No hay siguiente frame.'); return; }
    const src=tl[state.selectedTLIndex];
    tl[next].hitboxes  = JSON.parse(JSON.stringify(src.hitboxes  || []));
    tl[next].hurtboxes = JSON.parse(JSON.stringify(src.hurtboxes || []));
    saveToLocal(); alert('✓ Cajas copiadas al frame '+next+'.');
}

function copyBoxesToAll() {
    if (!state.activeAnim || state.selectedTLIndex===null) return;
    if (!confirm('¿Copiar las cajas de este frame a TODOS los demás?')) return;
    const tl=state.animations[state.activeAnim].timeline;
    const src=tl[state.selectedTLIndex];
    tl.forEach((f,i) => {
        if (i===state.selectedTLIndex) return;
        f.hitboxes  = JSON.parse(JSON.stringify(src.hitboxes  || []));
        f.hurtboxes = JSON.parse(JSON.stringify(src.hurtboxes || []));
    });
    saveToLocal(); alert('✓ Cajas copiadas a todos los frames.');
}

function clearAllBoxes() {
    if (!state.activeAnim || state.selectedTLIndex===null) return;
    if (!confirm('¿Limpiar todas las cajas del frame actual?')) return;
    const tlf=state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    tlf.hitboxes=[]; tlf.hurtboxes=[];
    state.selectedCollisionBox=null; hideBoxEditTooltip();
    drawMainCanvas(); window.__renderHitboxPanel && window.__renderHitboxPanel(); saveToLocal();
}

// Exponer al HTML (sin bundler)
Object.assign(window, {
    // Proyectos
    projectNew, projectSave, projectSaveAs, projectLoad, projectDelete,
    renderProjectPanel,
    // Animaciones
    addAnimation, setActiveAnim, setMode,
    changeZoom, resetZoom, runAutoSlice,
    togglePlay, startHold, endHold, resetPreview,
    // Timeline
    duplicateActiveFrame, removeSelectedFrame,
    selectTLFrame, setPhaseMarker,
    updateAnimProp, updateTLFrameProps,
    updateSelectedPivot, resetSelectedPivot,
    // Export / Import
    exportJSON, exportMovesetJSON, exportCharJSON,
    importJSON, importMovesetJSON, clearAll,
    // Boxes
    applyBoxEdit, deleteSelectedBox, closeBoxEditTooltip,
    selectBox, removeBox, copyBoxesToNext, copyBoxesToAll, clearAllBoxes,
    // Tabs
    switchRPTab,
});
window.__refreshMainCanvas = drawMainCanvas;
// Init
loadFromLocal();
renderAssetPanel();
updateUI();
switchRPTab('atlas');
renderProjectPanel();