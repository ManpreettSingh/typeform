// One-time setup: backend virtualenv + Python deps, frontend npm deps, local .env files.
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const frontend = join(root, "frontend");

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(" ")}  (in ${cwd})`);
  const { status } = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (status !== 0) process.exit(status ?? 1);
}

if (!existsSync(join(backend, ".venv"))) {
  const systemPython = process.platform === "win32" ? "python" : "python3";
  run(systemPython, ["-m", "venv", ".venv"], backend);
}
run("node", [join(root, "scripts", "py.mjs"), "-m", "pip", "install", "-r", "requirements.txt"], root);
run("npm", ["install"], frontend);

for (const [example, target] of [
  [join(backend, ".env.example"), join(backend, ".env")],
  [join(frontend, ".env.example"), join(frontend, ".env.local")],
]) {
  if (!existsSync(target)) copyFileSync(example, target);
}

console.log("\nSetup complete. Start both servers with `npm run dev`.");
