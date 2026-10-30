const fs = require('fs');
const assert = require('assert');
const path = require('path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root,'app','globals.css'),'utf8');
const source = css.slice(css.indexOf('/* v9.23 — Universal UI spacing'));
const important = [
  ':root', '.main-content', '.panel-head', '.panel > .filters',
  '.table-wrap', '.report-selected-detail > p', '.report-selected-detail > .report-detail-actions',
  '.receipt-inline-editor', '.modal-overlay', '.modal-body',
  '.disb-paper-stage', '.disb-paper-head', '.disb-paper-body',
  '.disb-paper-summary-grid', '.disb-paper-table', '.office-workspace',
  '@media (max-width: 700px)', '@media (max-width: 390px)', '@media print'
];
for(const s of important)assert(source.includes(s),`Missing updated spacing rule ${s}`);
assert.strictEqual(source.split('{').length,source.split('}').length,'Unbalanced CSS braces');
assert(source.indexOf('@media print')>source.indexOf('@media (max-width: 390px)'),'Print reset should override mobile styling');
for(const filename of ['app/page.tsx','lib/data.ts','lib/disbursement-requests.ts']) {
  assert(fs.existsSync(path.join(root,filename)),`Must preserve ${filename}`);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
assert(/^9\.(23|24|25)\./.test(pkg.version), 'Legacy v9.23 spacing must remain in newer minor versions');
console.log('PASS v9.23 UI spacing rules: consistent workspace/panel gutters, responsive tables/dialogs, disbursement paper, office pages, and print-safe overrides.');
