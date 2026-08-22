/**
 * Settings that belong to this machine rather than to a remote. One section today: the Logitech account.
 *
 * **Why an account is worth asking for at all.** A configuration read off a remote states the codes an
 * appliance answers to and no names for any of them, so an imported television is eighty codes called
 * "Command 41". Logitech's own database has the names, because their software is what compiled that
 * configuration, and the service is still answering. Everything in this application works without it.
 *
 * **The password goes one way.** It is encrypted by the operating system's own keystore and no route in
 * this application reads it back: this page can set one, replace one, or throw one away, and it is told
 * only whether there is one. That is a property of the bridge rather than a promise made here.
 *
 * **Check is not decoration.** A password changed on Logitech's own site looks exactly like one that
 * works, right up to the moment somebody wanted a device. This is how they find out on purpose.
 */
import { Alert, Button, Loader, PasswordInput, Text, TextInput } from '@mantine/core';
import { useEffect, useState } from 'react';

import type { AccountState } from '../../../shared/api.ts';
import { api } from '../api.ts';
import classes from './PreferencesView.module.scss';

type Checking = 'idle' | 'checking' | 'good' | { readonly failed: string };

export function PreferencesView() {
  const [account, setAccount] = useState<AccountState | undefined>(undefined);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState<Checking>('idle');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const load = async () => {
    const held = await api().logitech.account();
    setAccount(held);
    setEmail(held.email ?? '');
  };
  useEffect(() => { void load(); }, []);

  const attempt = async (what: () => Promise<void>) => {
    setBusy(true);
    setProblem(undefined);
    setChecked('idle');
    try {
      await what();
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={classes.preferences}>
      <div className={classes.heading}>
        <h2 className={classes.title}>Preferences</h2>
        <Text className={classes.under}>Settings that belong to this computer, not to a remote.</Text>
      </div>

      <div className={classes.block}>
        <h3 className={classes.blockTitle}>Logitech account</h3>
        <Text className={classes.explain}>
          {/* What it buys and what it costs, in one sentence each, because this is the only place in the
              application that asks for a credential and somebody is entitled to know why. */}
          A configuration read off a remote holds the codes your equipment answers to and no names for
          them. Logitech's own database has the names, and signing in is how this application can look
          them up. Everything else here works without an account.
        </Text>

        {account === undefined
          ? <Loader size="sm" />
          : (
            <>
              <TextInput
                label="Email"
                value={email}
                disabled={busy}
                onChange={(event) => setEmail(event.currentTarget.value)}
              />
              <PasswordInput
                label={account.hasPassword ? 'New password' : 'Password'}
                placeholder={account.hasPassword ? 'A password is stored' : ''}
                description={account.hasPassword
                  // What the field being empty means, which is the one thing that is not obvious: leaving
                  // it alone keeps what is stored. The stored password is never shown, not even as dots of
                  // the right length, which would itself be a fact about it.
                  ? 'Leave this empty to keep the password already stored'
                  : 'Kept encrypted by this computer and never shown again'}
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.currentTarget.value)}
              />

              <div className={classes.actions}>
                <Button
                  disabled={busy || email.trim() === '' || (password === '' && !account.hasPassword)}
                  onClick={() => void attempt(async () => {
                    // An unchanged password means an unchanged password, so nothing is written when the
                    // field is empty and one is already stored. Writing an empty string would clear it.
                    if (password !== '') {
                      setAccount(await api().logitech.rememberAccount(email.trim(), password));
                      setPassword('');
                    } else {
                      // Only the address changed. It goes through the same call, with the stored password
                      // untouched, which the main process does by refusing an empty one.
                      setAccount(await api().logitech.rememberAccount(email.trim(), ''));
                    }
                  })}
                >
                  Save
                </Button>
                <Button
                  variant="default"
                  disabled={busy || !account.hasPassword}
                  onClick={() => void attempt(async () => {
                    setChecked('checking');
                    try {
                      await api().logitech.checkAccount();
                      setChecked('good');
                    } catch (error) {
                      setChecked({ failed: error instanceof Error ? error.message : String(error) });
                    }
                  })}
                >
                  Check
                </Button>
                <Button
                  variant="subtle"
                  color="red"
                  disabled={busy || (!account.hasPassword && account.email === undefined)}
                  onClick={() => void attempt(async () => {
                    setAccount(await api().logitech.forgetAccount());
                    setEmail('');
                    setPassword('');
                  })}
                >
                  Forget it
                </Button>
              </div>

              {checked === 'checking' && <Text className={classes.explain}>Signing in...</Text>}
              {checked === 'good' && (
                <Alert color="green" variant="light">That password works.</Alert>
              )}
              {typeof checked === 'object' && (
                <Alert color="red" variant="light">{checked.failed}</Alert>
              )}
              {problem !== undefined && <Alert color="red" variant="light">{problem}</Alert>}
            </>
            )}
      </div>
    </section>
  );
}
