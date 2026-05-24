const fs = require('fs');
const path = require('path');

const ROOT = 'f:/management ecole/web/src/views';

const PORTAL_CONFIG = [
  {
    file: 'teacher/Dashboard.tsx',
    importPath: '../../components/dashboard/premium',
    variant: 'teacher',
    badge: 'Enseignant',
    metaVar: 'activeMeta',
    descVar: 'activeMeta.description',
    iconVar: 'ActiveTabIcon',
    oldWrapper: '<motion.div className="min-h-screen flex premium-body">',
    newWrapper: '<PremiumPortalShell variant="teacher">\n      <div className="min-h-screen flex">',
  },
];

function patchModuleHeader(content, cfg) {
  const startMarker = 'className={`rounded-2xl bg-gradient-to-r ${';
  const start = content.indexOf(startMarker);
  if (start < 0) return content;

  // find opening div before startMarker (the outer gradient div)
  let divStart = content.lastIndexOf('<div', start);
  if (divStart < 0) return content;

  const animateIdx = content.indexOf('<div className="animate-slide-up">', start);
  if (animateIdx < 0) return content;

  const replacement = `              <PremiumModuleHeader
                title={${cfg.metaVar}.label}
                description={${cfg.descVar}}
                icon={${cfg.iconVar}}
                gradient={${cfg.metaVar}.color}
                badge="${cfg.badge}"
              />

              `;

  return content.slice(0, divStart) + replacement + content.slice(animateIdx);
}

function addImports(content, importPath) {
  if (content.includes('PremiumModuleHeader')) return content;
  const marker = "import { inactiveModuleIconClass }";
  if (content.includes(marker)) {
    return content.replace(
      marker,
      `import { PremiumPortalShell, PremiumModuleHeader } from '${importPath.replace('../../', '@/').replace(/\\/g, '/')}';` +
        (importPath.startsWith('../') ? `\nimport { PremiumPortalShell, PremiumModuleHeader } from '${importPath}';` : '') +
        `\n${marker}`
    );
  }
  // teacher uses relative
  const rel = importPath || '../../components/dashboard/premium';
  const insertAfter = content.indexOf("import { inactiveModuleIconClass }");
  if (insertAfter >= 0) {
    const lineEnd = content.indexOf('\n', insertAfter);
    return (
      content.slice(0, lineEnd + 1) +
      `import { PremiumPortalShell, PremiumModuleHeader } from '${rel}';\n` +
      content.slice(lineEnd + 1)
    );
  }
  return content;
}

function wrapPortal(content, variant) {
  let s = content;
  s = s.replace(
    '<div className="min-h-screen flex premium-body">',
    `<PremiumPortalShell variant="${variant}">\n      <div className="min-h-screen flex">`
  );
  s = s.replace(
    '<div className="min-h-screen premium-body">',
    `<PremiumPortalShell variant="${variant}">\n      <motion.div className="min-h-screen">`
  );
  if (!s.includes('</PremiumPortalShell>')) {
    s = s.replace(/\n    <\/Layout>\n/, '\n      </PremiumPortalShell>\n    </Layout>\n');
  }
  return s.replace(/motion\.div/g, 'div');
}

const files = [
  ['teacher/Dashboard.tsx', 'teacher', 'activeMeta', 'activeMeta.description', 'ActiveTabIcon', 'Enseignant'],
  ['student/Dashboard.tsx', 'student', 'activeMeta', 'activeMeta.description', 'ActiveTabIcon', 'Élève'],
  ['parent/Dashboard.tsx', 'parent', 'activeMeta', 'activeDescription', 'ActiveTabIcon', 'Parent'],
  ['educator/Dashboard.tsx', 'educator', 'activeMeta', 'activeMeta.description', 'ActiveTabIcon', 'Éducateur'],
  ['staff/Dashboard.tsx', 'staff', 'activeMeta', 'activeMeta.description', 'ActiveTabIcon', 'Personnel'],
];

