import chalk from 'chalk';
import { contains, validators } from '@ionic/cli-framework/lib';
import { CommandData, CommandLineInputs, CommandLineOptions } from '@ionic/cli-utils';
import { Command } from '@ionic/cli-utils/lib/command';
import { INTEGRATIONS, enableIntegration } from '@ionic/cli-utils/lib/integrations';

export class IntegrationsEnableCommand extends Command {
  metadata: CommandData = {
    name: 'enable',
    type: 'project',
    description: 'Add various integrations to your app',
    inputs: [
      {
        name: 'id',
        description: `The integration to enable (${INTEGRATIONS.map(i => chalk.green(i.name)).join(', ')})`,
        validators: [validators.required, contains(INTEGRATIONS.map(i => i.name), {})],
      }
    ],
    options: [
      {
        name: 'quiet',
        description: 'Do not log file operations',
        type: Boolean,
      }
    ],
  };

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const [ id ] = inputs;

    const { quiet } = options;

    await enableIntegration(this.env, id, { quiet: Boolean(quiet) });
  }
}
