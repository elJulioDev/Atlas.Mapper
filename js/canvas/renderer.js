import { state, activeImage, imageForFrame } from '../core/state.js';

const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');
const wrap   = document.getElementById('canvas-wrapper');

export { canvas, ctx, wrap };

// Zoom

export function applyZoom() {
    const img = activeImage();
    if (!img || !img.src) return;
    document.getElementById('zoom-label').innerText = Math.round(state.currentZoom * 100) + '%';
    canvas.width  = img.width;
    canvas.height = img.height;
    canvas.style.width  = img.width  * state.currentZoom + 'px';
    canvas.style.height = img.height * state.currentZoom + 'px';
    drawMainCanvas();
}

export function changeZoom(d) {
    state.currentZoom = Math.max(0.25, Math.min(8, state.currentZoom + d));
    applyZoom();
}

export function resetZoom() { state.currentZoom = 1; applyZoom(); }

// Coordenadas canvas

export function getPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
        x: Math.round((e.clientX - r.left) * (canvas.width  / r.width)),
        y: Math.round((e.clientY - r.top)  * (canvas.height / r.height))
    };
}

// Draw principal

export function drawMainCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = activeImage();
    if (img && img.complete && img.naturalWidth) ctx.drawImage(img, 0, 0);

    // Auto-slice boxes
    if (state.autoSlicedBoxes.length > 0) {
        ctx.strokeStyle = 'rgba(52,152,219,0.4)';
        ctx.setLineDash([3, 3]);
        state.autoSlicedBoxes.forEach(b => ctx.strokeRect(b.x + .5, b.y + .5, b.w, b.h));
        ctx.setLineDash([]);
    }

    // Frames base (solo los del asset activo)
    ctx.lineWidth = 1;
    for (const id in state.allFrames) {
        const f = state.allFrames[id];
        if (f.assetId !== state.activeAssetId) continue;
        const sel = state.selectedBaseFrameId === id;
        ctx.strokeStyle = sel ? '#e67e22' : 'rgba(255,255,255,0.25)';
        ctx.strokeRect(f.x + .5, f.y + .5, f.w, f.h);
        if (sel) {
            ctx.fillStyle = 'rgba(230,126,34,0.12)';
            ctx.fillRect(f.x, f.y, f.w, f.h);
            ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(f.x + f.px - 7, f.y + f.py); ctx.lineTo(f.x + f.px + 7, f.y + f.py);
            ctx.moveTo(f.x + f.px, f.y + f.py - 7); ctx.lineTo(f.x + f.px, f.y + f.py + 7);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    }

    // Fase de animación activa
    if (state.activeAnim && state.animations[state.activeAnim]) {
        const anim = state.animations[state.activeAnim];
        anim.timeline.forEach((t, i) => {
            const f = state.allFrames[t.frameId];
            if (!f || f.assetId !== state.activeAssetId) return;
            const phase  = getPhase(anim, i);
            const colors = { intro: 'rgba(52,152,219,0.15)', loop: 'rgba(46,204,113,0.15)', outro: 'rgba(230,126,34,0.15)', none: 'rgba(255,255,255,0.05)' };
            ctx.fillStyle = colors[phase] || colors.none;
            ctx.fillRect(f.x, f.y, f.w, f.h);
        });
    }

    // Rectángulo en dibujo activo
    const ds = window.__drawState;
    if (ds && ds.isDrawing) {
        ctx.strokeStyle = state.currentMode === 'hitbox' ? '#e74c3c' : (state.currentMode === 'hurtbox' ? '#2ecc71' : '#d35400');
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(Math.min(ds.startX, ds.curX) + .5, Math.min(ds.startY, ds.curY) + .5, Math.abs(ds.curX - ds.startX), Math.abs(ds.curY - ds.startY));
        ctx.setLineDash([]);
    }

    // Hitboxes / hurtboxes del frame seleccionado
    const showBoxes = (['hitbox', 'hurtbox', 'editbox', 'select'].includes(state.currentMode)) &&
                      state.activeAnim && state.selectedTLIndex !== null;
    if (showBoxes) {
        const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
        const f   = state.allFrames[tlf && tlf.frameId];
        if (f && tlf && f.assetId === state.activeAssetId) {
            const pivotX = f.x + f.px;
            const pivotY = f.y + f.py;
            drawCollisionBoxes(tlf, pivotX, pivotY);
            // Pivot cross
            ctx.fillStyle = '#f1c40f';
            ctx.fillRect(pivotX - 2, pivotY - 2, 4, 4);
        }
    }
}

