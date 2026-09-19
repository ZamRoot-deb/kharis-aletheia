'use client';

/* KHARIS & ALETHEIA — Tee Studio interactive builder.
   Ported from ../studio.js sections 2, 4, 5, 6, 8 (state, render, drag/nudge,
   toolbar/fine-tune/size wiring, add-to-cart). The heavy imperative bits (SVG
   build, pointer drag, keyboard nudge) run as refs + handlers per
   CONTRACT-NEXT.md's "keep the heavy imperative logic ... in a 'use client'
   component" note; everything else is plain React state so undo/redo, the
   price bar and the spec sheet stay in sync for free. */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import { useCart, useToast } from '@/app/providers';
import { KA_CORE } from '@/lib/core';
import { KA_CONFIG } from '@/lib/config';
import { KA_PRINTS } from '@/lib/prints';
import type { PrintEntry } from '@/lib/types';
import { cn } from '@/lib/cn';
import { VB_W, buildSvg, garmentOf, colourOf, placementOf, FRONT_ONLY_PLACEMENTS } from './studio-geometry';
import {
  defaultDesign,
  defaultState,
  sanitizeQty,
  clampScaleRotate,
  loadInitialState,
  persistState,
  type StudioState,
} from './studio-state';

const CFG = KA_CONFIG.studio;

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="spec-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function StudioBuilder() {
  const cart = useCart();
  const { toast } = useToast();

  const [state, setState] = useState<StudioState>(() => defaultState());
  const [savedPrints, setSavedPrints] = useState<PrintEntry[]>([]);
  const [activeFamily, setActiveFamily] = useState<string>('all');
  const [undoStack, setUndoStack] = useState<StudioState[]>([]);
  const [fallbackNotice, setFallbackNotice] = useState('');

  const skipFirstPersist = useRef(true);
  const stageSurfaceRef = useRef<HTMLDivElement>(null);
  const scaleInputRef = useRef<HTMLInputElement>(null);
  const rotateInputRef = useRef<HTMLInputElement>(null);
  const committingScale = useRef(false);
  const committingRotate = useRef(false);
  const drag = useRef<{ dragging: boolean; startX: number; startY: number; origX: number; origY: number; moved: boolean; snapshot: StudioState | null }>(
    { dragging: false, startX: 0, startY: 0, origX: 0, origY: 0, moved: false, snapshot: null }
  );

  /* ---- mount: hydrate design/size/qty from localStorage + URL hash, and load
     any saved-in-the-Lab prints (both read localStorage, so client-only —
     never during render; see studio-state.ts / lib/prints.ts). ---- */
  useEffect(() => {
    setSavedPrints(KA_PRINTS.saved.list());
    const { state: loaded, fallbackNotice: notice } = loadInitialState();
    setState(loaded);
    if (notice) setFallbackNotice(notice);
  }, []);

  /* ---- persist design/size/qty to localStorage + the URL hash on every
     change, skipping the very first (mount) run so it never stomps the value
     the effect above is about to read. ---- */
  useEffect(() => {
    if (skipFirstPersist.current) {
      skipFirstPersist.current = false;
      return;
    }
    persistState(state);
  }, [state]);

  /* ---- native 'change' (fires once, on release) resets the fine-tune
     sliders' "one undo step per drag gesture" flags — React's onChange fires
     per-tick like the native 'input' event, so this needs the real 'change'. */
  useEffect(() => {
    const el = scaleInputRef.current;
    if (!el) return;
    const onChange = () => {
      committingScale.current = false;
    };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  useEffect(() => {
    const el = rotateInputRef.current;
    if (!el) return;
    const onChange = () => {
      committingRotate.current = false;
    };
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);

  const pushUndo = useCallback((snapshot: StudioState) => {
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > 50) next.shift();
      return next;
    });
  }, []);

  const doUndo = useCallback(() => {
    setUndoStack((prev) => {
      if (!prev.length) return prev;
      setState(prev[prev.length - 1]);
      return prev.slice(0, -1);
    });
  }, []);

  const moveOffset = useCallback((dx: number, dy: number) => {
    setState((prev) => ({
      ...prev,
      design: { ...prev.design, x: clamp(prev.design.x + dx, -200, 200), y: clamp(prev.design.y + dy, -200, 200) },
    }));
  }, []);

  /* ---------- derived data ---------- */
  const builtinPrints = useMemo(() => KA_PRINTS.list(), []);
  const allPrints = useMemo(() => builtinPrints.concat(savedPrints), [builtinPrints, savedPrints]);
  const families = useMemo(() => {
    const set = new Set<string>();
    allPrints.forEach((p) => {
      if (p.family) set.add(p.family);
    });
    return Array.from(set);
  }, [allPrints]);
  const printList = useMemo(() => {
    if (activeFamily === 'all') return allPrints;
    if (activeFamily === 'mine') return savedPrints;
    return allPrints.filter((p) => p.family === activeFamily);
  }, [activeFamily, allPrints, savedPrints]);

  const g = garmentOf(state.design.garment);
  const c = colourOf(state.design.colour);
  const pl = placementOf(state.design.placement);
  const pr = KA_PRINTS.get(state.design.printId);
  const unitPrice = KA_CORE.studioPrice(state.design);
  const total = unitPrice * state.qty;

  const stageSvg = useMemo(() => buildSvg(state.design, {}), [state.design]);
  const stageNote =
    FRONT_ONLY_PLACEMENTS[state.design.placement] && state.design.view === 'back'
      ? (pl ? pl.name : 'This print') + ' sits on the front — flip to Front to see it placed.'
      : '';

  /* ---------- toolbar ---------- */
  function handleViewToggle(view: 'front' | 'back') {
    if (state.design.view === view) return;
    setState((prev) => ({ ...prev, design: { ...prev.design, view } }));
  }
  function handleReset() {
    pushUndo(state);
    setState((prev) => ({ design: defaultDesign(), size: prev.size, qty: prev.qty }));
    setFallbackNotice('');
  }
  function handleRandomize() {
    pushUndo(state);
    setState((prev) => {
      const colour = CFG.colours[Math.floor(Math.random() * CFG.colours.length)].id;
      const printId = allPrints.length ? allPrints[Math.floor(Math.random() * allPrints.length)].id : prev.design.printId;
      const placement = CFG.placements[Math.floor(Math.random() * CFG.placements.length)].id;
      const scale = Math.round((0.7 + Math.random() * 1.1) * 100) / 100;
      const rotate = Math.floor(Math.random() * 360);
      const x = Math.floor(Math.random() * 80 - 40);
      const y = Math.floor(Math.random() * 80 - 40);
      return { ...prev, design: { ...prev.design, colour, printId, placement, scale, rotate, x, y } };
    });
  }
  async function handleCopyLink() {
    const url = location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        toast('Link copied', 'ok');
      } catch {
        toast('Could not copy — copy the address bar instead', 'err');
      }
    } else {
      toast('Copy not supported on this browser', 'err');
    }
  }

  /* ---------- garment / colour / print / placement ---------- */
  function handleGarmentSelect(id: string) {
    if (id === state.design.garment) return;
    pushUndo(state);
    setState((prev) => ({ ...prev, design: { ...prev.design, garment: id } }));
    setFallbackNotice('');
  }
  function handleColourSelect(id: string) {
    if (id === state.design.colour) return;
    pushUndo(state);
    setState((prev) => ({ ...prev, design: { ...prev.design, colour: id } }));
  }
  function handlePrintSelect(id: string) {
    if (id === state.design.printId) return;
    pushUndo(state);
    setState((prev) => ({ ...prev, design: { ...prev.design, printId: id } }));
    setFallbackNotice('');
  }
  function handlePlacementSelect(id: string) {
    if (id === state.design.placement) return;
    pushUndo(state);
    setState((prev) => ({ ...prev, design: { ...prev.design, placement: id } }));
  }

  /* ---------- fine-tune: scale / rotate / nudge ---------- */
  function handleScaleInput(e: ChangeEvent<HTMLInputElement>) {
    if (!committingScale.current) {
      pushUndo(state);
      committingScale.current = true;
    }
    const v = clampScaleRotate(e.target.value, 0.4, 2.5, 1);
    setState((prev) => ({ ...prev, design: { ...prev.design, scale: v } }));
  }
  function handleRotateInput(e: ChangeEvent<HTMLInputElement>) {
    if (!committingRotate.current) {
      pushUndo(state);
      committingRotate.current = true;
    }
    const v = clampScaleRotate(e.target.value, 0, 360, 0);
    setState((prev) => ({ ...prev, design: { ...prev.design, rotate: v } }));
  }
  function handleFtReset() {
    pushUndo(state);
    setState((prev) => ({ ...prev, design: { ...prev.design, scale: 1, rotate: 0, x: 0, y: 0 } }));
  }
  function handleNudgeClick(dir: 'up' | 'down' | 'left' | 'right' | 'center') {
    pushUndo(state);
    if (dir === 'up') moveOffset(0, -10);
    else if (dir === 'down') moveOffset(0, 10);
    else if (dir === 'left') moveOffset(-10, 0);
    else if (dir === 'right') moveOffset(10, 0);
    else setState((prev) => ({ ...prev, design: { ...prev.design, x: 0, y: 0 } }));
  }

  const NUDGE_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home'];
  function handleStageKeyDown(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (NUDGE_KEYS.indexOf(e.key) === -1) return;
    const step = e.shiftKey ? 20 : 5;
    if (!e.repeat) pushUndo(state);
    if (e.key === 'ArrowUp') moveOffset(0, -step);
    else if (e.key === 'ArrowDown') moveOffset(0, step);
    else if (e.key === 'ArrowLeft') moveOffset(-step, 0);
    else if (e.key === 'ArrowRight') moveOffset(step, 0);
    else if (e.key === 'Home') setState((prev) => ({ ...prev, design: { ...prev.design, x: 0, y: 0 } }));
    e.preventDefault();
  }

  /* ---------- drag-to-position (pointer) ---------- */
  function handlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    d.dragging = true;
    d.moved = false;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.origX = state.design.x;
    d.origY = state.design.y;
    d.snapshot = state;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore — capture is a nicety, drag still tracks via move/up */
    }
  }
  function handlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d.dragging) return;
    const rect = stageSurfaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const scaleFactor = VB_W / rect.width;
    const dx = (e.clientX - d.startX) * scaleFactor;
    const dy = (e.clientY - d.startY) * scaleFactor;
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) d.moved = true;
    const nx = clamp(d.origX + dx, -200, 200);
    const ny = clamp(d.origY + dy, -200, 200);
    setState((prev) => ({ ...prev, design: { ...prev.design, x: nx, y: ny } }));
  }
  function handlePointerEnd() {
    const d = drag.current;
    if (!d.dragging) return;
    d.dragging = false;
    if (d.moved && d.snapshot) pushUndo(d.snapshot);
    d.snapshot = null;
  }

  /* ---------- size / qty ---------- */
  function handleSizeSelect(s: string) {
    if (s === state.size) return;
    setState((prev) => ({ ...prev, size: s }));
  }
  function handleQtyMinus() {
    setState((prev) => ({ ...prev, qty: sanitizeQty(prev.qty - 1) }));
  }
  function handleQtyPlus() {
    setState((prev) => ({ ...prev, qty: sanitizeQty(prev.qty + 1) }));
  }

  /* ---------- add to cart ---------- */
  function buildThumb(): string {
    const svg = buildSvg(state.design, { thumb: true, forceView: 'front', uid: 'thumb' });
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  function handleAddToCart() {
    const garment = garmentOf(state.design.garment);
    const print = KA_PRINTS.get(state.design.printId);
    const price = KA_CORE.studioPrice(state.design);
    const name = (garment ? garment.name : 'Custom garment') + ' — ' + (print ? print.name : 'Custom print');
    const base = {
      kind: 'custom' as const,
      name,
      garment: state.design.garment,
      colour: state.design.colour,
      size: state.size,
      qty: state.qty,
      price,
      design: { ...state.design },
    };
    try {
      cart.addItem({ ...base, thumb: buildThumb() } as any);
    } catch {
      try {
        cart.addItem(base as any);
      } catch {
        toast('Could not add to cart — try again', 'err');
        return;
      }
    }
    toast('Added to cart', 'ok');
  }

  return (
    <section className="studio-shell">
      <div className="wrap">
        <p className={cn('link-notice', fallbackNotice && 'show')} id="linkNotice" role="status" aria-live="polite">
          {fallbackNotice}
        </p>

        <div className="studio-layout">
          {/* ===== LEFT: live preview stage ===== */}
          <div className="stage-col">
            <div className="stage-card">
              <div className="stage-toolbar">
                <div className="view-toggle" role="group" aria-label="Garment view">
                  <button
                    type="button"
                    id="btnViewFront"
                    className={cn('vt-btn', state.design.view === 'front' && 'on')}
                    aria-pressed={state.design.view === 'front'}
                    onClick={() => handleViewToggle('front')}
                  >
                    Front
                  </button>
                  <button
                    type="button"
                    id="btnViewBack"
                    className={cn('vt-btn', state.design.view === 'back' && 'on')}
                    aria-pressed={state.design.view === 'back'}
                    onClick={() => handleViewToggle('back')}
                  >
                    Back
                  </button>
                </div>
                <div className="stage-actions">
                  <button type="button" id="btnUndo" className="icon-btn" disabled={undoStack.length === 0} onClick={doUndo}>
                    ↺ Undo
                  </button>
                  <button type="button" id="btnRandomize" className="icon-btn" onClick={handleRandomize}>
                    ⚄ Randomize
                  </button>
                  <button type="button" id="btnReset" className="icon-btn" onClick={handleReset}>
                    Reset
                  </button>
                </div>
              </div>

              <div
                className="stage-surface"
                id="stageSurface"
                ref={stageSurfaceRef}
                tabIndex={0}
                role="group"
                aria-label="Print position on the garment. Drag with mouse or touch to move the print, or use the arrow keys to nudge it — hold Shift for a bigger step, Home to re-centre."
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onKeyDown={handleStageKeyDown}
              >
                <div id="stageMount" dangerouslySetInnerHTML={{ __html: stageSvg }} />
                <p className="stage-note" id="stageNote" aria-live="polite">
                  {stageNote}
                </p>
              </div>

              <p className="drag-hint">Drag the print to reposition it · Arrow keys nudge · Shift+Arrow moves further · Home re-centres.</p>
              <div className="stage-linkrow">
                <button type="button" id="btnCopyLink" className="btn btn-gold" onClick={handleCopyLink}>
                  Copy shareable link
                </button>
              </div>
            </div>

            <div className="spec-sheet" id="specSheet" aria-live="polite">
              <h2>Spec sheet — what the workshop cuts</h2>
              <SpecRow label="Garment" value={g ? g.name : '—'} />
              <SpecRow label="Colour" value={c ? c.name : '—'} />
              <SpecRow label="Print" value={(pr ? pr.name : '—') + (pr && pr.family ? ' · ' + pr.family : '')} />
              {pr && pr.meaning && <SpecRow label="Meaning" value={pr.meaning} />}
              <SpecRow
                label="Placement"
                value={(pl ? pl.name : '—') + (pl && pl.surcharge > 0 ? ` (+${KA_CORE.money(pl.surcharge)})` : ' (included)')}
              />
              <SpecRow label="Scale" value={`×${state.design.scale.toFixed(2)}`} />
              <SpecRow label="Rotation" value={`${Math.round(state.design.rotate)}°`} />
              <SpecRow label="Position offset" value={`${Math.round(state.design.x)}px, ${Math.round(state.design.y)}px from centre`} />
              <SpecRow label="Size" value={state.size} />
              <SpecRow label="Quantity" value={String(state.qty)} />
              <SpecRow label="Unit price" value={KA_CORE.money(unitPrice)} />
              <SpecRow label="Lead time" value={KA_CONFIG.leadTime || ''} />
              <p className="spec-note">Every Tee Studio piece is cut and sewn to this exact layout after you order — no two placements fall the same.</p>
            </div>
          </div>

          {/* ===== RIGHT: stepped control panel ===== */}
          <div className="panel-col">
            <div className="step" id="stepGarment">
              <div className="step-head">
                <span className="s-num">1</span>
                <h2>Garment</h2>
              </div>
              <p className="step-hint">Heavyweight cotton, cut and sewn to order.</p>
              <div className="garment-grid" id="garmentGrid">
                {CFG.garments.map((garment) => {
                  const on = garment.id === state.design.garment;
                  return (
                    <button
                      key={garment.id}
                      type="button"
                      className="opt-card"
                      aria-pressed={on}
                      onClick={() => handleGarmentSelect(garment.id)}
                    >
                      <span className="oc-name">{garment.name}</span>
                      <span className="oc-price">{KA_CORE.money(garment.base)} base</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="step" id="stepColour">
              <div className="step-head">
                <span className="s-num">2</span>
                <h2>Colour</h2>
              </div>
              <p className="step-hint">The base fabric colour your print sits on.</p>
              <div className="colour-grid" id="colourGrid">
                {CFG.colours.map((colour) => {
                  const on = colour.id === state.design.colour;
                  return (
                    <button
                      key={colour.id}
                      type="button"
                      className="colour-btn"
                      aria-pressed={on}
                      onClick={() => handleColourSelect(colour.id)}
                    >
                      <span className="cs-swatch" style={{ background: colour.hex }} />
                      <span className="cs-name">{colour.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="step" id="stepPrint">
              <div className="step-head">
                <span className="s-num">3</span>
                <h2>Print</h2>
              </div>
              <p className="step-hint">Kente, ankara and adinkra — every print carries a meaning.</p>
              <div className="print-tabs" id="printTabs">
                <button type="button" className={cn('pill', activeFamily === 'all' && 'on')} onClick={() => setActiveFamily('all')}>
                  All
                </button>
                {families.map((f) => (
                  <button key={f} type="button" className={cn('pill', activeFamily === f && 'on')} onClick={() => setActiveFamily(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
                <button type="button" className={cn('pill', activeFamily === 'mine' && 'on')} onClick={() => setActiveFamily('mine')}>
                  My prints ({savedPrints.length})
                </button>
              </div>
              {activeFamily === 'mine' && !savedPrints.length ? (
                <p className="print-empty" id="printEmpty">
                  You haven&apos;t saved any prints yet. Design one in the{' '}
                  <Link href="/lab" style={{ color: 'var(--gold)' }}>
                    Print Lab
                  </Link>{' '}
                  and it&apos;ll show up here.
                </p>
              ) : (
                <div className="print-grid" id="printGrid">
                  {printList.map((p) => {
                    const on = p.id === state.design.printId;
                    const uri = KA_PRINTS.dataUri(p.def, { size: 120 });
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className="print-tile"
                        aria-pressed={on}
                        onClick={() => handlePrintSelect(p.id)}
                      >
                        <span className="pt-swatch" style={{ backgroundImage: `url("${uri}")` }} />
                        <span className="pt-name">{p.name}</span>
                        {p.meaning && <span className="pt-meaning">{p.meaning}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              <Link className="print-lab-link" href="/lab">
                Design your own in the Print Lab →
              </Link>
            </div>

            <div className="step" id="stepPlacement">
              <div className="step-head">
                <span className="s-num">4</span>
                <h2>Placement</h2>
              </div>
              <p className="step-hint">Where the print sits on the garment. Some placements carry a small surcharge.</p>
              <div className="placement-grid" id="placementGrid">
                {CFG.placements.map((placement) => {
                  const on = placement.id === state.design.placement;
                  return (
                    <button
                      key={placement.id}
                      type="button"
                      className="opt-card"
                      aria-pressed={on}
                      onClick={() => handlePlacementSelect(placement.id)}
                    >
                      <span className="oc-name">{placement.name}</span>
                      <span className="oc-price">{placement.surcharge > 0 ? `+${KA_CORE.money(placement.surcharge)}` : 'Included'}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="step" id="stepFineTune">
              <div className="step-head">
                <span className="s-num">5</span>
                <h2>Fine-tune</h2>
              </div>
              <p className="step-hint">Scale and rotate the print, or nudge its position.</p>
              <div className="ft-field">
                <div className="ft-label-row">
                  <label htmlFor="ftScale">Scale</label>
                  <output id="ftScaleOut" htmlFor="ftScale">
                    ×{state.design.scale.toFixed(2)}
                  </output>
                </div>
                <input
                  ref={scaleInputRef}
                  type="range"
                  id="ftScale"
                  className="range-input"
                  min={0.4}
                  max={2.5}
                  step={0.01}
                  value={state.design.scale}
                  onChange={handleScaleInput}
                />
              </div>
              <div className="ft-field">
                <div className="ft-label-row">
                  <label htmlFor="ftRotate">Rotate</label>
                  <output id="ftRotateOut" htmlFor="ftRotate">
                    {Math.round(state.design.rotate)}°
                  </output>
                </div>
                <input
                  ref={rotateInputRef}
                  type="range"
                  id="ftRotate"
                  className="range-input"
                  min={0}
                  max={360}
                  step={1}
                  value={state.design.rotate}
                  onChange={handleRotateInput}
                />
              </div>
              <div className="ft-field">
                <div className="ft-label-row">
                  <label id="ftPosLabel">Position</label>
                </div>
                <div className="ft-nudge" role="group" aria-labelledby="ftPosLabel">
                  <button type="button" className="nudge-up" aria-label="Move print up" onClick={() => handleNudgeClick('up')}>
                    ↑
                  </button>
                  <button type="button" className="nudge-left" aria-label="Move print left" onClick={() => handleNudgeClick('left')}>
                    ←
                  </button>
                  <button type="button" className="nudge-center" aria-label="Centre print" onClick={() => handleNudgeClick('center')}>
                    ●
                  </button>
                  <button type="button" className="nudge-right" aria-label="Move print right" onClick={() => handleNudgeClick('right')}>
                    →
                  </button>
                  <button type="button" className="nudge-down" aria-label="Move print down" onClick={() => handleNudgeClick('down')}>
                    ↓
                  </button>
                </div>
              </div>
              <button type="button" id="ftReset" className="btn btn-berry ft-reset" onClick={handleFtReset}>
                Reset scale, rotation &amp; position
              </button>
            </div>

            <div className="step" id="stepSize">
              <div className="step-head">
                <span className="s-num">6</span>
                <h2>Size &amp; quantity</h2>
              </div>
              <p className="step-hint">
                Not sure which size? Check the{' '}
                <Link href="/sizing" style={{ color: 'var(--gold)' }}>
                  size charts
                </Link>
                .
              </p>
              <div className="size-grid" id="sizeGrid" role="radiogroup" aria-label="Size">
                {CFG.sizes.map((s, i) => {
                  const on = s === state.size;
                  const id = 'size_' + i;
                  return (
                    <span key={s} className={cn('pill', 'size-pill', on && 'on')}>
                      <input type="radio" name="studioSize" id={id} value={s} checked={on} onChange={() => handleSizeSelect(s)} />
                      <label htmlFor={id}>{s}</label>
                    </span>
                  );
                })}
              </div>
              <div className="qty-row">
                <span className="size-guide-link">Quantity</span>
                <div className="ci-qty">
                  <button type="button" id="qtyMinus" aria-label="Decrease quantity" onClick={handleQtyMinus}>
                    −
                  </button>
                  <span id="qtyValue">{state.qty}</span>
                  <button type="button" id="qtyPlus" aria-label="Increase quantity" onClick={handleQtyPlus}>
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="price-bar">
              <div className="price-breakdown" id="priceBreakdown">
                <div className="pb-row">
                  <span>{g ? g.name : ''}</span>
                  <span>{KA_CORE.money(g ? g.base : 0)}</span>
                </div>
                <div className="pb-row">
                  <span>{pl ? pl.name : ''}</span>
                  <span>{pl && pl.surcharge > 0 ? `+${KA_CORE.money(pl.surcharge)}` : 'Included'}</span>
                </div>
                <div className="pb-row">
                  <span>Qty</span>
                  <span>× {state.qty}</span>
                </div>
                <div className="pb-total">
                  <span>Total</span>
                  <span>{KA_CORE.money(total)}</span>
                </div>
              </div>
              <button type="button" id="btnAddToCart" className="btn btn-solid" onClick={handleAddToCart}>
                Add to cart
              </button>
              <p className="lead-time" id="leadTimeNote">
                Made to order · ships in {KA_CONFIG.leadTime}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
