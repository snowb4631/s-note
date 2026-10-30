// Minimal stand-in for the Upstash REST API. Scripts are not executed: every command counts
// per key and echoes the limit (ARGV[1]), as the fixed-window script does. No TTLs.
import http from "node:http";

const counts = new Map();
const seen = [];

http
  .createServer((req, res) => {
    const reply = (obj, status = 200) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(obj));
    };
    if (req.url === "/health") return reply({ ok: true });
    if (req.url === "/seen") return reply(seen);
    if (req.url === "/reset") {
      counts.clear();
      seen.length = 0;
      return reply({ ok: true });
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      seen.push(body);
      // The client auto-pipelines: /pipeline takes a list of commands and answers a list.
      const commands = JSON.parse(body);
      reply(
        commands.map((command) => {
          const key = command[3];
          const n = (counts.get(key) ?? 0) + 1;
          counts.set(key, n);
          return { result: [n, Number(command[4])] };
        }),
      );
    });
  })
  .listen(Number(process.argv[2]));
