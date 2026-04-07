import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  FolderOpen,
  X,
  GripVertical,
  Image,
  Plus,
} from 'lucide-react';
import { api } from '../lib/api';

interface ProjectUploaderProps {
  ownerType: 'designer' | 'company';
  ownerId?: number;
  onSuccess?: () => void;
}

interface UploadedImage {
  file: File;
  preview: string;
  name: string;
  isCover: boolean;
}

const ProjectUploader: React.FC<ProjectUploaderProps> = ({
  ownerType,
  ownerId,
  onSuccess,
}) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [description, setDescription] = useState('');
  const [projectName, setProjectName] = useState('');
  const [style, setStyle] = useState('');
  const [location, setLocation] = useState('');
  const [area, setArea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Recursively read directory entries and collect files
  const readDirectory = async (
    entry: any,
    path: string = ''
  ): Promise<File[]> => {
    const files: File[] = [];

    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file((file: File) => {
          resolve([
            new File([file], `${path}${file.name}`, { type: file.type }),
          ]);
        });
      });
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      return new Promise((resolve) => {
        const readEntries = async () => {
          const entries = await new Promise<any[]>((res) => {
            reader.readEntries(res);
          });

          if (entries.length === 0) {
            resolve(files);
            return;
          }

          const newPath = `${path}${entry.name}/`;
          const entriesPromises = entries.map((e) =>
            readDirectory(e, newPath)
          );
          const results = await Promise.all(entriesPromises);
          resolve(results.flat());
        };

        readEntries();
      });
    }

    return files;
  };

  // Handle files (from both file input and drag/drop)
  const processFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const newImages: UploadedImage[] = [];
      const fileArray = Array.from(fileList);

      for (const file of fileArray) {
        if (file.type.startsWith('image/')) {
          const preview = URL.createObjectURL(file);
          newImages.push({
            file,
            preview,
            name: file.name,
            isCover: newImages.length === 0 && images.length === 0,
          });
        }
      }

      // If this is the first batch, mark first as cover
      if (images.length === 0 && newImages.length > 0) {
        newImages[0].isCover = true;
      }

      setImages((prev) => [...prev, ...newImages]);
      setError(null);
    },
    [images.length]
  );

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop with folder support
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      const items = e.dataTransfer.items;
      if (!items) return;

      const allFiles: File[] = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const entry = item.webkitGetAsEntry();
          if (entry) {
            const files = await readDirectory(entry);
            allFiles.push(...files);
          }
        }
      }

      if (allFiles.length > 0) {
        processFiles(allFiles);
      }
    },
    [processFiles]
  );

  // Handle file input change
  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  // Remove image
  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // Ensure at least one image is marked as cover
      if (updated.length > 0 && !updated.some((img) => img.isCover)) {
        updated[0].isCover = true;
      }
      return updated;
    });
  };

  // Set cover image
  const setCoverImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        isCover: i === index,
      }))
    );
  };

  // Handle submit
  const handleSubmit = async (useQuickUpload: boolean = false) => {
    if (images.length === 0) {
      setError('Please upload at least one image');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();

      // Add images
      images.forEach((img, index) => {
        formData.append('images', img.file);
        formData.append(`image_names[${index}]`, img.name);
        if (img.isCover) {
          formData.append('cover_image_index', index.toString());
        }
      });

      // Add optional fields
      if (description) formData.append('description', description);
      if (projectName) formData.append('project_name', projectName);
      if (style) formData.append('style', style);
      if (location) formData.append('location', location);
      if (area) formData.append('area', area);

      // Add owner info
      formData.append('owner_type', ownerType);
      if (ownerId) formData.append('owner_id', ownerId.toString());

      const endpoint = useQuickUpload
        ? '/api/projects/quick-upload'
        : '/api/projects';

      const response = await api.post(endpoint, formData);

      if (response.status === 200 || response.status === 201) {
        // Clear form
        setImages([]);
        setDescription('');
        setProjectName('');
        setStyle('');
        setLocation('');
        setArea('');

        onSuccess?.();
      } else {
        setError('Failed to upload project');
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'An error occurred during upload'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isQuickMode = images.length === 1 && !description && !projectName;
  const styleOptions = [
    'Modern',
    'Contemporary',
    'Luxury',
    'Minimalist',
    'Arabic',
    'Mediterranean',
    'Industrial',
    'Classic',
  ];

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8">
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-lg transition-all duration-200 ${
          dragActive
            ? 'border-2 border-dashed border-amber-600 bg-amber-50'
            : 'border-0'
        } ${images.length > 0 ? 'py-8' : 'py-16'}`}
      >
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="p-4 rounded-full bg-stone-100">
              <Upload className="w-8 h-8 text-stone-600" />
            </div>
            <div>
              <p className="text-lg font-medium text-stone-900">
                Drop images here or click to browse
              </p>
              <p className="text-sm text-stone-600 mt-1">
                or drag a folder to upload all images inside
              </p>
            </div>

            {/* Buttons side by side */}
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-stone-300 rounded-lg text-stone-700 font-medium hover:bg-stone-50 transition-colors"
              >
                <Image className="w-4 h-4" />
                Select Files
              </button>
              <button
                type="button"
                onClick={() => folderInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-stone-300 rounded-lg text-stone-700 font-medium hover:bg-stone-50 transition-colors"
              >
                <FolderOpen className="w-4 h-4" />
                Select Folder
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm font-medium text-stone-700">
              {images.length} image{images.length !== 1 ? 's' : ''} uploaded
            </p>

            {/* Image Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div
                  key={index}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-stone-100 border border-stone-200 hover:border-stone-300 transition-colors"
                >
                  {/* Image */}
                  <img
                    src={image.preview}
                    alt={image.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Filename overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-xs text-white truncate">
                      {image.name}
                    </p>
                  </div>

                  {/* Cover badge */}
                  {image.isCover && (
                    <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-medium px-2 py-1 rounded">
                      Cover
                    </div>
                  )}

                  {/* Hover actions */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    {/* Set as cover button (if not already cover) */}
                    {!image.isCover && (
                      <button
                        type="button"
                        onClick={() => setCoverImage(index)}
                        className="p-2 bg-amber-600 text-white rounded-full hover:bg-amber-700 transition-colors"
                        title="Set as cover"
                      >
                        <Image className="w-4 h-4" />
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 transition-colors"
                      title="Remove image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Drag handle */}
                  <div className="absolute top-2 left-2 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="p-1 bg-white/80 rounded hover:bg-white">
                      <GripVertical className="w-4 h-4 text-stone-600" />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add more button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="aspect-square rounded-lg border-2 border-dashed border-stone-300 hover:border-stone-400 flex items-center justify-center transition-colors group"
              >
                <div className="flex flex-col items-center gap-1">
                  <Plus className="w-6 h-6 text-stone-400 group-hover:text-stone-500" />
                  <span className="text-xs text-stone-500">Add</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept="image/*"
          {...{ webkitdirectory: 'true' } as any}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* Form Fields */}
      {images.length > 0 && (
        <div className="mt-8 space-y-6">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description for this project..."
              className="w-full px-4 py-3 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent resize-none"
              rows={4}
            />
          </div>

          {/* Project Name */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Project name (optional, auto-generated if empty)"
              className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          {/* Style */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Style
            </label>
            <select
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-900 bg-white focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            >
              <option value="">Select a style...</option>
              {styleOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g., Dubai Marina"
              className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          {/* Area */}
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">
              Area
            </label>
            <input
              type="text"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="e.g., 150 m²"
              className="w-full px-4 py-2 border border-stone-300 rounded-lg text-stone-900 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-600 focus:border-transparent"
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex gap-3 pt-4">
            {isQuickMode ? (
              <button
                onClick={() => handleSubmit(true)}
                disabled={isLoading}
                className="flex-1 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Publishing...' : 'Quick Publish'}
              </button>
            ) : (
              <button
                onClick={() => handleSubmit(false)}
                disabled={isLoading || images.length === 0}
                className="flex-1 py-3 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Publishing...' : 'Publish Project'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setImages([]);
                setDescription('');
                setProjectName('');
                setStyle('');
                setLocation('');
                setArea('');
                setError(null);
              }}
              disabled={isLoading}
              className="px-6 py-3 border border-stone-300 text-stone-700 font-medium rounded-lg hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectUploader;
