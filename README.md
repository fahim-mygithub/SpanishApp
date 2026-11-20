# Hoy · Spanish

A five-minute-a-day Spanish app built on the 26-week plan. It's an installable PWA (no app store) with daily push reminders. The design follows the Tempo language from WorkOutAppRefactor: a dark focus mode, one amber action per screen, and ice blue for done.

## How it's built to keep you coming back

- **One button.** Start drops you straight into reviews, then today's new words. You don't have to pick what to do.
- **Five minutes counts.** Five minutes of practice, ten minutes of listening, or finishing the day's words all make the day count. You can stop any time and nothing is lost.
- **Progress-based, not calendar-based.** You're always on *your* next day. After a break, the app says "Welcome back", with no backlog and no "you missed 12 days".
- **Gentle streaks.** Seven days in a row earns a streak freeze (you can hold up to 2), and a freeze covers a missed day automatically. A capped review count means a break never turns into a wall of 300 cards.
- **Feedback in the moment.** Sounds, combos, XP and levels, plus an occasional surprise reward (a bonus freeze or +50 XP) once a day counts.
- **Progress you can feel.** Known words map to the approximate share of everyday speech they cover, and logged listening hours map to Dreaming Spanish levels.
- **A nudge.** One reminder a day at your chosen time, skipped if you've already practised. Tapping it opens straight into a session.

Borrowed from open-source projects:

- FSRS scheduling from ts-fsrs (MIT).
- Practice that never touches your review schedule, from Mnemosyne.
- Partial credit for near-miss typing, from Conjugar (the idea only).
- Coverage milestones based on subtitle frequency lists.

## Run it

```bash
npm install
npm run dev        # http://localhost:5291/SpanishApp/
npm test
```

The Archivo font is copied from WorkOutAppRefactor (`src/fonts/`, OFL license).

## One-step setup

Double-click `setup.cmd`. It installs everything, signs you in to Cloudflare (a browser window opens), deploys the reminder worker, connects the app to it, pushes the code to github.com/fahim-mygithub/SpanishApp and publishes to GitHub Pages. It's safe to re-run. The manual steps below do the same thing by hand.

## Deploy (GitHub Pages, same as the workout app)

1. Create a repo named `SpanishApp` on GitHub and push this folder to it.
2. Run `npm run deploy:pages`. This builds the app and pushes `dist/` to the `gh-pages` branch.
3. In the repo, go to Settings → Pages and set the source to the `gh-pages` branch.
4. The app is now at `https://fahim-mygithub.github.io/SpanishApp/`.
5. On iPhone, open it in Safari and choose Share → Add to Home Screen. Always open it from that icon.

If you change the repo name, change `BASE` in `vite.config.ts` to match.

## Reminders (one-time setup, about 10 minutes)

Push reminders need a small server that sends the reminder at your chosen time. This is the `worker/` folder, a Cloudflare Worker. It runs on the free plan, on the same account as `workout-ai`.

```bash
# 1. Generate push keys (from the app folder)
npm run vapid
#   -> prints VAPID_PUBLIC_KEY=... and VAPID_PRIVATE_KEY=...

# 2. Set up the worker
cd worker
npm install
npx wrangler kv namespace create SUBS        # paste the id into wrangler.toml
npx wrangler secret put VAPID_PUBLIC_KEY     # paste the public key
npx wrangler secret put VAPID_PRIVATE_KEY    # paste the private key
#   also set VAPID_SUBJECT in wrangler.toml to mailto:<your email>
npx wrangler deploy                          # prints https://spanish-nudge.<you>.workers.dev

# 3. Point the app at it (from the app folder)
cp .env.example .env.local
#   VITE_PUSH_URL=https://spanish-nudge.<you>.workers.dev
#   VITE_VAPID_PUBLIC_KEY=<same public key>
npm run deploy:pages
```

Then, on your phone:

1. Open the Home Screen app.
2. Go to Settings → Daily reminder, turn it on, and allow notifications.
3. Tap "Send a test reminder" to check it works.

Notes:

- iPhone needs iOS 16.4 or later, and notifications only work from the Home Screen app, not from a Safari tab.
- The worker checks every 15 minutes, so a reminder arrives up to 15 minutes after the time you set. It's sent only once a day, and never more than 3 hours late.
- `ALLOWED_ORIGINS` in `wrangler.toml` must include the app's address.

## Sync between devices (optional)

Under Settings → Sync with GitHub, enter:

- your username;
- a private repo (for example `spanish-data`);
- a fine-grained token limited to that repo, with Contents: read and write.

Progress then merges item by item and the newest change wins. The token stays in that browser's storage and is never committed.

## Project layout

```
src/
  main.ts          tabs, boot, deep link (?start=1 opens a session)
  sw.ts            offline cache + push + notification tap
  state.ts         local state and the merge used by sync
  srs.ts           FSRS scheduling
  habit.ts         what counts as a day, streaks, freezes, XP, milestones
  feel.ts          sounds, haptics, speech, toast, confetti
  push.ts          reminder subscription (client)
  sync.ts          GitHub JSON sync
  views/           today, session (the Start flow), words, progress, settings
data/              the 182-day plan and the 695-word core deck
worker/            Cloudflare Worker that sends reminders
```

## Ideas not built yet

These came out of a competitive analysis of open-source language-learning apps:

- **Native-audio example sentences** from Tatoeba (CC BY 2.0 FR). Each audio clip has its own license, so an attribution screen is needed.
- **"You'd understand X% of this text" for graded-reader chapters**, from VocabSieve.
- **Tap a word in a text to make a card, plus "mark the rest as known"**, from Lute (MIT).
- **Coverage figures computed from real frequency counts** (hermitdave/FrequencyWords, CC-BY-SA) instead of rounded estimates.
