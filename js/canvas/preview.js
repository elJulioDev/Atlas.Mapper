import { state, imageForFrame, imageById } from '../core/state.js';
import { getPhase } from './renderer.js';

const pCanvas = document.getElementById('preview-canvas');
const pCtx    = pCanvas.getContext('2d');

let pvIdx      = 0;
let pvState    = 'idle';
let pvHeld     = false;
let pvPlaying  = false;
let pvLastTime = 0;
window.lastPvScale = 2;

// Coordenadas hover
const pvCoords = document.getElementById('pv-coords');
pCanvas.addEventListener('mousemove', e => {
    const r  = pCanvas.getBoundingClientRect();
    const cx = Math.floor(pCanvas.width / 2);
    const cy = Math.floor(pCanvas.height * 0.8);
    const pxX = Math.floor((e.clientX - r.left - cx) / window.lastPvScale);
    const pxY = Math.floor((e.clientY - r.top  - cy) / window.lastPvScale);
    pvCoords.innerText = `X: ${pxX}, Y: ${pxY}`;
    pvCoords.style.display = 'block';
});
pCanvas.addEventListener('mouseleave', () => { pvCoords.style.display = 'none'; });

// Controles públicos

export function togglePlay() {
    pvPlaying = !pvPlaying;
    const btn = document.getElementById('pv-play');
    const txt = document.getElementById('pv-play-text');
    btn.classList.toggle('active', pvPlaying);
    if (pvPlaying) {
        pvIdx = 0; pvState = 'playing';
        txt.textContent = 'Stop';
        btn.querySelector('svg').innerHTML = '<path d="M5 3.5h6A1.5 1.5 0 0 1 12.5 5v6a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 11V5A1.5 1.5 0 0 1 5 3.5z"/>';
    } else {
        pvState = 'idle';
        txt.textContent = 'Play';
        btn.querySelector('svg').innerHTML = '<path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>';
    }
}

export function startHold() {
    pvHeld = true;
    document.getElementById('pv-hold').classList.add('holding');
    const anim = state.activeAnim ? state.animations[state.activeAnim] : null;
    if (anim && anim.type === 'held') { pvState = 'intro'; pvIdx = 0; pvPlaying = true; }
}

export function endHold() {
    pvHeld = false;
    document.getElementById('pv-hold').classList.remove('holding');
    const anim = state.activeAnim ? state.animations[state.activeAnim] : null;
    if (anim && anim.type === 'held' && pvState === 'loop') {
        pvState = 'outro'; pvIdx = anim.outro_start ?? anim.timeline.length - 1;
    }
}

export function resetPreview() {
    pvIdx = 0; pvPlaying = false; pvHeld = false; pvState = 'idle';
    const pb  = document.getElementById('pv-play');
    const txt = document.getElementById('pv-play-text');
    pb.classList.remove('active');
    txt.textContent = 'Play';
    pb.querySelector('svg').innerHTML = '<path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>';
    document.getElementById('pv-hold').classList.remove('holding', 'active');
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
}

export function setPvIdx(idx) { pvIdx = idx; }

// Loop de render

