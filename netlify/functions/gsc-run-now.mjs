import runDaily from "./gsc-daily.mjs";

function preview(s, n = 40) {
  if (!s) return "(empty)";
  return s.slice(0, n).replaceAll("\n", "\\n");
}

export const handler = async () => {
  try {
    const g = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
    const s = process.env.SITES_URLS || "";

    // Validate JSON without printing the full thing
    JSON.parse(s);

    // This is the one failing for you:
    JSON.parse(g);

    await runDaily();
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    const g = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "";
    const s = process.env.SITES_URLS || "";

    return {
      statusCode: 500,
      body:
        "DEBUG\n" +
        `SITES_URLS starts: ${preview(s)}\n` +
        `SITES_URLS length: ${s.length}\n\n` +
        `GOOGLE_SERVICE_ACCOUNT_JSON starts: ${preview(g)}\n` +
        `GOOGLE_SERVICE_ACCOUNT_JSON length: ${g.length}\n\n` +
        `ERROR: ${err?.message || err}\n`
    };
  }
};
