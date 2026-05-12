import { state, saveToLocal }       from '../core/state.js';
import { drawMainCanvas, getPhase,
         getPivotForCurrentFrame }  from '../canvas/renderer.js';
import { hideBoxEditTooltip }       from './boxEditor.js';
import { resetPreview, setPvIdx }   from '../canvas/preview.js';

let dragSrcIdx = null;

// Selección

export function selectTLFrame(idx) {
    state.selectedTLIndex = idx;
    if (state.activeAnim && state.animations[state.activeAnim].timeline[idx]) {
        state.selectedBaseFrameId = state.animations[state.activeAnim].timeline[idx].frameId;
        setPvIdx(idx);
    }
    state.selectedCollisionBox = null;
    hideBoxEditTooltip();
    renderTimelineStrip();
    renderRightPanel();
    drawMainCanvas();
    const active = document.querySelector('.rp-tab.active');
    if (!active) return;
    if (active.dataset.tab === 'hitbox')  window.__renderHitboxPanel && window.__renderHitboxPanel();
}

export function addFrameToTL(frameId) {
    if (!state.activeAnim) return;
    const anim = state.animations[state.activeAnim];
    anim.timeline.push({ frameId, events:'', duration:null, hitboxes:[], hurtboxes:[] });
    const idx = anim.timeline.length - 1;
    state.selectedTLIndex  = idx;
    state.selectedBaseFrameId = frameId;
    setPvIdx(idx);
    if (anim.type === 'held') {
        const len = anim.timeline.length;
        if (!anim.loop_start  || anim.loop_start  < 1) anim.loop_start  = 1;
        if (!anim.outro_start || anim.outro_start <= anim.loop_start) anim.outro_start = Math.max(anim.loop_start + 1, len - 1);
        anim.loop_start  = Math.min(anim.loop_start,  len - 1);
        anim.outro_start = Math.min(anim.outro_start, len);
    }
    updateUI(); saveToLocal();
}

export function removeSelectedFrame() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    state.animations[state.activeAnim].timeline.splice(state.selectedTLIndex, 1);
    state.selectedTLIndex = null;
    updateUI(); saveToLocal();
}

export function duplicateActiveFrame() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const tl   = state.animations[state.activeAnim].timeline;
    const copy = JSON.parse(JSON.stringify(tl[state.selectedTLIndex]));
    tl.splice(state.selectedTLIndex + 1, 0, copy);
    state.selectedTLIndex++;
    setPvIdx(state.selectedTLIndex);
    updateUI(); saveToLocal();
}

export function moveFrame(from, to) {
    if (from === to || !state.activeAnim) return;
    const tl   = state.animations[state.activeAnim].timeline;
    const item = tl.splice(from, 1)[0];
    tl.splice(to, 0, item);
    state.selectedTLIndex = to;
    setPvIdx(to);
    updateUI(); saveToLocal();
}

export function setPhaseMarker(phase) {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const anim = state.animations[state.activeAnim];
    if (phase === 'loop') {
        anim.loop_start = state.selectedTLIndex;
        if (anim.outro_start <= anim.loop_start) anim.outro_start = anim.loop_start + 1;
    } else {
        anim.outro_start = state.selectedTLIndex;
        if (anim.outro_start <= anim.loop_start) anim.loop_start = Math.max(0, anim.outro_start - 1);
    }
    document.getElementById('prop-loop-start').value  = anim.loop_start;
    document.getElementById('prop-outro-start').value = anim.outro_start;
    renderTimelineStrip(); renderRightPanel(); saveToLocal();
}

// Render strip

