import { readFile, writeFile } from 'node:fs/promises';
const sessions = JSON.parse(await readFile(new URL('../src/data/registration-sessions.json', import.meta.url), 'utf8'));
const filename=process.argv[2];
if (!filename || !/^\d{4}_[a-z0-9_]+\.sql$/.test(filename)) throw new Error('Provide a NEW migration filename, e.g. npm run registration:seed -- 0004_new_sessions.sql');
const q = value => "'" + String(value).replace(/'/g,"''") + "'";
// Seed only missing rows; never overwrite a staff-updated session on redeploy.
const sql = sessions.map(s => `INSERT OR IGNORE INTO course_sessions (id, course_id, data_json) VALUES (${q(s.id)}, ${q(s.courseId)}, ${q(JSON.stringify(s))});`).join('\n');
await writeFile(new URL(`../migrations/${filename}`, import.meta.url), sql + '\n', {flag:'wx'});
console.log(`Prepared ${sessions.length} sessions in ${filename}; existing rows and migrations are preserved.`);
