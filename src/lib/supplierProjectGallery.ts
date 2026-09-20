export interface SupplierProjectGallery {
  visible: string[];
  remaining: number;
}

/** Keep multi-project cards level: one cover, or two equal 16:9 covers with a remainder badge. */
export function buildSupplierProjectGallery(images: string[]): SupplierProjectGallery {
  return {
    visible: images.slice(0, 2),
    remaining: Math.max(0, images.length - 2),
  };
}
