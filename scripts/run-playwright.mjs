import { execFileSync, spawn } from 'node:child_process';

const workspaceSeed = Array.from(process.cwd()).reduce(
  (hash, character) => (hash * 31 + character.charCodeAt(0)) % 10000,
  0
);

const usedPorts = new Set();

try {
  const output = execFileSync('lsof', ['-nP', '-iTCP', '-sTCP:LISTEN'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });

  for (const line of output.split('\n')) {
    const match = line.match(/:(\d+)\s+\(LISTEN\)$/);
    if (match) {
      usedPorts.add(Number(match[1]));
    }
  }
} catch {
  // Fall back to the seeded default if lsof is unavailable in the environment.
}

const preferredPort = 45000 + workspaceSeed;
const fallbackRange = 400;

const selectPort = () => {
  const overriddenPort = Number(process.env.PLAYWRIGHT_PORT);

  if (Number.isInteger(overriddenPort) && overriddenPort > 0) {
    return overriddenPort;
  }

  for (let offset = 0; offset < fallbackRange; offset += 1) {
    const candidate = 45000 + ((workspaceSeed + offset) % 10000);
    if (!usedPorts.has(candidate)) {
      return candidate;
    }
  }

  return preferredPort;
};

const playwrightPort = selectPort();
const child = spawn(
  'bunx',
  ['playwright', 'test', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      PLAYWRIGHT_PORT: String(playwrightPort),
    },
    shell: process.platform === 'win32',
  }
);

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 1);
});
