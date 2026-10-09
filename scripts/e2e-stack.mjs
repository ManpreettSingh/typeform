// Isolated stack for browser checks: API on :8100 with a throwaway SQLite file, web on :3100.
// It never touches the ports you run by hand (3000 / 8000) or your real database, and it refuses to start if
// either of its own ports is taken.
//
// Usage: node scripts/e2e-stack.mjs start [--seed] | stop | status
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");
const dir = join(tmpdir(), "typeform-e2e");
const stateFile = join(dir, "pids.json");
const dbFile = join(dir, "e2e.db");

const API_PORT = 8100;
const WEB_PORT = 3100;
const API = `http://localhost:${API_PORT}`;
const WEB = `http://localhost:${WEB_PORT}`;
const isWindows = process.platform === "win32";
const python = isWindows ? join(backend, ".venv", "Scripts", "python.exe") : join(backend, ".venv", "bin", "python");
const nextBin = join(frontend, "node_modules", "next", "dist", "bin", "next");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** True when something accepts connections on the port, on IPv4 or IPv6 loopback. */
function inUse(port) {
  const probe = (host) =>
    new Promise((resolve) => {
      const socket = net.connect({ port, host });
      socket.setTimeout(800);
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("timeout", () => {
        socket.destroy();
        resolve(false);
      });
      socket.once("error", () => resolve(false));
    });
  return Promise.all([probe("127.0.0.1"), probe("::1")]).then(([v4, v6]) => v4 || v6);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Kills a process and everything it started. Never by image name: only the PIDs this script recorded. */
function killTree(pid) {
  if (isWindows) spawnSync("taskkill", ["/T", "/F", "/PID", String(pid)], { stdio: "ignore" });
  else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      /* already gone */
    }
  }
}

async function waitFor(url, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  throw new Error(`${label} did not answer at ${url} within ${timeoutMs / 1000}s (logs: ${dir})`);
}

function readState() {
  try {
    return JSON.parse(readFileSync(stateFile, "utf8"));
  } catch {
    return null;
  }
}

function launch(name, command, args, cwd, env) {
  const log = openSync(join(dir, `${name}.log`), "w");
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", log, log], detached: true, windowsHide: true });
  child.unref();
  closeSync(log);
  return child.pid;
}

async function start(seed) {
  const state = readState();
  if (state && (alive(state.api) || alive(state.web))) {
    console.error("The test stack is already running. Run `npm run e2e:status`, or `npm run e2e:stop` first.");
    process.exit(1);
  }
  for (const [port, name] of [
    [API_PORT, "API"],
    [WEB_PORT, "web app"],
  ]) {
    if (await inUse(port)) {
      console.error(`Port ${port} (${name}) is already in use, so nothing was started or changed.`);
      process.exit(1);
    }
  }
  if (!existsSync(python)) {
    console.error("Backend virtualenv not found. Run `npm run setup` first.");
    process.exit(1);
  }

  mkdirSync(dir, { recursive: true });
  rmSync(dbFile, { force: true });

  const apiEnv = {
    ...process.env,
    DATABASE_URL: `sqlite:///${dbFile.replaceAll("\\", "/")}`,
    CORS_ORIGINS: WEB,
    // Checks never reach real services. Later phases point these at local fake servers instead.
    GEMINI_API_KEY: "",
    CLOUDINARY_CLOUD_NAME: "",
    CLOUDINARY_API_KEY: "",
    CLOUDINARY_API_SECRET: "",
    CLOUDINARY_URL: "",
  };
  if (seed) {
    const res = spawnSync(python, ["-m", "app.seed"], { cwd: backend, env: apiEnv, encoding: "utf8" });
    if (res.status !== 0) {
      console.error(res.stderr || res.stdout);
      process.exit(1);
    }
  }

  const api = launch(
    "api",
    python,
    ["-m", "uvicorn", "app.main:app", "--port", String(API_PORT), "--timeout-graceful-shutdown", "1"],
    backend,
    apiEnv,
  );
  const web = launch("web", process.execPath, [nextBin, "dev", "-p", String(WEB_PORT)], frontend, {
    ...process.env,
    NEXT_PUBLIC_API_URL: `${API}/api`,
    NEXT_DIST_DIR: ".next-e2e",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  writeFileSync(stateFile, JSON.stringify({ api, web, db: dbFile }));

  try {
    await waitFor(`${API}/api/health`, "API", 60_000);
    await waitFor(`${WEB}/forms`, "web app", 240_000);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    stop();
    process.exit(1);
  }
  console.log(`Test stack is up\n  web  ${WEB}\n  api  ${API}/api   (docs: ${API}/docs)\n  db   ${dbFile}`);
}

function stop() {
  const state = readState();
  if (!state) {
    console.log("The test stack isn't running.");
    return;
  }
  for (const pid of [state.web, state.api]) if (pid) killTree(pid);
  rmSync(stateFile, { force: true });
  console.log("Test stack stopped.");
}

function status() {
  const state = readState();
  if (!state) {
    console.log("The test stack isn't running.");
    return;
  }
  const mark = (pid) => (alive(pid) ? `running (pid ${pid})` : "not running");
  console.log(`web  ${WEB}  ${mark(state.web)}\napi  ${API}/api  ${mark(state.api)}\ndb   ${state.db}`);
}

const [command, ...flags] = process.argv.slice(2);
if (command === "start") await start(flags.includes("--seed"));
else if (command === "stop") stop();
else if (command === "status") status();
else {
  console.error("usage: node scripts/e2e-stack.mjs start [--seed] | stop | status");
  process.exit(2);
}
