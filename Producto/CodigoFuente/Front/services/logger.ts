const C = {
  info:  'color:#4ade80;font-weight:700',
  warn:  'color:#facc15;font-weight:700',
  error: 'color:#f87171;font-weight:700',
  step:  'color:#60a5fa;font-weight:700',
  data:  'color:#c084fc;font-weight:700',
};

function ts() {
  return new Date().toTimeString().slice(0, 8);
}

export const bgoLog = {
  info:  (mod: string, msg: string, ...a: unknown[]) =>
    console.log(`%c[BGO ${ts()}] [${mod}] ${msg}`, C.info, ...a),

  warn:  (mod: string, msg: string, ...a: unknown[]) =>
    console.warn(`%c[BGO ${ts()}] [${mod}] ⚠ ${msg}`, C.warn, ...a),

  error: (mod: string, msg: string, ...a: unknown[]) =>
    console.error(`%c[BGO ${ts()}] [${mod}] ✖ ${msg}`, C.error, ...a),

  step:  (mod: string, msg: string, ...a: unknown[]) =>
    console.log(`%c[BGO ${ts()}] [${mod}] ▶ ${msg}`, C.step, ...a),

  data:  (mod: string, label: string, value: unknown) =>
    console.log(`%c[BGO ${ts()}] [${mod}] ◆ ${label}`, C.data, value),
};
