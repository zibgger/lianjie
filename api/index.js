const OpenAI = require("openai");
const { put } = require("@vercel/blob");

const MAX_PDF_BYTES = 4 * 1024 * 1024;
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6";

const PROFILE_SCHEMA_EXAMPLE = {
  name: "",
  englishName: "",
  headline: "",
  summary: "",
  location: "",
  education: [],
  research: [],
  work: [],
  skills: [],
  awards: [],
  papers: [],
  contact: {}
};

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(data));
}

function slugify(value) {
  const s = String(value || "profile")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return s || "profile";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeUrl(value) {
  const v = String(value || "").trim();
  if (/^https?:\/\//i.test(v)) return v;
  return "";
}

function normalizeProfile(raw) {
  const p = raw && typeof raw === "object" ? raw : {};
  const arr = (x) => Array.isArray(x) ? x : [];
  return {
    name: String(p.name || ""),
    englishName: String(p.englishName || ""),
    headline: String(p.headline || ""),
    summary: String(p.summary || ""),
    location: String(p.location || ""),
    education: arr(p.education),
    research: arr(p.research),
    work: arr(p.work),
    skills: arr(p.skills),
    awards: arr(p.awards),
    papers: arr(p.papers),
    contact: p.contact && typeof p.contact === "object" ? p.contact : {}
  };
}

function renderList(items, type) {
  if (!items.length) return '<p class="muted">暂无内容</p>';
  return items.map(item => {
    const x = item && typeof item === "object" ? item : { title: String(item) };
    const title = escapeHtml(x.title || x.name || x.position || "");
    const org = escapeHtml(x.organization || x.institution || x.company || x.supervisor || "");
    const date = escapeHtml(x.date || x.period || x.year || "");
    const desc = Array.isArray(x.description) ? x.description : (Array.isArray(x.highlights) ? x.highlights : []);
    const bullets = desc.map(d => `<li>${escapeHtml(d)}</li>`).join("");
    return `<article class="item">
      <div class="item-head">
        <h3>${title}</h3>
        <span>${date}</span>
      </div>
      ${org ? `<div class="org">${org}</div>` : ""}
      ${bullets ? `<ul>${bullets}</ul>` : ""}
    </article>`;
  }).join("");
}

function renderProfile(profile) {
  const p = normalizeProfile(profile);
  const contact = p.contact || {};
  const links = [
    ["Email", contact.email, contact.email ? `mailto:${contact.email}` : ""],
    ["GitHub", contact.github, safeUrl(contact.github)],
    ["LinkedIn", contact.linkedin, safeUrl(contact.linkedin)],
    ["Website", contact.website, safeUrl(contact.website)]
  ].filter(x => x[1]);

  const skillHtml = p.skills.length
    ? p.skills.map(s => `<span class="tag">${escapeHtml(typeof s === "string" ? s : (s.name || s.title || ""))}</span>`).join("")
    : '<p class="muted">暂无内容</p>';

  const paperHtml = p.papers.length
    ? p.papers.map(item => {
        const x = typeof item === "object" ? item : { title: item };
        const url = safeUrl(x.url || x.link);
        return `<article class="item">
          <h3>${escapeHtml(x.title || "")}</h3>
          ${x.authors ? `<div class="org">${escapeHtml(x.authors)}</div>` : ""}
          ${x.venue || x.year ? `<div class="org">${escapeHtml([x.venue, x.year].filter(Boolean).join(" · "))}</div>` : ""}
          ${url ? `<a class="paper-link" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">查看论文 ↗</a>` : ""}
        </article>`;
      }).join("")
    : '<p class="muted">暂无内容</p>';

  const contactHtml = links.length
    ? links.map(([label, value, href]) => href
      ? `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a>`
      : `<span>${escapeHtml(label)}: ${escapeHtml(value)}</span>`).join("")
    : '<span>暂无联系方式</span>';

  const title = [p.name, p.englishName].filter(Boolean).join(" · ") || "Academic Profile";
  const headline = p.headline || "Academic Profile";

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(p.summary || headline)}">
<style>
:root{--ink:#14213d;--muted:#60708a;--line:#e5eaf0;--accent:#26779b;--bg:#f6f8fa}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,"Microsoft YaHei",Arial,sans-serif;line-height:1.7}
.wrap{max-width:1040px;margin:0 auto;padding:56px 22px}.hero{background:#fff;border:1px solid var(--line);border-radius:28px;padding:42px;box-shadow:0 12px 40px rgba(20,33,61,.06)}
.kicker{color:var(--accent);font-weight:700;letter-spacing:.04em}.hero h1{font-size:48px;line-height:1.15;margin:10px 0}.headline{font-size:20px;color:var(--muted)}.summary{max-width:800px;color:#3e4d64;font-size:17px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px}.card{background:#fff;border:1px solid var(--line);border-radius:22px;padding:30px}.card.full{grid-column:1/-1}.card h2{margin-top:0;font-size:25px}.item{padding:18px 0;border-top:1px solid var(--line)}.item:first-child{border-top:0;padding-top:0}.item-head{display:flex;justify-content:space-between;gap:20px}.item h3{margin:0;font-size:18px}.item-head span{color:var(--muted);white-space:nowrap}.org,.muted{color:var(--muted)}ul{padding-left:22px}.tags{display:flex;flex-wrap:wrap;gap:10px}.tag{border:1px solid #d8e4ea;border-radius:999px;padding:7px 13px;color:#315c73;background:#f7fbfd}.contact{display:flex;flex-wrap:wrap;gap:12px}.contact a,.paper-link{color:var(--accent);text-decoration:none;font-weight:600}.footer{text-align:center;color:var(--muted);padding:28px}
@media(max-width:760px){.wrap{padding:22px 14px}.hero{padding:28px 22px}.hero h1{font-size:36px}.grid{grid-template-columns:1fr}.card.full{grid-column:auto}.item-head{display:block}}
</style>
</head>
<body>
<div class="wrap">
<section class="hero">
<div class="kicker">${escapeHtml(p.location || "Academic Profile")}</div>
<h1>${escapeHtml(p.name || "个人主页")}</h1>
${p.englishName ? `<div class="headline">${escapeHtml(p.englishName)}</div>` : ""}
<div class="headline">${escapeHtml(headline)}</div>
${p.summary ? `<p class="summary">${escapeHtml(p.summary)}</p>` : ""}
<div class="contact">${contactHtml}</div>
</section>
<div class="grid">
<section class="card full"><h2>教育背景</h2>${renderList(p.education, "education")}</section>
<section class="card full"><h2>科研经历</h2>${renderList(p.research, "research")}</section>
<section class="card full"><h2>工作经历</h2>${renderList(p.work, "work")}</section>
<section class="card"><h2>专业技能</h2><div class="tags">${skillHtml}</div></section>
<section class="card"><h2>荣誉与奖项</h2>${renderList(p.awards, "awards")}</section>
<section class="card full"><h2>论文与发表</h2>${paperHtml}</section>
</div>
<div class="footer">AI-generated academic homepage</div>
</div>
</body>
</html>`;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on("data", chunk => {
      total += chunk.length;
      if (total > MAX_PDF_BYTES) {
        reject(Object.assign(new Error("PDF too large. Maximum size is 4 MB."), { code: "TOO_LARGE" }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// This handler intentionally accepts the PDF as a raw binary request body.
// The browser sends application/pdf directly, avoiding multipart/disk storage,
// which is important for Vercel's serverless runtime.
module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, {
      ok: true,
      service: "AI Resume Homepage Generator",
      message: "API is running."
    });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJson(res, 500, { error: "OPENAI_API_KEY is not configured in Vercel." });
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return sendJson(res, 500, {
      error: "BLOB_READ_WRITE_TOKEN is not configured. Create a Vercel Blob Store and connect it to this project."
    });
  }

  const contentType = String(req.headers["content-type"] || "").split(";")[0].toLowerCase();
  if (contentType !== "application/pdf") {
    return sendJson(res, 400, { error: "Please upload a PDF file." });
  }

  try {
    const pdf = await readBody(req);

    if (!pdf.length) return sendJson(res, 400, { error: "The uploaded PDF is empty." });

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const file = await openai.files.create({
      file: new File([pdf], "resume.pdf", { type: "application/pdf" }),
      purpose: "user_data"
    });

    const response = await openai.responses.create({
      model: MODEL,
      input: [{
        role: "user",
        content: [
          { type: "input_file", file_id: file.id },
          {
            type: "input_text",
            text: `Read this PDF resume and extract its factual information into JSON only.
Do not invent facts. Preserve names, dates, institutions, supervisors, research topics,
work experience, standards, publications, skills and contact details as faithfully as possible.
Write concise Chinese descriptions when the source is Chinese; otherwise preserve English names.
Return exactly one JSON object matching this shape:
${JSON.stringify(PROFILE_SCHEMA_EXAMPLE, null, 2)}
For education/research/work/awards use objects with title/name, organization/institution/company,
date/period/year, and description or highlights arrays where appropriate.
For papers use title, authors, venue, year, url/link when present.
For contact use email, github, linkedin, website when present.`
          }
        ]
      }]
    });

    let text = String(response.output_text || "").trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();

    let profile;
    try {
      profile = JSON.parse(text);
    } catch {
      throw new Error("AI returned invalid JSON. Please try the PDF again.");
    }

    const normalized = normalizeProfile(profile);
    const baseSlug = slugify(normalized.englishName || normalized.name || "profile");
    const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
    const html = renderProfile(normalized);

    const blob = await put(`sites/${slug}/index.html`, html, {
      access: "public",
      addRandomSuffix: false,
      contentType: "text/html; charset=utf-8",
      cacheControlMaxAge: 31536000
    });

    // Best-effort cleanup of the temporary OpenAI file.
    try { await openai.files.delete(file.id); } catch {}

    return sendJson(res, 200, {
      ok: true,
      slug,
      url: blob.url,
      profile: normalized
    });
  } catch (error) {
    console.error("generate-homepage error:", error);
    const message = error && error.message ? error.message : "Generation failed.";
    return sendJson(res, error && error.code === "TOO_LARGE" ? 413 : 500, {
      error: message
    });
  }
};
