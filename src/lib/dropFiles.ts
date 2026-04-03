/**
 * Result of reading dropped files/folders.
 */
export interface DropResult {
  files: File[];
  /** File name for each file (original name from disk) */
  fileNames: string[];
  /** If a folder was dropped, its name (useful as project title) */
  folderName: string | null;
}

/**
 * Read all image files from a drag-and-drop event.
 * Supports both individual files AND folders (recursive).
 * Returns file names and folder name for auto-populating project title.
 */
export async function getDroppedImageFiles(e: React.DragEvent): Promise<DropResult> {
  const items = e.dataTransfer.items;

  // If browser supports webkitGetAsEntry, use it for folder support
  if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
    const entries: FileSystemEntry[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry();
      if (entry) entries.push(entry);
    }

    // Detect folder name from top-level directory entry
    let folderName: string | null = null;
    for (const entry of entries) {
      if (entry.isDirectory) {
        folderName = entry.name;
        break;
      }
    }

    const files = await readEntries(entries);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    return {
      files: imageFiles,
      fileNames: imageFiles.map(f => f.name),
      folderName,
    };
  }

  // Fallback: plain files (no folder support)
  const imageFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
  return {
    files: imageFiles,
    fileNames: imageFiles.map(f => f.name),
    folderName: null,
  };
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
          readBatch();
        }
      }, reject);
    }

    readBatch();
  });
}
