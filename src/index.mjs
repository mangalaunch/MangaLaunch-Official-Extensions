import createMangaDex from './engines/mangadex.mjs';
import createMangaKakalot from './sources/mangakakalot.mjs';
import createWeebCentral from './sources/weebcentral.mjs';
import createChan from './engines/chan.mjs';
import createDesu from './sources/desu.mjs';
import createShikimori from './sources/shikimori.mjs';
import createAniList from './sources/anilist.mjs';
import createMyAnimeList from './sources/myanimelist.mjs';

const factories = new Map([
  ['ru.mangadex',createMangaDex],
  ['en.mangadex',createMangaDex],
  ['en.mangakakalot',createMangaKakalot],
  ['en.weebcentral',createWeebCentral],
  ['ru.mangachan',createChan],
  ['ru.desu',createDesu],
  ['ru.shikimori',createShikimori],
  ['en.anilist',createAniList],
  ['en.myanimelist',createMyAnimeList],
]);
export default function createSource(context) {
  const factory = factories.get(context.sourceId);
  if (!factory) throw Object.assign(Error('Source ID is not registered in this package.'),{code:'source_unavailable',phase:'factory'});
  return factory(context);
}
