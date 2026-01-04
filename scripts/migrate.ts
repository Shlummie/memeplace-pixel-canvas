import { spawn } from 'node:child_process';

const subprocess = spawn('pnpm', ['--filter', 'server', 'run', 'migrate'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

subprocess.on('exit', (code) => {
  process.exit(code ?? 0);
});

