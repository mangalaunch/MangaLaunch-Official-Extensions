# MangaLaunch Official Extensions

**English** · [Русский](README.ru.md)

This package provides the sources maintained by the MangaLaunch project. The listed websites are independent of MangaLaunch.

The package ID is `official.mangalaunch.core.sources`. It covers nine websites with ten source entries because MangaDex is available in English and Russian. All entries declare `isNsfw: false`. Shikimori, AniList and MyAnimeList provide metadata only.

## Sources

### English

- **MangaDex** — `en.mangadex`
- **Mangakakalot** — `en.mangakakalot`
- **MangaFox** — `en.mangafox`
- **Weeb Central** — `en.weebcentral`
- **AniList** — `en.anilist`
- **MyAnimeList** — `en.myanimelist`

### Russian

- **MangaDex** — `ru.mangadex`
- **MangaChan** — `ru.mangachan`
- **Desu** — `ru.desu`
- **Shikimori** — `ru.shikimori`

## Switching from the unofficial package

The packages have different extension IDs. The transferred sources keep their existing source, title and chapter IDs. Use a MangaLaunch version that supports source transfers and follow these steps.

1. Update the unofficial package to a version that no longer lists these sources. Keep that version installed. If you already removed the unofficial package, install its updated version again.
2. Import the official package and verify its publisher.
3. Confirm the transfer of the sources, their settings and sign-in sessions. MangaLaunch verifies the previous package's signed manifest before transferring ownership. Your library, history and reading progress are preserved.

Disabling or uninstalling the old package leaves its source IDs reserved. The transfer requires the updated package's signed manifest.

## Development and releases

Use Node.js 22 or later. Run `npm test` to check the source contracts, parsers and packaging with temporary test keys. This repository includes the source modules, icons, SDK, template and tools.

Authoring guide · [English](docs/AUTHORING_EN.md) · [Русский](docs/AUTHORING_RU.md)

The [release workflow](.github/workflows/release.yml) uses the protected `official-core-source-release` environment. Set the `MLSOURCE_PUBLISHER_KEY_ID` variable and `MLSOURCE_SIGNING_KEY_BASE64` secret there. Use a dedicated publisher key for this package, retain it for updates and publish its public fingerprint so users can verify the publisher. The recommended key ID is `mangalaunch-core-official-2026`.

The workflow checks that the release tag points to the commit being published. The default archive name is `official.mangalaunch.core.sources.mlsource`. For local signing and packaging, use [`build-package.ps1`](build-package.ps1).

## License

See [LICENSE](LICENSE).
