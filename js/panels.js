// Paneles secundarios: Hitboxes, Moveset, Character Config
import { state, saveToLocal } from './core/state.js';
import { drawMainCanvas }     from './canvas/renderer.js';

// HITBOX PANEL

function renderHitboxPanel() {
    const container = document.getElementById('rp-tab-hitbox');
    if (!container) return;

    if (!state.activeAnim || state.selectedTLIndex === null) {
        container.innerHTML = '<div class="hint-empty">Selecciona un frame<br>en la timeline primero</div>';
        return;
    }

    const anim = state.animations[state.activeAnim];
    const tlf  = anim && anim.timeline[state.selectedTLIndex];
    if (!tlf) { container.innerHTML = '<div class="hint-empty">Frame inválido</div>'; return; }

    if (!anim.base_hurtboxes) anim.base_hurtboxes = [];
    if (!tlf.hitboxes)  tlf.hitboxes  = [];
    if (!tlf.hurtboxes) tlf.hurtboxes = [];

    container.innerHTML = '';

    // Sync mode
    const syncEl = document.createElement('div');
    syncEl.className = 'prop-group';
    syncEl.style.cssText = 'padding:6px 10px;';
    syncEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="font-size:10px;font-weight:800;letter-spacing:1px;text-transform:uppercase;color:var(--dim);">Sync Hurtboxes</span>
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin:0;">
                <span style="font-size:10px;color:${state.hurtboxSyncMode ? '#e67e22' : 'var(--dim)'};">
                    ${state.hurtboxSyncMode ? '⚡ ON' : 'OFF'}
                </span>
                <input type="checkbox" ${state.hurtboxSyncMode ? 'checked' : ''}
                    onchange="window.__panels.toggleSyncMode(this.checked)"
                    style="width:auto;cursor:pointer;">
            </label>
        </div>
        ${state.hurtboxSyncMode ? '<div style="font-size:9px;color:#e67e22;margin-top:3px;">Editar hurtbox actualiza todos los frames</div>' : ''}
    `;
    container.appendChild(syncEl);

    // Base hurtboxes (animación)
    const baseSection = document.createElement('div');
    baseSection.className = 'prop-group';
    const baseHeader = document.createElement('div');
    baseHeader.className = 'prop-label';
    baseHeader.innerHTML = `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#0d4020;border:1px dashed #2ecc71;margin-right:5px;vertical-align:middle;"></span>Hurtboxes Base · Animación</span>`;
    const addBaseBtn = document.createElement('button');
    addBaseBtn.className = 'btn btn-info btn-sm';
    addBaseBtn.style.cssText = 'padding:1px 7px;font-size:10px;';
    addBaseBtn.innerHTML = '+ Añadir';
    addBaseBtn.onclick = () => window.__panels.addBaseHurtbox();
    baseHeader.appendChild(addBaseBtn);
    baseSection.appendChild(baseHeader);

    if (!anim.base_hurtboxes.length) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:#303040;padding:4px 0;';
        hint.textContent = 'Sin base. Cada frame gestiona las suyas.';
        baseSection.appendChild(hint);
    } else {
        anim.base_hurtboxes.forEach((box, idx) => {
            const scb   = state.selectedCollisionBox;
            const isSel = scb && scb.type === 'base_hurtbox' && scb.idx === idx;
            const row   = document.createElement('div');
            row.className = 'box-row' + (isSel ? ' box-row-selected' : '');
            row.style.borderLeft = '2px dashed #1a7a40';
            row.innerHTML = `
                <span class="hurtbox-label" style="font-size:10px;font-weight:800;min-width:18px;">${idx}</span>
                <span class="box-coords">${box.x}, ${box.y} · ${box.w}×${box.h}</span>
                <button class="tool-btn btn-sm" title="Seleccionar" onclick="window.__panels.selectBaseHurtbox(${idx})" style="padding:2px 5px;">✎</button>
                <button class="tool-btn btn-sm" style="color:#e88;padding:2px 5px;" onclick="window.__panels.removeBaseHurtbox(${idx})">✕</button>
            `;
            baseSection.appendChild(row);
        });
        const baseBulk = document.createElement('div');
        baseBulk.style.cssText = 'display:flex;gap:4px;margin-top:6px;';
        baseBulk.innerHTML = `
            <button class="btn btn-info btn-sm" style="flex:1;" title="Sobrescribe hurtboxes de todos los frames con la base"
                onclick="window.__panels.applyBaseToAll()">↓ Aplicar a todos</button>
            <button class="btn btn-info btn-sm" style="flex:1;" title="Copia las hurtboxes del frame actual como base"
                onclick="window.__panels.setFrameAsBase()">↑ Usar frame</button>
        `;
        baseSection.appendChild(baseBulk);
    }
    container.appendChild(baseSection);

    // Hurtboxes del frame
    const frameHasHurt = tlf.hurtboxes.length > 0;
    const usingBase    = !frameHasHurt && anim.base_hurtboxes.length > 0;

    const hrtSection = document.createElement('div');
    hrtSection.className = 'prop-group';
    const hrtHeader = document.createElement('div');
    hrtHeader.className = 'prop-label';
    hrtHeader.innerHTML = `<span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#2ecc71;margin-right:5px;vertical-align:middle;"></span>Hurtboxes · Frame ${state.selectedTLIndex}</span>`;
    if (!usingBase) {
        const addHrtBtn = document.createElement('button');
        addHrtBtn.className = 'btn btn-info btn-sm';
        addHrtBtn.style.cssText = 'padding:1px 7px;font-size:10px;';
        addHrtBtn.innerHTML = '+ Añadir';
        addHrtBtn.onclick = () => _addBox('hurtbox');
        hrtHeader.appendChild(addHrtBtn);
    }
    hrtSection.appendChild(hrtHeader);

    if (usingBase) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:#1a7a40;padding:4px 0;line-height:1.5;';
        hint.innerHTML = '↑ Usando hurtboxes base (dashed en canvas)<br><span style="color:#303040;">Añade o dibuja para sobrescribir.</span>';
        hrtSection.appendChild(hint);
        if (anim.base_hurtboxes.length > 0) {
            const copyBtn = document.createElement('button');
            copyBtn.className = 'btn btn-info btn-sm';
            copyBtn.style.marginTop = '5px';
            copyBtn.innerHTML = '↓ Copiar base a este frame';
            copyBtn.onclick = () => window.__panels.copyBaseToFrame();
            hrtSection.appendChild(copyBtn);
        }
    } else {
        tlf.hurtboxes.forEach((box, idx) => {
            const scb   = state.selectedCollisionBox;
            const isSel = scb && scb.type === 'hurtbox' && scb.idx === idx;
            const row   = document.createElement('div');
            row.className = 'box-row' + (isSel ? ' box-row-selected' : '');
            row.innerHTML = `
                <span class="hurtbox-label" style="font-size:10px;font-weight:800;min-width:18px;">${idx}</span>
                <span class="box-coords">${box.x}, ${box.y} · ${box.w}×${box.h}</span>
                <button class="tool-btn btn-sm" title="Editar" onclick="window.selectBox('hurtbox',${idx})" style="padding:2px 5px;">✎</button>
                <button class="tool-btn btn-sm" style="color:#e88;padding:2px 5px;" onclick="window.removeBox('hurtbox',${idx})">✕</button>
            `;
            row.addEventListener('click', e => { if (e.target.tagName === 'BUTTON') return; window.selectBox('hurtbox', idx); });
            hrtSection.appendChild(row);
        });
        if (!tlf.hurtboxes.length) {
            const hint = document.createElement('div');
            hint.style.cssText = 'font-size:10px;color:#303040;padding:4px 0;';
            hint.textContent = 'Sin hurtboxes. Dibuja en canvas o pulsa + Añadir.';
            hrtSection.appendChild(hint);
        }
        if (frameHasHurt && anim.base_hurtboxes.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.className = 'btn btn-info btn-sm';
            clearBtn.style.marginTop = '5px';
            clearBtn.innerHTML = '↑ Revertir a base';
            clearBtn.onclick = () => window.__panels.revertToBase();
            hrtSection.appendChild(clearBtn);
        }
    }
    container.appendChild(hrtSection);

    // Hitboxes
    const hitSection = _makeBoxSection('hitbox', tlf.hitboxes, '#e74c3c');
    container.appendChild(hitSection);

    // Acciones bulk
    const bulk = document.createElement('div');
    bulk.className = 'prop-group';
    bulk.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    bulk.innerHTML = `
        <button class="btn btn-info btn-sm" onclick="window.__panels.copyBoxesToNext()">
            <i class="bi bi-copy icon-sm"></i>Copiar al siguiente
        </button>
        <button class="btn btn-info btn-sm" onclick="window.__panels.copyBoxesToAll()">
            <i class="bi bi-files icon-sm"></i>Copiar a todos
        </button>
        <button class="btn btn-danger btn-sm" onclick="window.__panels.clearAllBoxes()">
            <i class="bi bi-trash3 icon-sm"></i>Limpiar cajas frame
        </button>
    `;
    container.appendChild(bulk);
}

