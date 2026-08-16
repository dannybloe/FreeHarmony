/**
 * The shell the views sit in. It knows about layout and about nothing else.
 *
 * There is one view so far, so this is thin on purpose: when there is a second there will be
 * something to route between, and that is the moment to decide how, not now.
 */
import { RemotesView } from './views/RemotesView.tsx';
import classes from './App.module.scss';

export function App() {
  return (
    <main className={classes.shell}>
      <RemotesView />
    </main>
  );
}
