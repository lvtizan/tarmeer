const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildSeedData,
  SHOWCASE_AVATAR_URLS,
  SHOWCASE_COVER_URLS,
} = require('./seed-showcase-designers.js');

test('showcase seed uses site-hosted avatar and cover assets', async () => {
  const { designers, projects } = await buildSeedData();

  assert.equal(designers.length, 26);
  assert.equal(projects.length, 181);
  assert.equal(new Set(SHOWCASE_AVATAR_URLS).size, 26);
  assert.equal(new Set(SHOWCASE_COVER_URLS).size, 32);

  for (const designer of designers) {
    assert.match(designer.avatar_url, /^https:\/\/www\.tarmeer\.com\/images\/showcase\/avatar-\d{2}\.png$/);
    assert.equal(designer.email_verified, 0);
  }

  for (const project of projects) {
    const images = JSON.parse(project.images);
    assert.ok(images.length >= 2);
    for (const image of images) {
      assert.match(image, /^https:\/\/www\.tarmeer\.com\/images\/showcase\/cover-\d{2}\.png$/);
    }
  }
});
