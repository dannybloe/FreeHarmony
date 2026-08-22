/**
 * What is on a remote, and the question of whether to import it.
 *
 * **A dialogue rather than a page**, because it serves two arrivals identically: pressing Import on a
 * remote's own page, and being asked straight after a remote was recognised on the chooser. The second
 * wants a question over the page somebody just landed on, and giving the first its own screen would mean
 * two things to keep looking alike.
 *
 * The shape follows the two halves. While it is reading, it says so and says that nothing is written yet,
 * because the read takes a minute of somebody's hardware and silence for a minute reads as a hang. Once it
 * has read, it shows what came off the remote and, where the document already holds something, what would
 * go, **in numbers**. A warning saying "this will replace your work" is a warning; four numbers are an
 * answer.
 *
 * What it does not show is bookkeeping. `moved` in the outcome counts references the import had to rewrite
 * because the library orders that appliance's commands differently, which is a real fact that matters in
 * the tests and means nothing to somebody looking at a screen.
 */
import { Button, Loader, Modal, Text } from '@mantine/core';

import type { AppliancePlan, AttachedSummary } from '../../../shared/import.ts';
import type { Importing } from '../viewmodels/useImport.ts';
import classes from './ImportView.module.scss';

interface ImportViewProps {
  readonly importing: Importing;
  /** The document this would land in. */
  readonly into: string;
  /** Called after a successful import, so the page behind can show what arrived. */
  readonly onImported: () => void;
}

/** "6 devices", "1 device": the number with the thing it is a number of, which is the house rule. */
function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * A language tag spelled as a language, in the reader's own language.
 *
 * `en` on a screen is a code, and a code is this application's vocabulary rather than anybody else's.
 * `Intl.DisplayNames` is the platform's own table, so there is no list here to fall out of date, and the
 * tag comes back unchanged if it names nothing.
 */
function spellLanguage(tag: string): string {
  try {
    return new Intl.DisplayNames(undefined, { type: 'language' }).of(tag) ?? tag;
  } catch {
    return tag;
  }
}

function Appliance({ plan }: { readonly plan: AppliancePlan }) {
  return (
    <li className={classes.appliance}>
      <span className={classes.applianceName}>{plan.label ?? `Position ${plan.slot + 1}`}</span>
      <span className={classes.applianceNote}>
        {count(plan.commandCount, 'command')}
        {plan.disposition === 'linked'
          // The reason somebody cares which of the two it is: their own words survive the import, and a
          // configuration offers none. So the sentence names what they already call it.
          ? `, already here${plan.knownAs === undefined ? '' : ` as ${plan.knownAs}`}`
          : ', new here'}
      </span>
    </li>
  );
}

function Summary({ summary, into }: { readonly summary: AttachedSummary; readonly into: string }) {
  const { replacing } = summary;
  return (
    <>
      <Text size="sm" className={classes.what}>
        {[count(summary.appliances.length, 'device'),
          count(summary.activities.length, 'activity', 'activities'),
          count(summary.buttonCount, 'button')].join(', ')}
        {summary.language === undefined
          // Absent means genuinely unknown rather than not looked for, so nothing is said about it.
          ? '' : `. Its menus are in ${spellLanguage(summary.language)}`}
      </Text>

      <ul className={classes.appliances}>
        {summary.appliances.map((plan) => <Appliance key={plan.slot} plan={plan} />)}
      </ul>

      {summary.activities.length > 0 && (
        <Text size="sm" className={classes.activities}>
          {/* Named, because a bare list of words beside a list of devices reads as more devices. Nothing
              in a configuration says what an activity is called either: these names are read off the
              pixels its own screens draw. */}
          <span className={classes.activitiesLabel}>Activities</span>
          {summary.activities.map((one) => one.name ?? `Activity ${one.slot + 1}`).join(', ')}
        </Text>
      )}

      {replacing !== undefined && (
        <div className={classes.replacing}>
          <Text size="sm" fw={600}>This replaces what is in {into}</Text>
          <Text size="sm">
            {[count(replacing.devices, 'device'),
              count(replacing.activities, 'activity', 'activities'),
              count(replacing.buttons, 'button'),
              count(replacing.labels, 'device name')].join(', ')}
            . Duplicate it first if you want to keep both.
          </Text>
        </div>
      )}
    </>
  );
}

export function ImportView({ importing, into, onImported }: ImportViewProps) {
  const { inspection, commit } = importing;
  if (inspection.status === 'idle') return null;

  const title = inspection.status === 'inspecting'
    ? 'Reading the remote'
    : commit.status === 'done' ? 'Imported' : `Import into ${into}?`;

  return (
    <Modal opened onClose={importing.dismiss} title={title} centered radius="md" size="lg">
      {inspection.status === 'inspecting' && (
        <div className={classes.reading}>
          <Loader size="sm" />
          <Text size="sm">
            This reads the whole configuration, which takes about a minute. Nothing is written anywhere
            until you say so.
          </Text>
        </div>
      )}

      {inspection.status === 'failed' && <Text size="sm" c="red">{inspection.error}</Text>}

      {inspection.status === 'ready' && commit.status !== 'done' && (
        <Summary summary={inspection.summary} into={into} />
      )}

      {commit.status === 'done' && (
        <div className={classes.done}>
          <Text size="sm">
            {[count(commit.outcome.created.length, 'device'), 'added to your library'].join(' ')}
            {commit.outcome.linked.length > 0
              && `, and ${count(commit.outcome.linked.length, 'device')} matched what you already had`}
            .
          </Text>
          {/* Asked for, and it is not a caveat: a configuration compiled by somebody else's software
              carries no manufacturer, no model and not one command name, so there is real work waiting
              and saying so is the honest end of an import. */}
          <Text size="sm">
            Worth going through it now. Nothing in a configuration says what a device is or what its
            commands are called, so those are yours to fill in.
          </Text>
        </div>
      )}

      {commit.status === 'failed' && <Text size="sm" c="red">{commit.error}</Text>}

      <div className={classes.buttons}>
        {commit.status === 'done'
          ? <Button size="sm" onClick={() => { importing.dismiss(); onImported(); }}>Done</Button>
          : (
            <>
              <Button variant="default" size="sm" onClick={importing.dismiss}>
                {inspection.status === 'ready' ? 'Just looking' : 'Cancel'}
              </Button>
              {inspection.status === 'ready' && (
                <Button
                  size="sm"
                  loading={commit.status === 'importing'}
                  onClick={() => void importing.confirm(into)}
                >
                  Import
                </Button>
              )}
            </>
          )}
      </div>
    </Modal>
  );
}
