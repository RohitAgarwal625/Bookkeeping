# Pi Next Hackathon: Bookkeeping submission guide

> **Status file for the Pi Next work.** Any Claude session (local, cloud, or on the client's repo after the handover) should read this file first and carry on from the **Progress tracker** below. A styled copy of the same facts is in [`hackathon-guide.html`](hackathon-guide.html). Keep both in sync.
>
> Facts gathered 2026-11-28 from Pi's official pages. Each section lists its own sources; all links are also collected at the end. Rules can change, so re-check the official page before each step.

## How to continue (for Claude)

1. Read the **Progress tracker** and find the first unchecked item. That's where we are.
2. Help the user with that step the same way as before. Explain the step, do the code or config part yourself, and tell the user exactly what to click in the Pi, GitHub, Vercel and Railway dashboards (you can't log into them).
3. When a step is done, tick it here, add a dated line to the **Log**, and update the matching row in `hackathon-guide.html`.
4. Pi facts can change. For anything below marked *unconfirmed*, or older than a couple of weeks, check the official links before advising.
5. The repo rules still apply: CLAUDE.md, `.claude/rules/`, and the skills `law`, `verify` and `ui-change`. Backend work also needs `PROGRESS.md`.

**Sources:** This repo: `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, `PROGRESS.md`


## Key facts

| | |
|---|---|
| **Deadline** | **Tue 5 Jan 2027, 11:59 PM PT** (Wed 6 Jan, 07:59 UTC) |
| **Prize pool** | 200,000 USDT, plus up to 20M Pi to reward users of new apps |
| **Hard rule** | The entry must be a **Mainnet** Pi app. The entry form says "Apps on Testnet only aren't shown" |
| **Listing** | The Mainnet listing must be **submitted for review**. It doesn't need to be approved |
| **Console** | Developer Web Console: <https://developers.minepi.com/> (Hackathon tab, My apps) |
| **Hosting** | Our own hosting (Vercel + Railway) is allowed. The app is *registered and submitted* in the console, not hosted there |
| **Team lead** | The **client**. His Pi account owns the Mainnet app and submits the entry |

**Sources:** [Pi Next official page](https://minepi.com/pi-next/) · [Hackathon registration and entry pages in the Developer Web Console](https://developers.minepi.com/hackathon/register) (the "Testnet only aren't shown" rule) · [Developer Web Console](https://developers.minepi.com/) · [App URLs](https://developers.minepi.com/docs/build-first-app/urls) (Vercel as a hosting example) · [Console guide for coding agents (agents.md)](https://developers.minepi.com/agents.md) · [Pi Core Team announcement on X](https://x.com/PiCoreTeam/status/2125015548283290068)


## 1. Registration (each team member separately)

1. Have a Pi account and the Pi Browser on your phone.
2. On a **desktop** browser, open <https://developers.minepi.com/hackathon/register>. Signing in from inside the Pi Browser isn't supported yet.
3. Click **Sign in with Pi**, scan the QR code with your phone and approve in the Pi Browser.
4. Fill in the form: Pi username (can't be changed), email (filled in from your Pi profile; updates go there), region, "How did you hear about Pi Next?", and tick the box accepting the rules, Developer Terms and Privacy Policy.
5. The **team lead** adds members by Pi username on the app's entry page. Listing someone doesn't register them, so they must register first. Only the lead sees the entry.
6. Optional: midpoint submission for feedback (details are emailed to people who registered).

Eligibility: over 18; any team size; up to 3 apps per team; one account per person. Registering has no KYC step, but the Mainnet listing needs it.

**Sources:** [Pi Next official page](https://minepi.com/pi-next/) (steps) · [Hackathon registration and entry pages in the Developer Web Console](https://developers.minepi.com/hackathon/register) (form fields, teams, rules text) · [Console guide for coding agents (agents.md)](https://developers.minepi.com/agents.md) ("signing in from Pi Browser isn't supported yet") · [Pi Developer Terms](https://socialchain.app/developer_terms)


## 2. What the submission needs

- A **Mainnet** app picked from "My apps"
- A public demo video, **3 minutes or less** (YouTube is fine), showing the final app. It should cover what the app is, its features, who it's for, the problem it solves and how Pi fits in
- The team members
- English name and accurate English description
- Logo that follows Pi's trademark guidelines
- Preview images of the interface
- **PiNet** integration
- **Privacy policy**

The console won't let you submit until all of these are done: app deployed; domain verified; Mainnet listing submitted for review; demo video added; app not blocked or delisted.

**Sources:** [Pi Next official page](https://minepi.com/pi-next/) (submission guidelines, demo video) · [Hackathon registration and entry pages in the Developer Web Console](https://developers.minepi.com/hackathon/register) (the console's submission checks) · [Pi trademark guidelines](https://minepi.com/pi-trademark-guidelines/)


## 3. Judging and prizes

Criteria (no published weights):
1. Alignment with the Mainnet Listing Guidelines
2. Pi utility and fit with community and ecosystem needs
3. Technical completeness and innovation
4. UI/UX, accessibility and ease of navigation
5. Long-term utility on the Pi Mainnet blockchain
6. Uniqueness

Prizes (USDT):
- **Judges' Pick:** 25,000 / 15,000 / 10,000
- **Community Engagement Awards:** 150,000 shared by up to 2 teams, based on the judges' view plus **real user engagement, retention and community traction**

**Sources:** [Pi Next official page](https://minepi.com/pi-next/) (Prizes and Incentives) · [Pi Core Team announcement on X](https://x.com/PiCoreTeam/status/2125015548283290068)


## 4. Mainnet listing (you can apply directly; no Testnet app needed first)

An app's network is chosen when you create it and can't be changed later; a Testnet app can't be converted. Status goes Draft → Deployed → Under review → Listed.

1. Create a **Production (Mainnet)** app in "My apps" under the **client's** Pi account.
2. Frontend URL: `https://bookkeeping-v1.vercel.app` (the domain must not start with "pi").
3. Verify the domain: put the new key in `public/validation-key.txt` and redeploy. This also assigns the PiNet subdomain.
4. Create the app wallet and server API key. Railway: `PI_NETWORK_API_KEY`, `PI_NETWORK=mainnet`. Vercel: `VITE_PI_NETWORK=mainnet`.
5. Listing page: subtitle, description, category, language, 3 screenshots, 1024×1024 logo, privacy URL `https://bookkeeping-v1.vercel.app/privacy-policy.html`, terms URL `https://bookkeeping-v1.vercel.app/terms-of-use.html`.
6. The client must at least have **applied for Pi KYC** in the Pi app.
7. Submit for review.

**Review time:** Pi publishes none (community reports describe it as slow). Aim to submit by **mid-December**. Entering Pi Next doesn't speed up the review or change the listing.

Listing rules: fully working, clean UI; **Pi sign-in only**; **every transaction in Pi**; no sending users to outside sites (our only outside link is the Pi Wallet's own `wallet.pinet.com` send screen, which Pi reviews case by case); collect only the data the app needs.

**Sources:** [Mainnet Listing Requirements](https://developers.minepi.com/docs/build-first-app/MainnetListing) · [Launching on Mainnet](https://developers.minepi.com/docs/build-first-app/Launch) · [Console guide for coding agents (agents.md)](https://developers.minepi.com/agents.md) (Production vs Staging app, `testnet_app_id` optional, listing fields) · [Hackathon registration and entry pages in the Developer Web Console](https://developers.minepi.com/hackathon/register) (listing checks, KYC message) · [Registering an app](https://developers.minepi.com/docs/build-first-app/RegisterApp)


## 5. PiNet

PiNet gives the app a public `https://<name>NNNNN.pinet.com` address that works in any browser. The new console assigns it **automatically when the domain is verified**; it's not SDK code. An app that forces `Pi.authenticate` on first visit, or blocks non-Pi browsers, can't use PiNet.

- ✅ `vercel.json` CSP allows framing from `*.pinet.com`; `socialchain.app` is allowed
- ✅ No forced sign-in on first visit: "Connect via Pi" is a button, and guest mode works
- ⏳ PiNet subdomain: comes after the Mainnet domain is verified
- ⏳ Not tested: open the pinet.com URL in desktop Chrome and check the login screen and guest mode

**Sources:** [PiNet](https://developers.minepi.com/docs/build-first-app/PiNet) · [Community developer guide: PiNet](https://pi-apps.github.io/community-developer-guide/docs/importantTopics/piNet/) · [Console guide for coding agents (agents.md)](https://developers.minepi.com/agents.md) (`pinet_subdomain`, domain verification, CSP) · [Pi Next official page](https://minepi.com/pi-next/) (PiNet requirement) · This repo: `vercel.json`, `src/App.tsx`


## 6. Handover plan (move accounts; don't rebuild)

| What | How | Effect |
|---|---|---|
| GitHub | Repo Settings → Transfer ownership to the client; he adds the developer as a collaborator | History moves with it; GitHub redirects the old URL |
| Vercel | Project Settings → Transfer project to the client's team | Same URL, environment variables and domains |
| Railway | Project Settings → Transfer to the client's workspace | Database and environment variables move with it; same URL |
| Pi app | The client creates the **Mainnet** app under his own Pi account (KYC) | He owns the app and is the team lead |

**Free-plan limits (from the docs and forums below):**
- **Vercel:** to transfer, you must be a member of the destination team. A free Hobby account can't add members, so a transfer straight to the client's Hobby account may not be offered. Options: the client starts a Pro team (a trial works) and invites you, then you transfer; or use Vercel's "Claim Deployments".
- **Railway:** you can only transfer to a workspace you're a member of, and the destination needs an active Hobby or Pro subscription. If his workspace doesn't show up in the Transfer dialog, add yourself as a member of it, or ask Railway support.
- **GitHub:** a transfer is accepted by the new owner by email. You stay on the repo as a collaborator. Issues, pull requests and stars move with it.

The client signs up for each service with his own email and 2FA, then invites the developer, so passwords are never shared. Do the handover **before** submitting: moving the accounts keeps every URL the same, so nothing submitted has to be redone.

After a transfer, check:
- the Vercel production branch is `main` (switched from `feature_branch/backend-implementation` on 2026-11-28; the old frontend-only `main` is kept as `legacy-frontend`);
- Railway still deploys from the same repo and the `main` branch;
- the Railway `CORS_ORIGIN` still contains the Vercel URL.

**Sources:** [GitHub: Transferring a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository) · [Vercel: Transferring a project](https://vercel.com/docs/projects/transferring-projects) · [Vercel: Claim Deployments](https://vercel.com/docs/deployments/claim-deployments) · [Vercel community: Hobby-to-Hobby transfer](https://community.vercel.com/t/transfer-an-existing-production-project-between-two-hobby-accounts-using-claim-deployments/51492) · [Railway: Projects (Transfer Project)](https://docs.railway.com/projects) · [Railway: Workspaces](https://docs.railway.com/projects/workspaces)


## Progress tracker

### Code and repo
- [x] Privacy Policy page `/privacy-policy.html`, linked on the login screen (commit `fe52932`)
- [x] Terms of Use page `/terms-of-use.html`, linked on the login screen (commit `fe52932`)
- [ ] Contact email added on both pages (replace `[add contact email]`)
- [x] AUD-01 login fix in code: sign-in is `POST /api/auth/pi`, checked with Pi `/v2/me`; the uid login answers 410 (tests 697/697, 2026-11-28)
- [x] AUD-01 fix committed and pushed (`d29bbeb`, 2026-11-28; sandbox-only parts left uncommitted)
- [ ] Deployed: Railway and Vercel **together**; `ALLOW_UID_LOGIN` **not** set on Railway
- [ ] Real sign-in tested in the Pi Browser after the deploy

### Accounts and handover
- [ ] Client: Pi account and KYC applied
- [ ] Client: GitHub, Vercel and Railway accounts (his email, 2FA)
- [ ] Both registered for Pi Next (client and developer)
- [ ] GitHub repo transferred
- [ ] Vercel project transferred (production branch checked)
- [ ] Railway project transferred (CORS and branch checked)

### Mainnet and listing
- [ ] Mainnet (Production) app created under the client
- [ ] Domain verified (new `public/validation-key.txt` deployed) and PiNet URL assigned
- [ ] App wallet and API key set; `PI_NETWORK=mainnet` / `VITE_PI_NETWORK=mainnet` deployed
- [ ] Sign-in and payments tested on Mainnet
- [ ] PiNet URL loads in desktop Chrome (login screen and guest mode)
- [ ] Logo (1024×1024), 3 screenshots, subtitle and description ready
- [ ] Mainnet listing submitted for review (target: mid-December)
- [ ] Optional midpoint submission

### Submission
- [ ] Real users invited (this decides the Community Engagement prize)
- [ ] Demo video, 3 minutes or less, public link
- [ ] Team members added by the client on the entry
- [ ] **Entry submitted by the client** (target: about 1 Jan; deadline 5 Jan 11:59 PM PT)

**Sources:** This repo: commits `fe52932` (Privacy and Terms pages) and `d29bbeb` (AUD-01 sign-in fix), `PROGRESS.md`, `audits/backend/2026-11-19/findings.json` (local only)


## Not covered by the official pages (ask in the Pi Next Google Group)

- Judging dates and when winners are announced
- Whether KYC is needed to receive the prize, and who on the team gets paid
- How long the Mainnet listing review usually takes

**Sources:** [Pi Next Google Group](https://groups.google.com/a/picoreteam.org/g/pihackathon2026) · [Pi Next official page](https://minepi.com/pi-next/)


## Log

| Date | What happened |
|---|---|
| 2026-11-28 | Researched Pi Next (rules, registration, Mainnet-only entry, hosting, PiNet, listing). Added the Privacy Policy and Terms pages (`fe52932`). Fixed AUD-01 in code (Pi-verified sign-in); not committed yet. Wrote this guide. |
| 2026-11-28 | Committed and pushed the AUD-01 sign-in fix (`d29bbeb`) with the Privacy/Terms pages. Waiting on the Vercel and Railway deploys and a real sign-in test. Added sources to every section of this guide, plus the free-plan transfer limits for Vercel and Railway. |
| 2026-11-28 | `main` is now the full app (moved forward to `cf58c04`, no merge needed); the old `main` is saved as `legacy-frontend`. Vercel `bookkeeping-v1` and Railway now deploy from `main`. Live site and backend checked healthy afterwards. |

## Official links

- Pi Next page: <https://minepi.com/pi-next/>
- Hackathon registration: <https://developers.minepi.com/hackathon/register>
- Developer Web Console: <https://developers.minepi.com/>
- Mainnet Listing Requirements: <https://developers.minepi.com/docs/build-first-app/MainnetListing>
- Launching on Mainnet: <https://developers.minepi.com/docs/build-first-app/Launch>
- PiNet: <https://developers.minepi.com/docs/build-first-app/PiNet>
- App URLs: <https://developers.minepi.com/docs/build-first-app/urls>
- Registering an app: <https://developers.minepi.com/docs/build-first-app/RegisterApp>
- Console guide for coding agents: <https://developers.minepi.com/agents.md>
- Pi trademark guidelines: <https://minepi.com/pi-trademark-guidelines/>
- Pi Developer Terms: <https://socialchain.app/developer_terms>
- Pi Next Google Group: <https://groups.google.com/a/picoreteam.org/g/pihackathon2026>
- Pi Core Team announcement: <https://x.com/PiCoreTeam/status/2125015548283290068>