export function renderTimelineStrip() {
    const container = document.getElementById('timeline-frames');
    const label     = document.getElementById('tl-anim-label');
    const legend    = document.getElementById('tl-phase-legend');

    if (!state.activeAnim || !state.animations[state.activeAnim]) {
        label.textContent = 'SIN ANIMACIÓN';
        legend.innerHTML  = '';
        container.innerHTML = '<div class="tl-empty">Selecciona una animación y recorta sprites en el canvas</div>';
        return;
    }

    const anim = state.animations[state.activeAnim];
    label.textContent = state.activeAnim;
    legend.innerHTML  = anim.type === 'held'
        ? '<span style="color:var(--phase-i-b);">■ Intro</span> <span style="color:var(--phase-l-b);margin-left:6px;">■ Loop</span> <span style="color:var(--phase-o-b);margin-left:6px;">■ Outro</span>'
        : '';

    container.innerHTML = '';
    if (!anim.timeline.length) {
        container.innerHTML = '<div class="tl-empty">Haz clic en el canvas para añadir frames</div>';
        return;
    }

    anim.timeline.forEach((t, idx) => {
        const phase  = getPhase(anim, idx);
        const isSel  = state.selectedTLIndex === idx;
        const hasHit = t.hitboxes  && t.hitboxes.length  > 0;
        const hasHrt = t.hurtboxes && t.hurtboxes.length > 0;

        let phaseLabel = '';
        if (anim.type === 'held') {
            if (idx === 0)                     phaseLabel = '<div class="tl-phase-label" style="color:var(--phase-i-b);">INTRO</div>';
            else if (idx === anim.loop_start)  phaseLabel = '<div class="tl-phase-label" style="color:var(--phase-l-b);">LOOP ↻</div>';
            else if (idx === anim.outro_start) phaseLabel = '<div class="tl-phase-label" style="color:var(--phase-o-b);">OUTRO</div>';
        }

        const el = document.createElement('div');
        el.className = 'tl-frame' + (isSel ? ' selected' : '') + (phase !== 'none' ? ' phase-' + phase : '');
        el.draggable   = true;
        el.dataset.idx = idx;

        const thumbId  = 'th_' + idx + '_' + t.frameId;
        const durLabel = t.duration ? `<div class="tl-dur-badge">${t.duration}ms</div>` : '';
        const usesBaseHrt = !hasHrt && anim.base_hurtboxes?.length > 0;
        const boxDots = [
            hasHrt    ? '<span class="tl-box-dot" style="background:#2ecc71;" title="Hurtbox frame"></span>' : '',
            usesBaseHrt ? '<span class="tl-box-dot" style="background:#0d4020;border:1px dashed #2ecc71;" title="Hurtbox base"></span>' : '',
            hasHit    ? '<span class="tl-box-dot" style="background:#e74c3c;" title="Hitbox"></span>' : ''
        ].join('');

        el.innerHTML = `
            ${phaseLabel}
            <div class="tl-thumb"><canvas id="${thumbId}" width="50" height="50"></canvas></div>
            <div class="tl-index">${idx}</div>
            <div class="tl-badges">
                ${t.events ? '<div class="tl-evdot" title="' + t.events.replace(/"/g,"'") + '"></div>' : ''}
                ${boxDots}
            </div>
            ${durLabel}
        `;

        el.addEventListener('click',     () => selectTLFrame(idx));
        el.addEventListener('contextmenu', e => showCtxMenu(e, idx));
        el.addEventListener('dragstart', () => { dragSrcIdx = idx; el.classList.add('dragging'); });
        el.addEventListener('dragend',   () => { el.classList.remove('dragging'); container.querySelectorAll('.drag-over').forEach(f=>f.classList.remove('drag-over')); });
        el.addEventListener('dragover',  e  => { e.preventDefault(); el.classList.add('drag-over'); });
        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));
        el.addEventListener('drop',      e  => { e.preventDefault(); el.classList.remove('drag-over'); moveFrame(dragSrcIdx, idx); });

        container.appendChild(el);
        requestAnimationFrame(() => drawThumb(thumbId, t.frameId));
    });

    const hint = document.createElement('div');
    hint.className = 'tl-add-hint';
    hint.innerHTML = '<i class="bi bi-plus" style="margin:0;font-size:18px;color:#303040;"></i>';
    container.appendChild(hint);

    if (state.selectedTLIndex !== null) {
        const sel = container.querySelector('.tl-frame.selected');
        if (sel) sel.scrollIntoView({ behavior:'smooth', inline:'nearest' });
    }
}

function drawThumb(canvasId, frameId) {
    const tc = document.getElementById(canvasId);
    if (!tc) return;
    const f = state.allFrames[frameId];
    if (!f) return;
    const { imageById } = window.__stateHelpers || {};
    // Importa imagen desde el assetId del frame
    const a = state.assets[f.assetId];
    const img = a ? a.imgObject : null;
    if (!img || !img.complete || !img.naturalWidth) return;
    const tCtx = tc.getContext('2d');
    tCtx.clearRect(0, 0, 50, 50);
    const scale = Math.min(50/f.w, 50/f.h);
    const dw = f.w*scale, dh = f.h*scale;
    tCtx.imageSmoothingEnabled = false;
    tCtx.drawImage(img, f.x, f.y, f.w, f.h, (50-dw)/2, (50-dh)/2, dw, dh);
}

// Panel derecho (propiedades de animación)

