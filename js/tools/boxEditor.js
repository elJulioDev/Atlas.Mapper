import { state, saveToLocal }              from '../core/state.js';
import { canvas, drawMainCanvas,
         drawBoxHandles, getPos,
         getPivotForCurrentFrame,
         getBoxesForCurrentFrame }         from '../canvas/renderer.js';

const HANDLE_SIZE = 6;

let isDraggingBox = false;
let isResizingBox = false;
let dragBoxOffset = { x: 0, y: 0 };
let resizeHandle  = null;
let boxDragStart  = null;

// Resuelve el box actualmente seleccionado desde cualquier fuente
function _getActiveBox() {
    const scb = state.selectedCollisionBox;
    if (!scb) return null;
    if (scb.type === 'base_hurtbox') {
        const anim = state.activeAnim ? state.animations[state.activeAnim] : null;
        return anim?.base_hurtboxes?.[scb.idx] ?? null;
    }
    const tlf = getBoxesForCurrentFrame();
    if (!tlf) return null;
    const arr = scb.type === 'hitbox' ? tlf.hitboxes : tlf.hurtboxes;
    return arr?.[scb.idx] ?? null;
}

export function hitTestBox(box, pivotX, pivotY, cx, cy) {
    const bx = pivotX + box.x;
    const by = pivotY + box.y;
    const hs = HANDLE_SIZE / state.currentZoom;
    const handles = {
        nw:[bx-hs/2, by-hs/2], n:[bx+box.w/2-hs/2, by-hs/2], ne:[bx+box.w-hs/2, by-hs/2],
        e:[bx+box.w-hs/2, by+box.h/2-hs/2], se:[bx+box.w-hs/2, by+box.h-hs/2],
        s:[bx+box.w/2-hs/2, by+box.h-hs/2], sw:[bx-hs/2, by+box.h-hs/2],
        w:[bx-hs/2, by+box.h/2-hs/2]
    };
    for (const [name, [hx, hy]] of Object.entries(handles)) {
        if (cx >= hx && cx <= hx+hs && cy >= hy && cy <= hy+hs) return name;
    }
    if (cx >= bx && cx <= bx+box.w && cy >= by && cy <= by+box.h) return 'body';
    return null;
}

export function onEditBoxMouseDown(p) {
    const pivot = getPivotForCurrentFrame();
    const tlf   = getBoxesForCurrentFrame();
    if (!pivot || !tlf) return;

    const anim    = state.activeAnim ? state.animations[state.activeAnim] : null;
    const baseHrt = anim?.base_hurtboxes || [];
    const useBase = (tlf.hurtboxes || []).length === 0 && baseHrt.length > 0;

    const sources = [
        { type: 'hitbox',                              arr: tlf.hitboxes  || [] },
        { type: useBase ? 'base_hurtbox' : 'hurtbox', arr: useBase ? baseHrt : (tlf.hurtboxes || []) }
    ];

    let found = false;
    outer: for (const { type, arr } of sources) {
        for (let i = arr.length - 1; i >= 0; i--) {
            const hit = hitTestBox(arr[i], pivot.px, pivot.py, p.x, p.y);
            if (!hit) continue;
            state.selectedCollisionBox = { type, idx: i };
            if (hit === 'body') {
                isDraggingBox = true;
                dragBoxOffset = { x: p.x - (pivot.px + arr[i].x), y: p.y - (pivot.py + arr[i].y) };
            } else {
                isResizingBox = true; resizeHandle = hit;
                const b = arr[i];
                boxDragStart = { bx:b.x, by:b.y, bw:b.w, bh:b.h, mx:p.x, my:p.y };
            }
            showBoxEditTooltip(); drawMainCanvas(); found = true; break outer;
        }
    }
    if (!found) { state.selectedCollisionBox = null; hideBoxEditTooltip(); drawMainCanvas(); }
}

