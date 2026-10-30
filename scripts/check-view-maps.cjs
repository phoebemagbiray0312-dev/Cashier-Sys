/** Ensure every Record<View, string> map includes every View member before compilation. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const page = fs.readFileSync(path.resolve(__dirname, '../app/page.tsx'), 'utf8');
const declared = page.match(/type\s+View\s*=\s*([^;]+);/);
assert(declared, 'View union declaration not found');
const views = [...declared[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
assert(views.length > 0, 'View union is empty');
const maps = [...page.matchAll(/const\s+(\w+)\s*:\s*Record<View,\s*string>\s*=\s*\{([\s\S]*?)\};/g)];
assert(maps.length > 0, 'Record<View,string> mappings not found');
for (const match of maps) {
  const [,name,body] = match;
  const keys = new Set([...body.matchAll(/(?:^|,)\s*(\w+)\s*:/g)].map(m => m[1]));
  const missing = views.filter(v => !keys.has(v));
  assert.deepEqual(missing, [], `${name} missing View keys: ${missing.join(', ')}`);
  console.log(`PASS: ${name} covers all ${views.length} View values`);
}
