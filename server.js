import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

if (!process.env.OPENAI_API_KEY) {
  console.warn('WARNING: OPENAI_API_KEY is not configured.');
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const upload = multer({
  dest: 'tmp/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
    cb(ok ? null : new Error('Only PDF files are allowed.'), ok);
  }
});

app.use(express.static('public'));
app.use('/sites', express.static(path.resolve('public/sites')));

const schemaInstruction = `
You are an expert academic CV editor and web content architect.

Read the uploaded resume PDF carefully. Extract ONLY information supported by the PDF.
Do not invent degrees, dates, papers, employers, metrics, awards, links, or research claims.
Preserve names, titles, chemical formulas, journal names and author lists accurately.
Normalize common chemical formulas with Unicode subscripts when appropriate, e.g. CO2 -> CO₂, N4 -> N₄.

Return ONE valid JSON object with this exact high-level structure:
{
  "name": "",
  "englishName": "",
  "headline": "",
  "summary": "",
  "education": [{"period":"","school":"","degree":"","details":""}],
  "research": [{"period":"","title":"","advisor":"","bullets":[]}],
  "work": [{"period":"","company":"","role":"","bullets":[]}],
  "skills": [{"group":"","items":[]}],
  "awards": [{"period":"","title":""}],
  "papers": [{"authors":"","title":"","journal":"","year":"","volume":"","pages":"","doi":"","link":""}],
  "contact": {"email":"","phone":"","location":"","links":[]}
}

For missing fields use an empty string or an empty array.
Keep bullet points concise and professional.
The output will be rendered into a Chinese-first academic personal homepage.
`;

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '');
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
  throw new Error('AI returned invalid JSON.');
}

function esc(value='') {
  return String(value)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'","&#39;");
}

function arr(value) { return Array.isArray(value) ? value : []; }

