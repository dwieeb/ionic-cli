import chalk from 'chalk';

import { contains, validate } from '@ionic/cli-framework';
import { CommandLineInputs, CommandLineOptions, CommandMetadata } from '@ionic/cli-utils';
import { Command } from '@ionic/cli-utils/lib/command';
import { FatalException } from '@ionic/cli-utils/lib/errors';

export class DoctorCheckCommand extends Command {
  async getMetadata(): Promise<CommandMetadata> {
    return {
      name: 'check',
      type: 'project',
      description: 'Check the health of your Ionic project',
      inputs: [
        {
          name: 'id',
          description: 'The issue identifier',
        },
      ],
    };
  }

  async run(inputs: CommandLineInputs, options: CommandLineOptions): Promise<void> {
    const [ id ] = inputs;

    const { detectAndTreatAilment, registry, treatAilments } = await import('@ionic/cli-utils/lib/doctor/index');
    const { Ailments } = await import('@ionic/cli-utils/lib/doctor/ailments');

    const ailmentIds = Ailments.ALL.map(Ailment => new Ailment().id);

    if (id) {
      validate(id, 'id', [contains(ailmentIds, {})]);
      const ailment = registry.get(id);

      if (!ailment) {
        throw new FatalException(`Issue not found by ID: ${chalk.green(id)}`);
      }

      await detectAndTreatAilment(this.env, ailment);
    } else {
      await treatAilments(this.env);
    }
  }
}
