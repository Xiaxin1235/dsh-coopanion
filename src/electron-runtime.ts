import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { NativeStartError } from './desktop-lifecycle.ts';

const exec = promisify(execFile);
const installLimitMs = 120_000;

function failure(error: unknown, locale?: string): NativeStartError {
  const zh = locale?.toLowerCase().startsWith('zh') ?? true;
  const value = error as { code?: string; killed?: boolean; stderr?: string } | undefined;
  // The installer can print paths, proxy settings and mirror URLs. Expose only a category.
  const detail = `${value?.code ?? ''} ${value?.stderr ?? ''}`;
  const reason = value?.killed ? 'timeout'
    : /\b(?:EACCES|EPERM|EBUSY|EROFS)\b/i.test(detail) ? 'access'
    : /\bENOSPC\b/i.test(detail) ? 'disk'
    : /\b(?:EAI_AGAIN|ENOTFOUND|ECONN\w+|ETIMEDOUT|ENETUNREACH)\b|fetch failed|HTTPError|status code [45]\d\d|unable to verify the first certificate/i.test(detail) ? 'network'
    : /ERR_DLOPEN_FAILED|native binding|failed to extract|checksum|integrity/i.test(detail) ? 'archive'
    : 'other';
  const hints = {
    timeout: ['下载或解压超时，检查网络后点击重启。', 'Download or extraction timed out. Check the connection, then select Restart.'],
    access: ['安装目录不可写或文件被占用，完全退出 Harness 后重开，再点击重启。', 'The install directory is locked or unwritable. Quit Harness completely, reopen it, then select Restart.'],
    disk: ['磁盘空间不足，腾出空间后点击重启。', 'Free up disk space, then select Restart.'],
    network: ['无法下载 Electron，检查 GitHub Releases 的连接或代理后点击重启。', 'Could not download Electron. Check access to GitHub Releases or your proxy, then select Restart.'],
    archive: ['Electron 校验或解压失败，检查系统阻止记录与安装包后点击重启。', 'Electron verification or extraction failed. Check system block logs and the package, then select Restart.'],
    other: ['检查安装日志或使用完整安装包重装后点击重启。', 'Check the installation log or reinstall the complete package, then select Restart.'],
  };
  return new NativeStartError(`${zh ? '桌宠运行组件安装失败' : 'Could not install the desktop pet runtime'} (${reason}). ${hints[reason][zh ? 0 : 1]}`, false);
}

export async function prepareElectronRuntime(signal?: AbortSignal, locale?: string): Promise<string> {
  signal?.throwIfAborted();
  const require = createRequire(import.meta.url);
  try {
    const root = dirname(require.resolve('electron/package.json'));
    const entry = process.platform === 'win32' ? 'electron.exe'
      : process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';
    const override = process.env.ELECTRON_OVERRIDE_DIST_PATH;
    const dist = override || join(root, 'dist');
    const executable = join(dist, entry);
    const version: string = require('electron/package.json').version;
    const ready = async () => {
      try {
        return (await stat(executable)).isFile() && (override ||
          (await readFile(join(dist, 'version'), 'utf8')).trim().replace(/^v/, '') === version);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      }
    };
    if (await ready()) return executable;
    if (override) throw new Error('Configured Electron distribution is missing');
    // Electron's package entry point runs this installer synchronously. Run it
    // as a bounded, cancellable child so the Harness can still answer requests.
    await exec(process.execPath, [join(root, 'install.js')], {
      cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, windowsHide: true,
      signal, timeout: installLimitMs, maxBuffer: 128 * 1024,
    });
    signal?.throwIfAborted();
    if (!await ready()) throw new Error('Electron executable missing after installation');
    return executable;
  } catch (error) {
    signal?.throwIfAborted();
    throw failure(error, locale);
  }
}
