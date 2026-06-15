"use client";

import Image from "next/image";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ApiPlayer } from "@/lib/types";

export function PlayerAvatar({ player, small = false }: { player: Pick<ApiPlayer, "name" | "team" | "teamColor" | "teamLogo"> & { photo?: string | null }; small?: boolean }) {
  return (
    <span
      className={`player-avatar ${small ? "small" : ""} ${player.photo ? "has-photo" : ""}`}
      style={{ background: player.teamColor, color: contrast(player.teamColor) }}
      title={player.team}
    >
      {player.photo ? (
        <Image
          className="avatar-photo"
          src={player.photo}
          alt={player.name}
          width={small ? 34 : 45}
          height={small ? 34 : 45}
          unoptimized
          onError={(event) => { event.currentTarget.style.display = "none"; }}
        />
      ) : (
        <svg className="avatar-silhouette" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="7.5" r="3.6" />
          <path d="M4.5 21c0-4.2 3.4-7 7.5-7s7.5 2.8 7.5 7z" />
        </svg>
      )}
    </span>
  );
}

export function TeamBadge({ player }: { player: Pick<ApiPlayer, "team" | "teamLogo"> }) {
  if (!player.teamLogo) return null;
  return (
    <Image
      className="player-name-badge"
      src={player.teamLogo}
      alt=""
      title={player.team}
      width={16}
      height={16}
      unoptimized
      onError={(event) => { event.currentTarget.style.display = "none"; }}
    />
  );
}

function contrast(hex: string) {
  const value = hex.replace("#", "");
  if (value.length < 6) return "#fff";
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#16221a" : "#fff";
}

export function Trend({ player }: { player: ApiPlayer }) {
  if (player.lastPoints === null) return null;
  const positive = player.lastPoints >= 4;
  return <span className={positive ? "trend up" : "trend down"}>{positive ? <TrendingUp /> : <TrendingDown />}{player.lastPoints} pts</span>;
}

export function PositionTag({ position }: { position: string }) {
  return <span className={`position-tag ${position.toLowerCase()}`}>{position}</span>;
}

export function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button type="button" className={`toggle ${checked ? "on" : ""}`} onClick={onChange} disabled={disabled} aria-label={label} aria-pressed={checked}><span /></button>;
}

export function SettingRow({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return <div className="setting-row"><span><strong>{title}</strong><small>{text}</small></span>{children}</div>;
}