for (const [rel, variant, meta, desc, icon, badge] of files) {
  const fp = path.join(ROOT, rel);
  let s = fs.readFileSync(fp, 'utf8');
  if (!s.includes('PremiumModuleHeader')) {
    const insertAfter = s.indexOf("import { inactiveModuleIconClass }");
    if (insertAfter >= 0) {
      const lineEnd = s.indexOf('\n', insertAfter);
      s =
        s.slice(0, lineEnd + 1) +
        "import { PremiumPortalShell, PremiumModuleHeader } from '../../components/dashboard/premium';\n" +
        s.slice(lineEnd + 1);
    } else if (rel === 'parent/Dashboard.tsx') {
      s = s.replace(
        "import ParentSidebar",
        "import { PremiumPortalShell, PremiumModuleHeader } from '../../components/dashboard/premium';\nimport ParentSidebar"
      );
    }
  }
  s = wrapPortal(s, variant);

  const startMarker = 'className={`rounded-2xl bg-gradient-to-r ${';
  const start = s.indexOf(startMarker);
  if (start >= 0) {
    const divStart = s.lastIndexOf('<div', start);
    const animateIdx = s.indexOf('<div className="animate-slide-up">', start);
    const altAnimate = s.indexOf('<div className="space-y-4', start);
    const endAnimate = animateIdx >= 0 ? animateIdx : altAnimate;
    if (divStart >= 0 && endAnimate > divStart) {
      const replacement = `              <PremiumModuleHeader
                title={${meta}.label}
                description={${desc}}
                icon={${icon}}
                gradient={${meta}.color}
                badge="${badge}"
              />

              `;
      s = s.slice(0, divStart) + replacement + s.slice(endAnimate);
    }
  }
  fs.writeFileSync(fp, s);
  console.log('patched', rel);
}

// Admin dashboard - special with actions
const adminFp = path.join(ROOT, 'admin/Dashboard.tsx');
let admin = fs.readFileSync(adminFp, 'utf8');
if (!admin.includes('PremiumPortalShell')) {
  admin = admin.replace(
    "import AdminSidebar from '../../components/admin/AdminSidebar';",
    "import AdminSidebar from '../../components/admin/AdminSidebar';\nimport { PremiumPortalShell, PremiumModuleHeader } from '../../components/dashboard/premium';"
  );
  admin = admin.replace(
    '<div className="min-h-screen flex premium-body">',
    '<PremiumPortalShell variant="admin">\n        <div className="min-h-screen flex">'
  );
  admin = admin.replace(/\n    <\/Layout>\n/, '\n      </PremiumPortalShell>\n    </Layout>\n');

  const start = admin.indexOf('className={`rounded-2xl bg-gradient-to-r ${activeTabMeta.color}');
  if (start >= 0) {
    const divStart = admin.lastIndexOf('<div', start);
    const afterBlock = admin.indexOf('{workspaceRestricted', start);
    const fallback = admin.indexOf('{activeTab ===', start);
    const endBlock = afterBlock >= 0 ? admin.lastIndexOf('</motion.div>', fallback) : admin.lastIndexOf('</div>', fallback);
    // simpler: find closing of module header - 3 closing divs after start
    let pos = start;
    let depth = 0;
    let headerEnd = -1;
    for (let i = divStart; i < admin.length; i++) {
      if (admin.slice(i, i + 4) === '<div') depth++;
      if (admin.slice(i, i + 6) === '</div>') {
        depth--;
        if (depth === 0) {
          headerEnd = i + 6;
          break;
        }
      }
    }
    if (headerEnd > divStart) {
      const replacement = `<PremiumModuleHeader
                title={activeTabMeta.label}
                description={activeTabMeta.description}
                icon={ActiveTabIcon}
                gradient={activeTabMeta.color}
                badge="Admin"
                actions={
                  <div className="flex flex-wrap items-center gap-2">
                    {quickActions.slice(0, 2).map((qa) => (
                      <button
                        key={qa.label}
                        type="button"
                        onClick={qa.action}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-br from-stone-900 to-stone-800 text-amber-50 shadow-sm hover:from-stone-800 hover:to-stone-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2"
                      >
                        {qa.label}
                        <FiArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
                      </button>
                    ))}
                  </div>
                }
              />

              `;
      admin = admin.slice(0, divStart) + replacement + admin.slice(headerEnd);
    }
  }
  fs.writeFileSync(adminFp, admin.replace(/motion\.motion\.div/g, 'div').replace(/motion\.div/g, 'div'));
  console.log('patched admin');
}

console.log('done');
