import { copyFileSync } from 'node:fs';
// The reviewed source snapshot is canonical. Publish the exact same JSON for file consumers.
copyFileSync('src/data/subs/active.json', 'public/subs/active.json');
