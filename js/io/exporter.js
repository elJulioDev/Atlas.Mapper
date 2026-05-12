import { state } from '../core/state.js';

// Atlas JSON

export function exportJSON() {
    const assetIds = Object.keys(state.assets);
    if (!assetIds.length) { alert('Carga al menos una imagen primero.'); return; }

    const usedIds = new Set();
    for (const n in state.animations) state.animations[n].timeline.forEach(t => usedIds.add(t.frameId));

    const base_frames = {};
    usedIds.forEach(id => { if (state.allFrames[id]) base_frames[id] = state.allFrames[id]; });

    // Mapa de texturas (assetId → fileName)
    const textures = {};
    assetIds.forEach(id => { textures[id] = state.assets[id].fileName; });

    const output = {
        version: '1.0',
        textures,
        base_frames,
        animations: {}
    };

    const mapSeq = arr => arr.map(t => ({
        frame_id:    t.frameId,
        events:      t.events ? t.events.split(',').map(s=>s.trim()).filter(Boolean) : [],
        duration_ms: t.duration || null,
        hitboxes:    t.hitboxes  && t.hitboxes.length  > 0 ? t.hitboxes  : undefined,
        hurtboxes:   t.hurtboxes && t.hurtboxes.length > 0 ? t.hurtboxes : undefined
    }));

    for (const name in state.animations) {
        const a = state.animations[name];
        if (a.type === 'held') {
            const ls = Math.max(0, a.loop_start  ?? 1);
            const os = Math.max(ls + 1, a.outro_start ?? 2);
            const tl = a.timeline;
            output.animations[name] = {
                type: 'held', fps: a.fps, next_anim: a.next_anim || null,
                base_hurtboxes: a.base_hurtboxes?.length > 0 ? a.base_hurtboxes : undefined,  // añadir
                phases: { intro: mapSeq(tl.slice(0,ls)), loop: mapSeq(tl.slice(ls,os)), outro: mapSeq(tl.slice(os)) }
            };
        } else {
            output.animations[name] = {
                type: a.type, fps: a.fps, loop: a.type==='loop',
                next_anim: a.next_anim || null,
                base_hurtboxes: a.base_hurtboxes?.length > 0 ? a.base_hurtboxes : undefined,  // añadir
                sequence: mapSeq(a.timeline)
            };
        }
    }

    const json = JSON.stringify(output, null, 2);
    // Comprimir líneas cortas
    const compressed = json
        .replace(/"events":\s*\[([\s\S]*?)\]/g, (m, c) => '"events": [' + c.replace(/\s+/g,' ').trim() + ']')
        .replace(/\[\s+\]/g, '[]')
        .replace(/\{\s+"x":\s*(-?\d+),\s+"y":\s*(-?\d+),\s+"w":\s*(-?\d+),\s+"h":\s*(-?\d+),\s+"px":\s*(-?\d+),\s+"py":\s*(-?\d+)(?:,\s+"assetId":\s*"([^"]*)")?\s*\}/g,
            (_, x,y,w,h,px,py,aid) => aid ? `{ "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h}, "px": ${px}, "py": ${py}, "assetId": "${aid}" }` : `{ "x": ${x}, "y": ${y}, "w": ${w}, "h": ${h}, "px": ${px}, "py": ${py} }`)
        .replace(/\{\s+"x":\s*(-?\d+),\s+"y":\s*(-?\d+),\s+"w":\s*(-?\d+),\s+"h":\s*(-?\d+)\s*\}/g, '{ "x": $1, "y": $2, "w": $3, "h": $4 }');

    // Nombre de archivo = primer asset o "atlas"
    const baseName = state.assets[state.activeAssetId]?.fileName.replace(/\.[^/.]+$/, '') || 'atlas';
    _download(compressed, baseName + '_atlas.json');
}

// Moveset JSON

export function exportMovesetJSON() {
    if (!state.movesetConfig.length) { alert('Configura al menos un movimiento antes de exportar.'); return; }
    const folder = state.charConfig.folder || state.assets[state.activeAssetId]?.fileName.replace(/\.[^/.]+$/,'') || 'char';
    const output = {
        character: folder, transformation: 'base',
        controls: { move_left:'A', move_right:'D', jump:'W', guard:'S', charge_ki:'P', punch:'J', kick:'K', ki_blast:'L' },
        combo_window_ms: 500,
        combos: state.movesetConfig.filter(m => m.input && m.anim).map(m => ({
            input: m.input, animation: m.anim, type: m.type||'',
            damage: m.dmg||10, knockback: { x: m.kbx||0, y: m.kby||0 },
            hitstun: m.hitstun||300, blockstun: m.blockstun||100,
            ki_cost: m.ki_cost||0, priority: m.priority||1,
            cancel_into: m.cancel_into ? m.cancel_into.split(',').map(s=>s.trim()).filter(Boolean) : []
        }))
    };
    _download(JSON.stringify(output, null, 2), folder + '_moveset.json');
}

// Char JSON

export function exportCharJSON() {
    const ch = state.charConfig;
    if (!ch.name && !ch.folder) { alert('Define al menos el nombre del personaje.'); return; }
    const folder = ch.folder || ch.name.toLowerCase().replace(/\s+/g,'_');
    const output = {
        name: ch.name, display_name: ch.displayName||ch.name, folder,
        base_stats: { hp:ch.stats.hp, ki:ch.stats.ki, speed:ch.stats.speed, weight:ch.stats.weight, attack:ch.stats.attack, defense:ch.stats.defense },
        transformations: ch.transformations.map(t => ({
            name: t.name, folder: t.name, ki_cost: t.ki_cost||0,
            stats_mult: { hp:t.mult_hp||1, attack:t.mult_atk||1, speed:t.mult_spd||1, ki_regen:t.mult_ki||1 },
            files: {
                spritesheet: `${folder}/${t.name}/spritesheet.png`,
                atlas:       `${folder}/${t.name}/atlas.json`,
                moveset:     `${folder}/${t.name}/moveset.json`
            }
        }))
    };
    _download(JSON.stringify(output, null, 2), folder + '_char.json');
}

// Util

function _download(text, filename) {
    const a = document.createElement('a');
    a.href     = 'data:text/json;charset=utf-8,' + encodeURIComponent(text);
    a.download = filename;
    a.click();
}