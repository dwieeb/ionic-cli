import { CommandData, CommandLineInputs, CommandLineOptions } from '@ionic/cli-utils';
import { Command } from '@ionic/cli-utils/lib/command';

export class SignupCommand extends Command {
  metadata: CommandData = {
    name: 'signup',
    type: 'global',
    description: 'Create an Ionic account',
  };

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const opn = await import('opn');
    const dashUrl = await this.env.config.getDashUrl();

    opn(`${dashUrl}/signup?source=cli`, { wait: false });

    this.env.log.ok('Launched signup form in your browser!');
  }
}
