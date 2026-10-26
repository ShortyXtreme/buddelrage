'use strict';
// Hübschere Einstellungen: Segment-Pillen statt Dropdowns. Das originale <select> bleibt (unsichtbar)
// als Datenquelle erhalten – aller bestehende Code (value/change) funktioniert weiter.
const DIFF_META = {
  off: { ic: '⏸️', n: 'Aus', d: 'Gekaufte Buddler bleiben untätig – du wechselst selbst (Tab).', cls: 'n' },
  easy: { ic: '🌱', d: 'Gemütlich – langsam, macht Fehler, ideal zum Lernen.', cls: 'g' },
  normal: { ic: '⚔️', d: 'Ausgewogen – baut, forscht, verteidigt und greift an.', cls: 'y' },
  hard: { ic: '🔥', d: 'Schnell & taktisch – nutzt Waffen, Fahrzeuge und Flugbahnen.', cls: 'r' }
};
function diffMeta(v, txt) { const m = DIFF_META[v] || {}; return { ic: m.ic, n: m.n || txt, d: m.d, cls: m.cls }; }
function sizeMeta(v, txt) {
  const S = MAP_SIZES[v]; if (!S) return { n: txt };
  const w = Math.round(14 + S.f * 16), h = Math.round(S.h / 880 * 18);
  const dims = mapDims(1700, v);
  return { n: txt, d: dims.W + ' × ' + dims.H, pre: '<i class="mapprev" style="width:' + w + 'px;height:' + h + 'px"><i></i></i>' };
}
const segEsc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function segify(sel, meta, o) {
  if (!sel || sel._segRender) return; o = o || {};
  meta = meta || ((v, t) => ({ n: t }));
  sel.classList.add('seg-src'); sel.tabIndex = -1;
  const box = document.createElement('div'); box.className = 'seg' + (o.cls ? ' ' + o.cls : ''); box.setAttribute('role', 'radiogroup');
  if (sel.getAttribute('aria-label')) box.setAttribute('aria-label', sel.getAttribute('aria-label'));
  sel.insertAdjacentElement('afterend', box);
  const dl = o.line ? document.createElement('div') : null; if (dl) { dl.className = 'seg-desc'; dl.setAttribute('aria-live', 'polite'); box.insertAdjacentElement('afterend', dl); }
  const render = () => {
    const ae = document.activeElement, foc = ae && box.contains(ae) ? ae.dataset.v : null;
    box.innerHTML = Array.from(sel.options).map(op => {
      const m = meta(op.value, op.textContent) || {}, on = op.value === sel.value;
      return '<button type="button" class="seg-b' + (o.opt ? ' opt' : '') + (m.cls ? ' c-' + m.cls : '') + (on ? ' on' : '') + '" data-v="' + segEsc(op.value) + '" role="radio" aria-checked="' + on + '"' + (m.d ? ' title="' + segEsc(m.d) + '"' : '') + (op.disabled || sel.disabled ? ' disabled' : '') + '>' +
        (m.pre || '') + (m.ic ? '<span class="seg-ic" aria-hidden="true">' + m.ic + '</span>' : '') + '<b>' + segEsc(m.n || op.textContent) + '</b>' + (m.d && !o.nodesc && !o.line ? '<small>' + segEsc(m.d) + '</small>' : '') + '</button>';
    }).join('');
    if (dl) { const cur = sel.options[sel.selectedIndex], m = cur ? meta(cur.value, cur.textContent) || {} : {}; dl.innerHTML = m.d ? (m.ic || '') + ' <b>' + segEsc(m.n || cur.textContent) + '</b> · ' + segEsc(m.d) : ''; }
    if (foc) { const b = box.querySelector('[data-v="' + foc + '"]'); if (b) b.focus(); }
  };
  const pick = v => { if (sel.value === v) return; sel.value = v; sel.dispatchEvent(new Event('change', { bubbles: true })); render(); if (typeof uiSnd === 'function') uiSnd(); };
  box.addEventListener('click', e => { const b = e.target.closest('.seg-b'); if (b && !b.disabled) { e.stopPropagation(); pick(b.dataset.v); } });
  box.addEventListener('keydown', e => { // Pfeiltasten wechseln innerhalb der Gruppe (Barrierefreiheit)
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key) || G.world) return;
    const ops = Array.from(sel.options).filter(x => !x.disabled), i = ops.findIndex(x => x.value === sel.value);
    const n = ops[(i + (e.key === 'ArrowRight' ? 1 : -1) + ops.length) % ops.length]; if (n) { e.preventDefault(); e.stopPropagation(); pick(n.value); const b = box.querySelector('[data-v="' + n.value + '"]'); if (b) b.focus(); }
  });
  sel.addEventListener('change', render);
  sel._segRender = render; render();
}
function segRefreshAll() { document.querySelectorAll('select.seg-src').forEach(s => s._segRender && s._segRender()); }
function spGoal() { const v = $('spgoal').value; return v === 'custom' ? Math.max(50, Math.min(5000, Math.round(+$('spgoalc').value || 300))) : +v; }
function updGoalUi() { const c = $('spgoal').value === 'custom'; $('goalcrow').style.display = c ? 'flex' : 'none'; $('spgoalv').textContent = $('spgoalc').value; $('goaltxt').textContent = spGoal(); }
function sliderFill(el) { const p = (el.value - el.min) / (el.max - el.min) * 100; el.style.setProperty('--p', p + '%'); }
function setupFancyUI() {
  for (const id of ['spdiff1', 'spdiff2', 'opttakeover', 'coopdiff', 'opthelper', 'opthelper2']) segify($(id), diffMeta, { line: true });
  segify($('pausehelper'), diffMeta, { opt: true, nodesc: true, cls: 'compact' });
  for (const id of ['spsize', 'optsize']) segify($(id), sizeMeta);
  segify($('optclonks'), null, { cls: 'num' }); segify($('coopn'), null, { cls: 'num' });
  segify($('spgoal'), (v, t) => v === 'custom' ? { ic: '✏️', n: 'Eigenes' } : { n: t + ' 🪙' }, { cls: 'num' });
  // Goldziel
  const gv = lsGet('br_goal', '300'), gc = lsGet('br_goalc', '750');
  $('spgoalc').value = gc; if ([...$('spgoal').options].some(o => o.value === gv)) $('spgoal').value = gv;
  $('spgoal').addEventListener('change', () => { try { localStorage.setItem('br_goal', $('spgoal').value); } catch (e) {} updGoalUi(); });
  $('spgoalc').addEventListener('input', () => { try { localStorage.setItem('br_goalc', $('spgoalc').value); } catch (e) {} sliderFill($('spgoalc')); updGoalUi(); });
  sliderFill($('spgoalc')); updGoalUi(); segRefreshAll();
  // Wildschweine (SP)
  $('optmon1').checked = lsGet('br_mon1', '1') === '1'; $('optmon1').addEventListener('change', () => { try { localStorage.setItem('br_mon1', $('optmon1').checked ? '1' : '0'); } catch (e) {} });
  // Schalter per Tastatur erreichbar (Checkbox ist nur optisch versteckt)
  document.addEventListener('input', e => { if (e.target.type === 'range') sliderFill(e.target); });
}
// Moduskarten per Tastatur auslösbar (Enter/Leertaste)
document.addEventListener('keydown', e => { const t = e.target; if ((e.key === 'Enter' || e.key === ' ') && t && t.classList && t.classList.contains('card') && t.classList.contains('opt')) { e.preventDefault(); e.stopPropagation(); t.click(); } }, true);