export function onEditBoxMouseMove(p) {
    if (!isDraggingBox && !isResizingBox) return;
    const pivot = getPivotForCurrentFrame();
    if (!pivot) return;
    const b = _getActiveBox();
    if (!b) return;

    if (isDraggingBox) {
        b.x = p.x - pivot.px - dragBoxOffset.x;
        b.y = p.y - pivot.py - dragBoxOffset.y;
    } else if (isResizingBox && boxDragStart) {
        const dx = p.x - boxDragStart.mx, dy = p.y - boxDragStart.my;
        let nx=boxDragStart.bx, ny=boxDragStart.by, nw=boxDragStart.bw, nh=boxDragStart.bh;
        if (resizeHandle.includes('e')) nw = Math.max(2, boxDragStart.bw + dx);
        if (resizeHandle.includes('s')) nh = Math.max(2, boxDragStart.bh + dy);
        if (resizeHandle.includes('w')) { nw = Math.max(2, boxDragStart.bw - dx); nx = boxDragStart.bx + (boxDragStart.bw - nw); }
        if (resizeHandle.includes('n')) { nh = Math.max(2, boxDragStart.bh - dy); ny = boxDragStart.by + (boxDragStart.bh - nh); }
        b.x=nx; b.y=ny; b.w=nw; b.h=nh;
    }
    drawMainCanvas();
}

export function onEditBoxMouseUp() {
    if (!isDraggingBox && !isResizingBox) return;
    isDraggingBox = isResizingBox = false;
    resizeHandle = boxDragStart = null;
    if (state.hurtboxSyncMode && state.selectedCollisionBox?.type === 'hurtbox') _syncHurtboxes();
    saveToLocal();
    if (typeof window.__renderHitboxPanel === 'function') window.__renderHitboxPanel();
    showBoxEditTooltip();
}

function _syncHurtboxes() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const tl   = state.animations[state.activeAnim].timeline;
    const copy = JSON.parse(JSON.stringify(tl[state.selectedTLIndex].hurtboxes || []));
    tl.forEach((t, i) => { if (i !== state.selectedTLIndex) t.hurtboxes = copy; });
}

export function showBoxEditTooltip() {
    if (!state.selectedCollisionBox) return;
    const b = _getActiveBox();
    if (!b) return;
    const tip = document.getElementById('box-edit-tooltip');
    document.getElementById('bet-x').value = b.x;
    document.getElementById('bet-y').value = b.y;
    document.getElementById('bet-w').value = b.w;
    document.getElementById('bet-h').value = b.h;
    tip.style.display = 'flex';
    const canvasRect = canvas.getBoundingClientRect();
    const pivot = getPivotForCurrentFrame();
    if (pivot) {
        const scX = (pivot.px + b.x) * state.currentZoom + canvasRect.left;
        const scY = (pivot.py + b.y) * state.currentZoom + canvasRect.top - 70;
        tip.style.left = Math.max(10, Math.min(window.innerWidth - 320, scX)) + 'px';
        tip.style.top  = Math.max(10, scY) + 'px';
    }
}

export function hideBoxEditTooltip() {
    document.getElementById('box-edit-tooltip').style.display = 'none';
}

export function applyBoxEdit() {
    const b = _getActiveBox();
    if (!b) return;
    b.x = parseInt(document.getElementById('bet-x').value) || 0;
    b.y = parseInt(document.getElementById('bet-y').value) || 0;
    b.w = Math.max(1, parseInt(document.getElementById('bet-w').value) || 1);
    b.h = Math.max(1, parseInt(document.getElementById('bet-h').value) || 1);
    if (state.hurtboxSyncMode && state.selectedCollisionBox?.type === 'hurtbox') _syncHurtboxes();
    saveToLocal(); drawMainCanvas();
    if (typeof window.__renderHitboxPanel === 'function') window.__renderHitboxPanel();
}

export function deleteSelectedBox() {
    const scb = state.selectedCollisionBox;
    if (!scb) return;
    if (scb.type === 'base_hurtbox') {
        const anim = state.activeAnim ? state.animations[state.activeAnim] : null;
        if (anim?.base_hurtboxes) anim.base_hurtboxes.splice(scb.idx, 1);
    } else {
        const tlf = getBoxesForCurrentFrame();
        if (!tlf) return;
        const arr = scb.type === 'hitbox' ? tlf.hitboxes : tlf.hurtboxes;
        if (arr) arr.splice(scb.idx, 1);
    }
    state.selectedCollisionBox = null;
    hideBoxEditTooltip(); saveToLocal(); drawMainCanvas();
    if (typeof window.__renderHitboxPanel === 'function') window.__renderHitboxPanel();
}

export function closeBoxEditTooltip() {
    state.selectedCollisionBox = null;
    hideBoxEditTooltip();
    drawMainCanvas();
}