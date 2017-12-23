import { validators } from '@ionic/cli-framework';
import { BACKEND_PRO, CommandLineInputs, CommandLineOptions, CommandMetadata } from '@ionic/cli-utils';
import { Command } from '@ionic/cli-utils/lib/command';

// import { formatGitRepoUrl } from '../../lib/git';

export class GitCloneCommand extends Command {
  async getMetadata(): Promise<CommandMetadata> {
    return {
      name: 'clone',
      type: 'global',
      backends: [BACKEND_PRO],
      description: 'Clones an Ionic app git repository to your computer',
      inputs: [
        {
          name: 'app-id',
          description: 'The App ID of the Ionic app to clone',
          validators: [validators.required],
        },
        {
          name: 'path',
          description: 'The destination directory of the cloned app',
        },
      ],
      visible: false, // TODO: make part of start?
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    // let [ app_id, destination ] = inputs;

    // const appLoader = new App(await this.env.session.getAppUserToken(), this.env.client);
    // const app = await appLoader.load(app_id);
    // const remote = await formatGitRepoUrl(this.env.config, app.id);

    // if (!destination) {
    //   destination = app.slug ? app.slug : app.id;
    // }

    // destination = path.resolve(destination);

    // await this.env.shell.run('git', ['clone', '-o', 'ionic', remote, destination], { stdio: 'inherit' });

    // this.env.log.ok(`Your app has been cloned to ${chalk.bold(prettyPath(destination))}!`);
  }
}
