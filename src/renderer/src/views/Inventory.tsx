/**
 * What a remote is actually set up to do: its appliances and its activities.
 *
 * **This is the first screen in FreeHarmony that shows somebody their own configuration**, and every
 * word on it comes out of the bytes rather than out of a table here. An appliance is named by the
 * label its owner typed into Logitech's software; an activity is named by the words drawn on the
 * remote's own screen. Where a name is genuinely not in the file, the position is shown, because a
 * device with no name is still a device that answers.
 *
 * Three absences are on purpose. A command has no name in a configuration, so the codes are counted and
 * not listed: a list of forty untitled codes tells nobody anything, and inventing names for them would
 * be inventing facts about somebody's television. What an activity **wants** everything to be in is not
 * here, because the library next door cannot read it yet.
 *
 * And **which appliances this computer has no description of is not on this page**, though the model
 * carries the answer. It is true, and it is a statement about this application rather than about
 * somebody's remote, and there is nothing they could do about it: a page saying four appliances are
 * undescribed, with no way to describe one, is a diagnostic wearing an interface. It belongs here the
 * day naming an appliance is something a person can do.
 */
import type { DocumentContents } from '../../../shared/content.ts';
import classes from './Inventory.module.scss';

export function Inventory({ contents }: { readonly contents: DocumentContents }) {
  const { devices, activities, buttons } = contents.content;

  return (
    <div className={classes.inventory}>
      <section className={classes.group}>
        <h3 className={classes.heading}>Devices</h3>
        <ul className={classes.list}>
          {devices.map((device) => (
            <li key={device.slot} className={classes.row}>
              {/* The label is what its owner typed. Without one, the position, because a device that
                  answers is worth showing even when the file never named it. */}
              <span className={classes.label}>{device.label ?? `Device ${device.slot + 1}`}</span>
              <span className={classes.aside}>
                {buttons.filter((one) => one.sends.some((step) => step.device === device.slot)).length}
                {' buttons'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={classes.group}>
        <h3 className={classes.heading}>Activities</h3>
        <ul className={classes.list}>
          {activities.map((activity) => (
            <li key={activity.slot} className={classes.row}>
              <span className={classes.label}>{activity.name ?? `Activity ${activity.slot + 1}`}</span>
              <span className={classes.aside}>
                {/* Which appliances it drives, by their own labels, which is the fact a person
                    recognises: "the television and the amplifier". */}
                {activity.devices
                  .map((slot) => devices.find((one) => one.slot === slot)?.label ?? `#${slot + 1}`)
                  .join(', ')}
              </span>
            </li>
          ))}
        </ul>
      </section>

    </div>
  );
}
