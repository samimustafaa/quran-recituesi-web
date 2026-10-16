import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const task = process.argv[2];
if (!['assembleDebug', 'bundleRelease'].includes(task)) throw new Error('Choose assembleDebug or bundleRelease.');
const windows = process.platform === 'win32';
const child = spawn(windows ? 'gradlew.bat' : './gradlew', [task, '--no-daemon'], {cwd: fileURLToPath(new URL('../android/', import.meta.url)), stdio: 'inherit', shell: windows});
child.on('error', error => {console.error(error.message); process.exitCode = 1;});
child.on('exit', code => {process.exitCode = code ?? 1;});
