const { google } = require("googleapis");

exports.config = {
  // 09:30 Asia/Yerevan = 05:30 UTC
  schedule: "30 5 * * *"
};

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function telegramSend(text) {
  const token = mustGetEnv("TELEGRAM_BOT_TOKEN");
  const chatId = mustGetEnv("TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram send failed: ${res.status} ${body}`);
  }
}

function loadServiceAccount() {
  const raw = mustGetEnv("GOOGLE_SERVICE_ACCOUNT_JSON");
  return JSON.parse(raw);
}

async function getSearchConsoleClient() {
  const sa = loadServiceAccount();
  const auth = new google.auth.JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"]
  });

  return google.searchconsole({ version: "v1", auth });
}

async function queryTotals(webmasters, siteUrl, startDate, endDate) {
  const resp = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: { startDate, endDate }
  });

  const row = resp?.data?.rows?.[0];
  return {
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0
  };
}

async function queryTop(webmasters, siteUrl, startDate, endDate, dimension, limit = 10) {
  const resp = await webmasters.searchanalytics.query({
    siteUrl,
    requestBody: {
      startDate,
      endDate,
      dimensions: [dimension],
      rowLimit: limit
    }
  });

  return (resp?.data?.rows ?? []).map(r => ({
    key: r.keys?.[0] ?? "(unknown)",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    ctr: r.ctr ?? 0,
    position: r.position ?? 0
  }));
}

function fmtPct(x) { return `${(x * 100).toFixed(2)}%`; }
function fmtNum(x) { return Number(x).toLocaleString("en-US"); }
function fmtPos(x) { return Number(x).toFixed(2); }

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function blockTop(title, items) {
  if (!items.length) return `<b>${title}</b>\n(no data)\n`;
  const lines = items.map((it, i) =>
    `${i + 1}. ${escapeHtml(it.key)} — ${fmtNum(it.clicks)} clicks, ${fmtNum(it.impressions)} impr, ${fmtPct(it.ctr)}, pos ${fmtPos(it.position)}`
  );
  return `<b>${title}</b>\n${lines.join("\n")}\n`;
}

exports.handler = async () => {
  // Don’t send before your first push time
  const startAtUtc = mustGetEnv("START_AT_UTC");
  if (Date.now() < Date.parse(startAtUtc)) return;

  const sites = JSON.parse(mustGetEnv("SITES_URLS"));
  const webmasters = await getSearchConsoleClient();

  // Pull yesterday (UTC) — stable daily window
  const now = new Date();
  const y = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const startDate = isoDate(y);
  const endDate = isoDate(y);

  for (const siteUrl of sites) {
    const totals = await queryTotals(webmasters, siteUrl, startDate, endDate);
    const topQueries = await queryTop(webmasters, siteUrl, startDate, endDate, "query", 10);
    const topPages = await queryTop(webmasters, siteUrl, startDate, endDate, "page", 10);
    const topCountries = await queryTop(webmasters, siteUrl, startDate, endDate, "country", 10);

    const msg =
`<b>GSC Daily Update</b>
<b>Property:</b> ${escapeHtml(siteUrl)}
<b>Date:</b> ${startDate}

<b>Totals</b>
• Clicks: ${fmtNum(totals.clicks)}
• Impressions: ${fmtNum(totals.impressions)}
• Avg CTR: ${fmtPct(totals.ctr)}
• Avg Position: ${fmtPos(totals.position)}

${blockTop("Top Queries", topQueries)}
${blockTop("Top Pages", topPages)}
${blockTop("Top Countries", topCountries)}
`;

    await telegramSend(msg);
  }
};