function renderPreview(time) {
    requestAnimationFrame(renderPreview);
    if (!state.activeAnim || !state.animations[state.activeAnim]) return;
    const anim = state.animations[state.activeAnim];
    if (!anim.timeline.length) return;

    const curTLF   = anim.timeline[Math.min(pvIdx, anim.timeline.length - 1)];
    const interval = curTLF && curTLF.duration ? curTLF.duration : (1000 / (anim.fps || 12));
    if (time - pvLastTime < interval) return;
    pvLastTime = time;

    if (pvPlaying) {
        const len = anim.timeline.length;
        const ls  = anim.loop_start  ?? 1;
        const os  = Math.min(anim.outro_start ?? 2, len);

        if (anim.type === 'held') {
            if (pvState === 'intro') {
                pvIdx++;
                if (pvIdx >= ls) { pvState = pvHeld ? 'loop' : 'outro'; pvIdx = pvHeld ? ls : os; }
            } else if (pvState === 'loop') {
                pvIdx++;
                if (pvIdx >= os) pvIdx = ls;
                if (!pvHeld) { pvState = 'outro'; pvIdx = os; }
            } else if (pvState === 'outro') {
                pvIdx++;
                if (pvIdx >= len) { _stopPlay(); }
            } else { pvIdx++; if (pvIdx >= len) pvIdx = 0; }
        } else if (anim.type === 'loop') {
            pvIdx++; if (pvIdx >= len) pvIdx = 0;
        } else {
            pvIdx++; if (pvIdx >= len) { pvIdx = len - 1; _stopPlay(); }
        }
    }

    const safe = Math.min(pvIdx, anim.timeline.length - 1);
    const tlf  = anim.timeline[safe];
    const f    = tlf ? state.allFrames[tlf.frameId] : null;

    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

    // Calcular escala óptima
    let maxW = 1, maxH = 1;
    anim.timeline.forEach(t => {
        const fr = state.allFrames[t.frameId];
        if (fr) { maxW = Math.max(maxW, fr.w); maxH = Math.max(maxH, fr.h); }
    });
    let scale = Math.floor(Math.min((pCanvas.width - 40) / maxW, (pCanvas.height - 40) / maxH));
    if (scale < 1) scale = 1; if (scale > 8) scale = 8;
    window.lastPvScale = scale;

    const cx = Math.floor(pCanvas.width / 2);
    const cy = Math.floor(pCanvas.height * 0.8);

    // Grid pixel
    if (scale >= 3) {
        pCtx.strokeStyle = 'rgba(255,255,255,0.08)'; pCtx.lineWidth = 1; pCtx.beginPath();
        for(let x=0;cx+x*scale<=pCanvas.width;x++){pCtx.moveTo(cx+x*scale+.5,0);pCtx.lineTo(cx+x*scale+.5,pCanvas.height);}
        for(let x=1;cx-x*scale>=0;x++){pCtx.moveTo(cx-x*scale+.5,0);pCtx.lineTo(cx-x*scale+.5,pCanvas.height);}
        for(let y=0;cy+y*scale<=pCanvas.height;y++){pCtx.moveTo(0,cy+y*scale+.5);pCtx.lineTo(pCanvas.width,cy+y*scale+.5);}
        for(let y=1;cy-y*scale>=0;y++){pCtx.moveTo(0,cy-y*scale+.5);pCtx.lineTo(pCanvas.width,cy-y*scale+.5);}
        pCtx.stroke();
    }

    // Frame anterior (onion skin)
    if (!pvPlaying && safe > 0 && f) {
        const prevF = state.allFrames[anim.timeline[safe-1]?.frameId];
        if (prevF) {
            const prevImg = imageById(prevF.assetId);
            if (prevImg) {
                pCtx.globalAlpha = 0.3; pCtx.imageSmoothingEnabled = false;
                pCtx.drawImage(prevImg, prevF.x, prevF.y, prevF.w, prevF.h, cx - prevF.px*scale, cy - prevF.py*scale, prevF.w*scale, prevF.h*scale);
                pCtx.globalAlpha = 1.0;
            }
        }
    }

    // Frame actual — usa la imagen del asset del frame
    if (f) {
        const fImg = imageById(f.assetId);
        if (fImg) {
            pCtx.imageSmoothingEnabled = false;
            pCtx.drawImage(fImg, f.x, f.y, f.w, f.h, cx - f.px*scale, cy - f.py*scale, f.w*scale, f.h*scale);
        }
    }

    // Label de fase
    if (anim.type === 'held' && pvPlaying) {
        const cols = { intro:'#3498db', loop:'#2ecc71', outro:'#e67e22', playing:'#aaa' };
        pCtx.fillStyle = (cols[pvState] || '#777') + 'cc';
        pCtx.font = 'bold 10px monospace';
        pCtx.fillText(pvState.toUpperCase(), 4, 14);
    }
    pCtx.fillStyle = 'rgba(255,255,255,0.2)';
    pCtx.font = '10px monospace';
    pCtx.fillText(safe + '/' + (anim.timeline.length - 1), 4, pCanvas.height - 4);
}

function _stopPlay() {
    pvPlaying = false;
    const pb  = document.getElementById('pv-play');
    const txt = document.getElementById('pv-play-text');
    pb.classList.remove('active');
    txt.textContent = 'Play';
    pb.querySelector('svg').innerHTML = '<path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z"/>';
}

requestAnimationFrame(renderPreview);