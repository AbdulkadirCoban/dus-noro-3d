// localStorage, Safari gizli modunda veya kota dolunca hata verebilir; hata olursa bellekte devam edilir.
const KEY = 'dusnoro3d.v1';
const memory = {};

function readAll() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // bellek yedeği kullanılır
  }
  return memory.data ?? {};
}

function writeAll(data) {
  memory.data = data;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // bellek yedeği yeterli
  }
}

export function getProgress() {
  const d = readAll();
  return {
    answered: d.answered ?? 0,
    correct: d.correct ?? 0,
    wrong: d.wrong ?? {},
    best: d.best ?? 0,
  };
}

export function saveProgress(p) {
  writeAll({ ...readAll(), ...p });
}

export function resetProgress() {
  const { boneT, colorBones } = readAll();
  writeAll({ ...(boneT == null ? {} : { boneT }), ...(colorBones == null ? {} : { colorBones }) });
}

export const getBoneTransparency = () => readAll().boneT ?? 0;
export const saveBoneTransparency = (boneT) => writeAll({ ...readAll(), boneT });
export const getColorBones = () => !!readAll().colorBones;
export const saveColorBones = (colorBones) => writeAll({ ...readAll(), colorBones });
