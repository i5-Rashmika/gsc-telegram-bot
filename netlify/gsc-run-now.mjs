const { handler: dailyHandler } = require("./gsc-daily");

exports.handler = async (event, context) => {
  // Allow GET and POST
  if (event.httpMethod !== "GET" && event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Run the daily logic
  await dailyHandler(event, context);

  return { statusCode: 200, body: "OK" };
};