// Funciones nuevas para base hurtboxes

function addBaseHurtbox() {
    if (!state.activeAnim) return;
    const anim = state.animations[state.activeAnim];
    if (!anim.base_hurtboxes) anim.base_hurtboxes = [];
    anim.base_hurtboxes.push({ x: -20, y: -80, w: 40, h: 80 });
    state.selectedCollisionBox = { type: 'base_hurtbox', idx: anim.base_hurtboxes.length - 1 };
    if (state.currentMode !== 'editbox' && window.setMode) window.setMode('editbox');
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function selectBaseHurtbox(idx) {
    state.selectedCollisionBox = { type: 'base_hurtbox', idx };
    if (state.currentMode !== 'editbox' && window.setMode) window.setMode('editbox');
    if (window.showBoxEditTooltip) window.showBoxEditTooltip();
    drawMainCanvas(); renderHitboxPanel();
}

function removeBaseHurtbox(idx) {
    if (!state.activeAnim) return;
    const anim = state.animations[state.activeAnim];
    if (!anim.base_hurtboxes) return;
    anim.base_hurtboxes.splice(idx, 1);
    if (state.selectedCollisionBox?.type === 'base_hurtbox') state.selectedCollisionBox = null;
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function applyBaseToAll() {
    if (!state.activeAnim) return;
    const anim = state.animations[state.activeAnim];
    if (!anim.base_hurtboxes?.length) { alert('Sin hurtboxes base.'); return; }
    if (!confirm('¿Copiar base a TODOS los frames?')) return;
    const copy = JSON.parse(JSON.stringify(anim.base_hurtboxes));
    anim.timeline.forEach(t => { t.hurtboxes = JSON.parse(JSON.stringify(copy)); });
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function setFrameAsBase() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const anim = state.animations[state.activeAnim];
    const tlf  = anim.timeline[state.selectedTLIndex];
    if (!tlf.hurtboxes?.length) { alert('Frame sin hurtboxes.'); return; }
    anim.base_hurtboxes = JSON.parse(JSON.stringify(tlf.hurtboxes));
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function copyBaseToFrame() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const anim = state.animations[state.activeAnim];
    const tlf  = anim.timeline[state.selectedTLIndex];
    tlf.hurtboxes = JSON.parse(JSON.stringify(anim.base_hurtboxes || []));
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function revertToBase() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    tlf.hurtboxes = [];
    if (state.selectedCollisionBox?.type === 'hurtbox') state.selectedCollisionBox = null;
    if (window.hideBoxEditTooltip) window.hideBoxEditTooltip();
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

function toggleSyncMode(checked) {
    state.hurtboxSyncMode = checked;
    renderHitboxPanel();
}

function copyBoxesToAll() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    if (!confirm('¿Copiar las cajas de este frame a TODOS los demás?')) return;
    const tl  = state.animations[state.activeAnim].timeline;
    const src = tl[state.selectedTLIndex];
    tl.forEach((f, i) => {
        if (i === state.selectedTLIndex) return;
        f.hitboxes  = JSON.parse(JSON.stringify(src.hitboxes  || []));
        f.hurtboxes = JSON.parse(JSON.stringify(src.hurtboxes || []));
    });
    saveToLocal(); alert('✓ Cajas copiadas a todos los frames.');
}

function clearAllBoxes() {
    if (!state.activeAnim || state.selectedTLIndex === null) return;
    if (!confirm('¿Limpiar todas las cajas del frame actual?')) return;
    const tlf = state.animations[state.activeAnim].timeline[state.selectedTLIndex];
    tlf.hitboxes  = [];
    tlf.hurtboxes = [];
    state.selectedCollisionBox = null;
    drawMainCanvas(); renderHitboxPanel(); saveToLocal();
}

// MOVESET PANEL

const MOVE_TYPES = ['normal','special','super','grab','command','aerial'];

function renderMovesetPanel() {
    const container = document.getElementById('rp-tab-moveset');
    if (!container) return;
    container.innerHTML = '';

    // Header
    const header = document.createElement('div');
    header.className = 'prop-group';
    header.innerHTML = `
        <div class="prop-label">Lista de Movimientos</div>
        <button class="btn btn-accent btn-sm" onclick="window.__panels.addMove()" style="width:100%;">
            <i class="bi bi-plus-lg icon-sm"></i>
            Añadir Movimiento
        </button>
    `;
    container.appendChild(header);

    const list = document.createElement('div');
    list.id = 'move-entries-list';
    list.style.cssText = 'padding:6px 8px;overflow-y:auto;flex:1;';
    container.appendChild(list);

    if (!state.movesetConfig.length) {
        list.innerHTML = '<div class="hint-empty">Sin movimientos.<br>Pulsa + Añadir Movimiento</div>';
    } else {
        state.movesetConfig.forEach((move, i) => {
            const card = _makeMoveCard(move, i);
            list.appendChild(card);
        });
    }

    // Export
    const exp = document.createElement('div');
    exp.className = 'export-section';
    exp.innerHTML = `
        <div style="display:flex;gap:5px;">
            <button class="btn btn-info btn-sm" onclick="importMovesetJSON()" style="flex:1;">
                <i class="bi bi-folder2-open icon-sm"></i>
                Importar
            </button>
            <button class="btn btn-export btn-sm" onclick="exportMovesetJSON()" style="flex:1;">
                <i class="bi bi-download icon-sm"></i>
                Exportar
            </button>
        </div>
    `;
    container.appendChild(exp);
}

function _makeMoveCard(move, i) {
    const COLORS = { normal:'#6080b0', special:'#c07030', super:'#d0a000', grab:'#708060', command:'#9060a0', aerial:'#4090b0' };
    const color  = COLORS[move.type] || '#888';
    const card   = document.createElement('div');
    card.className = 'move-entry';

    const animNames = Object.keys(state.animations);

    card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
                <span class="move-badge" style="background:${color}22;color:${color};border:1px solid ${color}55;">
                    ${(move.type||'normal').toUpperCase()}
                </span>
                <input type="text" value="${move.input||''}" placeholder="Input (ej: 236J)"
                    onchange="window.__panels.updateMoveField(${i},'input',this.value)"
                    style="flex:1;min-width:0;font-family:monospace;font-weight:700;">
            </div>
            <button class="tool-btn btn-sm" style="color:#e88;flex-shrink:0;margin-left:5px;"
                onclick="window.__panels.removeMove(${i})">✕</button>
        </div>
        <div class="row" style="margin-bottom:5px;">
            <div>
                <label>Animación</label>
                <select onchange="window.__panels.updateMoveField(${i},'anim',this.value)">
                    <option value="">— Seleccionar —</option>
                    ${animNames.map(n=>`<option value="${n}" ${move.anim===n?'selected':''}>${n}</option>`).join('')}
                </select>
            </div>
            <div>
                <label>Tipo</label>
                <select onchange="window.__panels.updateMoveField(${i},'type',this.value)">
                    ${MOVE_TYPES.map(t=>`<option value="${t}" ${move.type===t?'selected':''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>
        <div class="row" style="margin-bottom:5px;">
            <div><label>Daño</label><input type="number" value="${move.dmg||10}" min="0" onchange="window.__panels.updateMoveField(${i},'dmg',+this.value)"></div>
            <div><label>KB X</label><input type="number" value="${move.kbx||0}" onchange="window.__panels.updateMoveField(${i},'kbx',+this.value)"></div>
            <div><label>KB Y</label><input type="number" value="${move.kby||0}" onchange="window.__panels.updateMoveField(${i},'kby',+this.value)"></div>
        </div>
        <div class="row" style="margin-bottom:5px;">
            <div><label>Hitstun (ms)</label><input type="number" value="${move.hitstun||300}" min="0" onchange="window.__panels.updateMoveField(${i},'hitstun',+this.value)"></div>
            <div><label>Ki cost</label><input type="number" value="${move.ki_cost||0}" min="0" onchange="window.__panels.updateMoveField(${i},'ki_cost',+this.value)"></div>
            <div><label>Priority</label><input type="number" value="${move.priority||1}" min="0" max="10" onchange="window.__panels.updateMoveField(${i},'priority',+this.value)"></div>
        </div>
        <div>
            <label>Cancel into (coma separado)</label>
            <input type="text" value="${move.cancel_into||''}" placeholder="ej: 236J, 214K"
                onchange="window.__panels.updateMoveField(${i},'cancel_into',this.value)">
        </div>
    `;
    return card;
}

function addMove() {
    state.movesetConfig.push({ input:'', anim:'', type:'normal', dmg:10, kbx:0, kby:-200, hitstun:300, blockstun:100, ki_cost:0, priority:1, cancel_into:'' });
    renderMovesetPanel(); saveToLocal();
}

function removeMove(i) {
    state.movesetConfig.splice(i, 1);
    renderMovesetPanel(); saveToLocal();
}

function updateMoveField(i, field, value) {
    state.movesetConfig[i][field] = value;
    // Refrescar solo la visual del badge de tipo si cambió
    if (field === 'type') renderMovesetPanel();
    saveToLocal();
}

// CHARACTER PANEL

function renderCharPanel() {
    const container = document.getElementById('rp-tab-char');
    if (!container) return;
    container.innerHTML = '';

    const ch = state.charConfig;

    // Info básica
    const basic = document.createElement('div');
    basic.className = 'prop-group';
    basic.innerHTML = `
        <div class="prop-label">Info del Personaje</div>
        <div style="margin-bottom:5px;">
            <label>ID Interno (sin espacios)</label>
            <input type="text" id="ch-name" value="${ch.name||''}" placeholder="goku_base"
                onchange="window.__panels.updateChar('name',this.value)">
        </div>
        <div style="margin-bottom:5px;">
            <label>Nombre a mostrar</label>
            <input type="text" id="ch-display" value="${ch.displayName||''}" placeholder="Son Goku"
                onchange="window.__panels.updateChar('displayName',this.value)">
        </div>
        <div>
            <label>Carpeta en Godot</label>
            <input type="text" id="ch-folder" value="${ch.folder||''}" placeholder="goku"
                onchange="window.__panels.updateChar('folder',this.value)">
            <div class="folder-hint">res://characters/${ch.folder||'<carpeta>'}/<br>→ atlas.json, moveset.json, char.json</div>
        </div>
    `;
    container.appendChild(basic);

    // Stats base
    const stats = ch.stats || {};
    const statsEl = document.createElement('div');
    statsEl.className = 'prop-group';
    statsEl.innerHTML = `
        <div class="prop-label">Stats Base</div>
        <div class="stat-grid">
            ${_statField('HP',      'hp',      stats.hp      ?? 1000)}
            ${_statField('KI',      'ki',      stats.ki      ?? 100)}
            ${_statField('Speed',   'speed',   stats.speed   ?? 5)}
            ${_statField('Weight',  'weight',  stats.weight  ?? 70)}
            ${_statField('Attack ×','attack',  stats.attack  ?? 1.0, true)}
            ${_statField('Def ×',   'defense', stats.defense ?? 1.0, true)}
        </div>
    `;
    container.appendChild(statsEl);

    // Transformaciones
    const transEl = document.createElement('div');
    transEl.className = 'prop-group';
    transEl.innerHTML = `<div class="prop-label">Transformaciones</div>`;

    const addTransBtn = document.createElement('button');
    addTransBtn.className = 'btn btn-accent btn-sm';
    addTransBtn.style.marginBottom = '8px';
    addTransBtn.innerHTML = '+ Añadir Transformación';
    addTransBtn.onclick = () => window.__panels.addTransformation();
    transEl.appendChild(addTransBtn);

    if (!ch.transformations || !ch.transformations.length) {
        const hint = document.createElement('div');
        hint.style.cssText = 'font-size:10px;color:#303040;padding:4px 0;';
        hint.textContent = 'Sin transformaciones (solo base)';
        transEl.appendChild(hint);
    } else {
        ch.transformations.forEach((t, i) => {
            const card = _makeTransCard(t, i);
            transEl.appendChild(card);
        });
    }
    container.appendChild(transEl);

    // Export char.json
    const exp = document.createElement('div');
    exp.className = 'export-section';
    exp.innerHTML = `
        <button class="btn btn-export" onclick="exportCharJSON()">
            <i class="bi bi-download icon"></i>
            Exportar char.json
        </button>
        <div class="json-struct">
            <span class="jk">"textures"</span>: {<br>
            &nbsp;&nbsp;<span class="jp">"sheet_0"</span>: <span class="jv">"goku_base.png"</span>,<br>
            &nbsp;&nbsp;<span class="jp">"sheet_vfx"</span>: <span class="jv">"goku_vfx.png"</span><br>
            },<br>
            <span class="jk">"base_frames"</span>: { <span class="jv">…</span> },<br>
            <span class="jk">"animations"</span>: { <span class="jv">…</span> }
        </div>
    `;
    container.appendChild(exp);
}

function _statField(label, key, value, isFloat = false) {
    const step = isFloat ? '0.05' : '1';
    const min  = isFloat ? '0' : '0';
    return `
        <div>
            <label>${label}</label>
            <input type="number" value="${value}" min="${min}" step="${step}"
                onchange="window.__panels.updateStat('${key}',${isFloat ? 'parseFloat' : 'parseInt'}(this.value))">
        </div>`;
}

function _makeTransCard(t, i) {
    const card = document.createElement('div');
    card.className = 'transform-row';
    card.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
            <input type="text" value="${t.name||''}" placeholder="SSJ1"
                onchange="window.__panels.updateTransField(${i},'name',this.value)"
                style="font-weight:800;font-size:13px;flex:1;margin-right:6px;">
            <button class="tool-btn btn-sm" style="color:#e88;flex-shrink:0;"
                onclick="window.__panels.removeTransformation(${i})">✕</button>
        </div>
        <div class="row" style="margin-bottom:5px;">
            <div><label>Ki cost</label><input type="number" value="${t.ki_cost||0}" min="0"
                onchange="window.__panels.updateTransField(${i},'ki_cost',+this.value)"></div>
        </div>
        <div style="font-size:10px;color:var(--dim);margin-bottom:4px;font-weight:700;">Stats ×</div>
        <div class="stat-grid">
            <div><label>HP</label><input type="number" value="${t.mult_hp||1}" min="0" step="0.1"
                onchange="window.__panels.updateTransField(${i},'mult_hp',parseFloat(this.value))"></div>
            <div><label>Atk</label><input type="number" value="${t.mult_atk||1}" min="0" step="0.1"
                onchange="window.__panels.updateTransField(${i},'mult_atk',parseFloat(this.value))"></div>
            <div><label>Speed</label><input type="number" value="${t.mult_spd||1}" min="0" step="0.1"
                onchange="window.__panels.updateTransField(${i},'mult_spd',parseFloat(this.value))"></div>
            <div><label>KI regen</label><input type="number" value="${t.mult_ki||1}" min="0" step="0.1"
                onchange="window.__panels.updateTransField(${i},'mult_ki',parseFloat(this.value))"></div>
        </div>
    `;
    return card;
}

function addTransformation() {
    if (!state.charConfig.transformations) state.charConfig.transformations = [];
    state.charConfig.transformations.push({ name:'SSJ1', ki_cost:3000, mult_hp:1.0, mult_atk:2.0, mult_spd:1.2, mult_ki:1.5 });
    renderCharPanel(); saveToLocal();
}

function removeTransformation(i) {
    state.charConfig.transformations.splice(i, 1);
    renderCharPanel(); saveToLocal();
}

function updateChar(field, value) {
    state.charConfig[field] = value;
    // Actualizar folder hint dinámicamente
    if (field === 'folder') {
        const hint = document.querySelector('.folder-hint');
        if (hint) hint.innerHTML = `res://characters/${value||'&lt;carpeta&gt;'}/<br>→ atlas.json, moveset.json, char.json`;
    }
    saveToLocal();
}

function updateStat(key, value) {
    if (!state.charConfig.stats) state.charConfig.stats = {};
    state.charConfig.stats[key] = value;
    saveToLocal();
}

function updateTransField(i, field, value) {
    if (!state.charConfig.transformations || !state.charConfig.transformations[i]) return;
    state.charConfig.transformations[i][field] = value;
    if (field === 'name') renderCharPanel();
    saveToLocal();
}

// Exponer API global

window.__renderHitboxPanel  = renderHitboxPanel;
window.__renderMovesetPanel = renderMovesetPanel;
window.__renderCharPanel    = renderCharPanel;

window.__panels = {
    // Hitbox
    copyBoxesToNext, copyBoxesToAll, clearAllBoxes,
    // Moveset
    addMove, removeMove, updateMoveField,
    // Char
    addTransformation, removeTransformation,
    updateChar, updateStat, updateTransField,
    // nuevas:
    addBaseHurtbox, selectBaseHurtbox, removeBaseHurtbox,
    applyBaseToAll, setFrameAsBase, copyBaseToFrame,
    revertToBase, toggleSyncMode,
};