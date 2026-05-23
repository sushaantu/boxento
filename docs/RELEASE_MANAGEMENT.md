# Release Management

Boxento releases are tag-driven. A `vMAJOR.MINOR.PATCH` tag is the source of truth for public GitHub Releases and Docker images.

Hosted deployment to `boxento.app` is intentionally excluded from the automated release workflow until Firebase deploy credentials are configured safely in GitHub Actions.

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
- runs lint
- runs unit tests
- runs browser smoke tests
- builds the app
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
3. Confirm `main` checks are green.
4. Create and push an annotated tag:

```bash
git switch main
git pull --ff-only origin main
git tag -a v1.1.0 -m "Boxento v1.1.0"
git push origin v1.1.0
```

5. Watch the `Release` workflow.
6. Confirm the GitHub Release is marked latest.
7. Confirm Docker users can pull:

```bash
docker compose pull
docker compose up -d
```

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