export function renderRightPanel() {
    const anim = state.activeAnim ? state.animations[state.activeAnim] : null;

    const animPropsEl = document.getElementById('anim-props');
    if (anim) {
        animPropsEl.style.display = 'block';
        document.getElementById('prop-fps').value  = anim.fps;
        document.getElementById('prop-type').value = anim.type;
        document.getElementById('prop-next').value = anim.next_anim || '';
    } else { animPropsEl.style.display = 'none'; }

    const phaseEl = document.getElementById('phase-controls');
    if (anim && anim.type === 'held') {
        phaseEl.style.display = 'block';
        document.getElementById('prop-loop-start').value  = anim.loop_start  ?? 1;
        document.getElementById('prop-outro-start').value = anim.outro_start ?? 2;
        document.getElementById('sel-frame-idx').textContent = state.selectedTLIndex !== null ? state.selectedTLIndex : '—';
    } else { phaseEl.style.display = 'none'; }

    const fpEl = document.getElementById('frame-props');
    if (state.selectedBaseFrameId && state.allFrames[state.selectedBaseFrameId]) {
        fpEl.style.display = 'block';
        document.getElementById('prop-px').value = state.allFrames[state.selectedBaseFrameId].px;
        document.getElementById('prop-py').value = state.allFrames[state.selectedBaseFrameId].py;
    } else { fpEl.style.display = 'none'; }

    const tlFpEl = document.getElementById('tl-frame-props');
    if (anim && state.selectedTLIndex !== null && anim.timeline[state.selectedTLIndex]) {
        tlFpEl.style.display = 'block';
        const tlf = anim.timeline[state.selectedTLIndex];
        document.getElementById('prop-events').value   = tlf.events   || '';
        document.getElementById('prop-duration').value = tlf.duration || '';
    } else { tlFpEl.style.display = 'none'; }
}

// Context menu

const ctxMenu = document.getElementById('ctx-menu');
let ctxCloseFn = null;

function showCtxMenu(e, idx) {
    e.preventDefault();
    if (ctxCloseFn) { document.removeEventListener('click', ctxCloseFn); ctxMenu.style.display='none'; }
    const anim = state.animations[state.activeAnim];

    ctxMenu.innerHTML = `
        <div class="ctx-item" onclick="ctxAction(()=>{window.__tl.selectTLFrame(${idx});window.__tl.duplicateActiveFrame();})">
            <i class="bi bi-copy icon"></i>
            Duplicar frame
        </div>
        ${anim && anim.type==='held' ? `
        <div class="ctx-sep"></div>
        <div class="ctx-item" onclick="ctxAction(()=>{window.__tl.selectTLFrame(${idx});window.__tl.setPhaseMarker('loop');})">
            <span style="color:var(--phase-l-b);">●</span> Marcar inicio Loop
        </div>
        <div class="ctx-item" onclick="ctxAction(()=>{window.__tl.selectTLFrame(${idx});window.__tl.setPhaseMarker('outro');})">
            <span style="color:var(--phase-o-b);">●</span> Marcar inicio Outro
        </div>` : ''}
        <div class="ctx-sep"></div>
        <div class="ctx-item danger" onclick="ctxAction(()=>{window.__tl.selectTLFrame(${idx});window.__tl.removeSelectedFrame();})">
            <i class="bi bi-trash3 icon"></i>
            Eliminar frame
        </div>
    `;
    ctxMenu.style.cssText = `display:block;left:${Math.min(e.clientX,window.innerWidth-180)}px;top:${Math.min(e.clientY,window.innerHeight-160)}px;`;
    ctxCloseFn = () => { ctxMenu.style.display='none'; ctxCloseFn=null; };
    setTimeout(() => document.addEventListener('click', ctxCloseFn, { once:true }), 10);
}

window.ctxAction = (fn) => { ctxMenu.style.display='none'; fn(); };

// updateUI global

export function updateUI() {
    renderAnimList();
    renderTimelineStrip();
    renderRightPanel();
    drawMainCanvas();
}

function renderAnimList() {
    const div   = document.getElementById('anim-list');
    const names = Object.keys(state.animations);
    if (!names.length) { div.innerHTML = '<div class="hint-empty">Añade una animación<br>para comenzar</div>'; return; }
    div.innerHTML = '';
    names.forEach(name => {
        const anim  = state.animations[name];
        const isAct = state.activeAnim === name;
        const badgeCls = { simple:'badge-simple', loop:'badge-loop', held:'badge-held' }[anim.type] || 'badge-simple';
        const el = document.createElement('div');
        el.className = 'anim-item' + (isAct ? ' active' : '');
        el.onclick   = () => window.__anims.setActiveAnim(name);
        el.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="overflow:hidden;">
                    <span class="anim-name" style="color:${isAct?'var(--accent)':'var(--text)'};">${name}</span>
                    <span class="type-badge ${badgeCls}">${anim.type.toUpperCase()}</span>
                </div>
                <div style="display:flex;gap:3px;flex-shrink:0;">
                    <button class="tool-btn btn-sm" onclick="event.stopPropagation();window.__anims.dupeAnim('${name}')" title="Duplicar">
                        <i class="bi bi-copy" style="margin:0;font-size:11px;"></i>
                    </button>
                    <button class="tool-btn btn-sm" style="color:#e88;" onclick="event.stopPropagation();window.__anims.deleteAnim('${name}')" title="Eliminar">
                        <i class="bi bi-trash3" style="margin:0;font-size:11px;"></i>
                    </button>
                </div>
            </div>
            <div class="anim-meta">${anim.timeline.length} frames · ${anim.fps} fps${anim.next_anim?' → '+anim.next_anim:''}</div>
        `;
        div.appendChild(el);
    });
}