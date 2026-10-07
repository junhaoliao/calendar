# Publishing to npm

GitHub Actions publishes the validated package when a GitHub Release is published
or the workflow is dispatched from a version tag.

## One-time npm setup

The npm account must have publishing access to `@junhaoliao/calendar` and 2FA
enabled. The package must exist before configuring its trusted publisher.
For package creation and optional staging, follow the
[npm staging guide](https://docs.npmjs.com/staged-publishing/).

In the npm package settings, add a GitHub Actions trusted publisher:

- Organization or user: `junhaoliao`
- Repository: `calendar`
- Workflow filename: `publish-to-npm.yaml`
- Environment: leave blank (the workflow does not use a GitHub environment)
- Allowed actions: enable direct publication with `npm publish`

The workflow uses GitHub-hosted runners and OIDC. Do not add an npm token secret
or an interactive login step. npm is pinned separately from the project's pnpm
version because the npm CLI performs the OIDC exchange.

Create the trusted publisher close to the first CI publication: npm requires a
successful first publish within two days or the configuration expires.

See the [npm trusted publishing documentation](https://docs.npmjs.com/trusted-publishers/).

## Prepare a release

1. Update `package.json` to the intended version. Use `0.1.0` for a stable release
   or a named prerelease such as `0.2.0-beta.1`. Versions already published to npm
   cannot be reused.
2. Review the public API, installation instructions, and third-party notices.
3. Install dependencies and browser support, then validate:

    ```sh
    pnpm install --frozen-lockfile
    pnpm exec playwright install chromium
    pnpm release:check
    ```

    This runs the full local verification and previews the npm package contents.
    It does not publish or modify authored source. For lint or formatting fixes,
    use `pnpm lint:fix` and `pnpm format`, then rerun validation.

4. Review, commit, and push the changes. Create a GitHub
   Release from a tag matching the package version exactly, such as `v0.1.0`.
   Publishing the GitHub Release starts npm publication; saving a draft does not.

## CI release flow

The release workflow checks the tag and package version, then calls the same
validation workflow used by pull requests. All jobs must pass: Node 22/24 checks,
browser tests, React 18 unit tests, React 18/19 tarball consumers, and supported
Node 18/20 consumer runtimes.

A separate job downloads and publishes that tested tarball without rebuilding or
running package lifecycle scripts. Only the publishing job has OIDC permission.
GitHub prereleases of stable-numbered versions go to `next`. Other stable releases
go to `latest`; named prereleases go to their first identifier
(`beta` or `rc`, for example).

For a failed run, rerun it from GitHub Actions. Manual dispatch is also supported,
but select the release tag rather than a branch:

```sh
gh workflow run publish-to-npm.yaml --ref v0.1.0
```

Before retrying publication, check whether the version already exists on npm.
After success, verify `npm view @junhaoliao/calendar version` (or the appropriate
prerelease tag) and install the released version in a fresh consumer.
