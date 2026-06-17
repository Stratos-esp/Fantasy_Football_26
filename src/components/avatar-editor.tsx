"use client";

import { useRef, useState } from "react";

const VIEW = 220; // tamaño del recuadro de recorte
const OUT = 256;  // tamaño de la imagen exportada

// Editor de foto de perfil: subir, encuadrar (arrastrar + zoom) y exportar a un
// data URL cuadrado para guardarlo.
export function AvatarEditor({ current, busy, onSave }: { current: string | null; busy: boolean; onSave: (dataUrl: string | null) => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [nat, setNat] = useState({ w: 1, h: 1 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const base = VIEW / Math.min(nat.w, nat.h);
  const scale = base * zoom;
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;

  function clamp(p: { x: number; y: number }, w = dispW, h = dispH) {
    return { x: Math.min(0, Math.max(VIEW - w, p.x)), y: Math.min(0, Math.max(VIEW - h, p.y)) };
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const b = VIEW / Math.min(img.naturalWidth, img.naturalHeight);
      const dw = img.naturalWidth * b;
      const dh = img.naturalHeight * b;
      setNat({ w: img.naturalWidth, h: img.naturalHeight });
      setZoom(1);
      setPos({ x: (VIEW - dw) / 2, y: (VIEW - dh) / 2 });
      setSrc(url);
    };
    img.src = url;
  }

  function changeZoom(next: number) {
    const scaleOld = base * zoom;
    const scaleNew = base * next;
    const cx = (VIEW / 2 - pos.x) / scaleOld;
    const cy = (VIEW / 2 - pos.y) / scaleOld;
    const np = { x: VIEW / 2 - cx * scaleNew, y: VIEW / 2 - cy * scaleNew };
    setZoom(next);
    setPos(clamp(np, nat.w * scaleNew, nat.h * scaleNew));
  }

  function save() {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const p = clamp(pos);
    const side = VIEW / scale;
    ctx.drawImage(img, -p.x / scale, -p.y / scale, side, side, 0, 0, OUT, OUT);
    onSave(canvas.toDataURL("image/jpeg", 0.82));
    setSrc(null);
  }

  if (src) {
    const p = clamp(pos);
    return (
      <div className="avatar-editor">
        <div
          className="avatar-crop"
          onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, px: pos.x, py: pos.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerMove={(e) => { if (drag.current) setPos(clamp({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) })); }}
          onPointerUp={() => { drag.current = null; }}
          onPointerLeave={() => { drag.current = null; }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img ref={imgRef} src={src} alt="" draggable={false} style={{ position: "absolute", left: p.x, top: p.y, width: dispW, height: dispH, userSelect: "none" }} />
          <span className="avatar-crop-ring" />
        </div>
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => changeZoom(Number(e.target.value))} />
        <div className="avatar-editor-actions">
          <button className="ghost-button" onClick={() => setSrc(null)}>Cancelar</button>
          <button className="button button-small" disabled={busy} onClick={save}>Guardar foto</button>
        </div>
        <small className="settings-help">Arrastra la foto para encuadrarla y usa el control para acercar.</small>
      </div>
    );
  }

  return (
    <div className="avatar-editor-rest">
      <div className="avatar-preview">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="Tu foto" />
        ) : <span>Sin foto</span>}
      </div>
      <div className="avatar-editor-actions">
        <label className="ghost-button avatar-upload">
          {current ? "Cambiar foto" : "Subir foto"}
          <input type="file" accept="image/*" onChange={onFile} hidden />
        </label>
        {current && <button className="ghost-button" disabled={busy} onClick={() => onSave(null)}>Quitar</button>}
      </div>
    </div>
  );
}
