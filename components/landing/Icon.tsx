// Lucide icon font (subset in /public/fonts/lucide.woff2). Only these icons are included.
const CODES = {
  search: 0xe151,
  check: 0xe06c,
  x: 0xe1b2,
  "shield-check": 0xe1ff,
  mail: 0xe10f,
  calendar: 0xe063,
  sparkles: 0xe412,
  users: 0xe1a4,
  bot: 0xe1bb,
  "arrow-right": 0xe049,
  bell: 0xe059,
  "message-circle": 0xe116,
  "sliders-horizontal": 0xe29a,
  lock: 0xe10b,
  zap: 0xe1b4,
  "file-text": 0xe0cc,
  "user-check": 0xe1a0,
  "triangle-alert": 0xe193,
  inbox: 0xe0f7,
  menu: 0xe115,
  send: 0xe152,
  target: 0xe180,
  "pen-line": 0xe130,
  handshake: 0xe5c0,
  database: 0xe0ad,
  "eye-off": 0xe0bb,
  "key-round": 0xe4a3,
  "circle-check": 0xe226,
  clock: 0xe087,
  repeat: 0xe146,
  "building-2": 0xe290,
  star: 0xe176,
} as const;

export type IconName = keyof typeof CODES;

export default function Icon({ name, size, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <i className={`ic${className ? ` ${className}` : ""}`} aria-hidden="true" style={size ? { fontSize: size } : undefined}>
      {String.fromCharCode(CODES[name])}
    </i>
  );
}
