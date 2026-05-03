import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  LogicalSize,
  LogicalPosition,
  PhysicalPosition,
  PhysicalSize,
} from "@tauri-apps/api/dpi";
import "./App.css";

const DEFAULT_WORK_SECS = 15 * 60;
const DEFAULT_BREAK_SECS = 30;
const BREAK_EXIT_MS = 350;

const WIDGET = { w: 240, h: 80 } as const;
const SETTINGS_WIN = { w: 340, h: 185 } as const;

type Phase = "work" | "break" | "settings";

interface Config {
  workSecs: number;
  breakSecs: number;
  workColor: string;
  breakColor: string;
}

function fmt(secs: number): string {
  return `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, "0")}`;
}

function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

const isValidHex = (s: string) => /^#[0-9a-fA-F]{6}$/.test(s);

function readConfig(): Config {
  try {
    const raw = localStorage.getItem("eyecare-config");
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.workSecs === "number" && typeof p.breakSecs === "number") {
        return {
          workSecs: p.workSecs,
          breakSecs: p.breakSecs,
          workColor: isValidHex(p.workColor) ? p.workColor : "#f05365",
          breakColor: isValidHex(p.breakColor) ? p.breakColor : "#7d83ff",
        };
      }
    }
  } catch {}
  return {
    workSecs: DEFAULT_WORK_SECS,
    breakSecs: DEFAULT_BREAK_SECS,
    workColor: "#f05365",
    breakColor: "#7d83ff",
  };
}

