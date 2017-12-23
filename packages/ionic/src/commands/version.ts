import { CommandLineInputs, CommandLineOptions, CommandMetadata } from '@ionic/cli-utils';
import { Command } from '@ionic/cli-utils/lib/command';

export class VersionCommand extends Command {
  async getMetadata(): Promise<CommandMetadata> {
    return {
      name: 'version',
      type: 'global',
      description: 'Returns the current CLI version',
      visible: false,
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    // can't use logger--see https://github.com/ionic-team/ionic-cli/issues/2507
    process.stdout.write(this.env.plugins.ionic.meta.pkg.version + '\n');
  }
}
