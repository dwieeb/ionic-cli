import * as fs from 'fs';
import * as path from 'path';

import chalk from 'chalk';
import * as Debug from 'debug';

import { pathAccessible } from '@ionic/cli-framework/utils/fs';

import { IonicEnvironment, LabServeDetails, ServeDetails, ServeOptions } from '../../definitions';
import { BIND_ALL_ADDRESS, DEFAULT_LAB_PORT, LOCAL_ADDRESSES, runLab, selectExternalIP } from '../serve';

const NG_AUTODETECTED_PROXY_FILE = 'proxy.config.js';
const NG_SERVE_CONNECTIVITY_TIMEOUT = 20000; // ms

const debug = Debug('ionic:cli-utils:lib:ionic-core-angular:serve');

export async function serve({ env, options }: { env: IonicEnvironment, options: ServeOptions }): Promise<ServeDetails> {
  const { findClosestOpenPort, isHostConnectable } = await import('../utils/network');
  const [ externalIP, availableInterfaces ] = await selectExternalIP(env, options);
  let labDetails: LabServeDetails | undefined;

  debug('finding closest port to %d', options.port);
  const ngPort = await findClosestOpenPort(options.port, '0.0.0.0');

  await ngServe(env, options.address, ngPort);

  if (options.lab) {
    labDetails = {
      protocol: 'http',
      address: 'localhost',
      port: await findClosestOpenPort(DEFAULT_LAB_PORT, '0.0.0.0'),
    };

    await runLab(env, `http://localhost:${ngPort}`, labDetails.port);
  }

  debug('waiting for connectivity with ng serve (%dms timeout)', NG_SERVE_CONNECTIVITY_TIMEOUT);
  await isHostConnectable('localhost', ngPort, NG_SERVE_CONNECTIVITY_TIMEOUT);

  return {
    protocol: 'http',
    localAddress: 'localhost',
    externalAddress: externalIP,
    externalNetworkInterfaces: availableInterfaces,
    port: ngPort,
    externallyAccessible: ![BIND_ALL_ADDRESS, ...LOCAL_ADDRESSES].includes(externalIP),
    lab: labDetails,
  };
}

async function ngServe(env: IonicEnvironment, host: string, port: number): Promise<void> {
  const [ through2, split2 ] = await Promise.all([import('through2'), import('split2')]);
  const { registerShutdownFunction } = await import('../process');

  const ngArgs: string[] = ['serve', '--host', host, '--port', String(port), '--progress', 'false'];

  if (await pathAccessible(path.resolve(env.project.directory, NG_AUTODETECTED_PROXY_FILE), fs.constants.R_OK)) {
    ngArgs.push('--proxy-config');
    ngArgs.push(NG_AUTODETECTED_PROXY_FILE); // this is fine as long as cwd is the project directory
  }

  const p = await env.shell.spawn('ng', ngArgs, { cwd: env.project.directory, env: { FORCE_COLOR: chalk.enabled ? '1' : '0' } });

  registerShutdownFunction(() => p.kill());

  const log = env.log.clone({ prefix: chalk.dim('[ng]'), wrap: false });
  const ws = log.createWriteStream();

  return new Promise<void>(resolve => {
    const stdoutFilter = through2(function(chunk, enc, callback) {
      const str = chunk.toString();

      if (!str.includes('NG Live Development Server is listening')) {
        this.push(chunk);
      }

      callback();
    });

    p.stdout.pipe(split2()).pipe(stdoutFilter).pipe(ws);
    p.stderr.pipe(split2()).pipe(ws);

    resolve(); // TODO: find a way to detect when webpack is finished bundling
  });
}