function makePage(data, title, photoUrl) {
  const edu = arr(data.education).map(x => `
    <article class="timeline-item">
      <div class="period">${esc(x.period)}</div>
      <h3>${esc(x.school)}</h3>
      <p class="meta">${esc(x.degree)}</p>
      ${x.details ? `<p>${esc(x.details)}</p>` : ''}
    </article>`).join('');

  const research = arr(data.research).map(x => `
    <article class="timeline-item">
      <div class="period">${esc(x.period)}</div>
      <h3>${esc(x.title)}</h3>
      ${x.advisor ? `<p class="meta">${esc(x.advisor)}</p>` : ''}
      <ul>${arr(x.bullets).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
    </article>`).join('');

  const work = arr(data.work).map(x => `
    <article class="timeline-item">
      <div class="period">${esc(x.period)}</div>
      <h3>${esc(x.company)}</h3>
      <p class="meta">${esc(x.role)}</p>
      <ul>${arr(x.bullets).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
    </article>`).join('');

  const skills = arr(data.skills).map(x => `
    <div class="skill-group"><b>${esc(x.group)}</b><div class="chips">
      ${arr(x.items).map(i => `<span>${esc(i)}</span>`).join('')}
    </div></div>`).join('');

  const awards = arr(data.awards).map(x => `
    <div class="award"><span>${esc(x.period)}</span><b>${esc(x.title)}</b></div>`).join('');

  const papers = arr(data.papers).map((x,i) => `
    <article class="paper">
      <div class="paper-no">${i+1}</div>
      <div>
        <h3>${esc(x.title)}</h3>
        <p>${esc(x.authors)}</p>
        <p class="meta">${esc(x.journal)} ${esc(x.year)} ${esc(x.volume)} ${esc(x.pages)}</p>
        ${x.doi ? `<p class="meta">DOI: ${esc(x.doi)}</p>` : ''}
        ${x.link ? `<a href="${esc(x.link)}" target="_blank" rel="noopener">论文链接 ↗</a>` : ''}
      </div>
    </article>`).join('');

  const photo = photoUrl
    ? `<img class="portrait" src="${esc(photoUrl)}" alt="个人照片">`
    : `<div class="portrait placeholder">PHOTO</div>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title || data.name || 'Academic Profile')}</title>
<style>
:root{--ink:#102a43;--muted:#60758a;--primary:#287696;--line:#dce6ec;--bg:#f5f8fa}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;font-family:Inter,"Noto Sans SC","Microsoft YaHei",sans-serif;color:var(--ink);background:var(--bg);line-height:1.75}
a{color:var(--primary);text-decoration:none}.layout{display:flex;min-height:100vh}.side{position:fixed;inset:0 auto 0 0;width:230px;background:#fff;border-right:1px solid var(--line);padding:26px 16px;z-index:10;display:flex;flex-direction:column}
.logo{display:flex;gap:10px;align-items:center;margin-bottom:24px}.logo-mark{width:42px;height:42px;border-radius:12px;background:#d9eef2;display:grid;place-items:center;font-weight:900;color:var(--primary)}.logo b{display:block}.logo small{color:var(--muted)}
.nav{display:grid;gap:4px;overflow:auto}.nav a{padding:11px 12px;border-radius:11px;color:#50657a}.nav a:hover{background:#edf6f8;color:var(--primary)}
.side-note{margin-top:auto;border-top:1px solid var(--line);padding-top:12px;color:#98a2b3;font-size:11px}
.main{margin-left:230px;width:calc(100% - 230px)}.container{max-width:1050px;margin:auto;padding:58px 44px}
.hero{display:grid;grid-template-columns:1fr 230px;gap:42px;align-items:center;min-height:470px}.eyebrow{display:inline-block;background:#e7f3f6;color:var(--primary);padding:6px 12px;border-radius:999px;font-size:13px;font-weight:800}
h1{font-size:64px;line-height:1.05;margin:18px 0 4px;letter-spacing:-2px}.headline{font-size:22px;color:var(--muted)}.summary{font-size:17px;color:#40566b;max-width:700px}.portrait{width:180px;aspect-ratio:3/4;object-fit:cover;border-radius:20px;border:1px solid var(--line);box-shadow:0 12px 30px rgba(16,42,67,.08)}.placeholder{display:grid;place-items:center;background:#eef4f6;color:#8da0ae;font-weight:800}
.section{padding:55px 0;border-top:1px solid var(--line)}.kicker{font-size:13px;color:var(--primary);font-weight:900;letter-spacing:1px;text-transform:uppercase}.section h2{font-size:38px;margin:4px 0 28px}
.timeline{border-left:2px solid #cbd9e0;padding-left:24px}.timeline-item{position:relative;margin-bottom:28px}.timeline-item:before{content:"";position:absolute;left:-33px;top:8px;width:12px;height:12px;border:4px solid #fff;background:#7caf98;border-radius:50%;box-shadow:0 0 0 2px #7caf98}.period{color:var(--primary);font-weight:900}.timeline h3{font-size:21px;margin:4px 0}.meta{color:var(--muted);margin:3px 0}.timeline ul{margin:8px 0 0;padding-left:22px}
.skill-group{margin-bottom:18px}.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}.chips span{border:1px solid var(--line);padding:6px 11px;border-radius:999px;background:#fff;font-size:13px}
.award{display:flex;gap:22px;padding:13px 0;border-bottom:1px solid var(--line)}.award span{width:90px;color:var(--muted)}
.paper{display:grid;grid-template-columns:38px 1fr;gap:14px;padding:18px 0;border-bottom:1px solid var(--line)}.paper-no{width:30px;height:30px;border-radius:50%;background:#e8f3f6;color:var(--primary);display:grid;place-items:center;font-weight:900}.paper h3{font-size:18px;margin:0 0 5px}.paper p{margin:3px 0}.footer{padding:40px 0;color:var(--muted);font-size:13px}
@media(max-width:800px){.side{position:static;width:100%;height:auto}.layout{display:block}.main{margin-left:0;width:100%}.nav{display:flex;overflow:auto}.nav a{white-space:nowrap}.side-note{margin-top:14px}.container{padding:32px 20px}.hero{grid-template-columns:1fr}.portrait{width:150px}h1{font-size:46px}.section h2{font-size:30px}}
</style>
</head>
<body>
<div class="layout">
<aside class="side">
  <div class="logo"><div class="logo-mark">${esc((data.name||'A').slice(0,2).toUpperCase())}</div><div><b>${esc(data.englishName || data.name || 'Academic Profile')}</b><small>Academic Profile</small></div></div>
  <nav class="nav">
    <a href="#about">关于我</a><a href="#education">教育背景</a><a href="#research">科研经历</a>
    ${work ? '<a href="#work">工作经历</a>' : ''}<a href="#skills">专业技能</a><a href="#awards">荣誉与奖项</a><a href="#papers">代表性论文</a><a href="#contact">联系方式</a>
  </nav>
  <div class="side-note">AI-generated academic profile</div>
</aside>
<main class="main"><div class="container">
<section class="hero" id="about">
  <div><span class="eyebrow">Academic Profile</span><h1>${esc(data.name || 'Academic Profile')}</h1><div class="headline">${esc(data.headline)}</div><p class="summary">${esc(data.summary)}</p></div>
  <div>${photo}</div>
</section>

<section class="section" id="education"><div class="kicker">Education</div><h2>教育背景</h2><div class="timeline">${edu}</div></section>
<section class="section" id="research"><div class="kicker">Research</div><h2>科研经历</h2><div class="timeline">${research}</div></section>
${work ? `<section class="section" id="work"><div class="kicker">Work Experience</div><h2>工作经历</h2><div class="timeline">${work}</div></section>` : ''}
<section class="section" id="skills"><div class="kicker">Skills</div><h2>专业技能</h2>${skills}</section>
<section class="section" id="awards"><div class="kicker">Awards</div><h2>荣誉与奖项</h2>${awards}</section>
<section class="section" id="papers"><div class="kicker">Publications</div><h2>代表性论文</h2>${papers}</section>
<section class="section" id="contact"><div class="kicker">Contact</div><h2>联系方式</h2>
  ${data.contact?.email ? `<p>邮箱：<a href="mailto:${esc(data.contact.email)}">${esc(data.contact.email)}</a></p>` : ''}
  ${data.contact?.phone ? `<p>电话：${esc(data.contact.phone)}</p>` : ''}
  ${data.contact?.location ? `<p>所在地：${esc(data.contact.location)}</p>` : ''}
  ${arr(data.contact?.links).map(l=>`<p><a href="${esc(l)}" target="_blank" rel="noopener">${esc(l)}</a></p>`).join('')}
</section>
<div class="footer">Generated by AI Resume Homepage Generator · ${new Date().getFullYear()}</div>
</div></main></div>
</body></html>`;
}

