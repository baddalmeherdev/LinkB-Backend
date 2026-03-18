import app from "./app";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

// Increase server-level timeouts so long yt-dlp jobs are never killed by the
// Node.js HTTP layer. Individual routes use keep-alive heartbeats to prevent
// the upstream proxy from closing idle connections.
server.setTimeout(0);             // Disable socket inactivity timeout
server.keepAliveTimeout = 305_000; // 5 min + margin (> headersTimeout)
server.headersTimeout = 310_000;  // 5 min 10 s
