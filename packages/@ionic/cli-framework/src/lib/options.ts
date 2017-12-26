import * as dargs from 'dargs';
import * as minimist from 'minimist';
import * as lodash from 'lodash';

import {
  CommandLineOptions,
  CommandMetadata,
  CommandMetadataGroup,
  CommandMetadataInput,
  CommandMetadataOption,
  CommandOptionType,
  NormalizedCommandOption,
  NormalizedParseArgsOptions,
  ParsedArg,
} from '../definitions';

export const parseArgs = minimist;
export { ParsedArgs } from 'minimist';

const typeDefaults = new Map<CommandOptionType, ParsedArg>()
  .set(String, null) // tslint:disable-line:no-null-keyword
  .set(Boolean, false);

/**
 * Takes a Minimist command option and normalizes its values.
 */
function normalizeOption(option: CommandMetadataOption): NormalizedCommandOption {
  const type = option.type ? option.type : String;

  return {
    type,
    default: option.default ? option.default : typeDefaults.get(type),
    aliases: option.aliases ? option.aliases : [],
    ...option,
  };
}

export function metadataToParseArgsOptions(metadata: CommandMetadata): NormalizedParseArgsOptions {
  const options: NormalizedParseArgsOptions = {
    string: ['_'],
    boolean: [],
    alias: {},
    default: {},
  };

  if (!metadata.options) {
    return options;
  }

  for (let option of metadata.options) {
    const normalizedOption = normalizeOption(option);

    if (normalizedOption.type === String) {
      options.string.push(normalizedOption.name);
    } else if (normalizedOption.type === Boolean) {
      options.boolean.push(normalizedOption.name);
    }

    options.default[normalizedOption.name] = normalizedOption.default;
    options.alias[normalizedOption.name] = normalizedOption.aliases;
  }

  return options;
}

export interface ParsedArgsToArgvOptions extends dargs.Options {
  useDoubleQuotes?: boolean;
}

export function parsedArgsToArgv(options: CommandLineOptions, fnOptions: ParsedArgsToArgvOptions = {}): string[] {
  if (typeof fnOptions.ignoreFalse === 'undefined') {
    fnOptions.ignoreFalse = true;
  }

  if (fnOptions.useDoubleQuotes) {
    fnOptions.useEquals = true;
  }

  let results = dargs(options, fnOptions);
  results.splice(results.length - options._.length); // take out arguments

  if (fnOptions.useDoubleQuotes) {
    results = results.map(r => r.replace(/^(\-\-[A-Za-z0-9-]+)=(.+\s+.+)$/, '$1="$2"'));
  }

  return results;
}

export type OptionPredicate<O extends CommandMetadataOption> = (option: O, value?: ParsedArg) => boolean;

export namespace OptionFilters {
  export function includesGroups<O extends CommandMetadataOption>(groups: CommandMetadataGroup | CommandMetadataGroup[]): OptionPredicate<O> {
    const g = Array.isArray(groups) ? groups : [groups];
    return (option: O) => typeof option.groups !== 'undefined' && lodash.intersection(option.groups, g).length > 0;
  }

  export function excludesGroups<O extends CommandMetadataOption>(groups: CommandMetadataGroup | CommandMetadataGroup[]): OptionPredicate<O> {
    const g = Array.isArray(groups) ? groups : [groups];
    return (option: O) => typeof option.groups === 'undefined' || lodash.difference(option.groups, g).length > 0;
  }
}

/**
 * Given a command metadata object and an object of parsed options, match each
 * supplied option with its command metadata option definition and pass it,
 * along with its value, to a predicate function, which is used to return a
 * subset of the parsed options.
 *
 * Options which are unknown to the command metadata are always excluded.
 *
 * @param predicate If excluded, `() => true` is used.
 */
export function filterCommandLineOptions<M extends CommandMetadata<I, O>, I extends CommandMetadataInput, O extends CommandMetadataOption>(metadata: M, parsedArgs: CommandLineOptions, predicate: OptionPredicate<O> = () => true): CommandLineOptions {
  const initial: CommandLineOptions = { _: parsedArgs._ };

  if (parsedArgs['--']) {
    initial['--'] = parsedArgs['--'];
  }

  const mapped = new Map(metadata.options ? [
    ...metadata.options.map((o): [string, O] => [o.name, o]),
    ...lodash.flatten(metadata.options.map(opt => opt.aliases ? opt.aliases.map((a): [string, O] => [a, opt]) : [])),
  ] : []);

  const pairs = Object.keys(parsedArgs)
    .map((k): [string, O | undefined, ParsedArg | undefined] => [k, mapped.get(k), parsedArgs[k]])
    .filter(([ k, opt, value ]) => opt && predicate(opt, value))
    .map(([ k, opt, value ]) => [opt ? opt.name : k, value]);

  return { ...initial, ...lodash.fromPairs(pairs) };
}

/**
 * Given a command metadata object and an object of parsed options, return a
 * subset of the parsed options whose command metadata option definition
 * contains the supplied group(s).
 *
 * Options which are unknown to the command metadata are always excluded.
 *
 * @param groups One or more option groups.
 */
export function filterCommandLineOptionsByGroup<M extends CommandMetadata<I, O>, I extends CommandMetadataInput, O extends CommandMetadataOption>(metadata: M, parsedArgs: CommandLineOptions, groups: CommandMetadataGroup | CommandMetadataGroup[]): CommandLineOptions {
  return filterCommandLineOptions(metadata, parsedArgs, OptionFilters.includesGroups(groups));
}
