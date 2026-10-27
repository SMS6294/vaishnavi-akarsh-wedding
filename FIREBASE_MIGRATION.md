# Firebase and GitHub Pages setup

The invitation pages and images are served from `public/`. The included GitHub Actions workflow can publish that folder to GitHub Pages, but it runs only when manually dispatched on the `firebase-migration` branch. No deployment has been run.

## Firebase Console setup

1. Create or select a Firebase project and register a Web app under **Project settings > General > Your apps**.
2. The Firebase Web app configuration is present in `public/firebase-config.js`. It contains public browser identifiers, not private keys. Never put a service-account JSON file or Admin SDK credential in `public/`.
3. Under **Authentication > Sign-in method**, enable **Email/Password**. Add each family account yourself; this code does not create accounts or choose passwords.
4. Create the Cloud Firestore database. The authorised family UID is present in `firestore.rules`; review and publish those rules through the Firestore Rules console. Authentication alone is not sufficient: an account absent from the allowlist cannot read RSVPs.
5. Add the deployed GitHub Pages origin and any local testing host to **Authentication > Settings > Authorized domains** if Firebase requires them. GitHub Pages URLs normally use `https://<owner>.github.io` as the origin.
6. In the GitHub repository settings, enable Pages with **GitHub Actions** as the build and deployment source. Then use **Actions > Deploy GitHub Pages > Run workflow** while `firebase-migration` is selected if/when you intend to publish. This manual action publishes the contents of `public/`.

For additional family accounts, obtain each UID from its Firebase Authentication user record and add it as a separate string in the `in [...]` list. Do not use email addresses in the allowlist.

## Data model and access

Each document in the `rsvps` collection contains `name`, `phone`, `attending`, `count`, `companions`, and `submittedAt`. Public visitors can create a document only when those fields and values pass the rules. A server timestamp is required. Public reads, updates, and deletes are denied. Only UIDs in the rules allowlist can read/list documents. The family dashboard calculates the same four totals from the collection and displays the same response columns as the existing dashboard.

The browser validates the same RSVP limits for usability; Firestore rules enforce them again. The existing `data/rsvps.json` is untouched and is not read or imported by this implementation. If you later choose to migrate its record, plan a separate controlled import using trusted server-side credentials; Admin SDK writes bypass Firestore Security Rules, so keep those credentials out of the site and repository.

## Local functional check

1. Complete Firebase Console setup and publish the reviewed Firestore rules. The web app config and authorised family UID are already in the local files.
2. From the repository root, serve the static folder over HTTP, for example with `py -m http.server 8000 --directory public`.
3. Open `http://localhost:8000/`. Confirm the design, images, countdown, navigation, and RSVP form load. Submit a valid accept and decline response; check that the Firestore records have only the allowed fields and the expected values. Try a blank name and invalid party size in the browser.
4. Open `http://localhost:8000/family-login.html`. Sign in with an allowlisted account and verify totals, refresh, every table column, and logout. Then sign in with a non-allowlisted account and confirm it cannot read the RSVP collection. Test signed-out access as well.
5. In Firestore Rules testing (or the Firebase Emulator Suite), verify that create requests with extra fields, overlong values, invalid attendance/count combinations, and a client-supplied non-server timestamp are denied; verify that unauthenticated reads and all updates/deletes are denied.
6. Only after the checks pass, manually run the Pages workflow on `firebase-migration` if you want to publish.

## Limits and review status

Create-only rules stop visitors from changing an existing document, but they cannot reliably stop spam or duplicate submissions. A visitor can submit repeatedly under new document IDs. Consider App Check, monitoring and budget alerts, or a server-side submission service with rate limiting/verification if abuse becomes a concern; App Check alone is not a per-person duplicate check. The current form has no guest identity or invitation token with which to enforce one response per household. The family dashboard reads the full collection, so read cost and page load time grow with the RSVP count.

This is not a production-verified migration. Firebase web configuration and the authorised family UID are present locally, but the Firestore rules still need to be published and tested in the target project. No live Firebase end-to-end test or deployment has been run here. The legacy Express server and ignored JSON file remain in the repository for now; the Pages frontend no longer calls the Express API.
