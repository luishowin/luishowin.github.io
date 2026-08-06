const fs = require('fs');
const f = 'C:/Users/Howin/Documents/GitHub/luishowin.github.io/docs/index.html';
const html = fs.readFileSync(f, 'utf8');
const sIdx = html.indexOf('<style>');
const style = html.slice(sIdx, html.indexOf('</style>'));

// Walk the style block tracking comment state; report any "*/" seen outside a comment
// and any "/*" that never closes.
let i = 0, inC = false, openAt = -1;
const lineOf = pos => style.slice(0, pos).split('\n').length + html.slice(0, sIdx).split('\n').length - 1;
const problems = [];
while (i < style.length - 1) {
  const two = style.substr(i, 2);
  if (!inC && two === '/*') { inC = true; openAt = i; i += 2; continue; }
  if (inC && two === '*/') { inC = false; openAt = -1; i += 2; continue; }
  if (!inC && two === '*/') {
    problems.push({ kind: 'stray close', line: lineOf(i), ctx: style.slice(Math.max(0, i - 90), i + 10).split('\n').slice(-3).join(' | ') });
    i += 2; continue;
  }
  i++;
}
if (inC) problems.push({ kind: 'unclosed open', line: lineOf(openAt), ctx: style.slice(openAt, openAt + 100) });
console.log(problems.length ? JSON.stringify(problems, null, 1) : 'comments are well-formed');
