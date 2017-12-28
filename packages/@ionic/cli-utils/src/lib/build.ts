import chalk from 'chalk';
import * as Debug from 'debug';
import * as lodash from 'lodash';

import { BuildOptions, CommandLineInputs, CommandLineOptions, IonicEnvironment, ProjectType } from '../definitions';

import { FatalException } from './errors';
import { PROJECT_FILE } from './project';

import * as ionic1BuildLibType from './ionic1/build';
import * as ionicAngularBuildLibType from './ionic-angular/build';
import * as ionicCoreAngularBuildLibType from './ionic-core-angular/build';

const debug = Debug('ionic:cli-utils:lib:build');

const BUILD_BEFORE_HOOK = 'build:before';
const BUILD_AFTER_HOOK = 'build:after';

// npm script names
const npmPrefix = 'ionic';
export const BUILD_SCRIPT = `${npmPrefix}:build`;
const BUILD_BEFORE_SCRIPT = `${npmPrefix}:${BUILD_BEFORE_HOOK}`;
const BUILD_AFTER_SCRIPT = `${npmPrefix}:${BUILD_AFTER_HOOK}`;

export abstract class BuildRunner<T extends BuildOptions> {
  constructor(protected env: IonicEnvironment) {}

  static async createFromProjectType(env: IonicEnvironment, type: 'ionic1'): Promise<ionic1BuildLibType.BuildRunner>;
  static async createFromProjectType(env: IonicEnvironment, type: 'ionic-core-angular'): Promise<ionicCoreAngularBuildLibType.BuildRunner>;
  static async createFromProjectType(env: IonicEnvironment, type: 'ionic-angular'): Promise<ionicAngularBuildLibType.BuildRunner>;
  static async createFromProjectType(env: IonicEnvironment, type: ProjectType): Promise<BuildRunner<any>>;
  static async createFromProjectType(env: IonicEnvironment, type: ProjectType): Promise<BuildRunner<any>> {
    if (type === 'ionic1') {
      const { BuildRunner } = await import('./ionic1/build');
      return new BuildRunner(env);
    } else if (type === 'ionic-angular') {
      const { BuildRunner } = await import('./ionic-angular/build');
      return new BuildRunner(env);
    } else if (type === 'ionic-core-angular') {
      const { BuildRunner } = await import('./ionic-core-angular/build');
      return new BuildRunner(env);
    } else {
      throw new FatalException(
        `Cannot perform Ionic build for project type: ${chalk.bold(type)}.\n` +
        (type === 'custom' ? `Since you're using the ${chalk.bold('custom')} project type, this command won't work. The Ionic CLI doesn't know how to build custom projects.\n\n` : '') +
        `If you'd like the CLI to try to detect your project type, you can unset the ${chalk.bold('type')} attribute in ${chalk.bold(PROJECT_FILE)}.`
      );
    }
  }

  abstract createOptionsFromCommandLine(inputs: CommandLineInputs, options: CommandLineOptions): T;

  createBaseOptionsFromCommandLine(inputs: CommandLineInputs, options: CommandLineOptions): BuildOptions {
    const [ platform ] = inputs;

    return {
      target: options['target'] ? String(options['target']) : undefined,
      platform,
    };
  }

  abstract buildProject(options: T): Promise<void>;

  async invokeBeforeHook() {
    const { pkgManagerArgs } = await import('./utils/npm');

    const pkg = await this.env.project.loadPackageJson();

    debug(`Looking for ${chalk.cyan(BUILD_BEFORE_SCRIPT)} npm script.`);

    if (pkg.scripts && pkg.scripts[BUILD_BEFORE_SCRIPT]) {
      debug(`Invoking ${chalk.cyan(BUILD_BEFORE_SCRIPT)} npm script.`);
      const [ pkgManager, ...pkgArgs ] = await pkgManagerArgs(this.env, { command: 'run', script: BUILD_BEFORE_SCRIPT });
      await this.env.shell.run(pkgManager, pkgArgs, { showExecution: true });
    }

    const deps = lodash.assign({}, pkg.dependencies, pkg.devDependencies);

    if (deps['@ionic/cli-plugin-cordova']) {
      const { checkCordova } = await import('./cordova/utils');
      await checkCordova(this.env);
    }

    await this.env.hooks.fire(BUILD_BEFORE_HOOK, { env: this.env });
  }

  async invokeAfterHook(options: T) {
    const { pkgManagerArgs } = await import('./utils/npm');

    const pkg = await this.env.project.loadPackageJson();

    debug(`Looking for ${chalk.cyan(BUILD_AFTER_SCRIPT)} npm script.`);

    if (pkg.scripts && pkg.scripts[BUILD_AFTER_SCRIPT]) {
      debug(`Invoking ${chalk.cyan(BUILD_AFTER_SCRIPT)} npm script.`);
      const [ pkgManager, ...pkgArgs ] = await pkgManagerArgs(this.env, { command: 'run', script: BUILD_AFTER_SCRIPT });
      await this.env.shell.run(pkgManager, pkgArgs, { showExecution: true });
    }

    await this.env.hooks.fire(BUILD_AFTER_HOOK, { env: this.env, platform: options.platform });
  }

  async run(options: T): Promise<void> {
    await this.invokeBeforeHook();
    await this.buildProject(options);
    await this.invokeAfterHook(options);
  }
}

export async function build(env: IonicEnvironment, inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
  const project = await env.project.load();
  const runner = await BuildRunner.createFromProjectType(env, project.type);
  const opts = runner.createOptionsFromCommandLine(inputs, options);
  await runner.run(opts);
}
