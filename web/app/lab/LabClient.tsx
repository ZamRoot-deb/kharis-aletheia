'use client';

/* KHARIS & ALETHEIA — PRINT LAB client logic. Ported from ../lab.js (CONTRACT-NEXT.md
   "lab" row: family tabs, start-from gallery, palette editor, family params, seed +
   randomize, undo/redo, reset, live tiled preview + zoom + on-a-tee toggle, name
   field, Save to My Prints (dedupe on unchanged), My-prints shelf, Download SVG,
   Send to Tee Studio, meaning panel, aria-live status, ka_lab persistence).

   State replaces the original's imperative DOM rebuilds (renderX() functions) with
   plain React state + declarative JSX — CONTRACT-NEXT.md explicitly allows either
   approach ("a ref + effect ... is fine and preferred for fidelity", not required).
   Refs+effects are used exactly where the browser's own semantics need them: the
   native 'change' event on range/colour inputs (useCommitRef, lab-fields.tsx) so a
   history entry is pushed once per drag/keystep release rather than on every tick;
   the global Ctrl/Cmd+Z undo/redo listener; the dice-spin restart; and the seed
   field, which (like the original) is read on demand rather than controlled. */

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useRouter } from 'next/navigation';
import { KA_PRINTS } from '@/lib/prints';
import type { PrintDef, PrintEntry, PrintFamily, PrintSymbol } from '@/lib/types';
import { useModal, useToast } from '@/app/providers';
import { cn } from '@/lib/cn';
import {
  FAMILIES,
  FAMILY_LABEL,
  FAMILY_MEANING,
  MOTIF_OPTS,
  ANKARA_MOTIFS,
  FRAME_OPTS,
  HOUSE_PALETTES,
  HIST_MAX,
  LS_KEY,
  type HousePalette,
} from './lab-constants';
import { clone, randSeed, clampZoom, prefersReducedMotion, slugify, capitalize, makerName, findSymbol, shuffleArray } from './lab-utils';
import { RangeField, SegField, MultiSegField, BoolRow, BandHeightsField, SymbolPickerField, ColorSwatch } from './lab-fields';

interface HistEntry {
  family: PrintFamily;
  def: PrintDef;
  seed: string;
}

interface LabPersisted {
  family: PrintFamily;
  def: unknown;
  seed?: string;
  zoom?: number;
  teeMock?: boolean;
}

interface ParamCommitAPI {
  /** Continuous edit tick — updates the live def, no history entry, no persist. */
  liveMutate: (mutator: (d: PrintDef) => void) => void;
  /** Commits whatever the def currently is (called on a range/colour's native 'change'). */
  commitCurrent: () => void;
  /** Discrete edit (pill/checkbox/click) — mutate + commit in one atomic step. */
  applyCommit: (mutator: (d: PrintDef) => void) => void;
  announce: (msg: string) => void;
}

function persistState(f: PrintFamily, d: PrintDef, s: string, z: number, t: boolean) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({ family: f, def: d, seed: s, zoom: z, teeMock: t }));
  } catch {
    /* private mode / quota exceeded — in-memory state still works this visit */
  }
}

