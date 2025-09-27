let memory = new Set<string>();

function getStore(): Set<string> {
  if (typeof window === 'undefined') return memory;
  try {
    const raw = window.sessionStorage.getItem('toastOnceKeys');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set<string>(arr);
    }
  } catch {}
  return memory;
}

function saveStore(store: Set<string>) {
  if (typeof window === 'undefined') { memory = store; return; }
  try {
    window.sessionStorage.setItem('toastOnceKeys', JSON.stringify(Array.from(store)));
  } catch {}
  memory = store;
}

export function toastOnce(key: string, fn: () => void) {
  const store = getStore();
  if (store.has(key)) return;
  try { fn(); } catch {}
  store.add(key);
  saveStore(store);
}

export function resetToastOnce(keys?: string[]) {
  const store = getStore();
  if (!keys || keys.length === 0) {
    saveStore(new Set());
    return;
  }
  for (const k of keys) store.delete(k);
  saveStore(store);
}

