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
 * Read files from a drag-and-drop event, filtered by `matches`.
 * Supports both individual files AND folders (recursive).
 * Returns file names and folder name for auto-populating project title.
 */
export async function getDroppedFiles(
  e: React.DragEvent,
  matches: (f: File) => boolean = () => true,
): Promise<DropResult> {
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

    const files = (await readEntries(entries)).filter(matches);
    return {
      files,
      fileNames: files.map(f => f.name),
      folderName,
    };
  }

  // Fallback: plain files (no folder support)
  const files = Array.from(e.dataTransfer.files).filter(matches);
  return {
    files,
    fileNames: files.map(f => f.name),
    folderName: null,
  };
}

/**
 * Read all image files from a drag-and-drop event.
 * Supports both individual files AND folders (recursive).
 */
export function getDroppedImageFiles(e: React.DragEvent): Promise<DropResult> {
  return getDroppedFiles(e, f => f.type.startsWith('image/'));
}

async function readEntries(entries: FileSystemEntry[]): Promise<File[]> {
  const files: File[] = [];

  for (const entry of entries) {
    try {
      if (entry.isFile) {
        files.push(await getFile(entry as FileSystemFileEntry));
      } else if (entry.isDirectory) {
        const dirReader = (entry as FileSystemDirectoryEntry).createReader();
        const subEntries = await readDirectoryEntries(dirReader);
        files.push(...await readEntries(subEntries));
      }
    } catch {
      // 跳过读不了的文件/目录(损坏软链/权限/枚举后被删),不因单个失败而丢整批
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
