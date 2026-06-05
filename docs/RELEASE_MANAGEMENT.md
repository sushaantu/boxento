# Release Management

Boxento releases are tag-driven. A `vMAJOR.MINOR.PATCH` tag is the source of truth for public GitHub Releases and Docker images.

Hosted deployment to `boxento.app` runs from the same release workflow when the `FIREBASE_SERVICE_ACCOUNT_BOXENTO_APP` GitHub secret is configured. If that secret is missing, the workflow still publishes the GitHub Release and Docker images, and the workflow summary states that Firebase deployment was skipped.

## What Runs Where

### Pull Requests

Pull requests run tests and Docker build validation. They do not publish images or releases.

### Main

Merges to `main` publish development Docker images:

- `ghcr.io/sushaantu/boxento:main`
- `ghcr.io/sushaantu/boxento:sha-<commit>`

`latest` is not published from every `main` merge.

### Release Tags

Pushing a tag like `v1.1.0` runs the release workflow:

- installs dependencies
- installs Firebase Functions dependencies
- runs lint
- runs unit tests
- runs browser smoke tests
- builds the app
- builds Firebase Functions
- deploys Firebase Hosting and Functions to `boxento-app` when `FIREBASE_SERVICE_ACCOUNT_BOXENTO_APP` is configured
- publishes multi-architecture Docker images
- creates or updates the GitHub Release
- marks the GitHub Release as latest

Docker tags published from `v1.1.0`:

- `ghcr.io/sushaantu/boxento:1.1.0`
- `ghcr.io/sushaantu/boxento:1.1`
- `ghcr.io/sushaantu/boxento:1`
- `ghcr.io/sushaantu/boxento:latest`
- `ghcr.io/sushaantu/boxento:sha-<commit>`

## Release Checklist

1. Merge all intended release PRs into `main`.
2. Update `CHANGELOG.md` in a PR when the release needs hand-written notes.
3. Confirm the repository secret `FIREBASE_SERVICE_ACCOUNT_BOXENTO_APP` is present when the release should deploy `boxento.app`.
4. Confirm `main` checks are green.
5. Create and push an annotated tag:

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.1.0 -m "Boxento v1.1.0"
git push origin v1.1.0
```

6. Watch the `Release` workflow.
7. Confirm the workflow summary says Firebase deployment published to `boxento-app`.
8. Confirm the GitHub Release is marked latest.
9. Confirm Docker users can pull:

```bash
docker compose pull
docker compose up -d
```

10. Confirm the hosted app and RSS proxy:

```bash
curl -I https://boxento.app
curl -L 'https://boxento.app/api/rss?url=https%3A%2F%2Fwww.letelegramme.fr%2Frss.xml'
```

## Firebase Deploy Credentials

Create a service account for Firebase deployment in the `boxento-app` Google Cloud project, grant only the roles needed to deploy Hosting and Cloud Functions, and store the JSON key in the repository secret named `FIREBASE_SERVICE_ACCOUNT_BOXENTO_APP`.

Recommended role coverage:

- Firebase Hosting Admin
- Cloud Functions Admin
- Cloud Build Editor
- Service Account User for the runtime service account used by deployed functions

Do not commit the JSON key. Rotate the key if it is exposed, then update the GitHub secret.

For local deploys, authenticate with Firebase CLI and run:

```bash
bun run deploy
```

That command builds the Vite app, installs and builds Firebase Functions dependencies, and deploys Hosting plus Functions.

## Version Guidance

- Patch: bug fix or compatibility fix, for example `v1.1.1`.
- Minor: new widgets, substantial widget UX improvements, performance work, or new user-facing capabilities, for example `v1.2.0`.
- Major: breaking configuration, storage, or deployment changes, for example `v2.0.0`.

## Public Repo Safety

Never commit secrets or private deploy credentials.

Safe to commit:

- workflow files
- release scripts
- documentation
- references to GitHub secret names

Do not commit:

- `.env`
- Firebase service account JSON
- API tokens
- private keys
- production-only credentials

## Rollback

For Docker users, pin the previous version in `docker-compose.yml`:

```yaml
image: ghcr.io/sushaantu/boxento:1.1.0
```

Then run:

```bash
docker compose pull
docker compose up -d
```

If a GitHub Release was published with incorrect notes, edit the release notes rather than deleting the tag. If the release artifact itself is wrong, publish a new patch version, for example `v1.1.1`, instead of deleting and recreating an existing public tag.
