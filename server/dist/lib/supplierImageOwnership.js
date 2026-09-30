"use strict";
const fs = require('fs/promises');
const path = require('path');
const {validImageUrl} = require('./materialProcurement');
async function supplierImagePathIsOwned(profile, imageUrl, folder, supplierUserId, publicRoot = path.resolve(process.cwd(),'public')) {
  if (!validImageUrl(imageUrl) || !imageUrl.startsWith('/uploads/') || /\.\.|[\\%?#]/.test(imageUrl)) return false;
  const slug = (profile.slug || `id${profile.id}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const profilePrefix = `/uploads/suppliers/${slug}/`;
  const user = Number(supplierUserId);
  const ownUserImage = Number.isSafeInteger(user) && user > 0 && new RegExp(`^/uploads/suppliers/products/${user}-[0-9a-f-]{36}\\.(?:png|jpe?g|webp|gif|avif)$`,'i').test(imageUrl);
  if (folder) {
    if (!new RegExp(`^${profilePrefix}${folder}/\\d+_[0-9a-f-]{36}\\.webp$`,'i').test(imageUrl)) return false;
  } else if (!ownUserImage && !imageUrl.startsWith(profilePrefix)) return false;
  const candidate = path.resolve(publicRoot,imageUrl.slice(1));
  try {
    const [realRoot,realFile,stat] = await Promise.all([fs.realpath(publicRoot),fs.realpath(candidate),fs.stat(candidate)]);
    return stat.isFile() && realFile === path.join(realRoot,imageUrl.slice(1));
  } catch { return false; }
}
module.exports = {supplierImagePathIsOwned};