app.post('/api/generate', upload.single('resume'), async (req, res) => {
  let uploadedFile;
  try {
    if (!req.file) return res.status(400).json({ error: '请上传 PDF 简历。' });
    if (!process.env.OPENAI_API_KEY) return res.status(500).json({ error: '服务器尚未配置 OPENAI_API_KEY。' });

    // 1) Upload PDF to OpenAI Files API.
    const { createReadStream } = await import('node:fs');
    uploadedFile = await openai.files.create({
      file: createReadStream(req.file.path),
      purpose: 'user_data',
      expires_after: { anchor: 'created_at', seconds: 86400 }
    });

    // 2) Ask the model to analyze the PDF and return structured resume data.
    const response = await openai.responses.create({
      model: MODEL,
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', file_id: uploadedFile.id },
          { type: 'input_text', text: schemaInstruction }
        ]
      }]
    });

    const data = extractJson(response.output_text);
    const title = req.body.siteTitle || data.englishName || data.name || 'Academic Profile';
    const slug = `${(data.englishName || data.name || 'profile')
      .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'profile'}-${crypto.randomBytes(3).toString('hex')}`;

    // 3) Generate a standalone public HTML page.
    const dir = path.resolve('public/sites', slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), makePage(data, title, req.body.photoUrl || ''), 'utf8');

    res.json({
      ok: true,
      slug,
      url: `${PUBLIC_BASE_URL}/sites/${slug}/`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error?.message || 'AI 生成失败，请稍后重试。' });
  } finally {
    if (req.file?.path) await fs.rm(req.file.path, { force: true }).catch(() => {});
    if (uploadedFile?.id) await openai.files.delete(uploadedFile.id).catch(() => {});
  }
});

app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'PDF 超过 10 MB。' : err.message });
  }
  res.status(400).json({ error: err.message || '请求失败。' });
});

app.listen(PORT, () => {
  console.log(`AI Resume Generator running at ${PUBLIC_BASE_URL}`);
});
