const fs = require('fs');
let code = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
code = code.replace(/\\`/g, '`').replace(/\\\$/g, '$');
fs.writeFileSync('app/dashboard/page.tsx', code);
