import { ROLE_COLORS, type RceRole } from "../lib/rce-profiles";

interface Props {
  role: RceRole | "Unknown";
  size?: "sm" | "md";
}

export default function ProfileBadge({ role, size = "sm" }: Props) {
  const color = ROLE_COLORS[role];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
      style={{ backgroundColor: `${color}20`, color }}
    >
      <span
        className="inline-block rounded-full"
        style={{
          backgroundColor: color,
          width: size === "sm" ? 6 : 8,
          height: size === "sm" ? 6 : 8,
        }}
      />
      {role}
    </span>
  );
}
