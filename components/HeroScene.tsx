"use client";

import { useEffect, useRef } from "react";
import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  QuadraticBezierCurve3,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import type { Content } from "@/content/types";

type SceneLabels = Content["hero"]["scene"]["labels"];

/**
 * The hero scene (website.md section 6): three device nodes around a server node.
 * Devices go offline — their link dims to --conflict amber and small op-packets
 * pile up beside them. They reconnect: packets flow to the server and back out,
 * and each device's state chip (a 3×3 grid of cells) settles to the SAME
 * pattern in --accent green. Every third cycle, two offline devices edit the
 * same conflict() cell: after sync, that cell shows BOTH values with an amber
 * marker on every device — it is never quietly overwritten. That is Accord's
 * core idea, shown.
 *
 * Honest by construction: a seeded generator (no Math.random) drives the
 * cycles, so the illustration is reproducible, and the caption says it is an
 * illustration — never a live view. Decorative: the canvas is aria-hidden, the
 * section carries a text description, and the parent shows a static SVG until
 * (or instead of) this.
 */

// Seeded PRNG so every run of the illustration is reproducible (plan.md section 6
// spirit: seeded runs that reproduce exactly).
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    accent: new Color(v("--accent", "#1d6b57")),
    conflict: new Color(v("--conflict", "#9a4a12")),
    ink: new Color(v("--ink", "#16202a")),
    muted: new Color(v("--muted", "#56616b")),
    surface: new Color(v("--surface", "#ffffff")),
    line: new Color(v("--line", "#dce2dc")),
  };
}

const DEVICE_POSITIONS = [
  new Vector3(-3.3, 0, 1.2),
  new Vector3(3.3, 0, 1.2),
  new Vector3(0, 0, -3.6),
];
const SERVER_POS = new Vector3(0, 0, 0);
const CENTER_CELL = 4; // the conflict() cell in the 3×3 chip

type CellState = "idle" | "edit" | "converged" | "conflict";

