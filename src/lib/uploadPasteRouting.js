export function createPasteZoneRegistry() {
  let zones = [];

  return {
    mount(zone) {
      zones = [...zones.filter(id => id !== zone), zone];
    },
    unmount(zone) {
      zones = zones.filter(id => id !== zone);
    },
    isCurrent(zone) {
      return zones.at(-1) === zone;
    },
  };
}

export function getPasteFiles(items, { acceptClipboardFiles, isCurrent }) {
  if (!isCurrent) return [];
  if (!acceptClipboardFiles) {
    const file = items.find(item => item.type.startsWith('image/'))?.getAsFile();
    return file ? [file] : [];
  }
  return items.map(item => item.getAsFile()).filter(file => file !== null);
}

export function isWithinFileLimit(file, maxFileBytes) {
  return maxFileBytes === undefined || file.size <= maxFileBytes;
}