function drawCollisionBoxes(tlf, pivotX, pivotY) {
    const scb = state.selectedCollisionBox;
    // Hurtboxes
    (tlf.hurtboxes || []).forEach((box, i) => {
        const sel = scb && scb.type === 'hurtbox' && scb.idx === i;
        ctx.fillStyle   = sel ? 'rgba(46,204,113,0.55)' : 'rgba(46,204,113,0.35)';
        ctx.strokeStyle = sel ? '#00ff88' : '#2ecc71';
        ctx.lineWidth   = sel ? 2 : 1;
        ctx.fillRect(pivotX + box.x, pivotY + box.y, box.w, box.h);
        ctx.strokeRect(pivotX + box.x + .5, pivotY + box.y + .5, box.w, box.h);
        if (sel && state.currentMode === 'editbox') drawBoxHandles(pivotX + box.x, pivotY + box.y, box.w, box.h, '#00ff88');
        ctx.lineWidth = 1;
    });
    // Hitboxes
    (tlf.hitboxes || []).forEach((box, i) => {
        const sel = scb && scb.type === 'hitbox' && scb.idx === i;
        ctx.fillStyle   = sel ? 'rgba(231,76,60,0.55)' : 'rgba(231,76,60,0.35)';
        ctx.strokeStyle = sel ? '#ff4466' : '#e74c3c';
        ctx.lineWidth   = sel ? 2 : 1;
        ctx.fillRect(pivotX + box.x, pivotY + box.y, box.w, box.h);
        ctx.strokeRect(pivotX + box.x + .5, pivotY + box.y + .5, box.w, box.h);
        if (sel && state.currentMode === 'editbox') drawBoxHandles(pivotX + box.x, pivotY + box.y, box.w, box.h, '#ff4466');
        ctx.lineWidth = 1;
    });
}

export function drawBoxHandles(bx, by, bw, bh, color) {
    const hs = 6 / state.currentZoom;
    const positions = [
        [bx - hs/2, by - hs/2], [bx+bw/2 - hs/2, by - hs/2], [bx+bw - hs/2, by - hs/2],
        [bx+bw - hs/2, by+bh/2 - hs/2], [bx+bw - hs/2, by+bh - hs/2],
        [bx+bw/2 - hs/2, by+bh - hs/2], [bx - hs/2, by+bh - hs/2],
        [bx - hs/2, by+bh/2 - hs/2]
    ];
    ctx.fillStyle = color;
    positions.forEach(([hx, hy]) => ctx.fillRect(hx, hy, hs, hs));
    ctx.strokeStyle = '#000'; ctx.lineWidth = 0.5;
    positions.forEach(([hx, hy]) => ctx.strokeRect(hx + .25, hy + .25, hs - .5, hs - .5));
    ctx.lineWidth = 1;
}

// Helpers compartidos

export function getPhase(anim, idx) {
    if (anim.type !== 'held') return 'none';
    const ls = anim.loop_start  ?? 1;
    const os = anim.outro_start ?? 2;
    if (idx < ls) return 'intro';
    if (idx < os) return 'loop';
    return 'outro';
}

export function getPivotForCurrentFrame() {
    if (!state.activeAnim || state.selectedTLIndex === null) return null;
    const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    if (!tlf) return null;
    const f = state.allFrames[tlf.frameId];
    if (!f) return null;
    return { px: f.x + f.px, py: f.y + f.py };
}

export function getBoxesForCurrentFrame() {
    if (!state.activeAnim || state.selectedTLIndex === null) return null;
    return state.animations[state.activeAnim].timeline[state.selectedTLIndex] || null;
}

// Auto-slice

export function runAutoSlice() {
    const img = activeImage();
    if (!img || !img.naturalWidth) { alert('Carga una imagen primero.'); return; }
    state.autoSlicedBoxes = [];
    const tc = document.createElement('canvas');
    tc.width = img.width; tc.height = img.height;
    const tCtx = tc.getContext('2d'); tCtx.drawImage(img, 0, 0);
    const data = tCtx.getImageData(0, 0, img.width, img.height).data;
    const vis  = new Uint8Array(img.width * img.height);
    const W    = img.width;

    for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < W; x++) {
            if (data[(y*W+x)*4+3] > 10 && !vis[y*W+x]) {
                let minX=x,maxX=x,minY=y,maxY=y;
                const stk=[[x,y]]; vis[y*W+x]=1;
                while (stk.length) {
                    const [cx,cy]=stk.pop();
                    if(cx<minX)minX=cx; if(cx>maxX)maxX=cx;
                    if(cy<minY)minY=cy; if(cy>maxY)maxY=cy;
                    for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
                        const nx=cx+dx,ny=cy+dy;
                        if(nx>=0&&nx<W&&ny>=0&&ny<img.height&&!vis[ny*W+nx]&&data[(ny*W+nx)*4+3]>10){
                            vis[ny*W+nx]=1; stk.push([nx,ny]);
                        }
                    }
                }
                if(maxX-minX>=4&&maxY-minY>=4)
                    state.autoSlicedBoxes.push({x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1});
            }
        }
    }
    document.getElementById('canvas-info').innerText = state.autoSlicedBoxes.length + ' sprites detectados';
    drawMainCanvas();
}