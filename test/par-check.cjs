// Par-Check: direkte Lösung je Level vs. par.cost
global.window = {};
const fs = require('fs');
const vm = require('vm');
const path = require('path');
const root = path.join(__dirname, '..');
const FILES = ['js/config.js', 'js/storage.js', 'js/audio.js', 'js/levels.js',
    'js/levelformat.js', 'js/physics.js'];
const sandbox = vm.createContext({ window: {}, console, setTimeout, clearTimeout });
sandbox.window = sandbox;
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), sandbox, { filename: f });
const BB = sandbox.window.BB;
const smoke = fs.readFileSync(path.join(root, 'test', 'smoke.mjs'), 'utf8');
// createSolution aus smoke.mjs extrahieren:
const fnStart = smoke.indexOf('function createSolution');
const fnEnd = smoke.indexOf('function simulateSolution');
eval(smoke.slice(fnStart, fnEnd));
BB.LEVELS.forEach(function (lvl, i) {
    const sol = createSolution(lvl, 'direct');
    const cost = sol ? BB.totalCost(sol.beams) : null;
    console.log('Level ' + (i + 1) + ': direkt ' + (cost === null ? 'NICHT MÖGLICH' : cost + ' $') +
        ' | par.cost ' + lvl.par.cost + ' $ | Budget ' + lvl.budget + ' $' +
        (cost !== null && cost <= lvl.par.cost ? '  ✓ 3 Sterne möglich' : '  ⚠ PAR ZU NIEDRIG'));
});
