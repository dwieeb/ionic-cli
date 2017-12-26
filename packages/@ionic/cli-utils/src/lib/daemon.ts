import * as path from 'path';

import chalk from 'chalk';
import * as lodash from 'lodash';
import * as expressType from 'express';

import { DaemonFile, IonicEnvironment } from '../definitions';
import { BaseConfig } from './config';
import { fsOpen, fsReadFile, fsWriteFile } from '@ionic/cli-framework/utils/fs';

export const DAEMON_PID_FILE = 'daemon.pid';
export const DAEMON_PORT_FILE = 'daemon.port';
export const DAEMON_JSON_FILE = 'daemon.json';
export const DAEMON_LOG_FILE = 'daemon.log';

export class Daemon extends BaseConfig<DaemonFile> {
  get pidFilePath(): string {
    return path.join(this.directory, DAEMON_PID_FILE);
  }

  get portFilePath(): string {
    return path.join(this.directory, DAEMON_PORT_FILE);
  }

  get logFilePath(): string {
    return path.join(this.directory, DAEMON_LOG_FILE);
  }

  async getPid(): Promise<number | undefined> {
    try {
      const f = await fsReadFile(this.pidFilePath, { encoding: 'utf8' });
      return Number(f);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }

  async setPid(pid: number): Promise<void> {
    await fsWriteFile(this.pidFilePath, String(pid), { encoding: 'utf8' });
  }

  async getPort(): Promise<number | undefined> {
    try {
      const f = await fsReadFile(this.portFilePath, { encoding: 'utf8' });
      return Number(f);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }

  async setPort(port: number): Promise<void> {
    await fsWriteFile(this.portFilePath, String(port), { encoding: 'utf8' });
  }

  async provideDefaults(o: any): Promise<DaemonFile> {
    const results = lodash.cloneDeep(o);

    if (!results.daemonVersion) {
      results.daemonVersion = '';
    }

    delete results.latestVersions;

    return results;
  }

  is(j: any): j is DaemonFile {
    return j && typeof j.daemonVersion === 'string';
  }
}

export function processRunning(pid: number): boolean {
  try {
    const r = process.kill(pid, 0);

    if (typeof r === 'boolean') {
      return r;
    }

    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
}

export async function checkForDaemon(env: IonicEnvironment): Promise<number> {
  const config = await env.config.load();

  if (!config.daemon.enabled) {
    return -1;
  }

  const f = await env.daemon.getPid();

  if (f && processRunning(f)) {
    env.log.debug(() => `Daemon found (pid: ${chalk.bold(String(f))})`);
    return f;
  }

  const crossSpawn = await import('cross-spawn');
  const fd = await fsOpen(env.daemon.logFilePath, 'a');

  const crossSpawnOptions: { cwd: string; stdio: (string | number)[]; shell?: boolean; detached?: boolean; } = {
    cwd: env.config.directory,
    stdio: ['ignore', fd, fd],
  };

  // TODO: should cross-spawn figure this stuff out? https://github.com/IndigoUnited/node-cross-spawn/issues/77
  if (process.platform === 'win32') {
    crossSpawnOptions.shell = true;
    crossSpawnOptions.detached = false;
  }

  const crossSpawnArgs = [crossSpawnOptions.shell ? `"${env.meta.binPath}"` : env.meta.binPath, 'daemon', '--verbose', '--no-interactive', '--log-timestamps'];
  const p = crossSpawn.spawn(crossSpawnOptions.shell ? `"${process.execPath}"` : process.execPath, crossSpawnArgs, crossSpawnOptions);

  p.unref();

  env.log.debug(`New daemon pid: ${chalk.bold(String(p.pid))}`);

  return p.pid;
}

export async function createCommServer(env: IonicEnvironment): Promise<expressType.Application> {
  const [ express, bodyParser ] = await Promise.all([import('express'), import('body-parser')]);
  const { PROJECT_FILE, Project } = await import('../lib/project');

  const app = express();

  app.use(bodyParser.json());

  app.post('/events/command', async (req, res) => {
    const { sendCommand } = await import('./telemetry');
    const { command, args } = req.body;

    if (typeof command !== 'string' || !args || typeof args.length !== 'number') {
      return res.sendStatus(400);
    }

    res.sendStatus(204);

    await env.config.load({ disk: true });
    await sendCommand(env, new Project(req.body.projectDir, PROJECT_FILE), command, args);
  });

  return app;
}