function tryRestore(): LabPersisted | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.def || FAMILIES.indexOf(parsed.family) === -1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function LabClient() {
  const router = useRouter();
  const { toast } = useToast();
  const modal = useModal();

  /* Identical on server + first client render (HYDRATION rule) — corrected from
     localStorage in the mount-only effect below, same pattern as app/providers.tsx. */
  const [family, setFamily] = useState<PrintFamily>('kente');
  const [def, setDef] = useState<PrintDef>(() => KA_PRINTS.defaults('kente'));
  const [seed, setSeed] = useState('');
  const [zoom, setZoom] = useState(1);
  const [teeMock, setTeeMock] = useState(false);
  const [sourcePrint, setSourcePrint] = useState<PrintEntry | null>(null);
  const [hist, setHist] = useState<{ list: HistEntry[]; index: number }>({ list: [], index: -1 });
  const [shelf, setShelf] = useState<PrintEntry[]>([]);
  const [status, setStatus] = useState('');

  const lastSavedRef = useRef<{ id: string; fingerprint: string } | null>(null);
  const seedInputRef = useRef<HTMLInputElement>(null);
  const addSwatchBtnRef = useRef<HTMLButtonElement>(null);
  const addBandBtnRef = useRef<HTMLButtonElement>(null);
  const diceRef = useRef<HTMLSpanElement>(null);
  const controlsRef = useRef<HTMLDivElement>(null);

  function announce(msg: string) {
    setStatus('');
    requestAnimationFrame(() => setStatus(msg));
  }

  /* ============ history (undo / redo) ============ */

  function pushHistory(f: PrintFamily, d: PrintDef, s: string) {
    const trimmed = hist.list.slice(0, hist.index + 1);
    let list = [...trimmed, { family: f, def: clone(d), seed: s }];
    let index = list.length - 1;
    if (list.length > HIST_MAX) {
      list = list.slice(1);
      index = list.length - 1;
    }
    setHist({ list, index });
  }

  function goHistory(delta: number) {
    const target = hist.index + delta;
    if (target < 0 || target >= hist.list.length) return;
    const snap = hist.list[target];
    setSourcePrint(null);
    setFamily(snap.family);
    setDef(clone(snap.def));
    setSeed(snap.seed);
    setHist((prev) => ({ ...prev, index: target }));
    announce(delta < 0 ? 'Undo.' : 'Redo.');
  }

  const goHistoryRef = useRef(goHistory);
  goHistoryRef.current = goHistory;

  /* global Ctrl/Cmd+Z (Shift = redo) — bound once, always calls the latest goHistory */
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || (e.key !== 'z' && e.key !== 'Z')) return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active ? active.tagName : '';
      const typingField = (tag === 'INPUT' && (active as HTMLInputElement).type === 'text') || tag === 'TEXTAREA';
      if (typingField) return; // let the browser's native text-undo run
      e.preventDefault();
      if (e.shiftKey) goHistoryRef.current(1);
      else goHistoryRef.current(-1);
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  /* ============ core state transitions ============ */

  function loadDef(rawDef: unknown, newFamily: PrintFamily, newSeed: string) {
    const clean = KA_PRINTS.sanitize(clone(rawDef));
    setFamily(newFamily);
    setDef(clean);
    setSeed(newSeed);
    pushHistory(newFamily, clean, newSeed);
    persistState(newFamily, clean, newSeed, zoom, teeMock);
  }

  const api: ParamCommitAPI = {
    liveMutate(mutator) {
      setDef((prev) => {
        const next = clone(prev);
        mutator(next);
        return next;
      });
    },
    commitCurrent() {
      setSourcePrint(null);
      pushHistory(family, def, seed);
      persistState(family, def, seed, zoom, teeMock);
    },
    applyCommit(mutator) {
      const next = clone(def);
      mutator(next);
      setDef(next);
      setSourcePrint(null);
      pushHistory(family, next, seed);
      persistState(family, next, seed, zoom, teeMock);
    },
    announce,
  };

  /* ============ mount: restore ka_lab + shelf ============ */

  useEffect(() => {
    const restored = tryRestore();
    const fam: PrintFamily = restored?.family || 'kente';
    const rawDef = restored?.def || KA_PRINTS.defaults(fam);
    const newSeed = restored && restored.seed != null ? String(restored.seed) : randSeed();
    const newZoom = restored && restored.zoom != null ? clampZoom(restored.zoom) : 1;
    const newTeeMock = !!(restored && restored.teeMock);

    const clean = KA_PRINTS.sanitize(clone(rawDef));
    setFamily(fam);
    setDef(clean);
    setSeed(newSeed);
    setZoom(newZoom);
    setTeeMock(newTeeMock);
    setSourcePrint(null);
    setHist({ list: [{ family: fam, def: clone(clean), seed: newSeed }], index: 0 });
    persistState(fam, clean, newSeed, newZoom, newTeeMock);
    setShelf(KA_PRINTS.saved.list());
    announce('Print Lab ready.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* keep the (uncontrolled) seed field in sync with state.seed, exactly like the
     original's renderSeedField() — the user can still freely type into it without
     that being clobbered until an explicit load/reset/undo/redo changes `seed`. */
  useEffect(() => {
    if (seedInputRef.current) seedInputRef.current.value = seed;
  }, [seed]);

  function spinDice() {
    const el = diceRef.current;
    if (!el || prefersReducedMotion()) return;
    el.classList.remove('spin');
    void el.offsetWidth;
    el.classList.add('spin');
  }

  function refreshShelf() {
    setShelf(KA_PRINTS.saved.list());
  }

  /* ============ family / gallery / reset / randomize ============ */

  function handleSwitchFamily(f: PrintFamily) {
    if (f === family) return;
    const fresh = KA_PRINTS.defaults(f);
    const newSeed = randSeed();
    setSourcePrint(null);
    loadDef(fresh, f, newSeed);
    announce(`Switched to ${FAMILY_LABEL[f]}.`);
  }

  function handleLoadGalleryItem(item: PrintEntry) {
    setSourcePrint(item);
    const newSeed = randSeed();
    loadDef(item.def, item.family, newSeed);
    announce(`Loaded "${item.name}".`);
  }

  function handleReset() {
    const fresh = KA_PRINTS.defaults(family);
    const newSeed = randSeed();
    setSourcePrint(null);
    loadDef(fresh, family, newSeed);
    announce(`Reset to the default ${FAMILY_LABEL[family]} print.`);
  }

  function handleRandomize() {
    const raw = seedInputRef.current?.value || '';
    const seedVal = raw.trim() || randSeed();
    let remixed: PrintDef;
    try {
      const clean = KA_PRINTS.sanitize(clone(def));
      remixed = KA_PRINTS.randomize(clean, seedVal);
    } catch {
      announce('Randomize failed for that seed — try another.');
      return;
    }
    setSourcePrint(null);
    loadDef(remixed, remixed.family || family, seedVal);
    spinDice();
    announce(`Randomized with seed ${seedVal}.`);
  }

  /* ============ name field ============ */

  function handleNameBlur() {
    const trimmed = def.name.trim();
    const finalName = trimmed || 'Untitled remix';
    api.applyCommit((d) => {
      d.name = finalName;
    });
  }

  /* ============ save / download / send ============ */

  function saveCurrentAsNewPrint(announceResult: boolean): string | null {
    const name = (def.name || '').trim() || 'Untitled remix';
    if (name !== def.name) setDef((prev) => ({ ...prev, name }));
    let clean: PrintDef;
    try {
      clean = KA_PRINTS.sanitize({ ...def, name });
    } catch {
      toast('Could not prepare this print to save.', 'err');
      return null;
    }
    /* unchanged since the last save (e.g. Save then Send to Tee Studio) — reuse
       that print, don't duplicate it */
    const fingerprint = JSON.stringify(clean);
    if (lastSavedRef.current && lastSavedRef.current.fingerprint === fingerprint && KA_PRINTS.get(lastSavedRef.current.id)) {
      if (announceResult) {
        toast(`"${name}" is already in My Prints.`, 'ok');
        announce('Already saved.');
      }
      return lastSavedRef.current.id;
    }
    let result: PrintEntry;
    try {
      result = KA_PRINTS.saved.save(clean);
    } catch {
      toast('Saving failed — please try again.', 'err');
      announce('Save failed.');
      return null;
    }
    lastSavedRef.current = { id: result.id, fingerprint };
    refreshShelf();
    if (announceResult) {
      toast(`Saved "${name}" to My Prints.`, 'ok');
      announce(`Saved "${name}" to My Prints.`);
    }
    return result.id;
  }

  function handleDownload() {
    let clean: PrintDef;
    try {
      clean = KA_PRINTS.sanitize(def);
    } catch {
      toast('Could not prepare the SVG.', 'err');
      return;
    }
    let svg: string;
    try {
      svg = KA_PRINTS.tileSvg(clean, { size: 1024 });
    } catch {
      toast('Download failed — try adjusting the print first.', 'err');
      return;
    }
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slugify(def.name || 'kharis-aletheia-print') + '.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast(`Downloading ${a.download}`, 'ok');
    announce('SVG download started.');
  }

  function handleSendStudio() {
    const id = saveCurrentAsNewPrint(false);
    if (!id) {
      toast('Could not send to the Tee Studio — try saving first.', 'err');
      return;
    }
    toast('Sending to Tee Studio…', 'ok');
    announce(`Sending "${def.name || 'this print'}" to the Tee Studio.`);
    router.push(`/studio#print=${encodeURIComponent(id)}`);
  }

  /* ============ my prints shelf ============ */

  function handleShelfLoad(item: PrintEntry) {
    const full = KA_PRINTS.get(item.id) || item;
    const defToLoad = full.def || item.def;
    if (!defToLoad) {
      toast('That print could not be loaded.', 'err');
      return;
    }
    setSourcePrint(null);
    const newSeed = randSeed();
    loadDef(defToLoad, full.family || item.family, newSeed);
    toast(`Loaded "${full.name || item.name}".`, 'ok');
    announce(`Loaded "${full.name || item.name}" into the editor.`);
    controlsRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }

  function handleRenameSave(item: PrintEntry, rawName: string) {
    const full = KA_PRINTS.get(item.id) || item;
    const def0 = full.def || item.def;
    const fam0 = full.family || item.family;
    const newName = rawName.trim() || full.name || item.name;
    if (!def0) {
      toast('That print has no data to rename.', 'err');
      return;
    }
    let clean: PrintDef;
    try {
      clean = KA_PRINTS.sanitize(clone(def0));
    } catch {
      clean = clone(def0);
    }
    clean.name = newName;
    clean.family = fam0;
    try {
      KA_PRINTS.saved.remove(item.id);
      KA_PRINTS.saved.save(clean);
    } catch {
      toast('Rename failed — please try again.', 'err');
      refreshShelf();
      return;
    }
    refreshShelf();
    toast(`Renamed to "${newName}".`, 'ok');
    announce(`Renamed print to "${newName}".`);
  }

  function handleDuplicate(item: PrintEntry) {
    const full = KA_PRINTS.get(item.id) || item;
    const def0 = full.def || item.def;
    const name = full.name || item.name;
    const fam0 = full.family || item.family;
    if (!def0) {
      toast('That print has no data to duplicate.', 'err');
      return;
    }
    let clean: PrintDef;
    try {
      clean = KA_PRINTS.sanitize(clone(def0));
    } catch {
      clean = clone(def0);
    }
    clean.name = `${name} (copy)`;
    clean.family = fam0;
    try {
      KA_PRINTS.saved.save(clean);
    } catch {
      toast('Duplicate failed — please try again.', 'err');
      return;
    }
    refreshShelf();
    toast(`Duplicated as "${clean.name}".`, 'ok');
    announce(`Duplicated as "${clean.name}".`);
  }

  function handleDeleteRequest(item: PrintEntry, name: string) {
    modal.open(
      <ConfirmDeleteDialog
        name={name}
        onCancel={() => modal.close()}
        onConfirm={() => {
          try {
            KA_PRINTS.saved.remove(item.id);
          } catch {
            toast('Delete failed — please try again.', 'err');
            modal.close();
            return;
          }
          modal.close();
          refreshShelf();
          toast(`Deleted "${name}".`, 'ok');
          announce(`Deleted "${name}" from My Prints.`);
        }}
      />,
      { label: 'Confirm delete' }
    );
  }

  /* ============ preview + tee mock ============ */

  let previewUri: string | null = null;
  let previewClean: PrintDef | null = null;
  try {
    previewClean = KA_PRINTS.sanitize(def);
    previewUri = KA_PRINTS.dataUri(previewClean, { size: 480 });
  } catch {
    previewUri = null;
    previewClean = null;
  }

  const galleryItems = KA_PRINTS.list().filter((p) => p.family === family);

  /* ============ render ============ */

  return (
    <section className="lab-section">
      <div className="wrap">
        <div id="labStatus" className="visually-hidden" role="status" aria-live="polite">
          {status}
        </div>

        <div className="pill-row" id="labFamilyTabs" role="group" aria-label="Print family">
          {FAMILIES.map((f) => (
            <button
              key={f}
              type="button"
              className={cn('pill', f === family && 'on')}
              aria-pressed={f === family}
              onClick={() => handleSwitchFamily(f)}
            >
              {FAMILY_LABEL[f]}
            </button>
          ))}
        </div>

        <div className="lab-block lab-gallery-wrap">
          <p className="lab-block-title">Start from</p>
          <p className="lab-block-hint">Built-in prints for this family — pick one as a starting point, then make it yours.</p>
          <div className="lab-gallery" id="labGallery" aria-label="Built-in print gallery" tabIndex={0}>
            {galleryItems.length === 0 ? (
              <p className="lab-gallery-empty">
                No built-in {FAMILY_LABEL[family]} prints yet — start from Reset and remix your own.
              </p>
            ) : (
              galleryItems.map((item) => {
                const on = !!(sourcePrint && sourcePrint.id === item.id);
                let thumb: string | null = null;
                try {
                  thumb = KA_PRINTS.dataUri(item.def, { size: 160 });
                } catch {
                  thumb = null;
                }
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={cn('lab-card', on && 'on')}
                    aria-pressed={on}
                    title={item.meaning ? `${item.name} — ${item.meaning}` : item.name}
                    onClick={() => handleLoadGalleryItem(item)}
                  >
                    <span className="lc-thumb">{thumb && <img decoding="async" alt="" src={thumb} />}</span>
                    <span className="lc-name">{item.name}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lab-grid">
          <div className="lab-controls" id="labControls" ref={controlsRef}>
            <div className="lab-block">
              <p className="lab-block-title">Palette</p>
              <p className="lab-block-hint">House presets, or edit each swatch. 2–6 colours.</p>
              <div className="lab-palette-presets" role="group" aria-label="House palette presets">
                {HOUSE_PALETTES.map((preset: HousePalette) => (
                  <button
                    key={preset.name}
                    type="button"
                    className="lab-preset"
                    title={preset.name}
                    aria-label={`Apply the ${preset.name} palette`}
                    onClick={() => {
                      api.applyCommit((d) => {
                        d.palette = preset.hexes.slice();
                      });
                      announce(`Applied the ${preset.name} palette.`);
                    }}
                  >
                    {preset.hexes.map((hex, i) => (
                      <i key={i} style={{ background: hex }} />
                    ))}
                  </button>
                ))}
              </div>
              <div className="lab-swatches" role="group" aria-label="Print palette swatches">
                {def.palette.map((hex, idx) => (
                  <ColorSwatch
                    key={idx}
                    index={idx}
                    hex={hex}
                    canRemove={def.palette.length > 2}
                    onInput={(v) =>
                      api.liveMutate((d) => {
                        d.palette[idx] = v;
                      })
                    }
                    onCommit={api.commitCurrent}
                    onRemove={() => {
                      if (def.palette.length <= 2) return;
                      api.applyCommit((d) => {
                        d.palette.splice(idx, 1);
                      });
                      announce('Swatch removed.');
                      addSwatchBtnRef.current?.focus();
                    }}
                  />
                ))}
              </div>
              <div className="lab-swatch-actions">
                <button
                  type="button"
                  ref={addSwatchBtnRef}
                  className="btn btn-gold"
                  id="labAddSwatch"
                  disabled={def.palette.length >= 6}
                  onClick={() => {
                    if (def.palette.length >= 6) return;
                    api.applyCommit((d) => {
                      d.palette.push(d.palette[d.palette.length - 1] || '#d8b26a');
                    });
                    announce('Swatch added.');
                  }}
                >
                  + Add swatch
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  id="labShuffleSwatch"
                  disabled={def.palette.length < 2}
                  onClick={() => {
                    api.applyCommit((d) => {
                      shuffleArray(d.palette);
                    });
                    announce('Palette order shuffled.');
                  }}
                >
                  Shuffle order
                </button>
              </div>
            </div>

            <div className="lab-block" id="labParamsBlock">
              <p className="lab-block-title" id="labParamsTitle">
                {FAMILY_LABEL[family]} pattern
              </p>
              <div id="labParams">
                {family === 'kente' && <KenteParams p={def.params} api={api} addBandBtnRef={addBandBtnRef} />}
                {family === 'ankara' && <AnkaraParams p={def.params} api={api} />}
                {family === 'adinkra' && <AdinkraParams p={def.params} api={api} />}
              </div>
            </div>

            <div className="lab-block lab-tools">
              <p className="lab-block-title">Seed &amp; history</p>
              <div className="lab-field">
                <label htmlFor="labSeed">Seed</label>
                <input ref={seedInputRef} type="text" id="labSeed" defaultValue={seed} inputMode="numeric" autoComplete="off" spellCheck={false} />
              </div>
              <div className="lab-tool-btns">
                <button type="button" className="btn btn-berry" id="labRandomize" onClick={handleRandomize}>
                  <span className="lab-dice" id="labDiceIcon" ref={diceRef} aria-hidden="true">
                    🎲
                  </span>{' '}
                  Randomize
                </button>
                <button type="button" className="btn btn-gold" id="labUndo" disabled={hist.index <= 0} onClick={() => goHistory(-1)}>
                  {'↶'} Undo
                </button>
                <button
                  type="button"
                  className="btn btn-gold"
                  id="labRedo"
                  disabled={hist.index >= hist.list.length - 1}
                  onClick={() => goHistory(1)}
                >
                  {'↷'} Redo
                </button>
                <button type="button" className="btn btn-gold" id="labReset" onClick={handleReset}>
                  Reset family
                </button>
              </div>
            </div>

            <div className="lab-block">
              <p className="lab-block-title">Name &amp; save</p>
              <div className="pd-field">
                <label htmlFor="labName">Print name</label>
                <input
                  type="text"
                  id="labName"
                  maxLength={48}
                  placeholder="Untitled remix"
                  autoComplete="off"
                  value={def.name}
                  onChange={(e) =>
                    api.liveMutate((d) => {
                      d.name = e.target.value;
                    })
                  }
                  onBlur={handleNameBlur}
                />
              </div>
              <div className="lab-save-row">
                <button type="button" className="btn btn-solid" id="labSave" onClick={() => saveCurrentAsNewPrint(true)}>
                  Save to My Prints
                </button>
                <button type="button" className="btn btn-gold" id="labDownload" onClick={handleDownload}>
                  Download SVG
                </button>
                <button type="button" className="btn btn-berry" id="labSendStudio" onClick={handleSendStudio}>
                  Send to Tee Studio →
                </button>
              </div>
            </div>
          </div>

          <div className="lab-preview-col">
            <div className="lab-block">
              <div className="lab-preview-head">
                <div className="lab-zoom">
                  <label htmlFor="labZoom">Zoom</label>
                  <input
                    type="range"
                    id="labZoom"
                    min={0.5}
                    max={3}
                    step={0.1}
                    value={zoom}
                    aria-describedby="labZoomOut"
                    onChange={(e) => {
                      const v = clampZoom(parseFloat(e.target.value));
                      setZoom(v);
                      persistState(family, def, seed, v, teeMock);
                    }}
                  />
                  <output id="labZoomOut" htmlFor="labZoom">
                    {Math.round(zoom * 100)}%
                  </output>
                </div>
                <label className="lab-toggle">
                  <input
                    type="checkbox"
                    id="labTeeToggle"
                    checked={teeMock}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setTeeMock(v);
                      persistState(family, def, seed, zoom, v);
                      announce(v ? 'Showing the tee mock-up.' : 'Hid the tee mock-up.');
                    }}
                  />
                  <span className="lt-box" aria-hidden="true" />
                  <span>On a tee</span>
                </label>
              </div>
            </div>

            <div
              id="labPreview"
              role="img"
              aria-label={`Live tiled preview of ${def.name || 'this'} print`}
              className={cn(!previewUri && 'is-empty')}
              style={
                previewUri
                  ? { backgroundImage: `url("${previewUri}")`, backgroundSize: `${Math.round(160 * zoom)}px` }
                  : { backgroundImage: 'none' }
              }
            />

            {previewUri && previewClean && <TeeMock show={teeMock} def={previewClean} />}

            <MeaningPanel family={family} sourcePrint={sourcePrint} def={def} />
          </div>
        </div>

        <div className="lab-shelf-wrap">
          <div className="sec-head">
            <p className="micro">Your archive</p>
            <h2 className="h-display h-md">MY PRINTS</h2>
          </div>
          <div className="lab-shelf" id="labShelf">
            {shelf.length === 0 ? (
              <p className="lab-shelf-empty">Nothing saved yet — remix a print above and hit “Save to My Prints.”</p>
            ) : (
              shelf.map((item) => (
                <ShelfCard
                  key={item.id}
                  item={item}
                  onLoad={() => handleShelfLoad(item)}
                  onRename={(v) => handleRenameSave(item, v)}
                  onDuplicate={() => handleDuplicate(item)}
                  onDelete={() => handleDeleteRequest(item, item.name)}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ============ family-specific param panels ============ */

function KenteParams({ p, api, addBandBtnRef }: { p: any; api: ParamCommitAPI; addBandBtnRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <>
      <RangeField
        label="Strips"
        value={p.strips}
        min={3}
        max={8}
        step={1}
        onInput={(v) =>
          api.liveMutate((d) => {
            d.params.strips = v;
          })
        }
        onCommit={api.commitCurrent}
      />
      <MultiSegField
        label="Block motifs — pick one or more"
        options={MOTIF_OPTS}
        values={p.blockMotifs}
        format={capitalize}
        onChange={(next) =>
          api.applyCommit((d) => {
            d.params.blockMotifs = next;
          })
        }
        onBlocked={() => api.announce('At least one option must stay selected.')}
      />
      <RangeField
        label="Weft lines"
        value={p.weftLines}
        min={0}
        max={10}
        step={1}
        onInput={(v) =>
          api.liveMutate((d) => {
            d.params.weftLines = v;
          })
        }
        onCommit={api.commitCurrent}
      />
      <BandHeightsField
        heights={p.bandHeights}
        onInput={(idx, v) =>
          api.liveMutate((d) => {
            d.params.bandHeights[idx] = v;
          })
        }
        onCommit={api.commitCurrent}
        onRemove={(idx) => {
          if (p.bandHeights.length <= 2) return;
          api.applyCommit((d) => {
            d.params.bandHeights.splice(idx, 1);
          });
          api.announce('Band removed.');
        }}
        onAdd={() => {
          if (p.bandHeights.length >= 5) return;
          api.applyCommit((d) => {
            const arr = d.params.bandHeights;
            arr.push(arr[arr.length - 1] || 8);
          });
          api.announce('Band added.');
          addBandBtnRef.current?.focus();
        }}
        addBtnRef={addBandBtnRef}
      />
    </>
  );
}

function AnkaraParams({ p, api }: { p: any; api: ParamCommitAPI }) {
  return (
    <>
      <SegField
        label="Motif"
        options={ANKARA_MOTIFS}
        value={p.motif}
        format={capitalize}
        onChange={(v) =>
          api.applyCommit((d) => {
            d.params.motif = v;
          })
        }
      />
      <RangeField
        label="Scale"
        value={p.scale}
        min={0.4}
        max={2.5}
        step={0.1}
        decimals={1}
        onInput={(v) =>
          api.liveMutate((d) => {
            d.params.scale = v;
          })
        }
        onCommit={api.commitCurrent}
      />
      <BoolRow
        items={[
          {
            key: 'outline',
            label: 'Outline',
            value: p.outline,
            onChange: (v) =>
              api.applyCommit((d) => {
                d.params.outline = v;
              }),
          },
          {
            key: 'dotFill',
            label: 'Dot fill',
            value: p.dotFill,
            onChange: (v) =>
              api.applyCommit((d) => {
                d.params.dotFill = v;
              }),
          },
          {
            key: 'crackle',
            label: 'Crackle',
            value: p.crackle,
            onChange: (v) =>
              api.applyCommit((d) => {
                d.params.crackle = v;
              }),
          },
        ]}
      />
    </>
  );
}

function AdinkraParams({ p, api }: { p: any; api: ParamCommitAPI }) {
  return (
    <>
      <RangeField
        label="Density"
        value={p.density}
        min={1}
        max={6}
        step={1}
        onInput={(v) =>
          api.liveMutate((d) => {
            d.params.density = v;
          })
        }
        onCommit={api.commitCurrent}
      />
      <SegField
        label="Frame"
        options={FRAME_OPTS}
        value={p.frame}
        format={capitalize}
        onChange={(v) =>
          api.applyCommit((d) => {
            d.params.frame = v;
          })
        }
      />
      <BoolRow
        items={[
          {
            key: 'alternate',
            label: 'Alternate rows',
            value: p.alternate,
            onChange: (v) =>
              api.applyCommit((d) => {
                d.params.alternate = v;
              }),
          },
          {
            key: 'rotateAlt',
            label: 'Rotate alternate',
            value: p.rotateAlt,
            onChange: (v) =>
              api.applyCommit((d) => {
                d.params.rotateAlt = v;
              }),
          },
        ]}
      />
      <SymbolPickerField
        value={p.symbol}
        onChange={(id) =>
          api.applyCommit((d) => {
            d.params.symbol = id;
          })
        }
      />
    </>
  );
}

/* ============ tee mock ============ */

function TeeMock({ show, def }: { show: boolean; def: PrintDef }) {
  if (!show) return null;
  let patternMarkup: string | null = null;
  try {
    patternMarkup = KA_PRINTS.patternDef(def, { id: 'labTeePattern', scale: 1, rotate: 0 });
  } catch {
    patternMarkup = null;
  }
  if (!patternMarkup) {
    return (
      <div className="lab-tee-mock" id="labTeeMock">
        <p className="lab-block-hint">Tee mock-up unavailable right now.</p>
      </div>
    );
  }
  return (
    <div className="lab-tee-mock" id="labTeeMock">
      <svg viewBox="0 0 300 340" role="img" aria-label="Preview of the print on a tee">
        <defs dangerouslySetInnerHTML={{ __html: patternMarkup }} />
        <path
          d="M100,42 L100,10 Q150,-4 200,10 L200,42 L252,22 L284,74 L236,98 L236,322 L64,322 L64,98 L16,74 L48,22 Z"
          style={{ fill: 'url(#labTeePattern)', stroke: 'var(--border-strong)', strokeWidth: 2 }}
        />
        <ellipse cx={150} cy={34} rx={36} ry={15} style={{ fill: 'var(--surface)', stroke: 'var(--border-strong)', strokeWidth: 1.5 }} />
      </svg>
    </div>
  );
}

/* ============ meaning panel ============ */

function MeaningPanel({ family, sourcePrint, def }: { family: PrintFamily; sourcePrint: PrintEntry | null; def: PrintDef }) {
  const famName = FAMILY_LABEL[family];
  const sym: PrintSymbol | null = family === 'adinkra' ? findSymbol(def.params.symbol) : null;
  const inspiredBy = sourcePrint ? makerName(sourcePrint.maker) : null;
  return (
    <div className="lab-meaning" id="labMeaning">
      <h3>{famName}</h3>
      {sourcePrint && sourcePrint.meaning ? (
        <>
          <p>{sourcePrint.meaning}</p>
          {inspiredBy && <p className="lab-block-hint">Inspired by a piece from {inspiredBy}.</p>}
        </>
      ) : (
        <p>{FAMILY_MEANING[family]}</p>
      )}
      {sym && (
        <div className="lab-symbol-meaning">
          <p>
            <b>{sym.name}</b> — {sym.meaning}
          </p>
        </div>
      )}
    </div>
  );
}

/* ============ my prints shelf card ============ */

function ShelfCard({
  item,
  onLoad,
  onRename,
  onDuplicate,
  onDelete,
}: {
  item: PrintEntry;
  onLoad: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [value, setValue] = useState(item.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [renaming]);

  let thumb: string | null = null;
  try {
    if (item.def) thumb = KA_PRINTS.dataUri(item.def, { size: 160 });
  } catch {
    thumb = null;
  }

  function startRename() {
    setValue(item.name);
    setRenaming(true);
  }
  function cancelRename() {
    setRenaming(false);
  }
  function saveRename() {
    onRename(value);
    setRenaming(false);
  }

  return (
    <div className="lab-shelf-card">
      <div className="lab-shelf-thumb">{thumb && <img alt="" src={thumb} />}</div>
      <div className="lab-shelf-body">
        <p className="lab-shelf-fam">{FAMILY_LABEL[item.family] || item.family}</p>
        {renaming ? (
          <div className="lab-rename-row">
            <input
              ref={inputRef}
              type="text"
              value={value}
              maxLength={48}
              aria-label={`New name for ${item.name}`}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelRename();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  saveRename();
                }
              }}
            />
            <button type="button" onClick={saveRename}>
              Save
            </button>
            <button type="button" onClick={cancelRename}>
              Cancel
            </button>
          </div>
        ) : (
          <p className="lab-shelf-name">{item.name}</p>
        )}
        <div className="lab-shelf-actions" hidden={renaming}>
          <button type="button" onClick={onLoad}>
            Load
          </button>
          <button type="button" onClick={startRename}>
            Rename
          </button>
          <button type="button" onClick={onDuplicate}>
            Duplicate
          </button>
          <button type="button" className="lab-danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ============ confirm-delete dialog (rendered inside useModal()) ============ */

function ConfirmDeleteDialog({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="lab-confirm">
      <h3 className="h-display h-md">Delete this print?</h3>
      <p>“{name}” will be removed from My Prints. This can’t be undone.</p>
      <div className="lab-confirm-btns">
        <button type="button" className="btn btn-gold" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn-berry" onClick={onConfirm}>
          Delete
        </button>
      </div>
    </div>
  );
}