export default function App() {
  const appWindow = useMemo(() => getCurrentWindow(), []);

  const [config, setConfig] = useState<Config>(readConfig);
  const [phase, setPhase] = useState<Phase>("work");
  const [remaining, setRemaining] = useState<number>(config.workSecs);
  const [breakExiting, setBreakExiting] = useState(false);
  const [fontScale, setFontScale] = useState(() => {
    const saved = localStorage.getItem("eyecare-font-scale");
    return saved ? parseFloat(saved) : 1;
  });

  const [inputWorkMin, setInputWorkMin] = useState("15");
  const [inputWorkSec, setInputWorkSec] = useState("0");
  const [inputBreakMin, setInputBreakMin] = useState("0");
  const [inputBreakSec, setInputBreakSec] = useState("30");
  const [inputWorkColor, setInputWorkColor] = useState("#f05365");
  const [inputBreakColor, setInputBreakColor] = useState("#7d83ff");

  const phaseRef = useRef<Phase>("work");
  const configRef = useRef<Config>(config);
  const remainingRef = useRef<number>(config.workSecs);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedPosRef = useRef<{ x: number; y: number } | null>(null);
  const savedSizeRef = useRef<{ w: number; h: number } | null>(null);
  phaseRef.current = phase;
  configRef.current = config;

  /* ── Window positioning ── */

  const toWorkMode = useCallback(async () => {
    await appWindow.setDecorations(true);
    const restoreSize =
      savedSizeRef.current ??
      (() => {
        const s = localStorage.getItem("eyecare-window-size");
        return s ? (JSON.parse(s) as { w: number; h: number }) : null;
      })();
    if (restoreSize) {
      await appWindow.setSize(new PhysicalSize(restoreSize.w, restoreSize.h));
    } else {
      await appWindow.setSize(new LogicalSize(WIDGET.w, WIDGET.h));
    }
    savedSizeRef.current = null;
    if (savedPosRef.current) {
      await appWindow.setPosition(
        new PhysicalPosition(savedPosRef.current.x, savedPosRef.current.y),
      );
      savedPosRef.current = null;
    }
    await appWindow.show();
  }, [appWindow]);

  const toBreakMode = useCallback(async () => {
    const [pos, size] = await Promise.all([
      appWindow.outerPosition(),
      appWindow.outerSize(),
    ]);
    savedPosRef.current = { x: pos.x, y: pos.y };
    savedSizeRef.current = { w: size.width, h: size.height };
    await appWindow.setDecorations(false);
    await appWindow.setSize(new LogicalSize(screen.width, screen.height));
    await appWindow.setPosition(new LogicalPosition(0, 0));
    await appWindow.show();
  }, [appWindow]);

  const toSettingsMode = useCallback(async () => {
    await appWindow.setDecorations(true);
    const saved = localStorage.getItem("eyecare-settings-size");
    const size = saved ? (JSON.parse(saved) as { w: number; h: number }) : null;
    if (size) {
      await appWindow.setSize(new PhysicalSize(size.w, size.h));
    } else {
      await appWindow.setSize(new LogicalSize(SETTINGS_WIN.w, SETTINGS_WIN.h));
    }
    await appWindow.show();
  }, [appWindow]);

  /* ── Animated break exit ── */

  const startBreakExit = useCallback((onDone: () => void) => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
    }
    setBreakExiting(true);
    exitTimerRef.current = setTimeout(() => {
      setBreakExiting(false);
      onDone();
    }, BREAK_EXIT_MS);
  }, []);

  /* ── Timer ── */

  const startTick = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      const next = remainingRef.current - 1;
      if (next <= 0) {
        if (phaseRef.current === "work") {
          const dur = configRef.current.breakSecs;
          phaseRef.current = "break";
          remainingRef.current = dur;
          setRemaining(dur);
          // Render break UI only after window is fullscreen — eliminates the
          // brief flash of break content on a still-small window.
          toBreakMode().then(() => setPhase("break"));
        } else if (phaseRef.current === "break") {
          clearInterval(tickRef.current!);
          tickRef.current = null;
          const dur = configRef.current.workSecs;
          startBreakExit(() => {
            phaseRef.current = "work";
            remainingRef.current = dur;
            setRemaining(dur);
            // Render widget only after window has shrunk back — eliminates
            // the flash of widget content stretched across a fullscreen window.
            toWorkMode().then(() => {
              setPhase("work");
              startTick(); // eslint-disable-line @typescript-eslint/no-use-before-define
            });
          });
        }
      } else {
        remainingRef.current = next;
        setRemaining(next);
      }
    }, 1000);
  }, [toBreakMode, toWorkMode, startBreakExit]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Persist work window size on resize ── */

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    appWindow
      .onResized(async () => {
        const size = await appWindow.outerSize();
        if (phaseRef.current === "work") {
          localStorage.setItem(
            "eyecare-window-size",
            JSON.stringify({ w: size.width, h: size.height }),
          );
        } else if (phaseRef.current === "settings") {
          localStorage.setItem(
            "eyecare-settings-size",
            JSON.stringify({ w: size.width, h: size.height }),
          );
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, [appWindow]);

  /* ── Init ── */

  useEffect(() => {
    toWorkMode().then(startTick);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Keyboard shortcuts ── */

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (phaseRef.current === "break") {
        const dur = configRef.current.workSecs;
        startBreakExit(() => {
          phaseRef.current = "work";
          remainingRef.current = dur;
          setRemaining(dur);
          toWorkMode().then(() => {
            setPhase("work");
            startTick();
          });
        });
      } else if (phaseRef.current === "settings") {
        if (tickRef.current) clearInterval(tickRef.current);
        phaseRef.current = "work";
        toWorkMode().then(() => {
          setPhase("work");
          startTick();
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toWorkMode, startTick, startBreakExit]);

  /* ── Font scale ── */

  useEffect(() => {
    document.documentElement.style.fontSize = `${fontScale * 16}px`;
  }, [fontScale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setFontScale((s) => {
          const next = Math.min(2, Math.round((s + 0.1) * 10) / 10);
          localStorage.setItem("eyecare-font-scale", String(next));
          return next;
        });
      } else if (e.key === "-") {
        e.preventDefault();
        setFontScale((s) => {
          const next = Math.max(0.5, Math.round((s - 0.1) * 10) / 10);
          localStorage.setItem("eyecare-font-scale", String(next));
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Settings ── */

  const openSettings = async () => {
    if (tickRef.current) clearInterval(tickRef.current);
    const pos = await appWindow.outerPosition();
    savedPosRef.current = { x: pos.x, y: pos.y };
    const { workSecs, breakSecs, workColor, breakColor } = config;
    setInputWorkMin(String(Math.floor(workSecs / 60)));
    setInputWorkSec(String(workSecs % 60));
    setInputBreakMin(String(Math.floor(breakSecs / 60)));
    setInputBreakSec(String(breakSecs % 60));
    setInputWorkColor(workColor);
    setInputBreakColor(breakColor);
    setPhase("settings");
    phaseRef.current = "settings";
    await toSettingsMode();
  };

  const cancelSettings = async () => {
    phaseRef.current = "work";
    await toWorkMode();
    setPhase("work");
    startTick();
  };

  /* ── Validation ── */

  const isSettingsValid = useMemo(() => {
    const wm = parseInt(inputWorkMin, 10);
    const ws = parseInt(inputWorkSec, 10);
    const bm = parseInt(inputBreakMin, 10);
    const bs = parseInt(inputBreakSec, 10);

    // Check for NaN and bounds
    if ([wm, ws, bm, bs].some(isNaN)) return false;
    if (ws < 0 || ws > 59 || bs < 0 || bs > 59) return false;
    if (wm < 0 || bm < 0) return false;

    // Check for 0 duration
    const totalWork = wm * 60 + ws;
    const totalBreak = bm * 60 + bs;
    if (totalWork <= 0 || totalBreak <= 0) return false;

    // Check hex validity
    if (!isValidHex(inputWorkColor) || !isValidHex(inputBreakColor))
      return false;

    return true;
  }, [
    inputWorkMin,
    inputWorkSec,
    inputBreakMin,
    inputBreakSec,
    inputWorkColor,
    inputBreakColor,
  ]);

  const applySettings = async () => {
    if (!isSettingsValid) return; // Single guard relies on the useMemo

    const wm = parseInt(inputWorkMin, 10);
    const ws = parseInt(inputWorkSec, 10);
    const bm = parseInt(inputBreakMin, 10);
    const bs = parseInt(inputBreakSec, 10);

    const totalWork = wm * 60 + ws;
    const totalBreak = bm * 60 + bs;

    const next: Config = {
      workSecs: totalWork,
      breakSecs: totalBreak,
      workColor: inputWorkColor,
      breakColor: inputBreakColor,
    };

    setConfig(next);
    configRef.current = next;
    localStorage.setItem("eyecare-config", JSON.stringify(next));
    phaseRef.current = "work";
    remainingRef.current = totalWork;
    setRemaining(totalWork);

    await toWorkMode();
    setPhase("work");
    startTick();
  };

  /* ── Hex input handler ── */

  const onHexChange = (raw: string, set: (v: string) => void) => {
    const v = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    set("#" + v);
  };

  /* ── Render ── */

  if (phase === "break") {
    return (
      <main
        className={`break-overlay${breakExiting ? " exiting" : ""}`}
        style={{ background: hexToRgba(config.breakColor, 0.65) }}
      >
        <div className="break-card">
          <h1>Relax</h1>
          <p className="break-sub">Remember to hydrate! Drink water.</p>
          <div className="break-timer">{fmt(remaining)}</div>
          <p className="hint">
            Press <kbd>Esc</kbd> to skip
          </p>
        </div>
      </main>
    );
  }

  if (phase === "settings") {
    return (
      <main className="settings-overlay">
        <div className="settings-card">
          <h2>Intervals</h2>
          <div className="settings-field">
            <label>Work</label>
            <div className="duration-inputs">
              <input
                type="number"
                min="0"
                value={inputWorkMin}
                onChange={(e) => setInputWorkMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySettings()}
              />
              <span className="duration-sep">m</span>
              <input
                type="number"
                min="0"
                max="59"
                value={inputWorkSec}
                onChange={(e) => setInputWorkSec(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySettings()}
              />
              <span className="duration-sep">s</span>
              <input
                type="color"
                className="color-swatch"
                value={inputWorkColor}
                onChange={(e) => setInputWorkColor(e.target.value)}
              />
              <span className="hex-prefix">#</span>
              <input
                type="text"
                className="hex-input"
                value={inputWorkColor.replace(/^#/, "")}
                maxLength={6}
                spellCheck={false}
                placeholder="f05365"
                onChange={(e) => onHexChange(e.target.value, setInputWorkColor)}
              />
            </div>
          </div>
          <div className="settings-field">
            <label>Break</label>
            <div className="duration-inputs">
              <input
                type="number"
                min="0"
                value={inputBreakMin}
                onChange={(e) => setInputBreakMin(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySettings()}
              />
              <span className="duration-sep">m</span>
              <input
                type="number"
                min="0"
                max="59"
                value={inputBreakSec}
                onChange={(e) => setInputBreakSec(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && applySettings()}
              />
              <span className="duration-sep">s</span>
              <input
                type="color"
                className="color-swatch"
                value={inputBreakColor}
                onChange={(e) => setInputBreakColor(e.target.value)}
              />
              <span className="hex-prefix">#</span>
              <input
                type="text"
                className="hex-input"
                value={inputBreakColor.replace(/^#/, "")}
                maxLength={6}
                spellCheck={false}
                placeholder="7d83ff"
                onChange={(e) =>
                  onHexChange(e.target.value, setInputBreakColor)
                }
              />
            </div>
          </div>
          <div className="settings-actions">
            <button className="btn-cancel" onClick={cancelSettings}>
              Cancel
            </button>
            <button
              className="btn-apply"
              onClick={applySettings}
              disabled={!isSettingsValid}
              style={
                !isSettingsValid
                  ? {
                      background: "rgba(0, 0, 0, 0.15)",
                      color: "rgba(255, 255, 255, 0.15)",
                      cursor: "not-allowed",
                    }
                  : {}
              }
            >
              Apply
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="widget"
      style={{ background: hexToRgba(config.workColor, 0.82) }}
    >
      <div className="widget-top">
        <span className="widget-label">Next break</span>
        <button className="widget-gear" onClick={openSettings} title="Settings">
          ⚙
        </button>
      </div>
      <div className="widget-timer">{fmt(remaining)}</div>
    </main>
  );
}
