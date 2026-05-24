const fs = require('fs');
const path = require('path');

const ROOT = 'f:/management ecole/web/src';

const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (!f.includes('node_modules')) walk(p);
    } else if (f.endsWith('.tsx') && fs.readFileSync(p, 'utf8').includes('ResponsiveContainer')) {
      files.push(p);
    }
  }
}
walk(ROOT);

for (const fp of files) {
  let s = fs.readFileSync(fp, 'utf8');
  const orig = s;

  // Add RechartsViewport import if using ResponsiveContainer
  if (s.includes('ResponsiveContainer') && !s.includes('RechartsViewport')) {
    if (s.includes("from '../charts'") || s.includes('from "../../components/charts"')) {
      s = s.replace(
        /from ['"](\.{1,2}\/)+charts['"];?/,
        (m) => m.replace("';\n", "';\n").replace(/;$/, '') // noop keep
      );
      s = s.replace(
        /(from ['"](?:@\/components|\.\.?\/)+charts['"];?\n)/,
        "$1"
      );
      // inject RechartsViewport into charts import
      s = s.replace(
        /import \{([^}]*)\} from ['"]([^'"]*charts)['"];/,
        (match, imports, mod) => {
          if (imports.includes('RechartsViewport')) return match;
          const trimmed = imports.trim();
          return `import { ${trimmed}${trimmed ? ', ' : ''}RechartsViewport${imports.includes('PremiumChartCard') ? '' : ', PremiumChartCard'} } from '${mod}';`;
        }
      );
    } else if (s.includes("from 'recharts'")) {
      s = s.replace(
        /} from 'recharts';/,
        "} from 'recharts';\nimport { RechartsViewport, CHART_AXIS_TICK, CHART_GRID_SOFT } from '@/components/charts';"
      );
    }
  }

  // Remove ResponsiveContainer from recharts import
  s = s.replace(/,?\s*ResponsiveContainer\s*,?/g, (m, offset, str) => {
    const before = str.slice(0, offset);
    if (!before.includes("from 'recharts'") && !before.includes('from "recharts"')) return m;
    return m.includes(',') ? '' : '';
  });
  s = s.replace(/{\s*,/g, '{ ');
  s = s.replace(/,\s*}/g, ' }');

  // Replace ResponsiveContainer wrapper with RechartsViewport
  s = s.replace(
    /<ResponsiveContainer width="100%" height="100%">\s*/g,
    '<RechartsViewport height={typeof height !== "undefined" ? height : 240} className="w-full">'
  );
  s = s.replace(
    /<ResponsiveContainer width="100%" height=\{(\d+)\}>\s*/g,
    '<RechartsViewport height={$1} className="w-full">'
  );
  s = s.replace(/<\/ResponsiveContainer>/g, '</RechartsViewport>');

  // Fix broken height reference - use inline 100% parent
  s = s.replace(
    '<RechartsViewport height={typeof height !== "undefined" ? height : 240} className="w-full">',
    '<RechartsViewport height="100%" className="w-full h-full">'
  );

  if (s !== orig) {
    fs.writeFileSync(fp, s);
    console.log('patched charts:', path.relative(ROOT, fp));
  }
}

console.log('done', files.length, 'files scanned');