export default function HeroScene({
  onReady,
  paused,
  labels,
}: {
  onReady: () => void;
  paused: boolean;
  labels: SceneLabels;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    const disposables: { dispose(): void }[] = [];

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      return; // no WebGL after all: the parent keeps showing the static SVG
    }
    renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    const camera = new PerspectiveCamera(40, 1, 0.1, 100);
    const cameraBase = new Vector3(0, 8.1, 9.0);
    camera.position.copy(cameraBase);
    camera.lookAt(0, 0.5, 0);

    const rng = mulberry32(20261002);

    // ---- static geometry ----------------------------------------------------
    const palette = readPalette();
    const serverMat = new MeshBasicMaterial({ color: palette.muted });
    const serverTopMat = new MeshBasicMaterial({ color: palette.accent });
    const deviceMat = new MeshBasicMaterial({ color: palette.ink });
    disposables.push(serverMat, serverTopMat, deviceMat);

    const server = new Mesh(new BoxGeometry(1.7, 1.05, 1.2), serverMat);
    server.position.set(SERVER_POS.x, 0.525, SERVER_POS.z);
    scene.add(server);
    disposables.push(server.geometry);
    const serverTop = new Mesh(new BoxGeometry(1.7, 0.14, 0.3), serverTopMat);
    serverTop.position.set(SERVER_POS.x, 1.12, SERVER_POS.z + 0.42);
    scene.add(serverTop);
    disposables.push(serverTop.geometry);

    const deviceGeometry = new BoxGeometry(0.72, 1.3, 0.09);
    disposables.push(deviceGeometry);
    const devices = DEVICE_POSITIONS.map((p) => {
      const mesh = new Mesh(deviceGeometry, deviceMat);
      mesh.position.set(p.x, 0.65, p.z);
      mesh.rotation.y = Math.atan2(-p.x, -p.z) * 0.35;
      scene.add(mesh);
      return mesh;
    });

    // Links: a lifted curve device → server, rendered twice (online / offline).
    const linkCurves = DEVICE_POSITIONS.map((p) => {
      const from = new Vector3(p.x, 1.15, p.z);
      const to = new Vector3(p.x, 0.9, p.z).multiplyScalar(0.16);
      const mid = from.clone().lerp(to, 0.5).setY(1.9);
      return new QuadraticBezierCurve3(from, mid, to);
    });
    const onlineMat = new LineBasicMaterial({
      color: palette.muted,
      transparent: true,
      opacity: 0.55,
    });
    const offlineMat = new LineDashedMaterial({
      color: palette.conflict,
      dashSize: 0.14,
      gapSize: 0.09,
      transparent: true,
      opacity: 0.9,
    });
    disposables.push(onlineMat, offlineMat);
    const links = linkCurves.map((curve) => {
      const geometry = new BufferGeometry().setFromPoints(curve.getPoints(28));
      disposables.push(geometry);
      const line = new Line(geometry, onlineMat);
      line.computeLineDistances();
      scene.add(line);
      return line;
    });

    // ---- state chips: a 3×3 grid of cells above each device ------------------
    const cellGeometry = new BoxGeometry(0.17, 0.05, 0.17);
    const dotGeometry = new SphereGeometry(0.035, 8, 6);
    disposables.push(cellGeometry, dotGeometry);
    type Cell = {
      mesh: Mesh;
      dots: [Mesh, Mesh];
      state: CellState;
      from: Color;
      to: Color;
      lerp: number; // 0..1 colour transition progress
    };
    const cells: Cell[][] = [];
    const materialCache = new Map<string, MeshBasicMaterial>();
    const materialFor = (key: string, color: Color, opacity = 1) => {
      const id = `${key}:${opacity}`;
      let mat = materialCache.get(id);
      if (!mat) {
        mat = new MeshBasicMaterial({ color, transparent: opacity < 1, opacity });
        materialCache.set(id, mat);
        disposables.push(mat);
      }
      return mat;
    };
    const idleMat = materialFor("idle", palette.muted, 0.35);
    const editMat = materialFor("edit", palette.ink);
    const convergedMat = materialFor("converged", palette.accent);
    const conflictMat = materialFor("conflict", palette.conflict);
    const dotMat = materialFor("dot", palette.ink);

    const CHIP_Y = 1.85;
    const SPACING = 0.21;
    for (let d = 0; d < 3; d++) {
      const p = DEVICE_POSITIONS[d];
      const row: Cell[] = [];
      for (let i = 0; i < 9; i++) {
        const col = i % 3;
        const rowIdx = Math.floor(i / 3);
        const mesh = new Mesh(cellGeometry, i === CENTER_CELL ? conflictMat : idleMat);
        mesh.position.set(
          p.x + (col - 1) * SPACING,
          CHIP_Y + (i === CENTER_CELL ? 0.015 : 0),
          p.z + (rowIdx - 1) * SPACING,
        );
        scene.add(mesh);
        const dots: [Mesh, Mesh] = [new Mesh(dotGeometry, dotMat), new Mesh(dotGeometry, dotMat)];
        dots[0].position.set(mesh.position.x - 0.05, mesh.position.y + 0.05, mesh.position.z);
        dots[1].position.set(mesh.position.x + 0.05, mesh.position.y + 0.05, mesh.position.z);
        dots.forEach((dot) => {
          dot.visible = i === CENTER_CELL;
          scene.add(dot);
        });
        row.push({
          mesh,
          dots,
          state: i === CENTER_CELL ? "conflict" : "idle",
          from: palette.muted.clone(),
          to: palette.muted.clone(),
          lerp: 1,
        });
      }
      cells.push(row);
    }

    const setColor = (cell: Cell, next: Color, state: CellState) => {
      cell.from.copy(
        cell.mesh.material === conflictMat
          ? palette.conflict
          : (cell.mesh.material as MeshBasicMaterial).color,
      );
      cell.to.copy(next);
      cell.lerp = 0;
      cell.state = state;
    };

    // ---- packets -------------------------------------------------------------
    const packetGeometry = new BoxGeometry(0.13, 0.13, 0.13);
    const packetMat = materialFor("packet", palette.accent);
    disposables.push(packetGeometry);
    type Packet = {
      mesh: Mesh;
      device: number;
      phase: "queued" | "push" | "pull";
      t: number;
      speed: number;
    };
    const packets: Packet[] = [];
    const queueSlot = (device: number, index: number) => {
      const p = DEVICE_POSITIONS[device];
      const toward = new Vector3(-Math.sign(p.x) || 0, 0, p.z > 0 ? 1 : p.z < 0 ? -1 : 0);
      return new Vector3(
        p.x + toward.x * 0.62 + (index % 2) * 0.18,
        0.2 + Math.floor(index / 2) * 0.16,
        p.z + toward.z * 0.62 + ((index + 1) % 2) * 0.18,
      );
    };
    function spawnPacket(device: number, index: number) {
      const mesh = new Mesh(packetGeometry, packetMat);
      mesh.position.copy(queueSlot(device, index));
      mesh.rotation.y = rng() * Math.PI;
      scene.add(mesh);
      packets.push({ mesh, device, phase: "queued", t: 0, speed: 0.9 + rng() * 0.25 });
    }

    // ---- HTML labels over the canvas ----------------------------------------
    const labelHost = document.createElement("div");
    labelHost.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden";
    host.appendChild(labelHost);
    type LabelDef = { text: string; anchor: Vector3; className: string; el: HTMLSpanElement };
    const labelTexts: Omit<LabelDef, "el">[] = [
      {
        text: labels.server,
        anchor: new Vector3(0, 1.7, 0.2),
        className: "color:var(--muted)",
      },
      ...DEVICE_POSITIONS.map((p, i) => ({
        text: labels.devices[i],
        anchor: new Vector3(p.x, 0.25, p.z + (p.z > 0 ? 0.35 : -0.35)),
        className: "color:var(--muted)",
      })),
    ];
    // Per-device status label: "offline" — a text label, never colour alone (section 2).
    const statusEls = DEVICE_POSITIONS.map((p) => {
      const el = document.createElement("span");
      el.textContent = labels.offline;
      el.style.cssText =
        "position:absolute;left:0;top:0;transform:translate(-50%,-50%);font:600 11px/1 var(--font-inter-tight),sans-serif;white-space:nowrap;color:var(--conflict);visibility:hidden;transition:visibility 0s";
      labelHost.appendChild(el);
      return { anchor: new Vector3(p.x, 2.75, p.z), el };
    });
    const labelEls = labelTexts.map(({ text, className }) => {
      const el = document.createElement("span");
      el.textContent = text;
      el.style.cssText = `position:absolute;left:0;top:0;transform:translate(-50%,-50%);font:600 12px/1 var(--font-inter-tight),sans-serif;white-space:nowrap;transition:color .4s;${className}`;
      labelHost.appendChild(el);
      return el;
    });
    const projected = new Vector3();
    const projectLabels = () => {
      for (let i = 0; i < labelEls.length; i++) {
        projected.copy(labelTexts[i].anchor).project(camera);
        const el = labelEls[i];
        if (projected.z > 1) {
          el.style.visibility = "hidden";
          continue;
        }
        el.style.visibility = "visible";
        el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * host.clientWidth}px, ${
          (-projected.y * 0.5 + 0.5) * host.clientHeight
        }px) translate(-50%, -50%)`;
      }
      for (const status of statusEls) {
        projected.copy(status.anchor).project(camera);
        status.el.style.transform = `translate(${(projected.x * 0.5 + 0.5) * host.clientWidth}px, ${
          (-projected.y * 0.5 + 0.5) * host.clientHeight
        }px) translate(-50%, -50%)`;
      }
    };

    // ---- theme changes -------------------------------------------------------
    const applyPalette = () => {
      const next = readPalette();
      serverMat.color.copy(next.muted);
      serverTopMat.color.copy(next.accent);
      deviceMat.color.copy(next.ink);
      onlineMat.color.copy(next.muted);
      offlineMat.color.copy(next.conflict);
      idleMat.color.copy(next.muted);
      editMat.color.copy(next.ink);
      convergedMat.color.copy(next.accent);
      conflictMat.color.copy(next.conflict);
      dotMat.color.copy(next.ink);
      packetMat.color.copy(next.accent);
    };
    const themeObserver = new MutationObserver(applyPalette);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    // ---- sizing --------------------------------------------------------------
    renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, window.innerWidth < 640 ? 1 : 1.5),
    );
    const resize = () => {
      if (disposed) return;
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // ---- pointer parallax (desktop only) -------------------------------------
    const target = { x: 0, y: 0 };
    const smooth = { x: 0, y: 0 };
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    function onPointerMove(event: PointerEvent) {
      target.x = (event.clientX / window.innerWidth) * 2 - 1;
      target.y = (event.clientY / window.innerHeight) * 2 - 1;
    }
    if (finePointer) window.addEventListener("pointermove", onPointerMove, { passive: true });

    // ---- the cycle state machine (seeded, reproducible) ----------------------
    // Phases and durations, in seconds. Every third cycle two devices edit the
    // same conflict() cell; otherwise one device goes offline.
    const T = {
      online: 1.4,
      goOffline: 0.8,
      offline: 2.6,
      reconnect: 0.6,
      push: 1.8,
      pull: 1.8,
      settle: 1.2,
      hold: 2.6,
    } as const;
    const SEQUENCE: (keyof typeof T)[] = [
      "online",
      "goOffline",
      "offline",
      "reconnect",
      "push",
      "pull",
      "settle",
      "hold",
    ];

    let cycle = 0;
    let phaseIdx = 0;
    let phaseTime = 0;
    let offline: number[] = [];
    let conflictCycle = false;
    let pattern: boolean[] = [];
    let spawnTimer = 0;
    let pushedFrom: number[] = [];

    const currentPattern = (seedCycle: number) => {
      // 5 of 9 cells on, deterministic per cycle.
      const r = mulberry32(9000 + seedCycle);
      const p = Array.from({ length: 9 }, () => false);
      let placed = 0;
      while (placed < 5) {
        const idx = Math.floor(r() * 9);
        if (!p[idx]) {
          p[idx] = true;
          placed++;
        }
      }
      p[CENTER_CELL] = false; // the conflict cell is rendered separately
      return p;
    };

    const applyConverged = () => {
      for (let d = 0; d < 3; d++) {
        cells[d].forEach((cell, i) => {
          if (conflictCycle && i === CENTER_CELL) {
            setColor(cell, palette.conflict, "conflict");
            cell.dots.forEach((dot) => (dot.visible = true));
          } else {
            setColor(
              cell,
              pattern[i] ? palette.accent : palette.muted,
              pattern[i] ? "converged" : "idle",
            );
            cell.dots.forEach((dot) => (dot.visible = false));
          }
        });
      }
    };
    const applyEdit = (device: number, seedCycle: number) => {
      const r = mulberry32(500 + seedCycle * 10 + device);
      cells[device].forEach((cell, i) => {
        if (i === CENTER_CELL && conflictCycle) {
          // this device's own local write on the conflict cell: one value, ink
          setColor(cell, palette.ink, "edit");
          cell.dots.forEach((dot) => (dot.visible = false));
        } else {
          const edited = pattern[i] !== r() < 0.3;
          setColor(cell, edited ? palette.ink : palette.muted, edited ? "edit" : "idle");
          cell.dots.forEach((dot) => (dot.visible = false));
        }
      });
    };

    function enterPhase(name: keyof typeof T) {
      const total = cycle; // deterministic per cycle
      if (name === "online") {
        // start of a cycle: decide who goes offline
        conflictCycle = cycle % 3 === 2;
        offline = conflictCycle ? [0, 1] : [total % 3];
        pattern = currentPattern(total);
        // reset chips to the converged pattern of the previous settle
        applyConverged();
      }
      if (name === "goOffline") {
        for (const d of offline) {
          links[d].material = offlineMat;
          statusEls[d].el.style.visibility = "visible";
        }
      }
      if (name === "offline") {
        spawnTimer = 0;
      }
      if (name === "reconnect") {
        for (const d of offline) {
          links[d].material = onlineMat;
          statusEls[d].el.style.visibility = "hidden";
        }
        pushedFrom = [];
      }
      if (name === "push") {
        // the queued packets fly to the server, in arbitrary (staggered) order
        const queued = packets.filter((p) => p.phase === "queued");
        queued.forEach((p, i) => {
          p.phase = "push";
          p.t = -i * 0.22;
          p.speed = 0.75 + rng() * 0.3;
        });
        // devices diverge while offline: their own edits show
        offline.forEach((d, i) => applyEdit(d, total + i));
      }
      if (name === "pull") {
        // the server sends the merged ops back out: one wave per device
        for (let wave = 0; wave < 2; wave++) {
          for (let d = 0; d < 3; d++) {
            const mesh = new Mesh(packetGeometry, packetMat);
            scene.add(mesh);
            packets.push({ mesh, device: d, phase: "pull", t: -wave * 0.9 - d * 0.12, speed: 0.8 });
          }
        }
      }
      if (name === "settle") {
        applyConverged();
      }
      phaseTime = 0;
    }

    // kick off
    enterPhase("online");
    pattern = currentPattern(0);
    applyConverged();

    // ---- render loop, gated by visibility and pause ---------------------------
    let raf = 0;
    let running = false;
    let inView = true;
    let frameTimes: number[] = [];
    let last = performance.now();
    let clock = 0;

    const point = new Vector3();
    const tmpColor = new Color();
    function frame(now: number) {
      raf = 0;
      if (disposed) return;
      const rawDt = Math.min(now - last, 50); // ms
      last = now;
      const dt = rawDt / 1000;
      clock += dt;

      // fps watchdog: sustained frame times above 32 ms → freeze at a static frame
      frameTimes.push(rawDt);
      if (frameTimes.length > 40) frameTimes.shift();
      if (frameTimes.length === 40 && frameTimes.reduce((a, b) => a + b, 0) / 40 > 32) {
        renderer.render(scene, camera);
        running = false;
        return;
      }

      // camera drift + parallax
      smooth.x += (target.x - smooth.x) * 0.05;
      smooth.y += (target.y - smooth.y) * 0.05;
      camera.position.set(
        cameraBase.x + Math.sin(clock * 0.11) * 0.22 + smooth.x * 0.45,
        cameraBase.y + Math.sin(clock * 0.08) * 0.12 - smooth.y * 0.22,
        cameraBase.z + Math.cos(clock * 0.09) * 0.22,
      );
      camera.lookAt(0, 0.5, 0);

      // phase machine
      const phase = SEQUENCE[phaseIdx];
      phaseTime += dt;
      if (phase === "offline") {
        spawnTimer -= dt;
        const queuedForOffline = packets.filter((p) => p.phase === "queued").length;
        if (spawnTimer <= 0 && queuedForOffline < 6) {
          for (const d of offline) {
            const index = packets.filter((p) => p.phase === "queued" && p.device === d).length;
            spawnPacket(d, index);
          }
          spawnTimer = 0.5;
        }
      }
      if (phaseTime >= T[phase]) {
        phaseIdx = (phaseIdx + 1) % SEQUENCE.length;
        if (phaseIdx === 0) cycle++;
        enterPhase(SEQUENCE[phaseIdx]);
      }

      // packets
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        if (p.phase === "push") {
          p.t += p.speed * dt;
          if (p.t >= 1) {
            // arrived at the server: brief pulse, packet absorbed
            serverTop.scale.setScalar(1.35);
            scene.remove(p.mesh);
            packets.splice(i, 1);
            continue;
          }
          if (p.t > 0) {
            linkCurves[p.device].getPoint(Math.min(p.t, 1), point);
            p.mesh.position.copy(point);
            p.mesh.rotation.x += dt * 2;
          }
        } else if (p.phase === "pull") {
          p.t += p.speed * dt;
          if (p.t >= 1) {
            scene.remove(p.mesh);
            packets.splice(i, 1);
            continue;
          }
          if (p.t > 0) {
            linkCurves[p.device].getPoint(1 - p.t, point);
            p.mesh.position.copy(point);
            p.mesh.rotation.x -= dt * 2;
          }
        }
      }
      serverTop.scale.lerp(new Vector3(1, 1, 1), Math.min(dt * 6, 1));

      // chip colour transitions
      for (const row of cells) {
        for (const cell of row) {
          if (cell.lerp < 1) {
            cell.lerp = Math.min(1, cell.lerp + dt * 1.8);
            tmpColor.copy(cell.from).lerp(cell.to, cell.lerp);
            (cell.mesh.material as MeshBasicMaterial).color.copy(tmpColor);
            if (cell.lerp >= 1) {
              cell.mesh.material =
                cell.state === "conflict"
                  ? conflictMat
                  : cell.state === "converged"
                    ? convergedMat
                    : cell.state === "edit"
                      ? editMat
                      : idleMat;
            }
          }
        }
      }

      renderer.render(scene, camera);
      projectLabels();
      onReadyRef.current();
      schedule();
    }

    function schedule() {
      if (!running || disposed) return;
      raf = requestAnimationFrame(frame);
    }
    function start() {
      if (running || disposed) return;
      running = true;
      last = performance.now();
      frameTimes = [];
      schedule();
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }
    function sync() {
      if (pausedRef.current || !inView || document.hidden) stop();
      else start();
    }

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    intersectionObserver.observe(host);
    const onVisibility = () => sync();
    document.addEventListener("visibilitychange", onVisibility);

    // first static render so the fade-in has content even while paused
    resize();
    renderer.render(scene, camera);
    projectLabels();
    onReadyRef.current();

    return () => {
      disposed = true;
      stop();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      if (finePointer) window.removeEventListener("pointermove", onPointerMove);
      renderer.dispose();
      host.removeChild(renderer.domElement);
      host.removeChild(labelHost);
      for (const d of disposables) d.dispose();
    };
    // Stable for the lifetime of the mount: labels and the ready callback are
    // held in refs, so the scene is built once and never rebuilt on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={hostRef} className="absolute inset-0" />;
}
