"use client";

import Image from "next/image";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ApiPlayer } from "@/lib/types";

export function PlayerAvatar({ player, small = false, points }: { player: Pick<ApiPlayer, "name" | "team" | "teamColor" | "teamLogo"> & { photo?: string | null }; small?: boolean; points?: number }) {
  const avatar = (
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
        <b className="avatar-initials">{initials(player.name)}</b>
      )}
    </span>
  );
  if (points === undefined) return avatar;
  // El globo de puntos va fuera del círculo (que recorta), por eso envolvemos.
  return <span className="avatar-stack">{avatar}<em className="avatar-points">{Math.round(points)}</em></span>;
}

// Avatar de un mánager: su foto de perfil o sus iniciales sobre su color.
// Se renderiza como <i> para heredar el tamaño de cada lista de clasificación.
export function UserAvatar({ name, color, avatarUrl }: { name: string; color: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <i className="user-badge" style={{ background: "var(--surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="user-avatar-img" src={avatarUrl} alt="" />
      </i>
    );
  }
  return <i className="user-badge" style={{ background: color }}>{name.slice(0, 2).toUpperCase()}</i>;
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
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
