/**
 * Read all image files from a drag-and-drop event.
 * Supports both individual files AND folders (recursive).
 */
export async function getDroppedImageFiles(e: React.DragEvent): Promise<File[]> {
  const items = e.dataTransfer.items;

  // If browser supports webkitGetAsEntry (Chrome, Edge, Safari), use it for folder support
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }
    const files = await readEntries(entries);
    return files.filter(f => f.type.startsWith('image/'));
  }

  // Fallback: plain files (no folder support)
  return Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
}

async function readEntries(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];

  for (const entry of entries) {
    if (entry.isFile) {
      const file = await getFile(entry as FileSystemFileEntry);
      files.push(file);
    } else if (entry.isDirectory) {
      const dirReader = (entry as FileSystemDirectoryEntry).createReader();
      const subEntries = await readDirectoryEntries(dirReader);
      const subFiles = await readEntries(subEntries);
      files.push(...subFiles);
    }
  }

  return files;
}

function getFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readDirectoryEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve, reject) => {
    const allEntries: FileSystemEntry[] = [];

    function readBatch() {
      reader.readEntries((entries) => {
        if (entries.length === 0) {
          resolve(allEntries);
        } else {
          allEntries.push(...entries);
          readBatch(); // Keep reading until empty (batched API)
        }
      }, reject);
    }

    readBatch();
  });
}
