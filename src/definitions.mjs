/** Signed, declarative registrations. IDs are the existing persistent app IDs. */
const browse = ['browse','latest','search','filters'];
const origin = host => `https://${host}`;
const sourceBranding = {
  "mangadex": {
    "icon": "assets/source_logos/mangadex.png",
    "accentColor": "#FF6740"
  },
  "mangakakalot": {
    "icon": "assets/source_logos/mangakakalot.png",
    "accentColor": "#F48A46"
  },
  "weebcentral": {
    "icon": "assets/source_logos/weebcentral.png",
    "accentColor": "#4EA2FF"
  },
  "mangachan": {
    "icon": "assets/source_logos/mangachan.png",
    "accentColor": "#EE6F2D"
  },
  "desu": {
    "icon": "assets/source_logos/desu.png",
    "accentColor": "#176093"
  },
  "shikimori": {
    "icon": "assets/source_logos/shikimori.png",
    "accentColor": "#4B7FAA"
  },
  "anilist": {
    "icon": "assets/source_logos/anilist.png",
    "accentColor": "#3DB4F2"
  },
  "myanimelist": {
    "icon": "assets/source_logos/myanimelist.png",
    "accentColor": "#2E51A2"
  }
};
function source(id,name,host,module,extra = {}) {
  const base = origin(host), {origins = [],images = [],auth = null,recommendations = false,custom = false,refresh = false,
    template = '/{id}',encoding = 'pathSegment',idPart,capabilities = browse,parameters = {},settings,metadataOnly = false,bindings = {},nsfw = false,media = {},network = {}} = extra;
  return {id,name,language:id.split('.')[0],baseUrl:base,engine:extra.engine ?? 'Handwritten JS',status:'experimental',isNsfw:nsfw,
    branding:sourceBranding[id.split('.').at(-1)],
    supportsCustomBaseUrl:custom,supportsFilterRefresh:refresh,capabilities:[...capabilities,...(recommendations ? ['recommendations'] : []),...(auth ? ['account'] : [])],
    features:{webLinks:true,auth:auth != null,authCompletion:auth?.completionUrl != null,recommendations},
    web:{mangaUrlTemplate:template,idEncoding:encoding,...(idPart ? {idPart} : {})},parameters,
    filterBindings:bindings,metadataOnly,...(extra.presentation ? {presentation:extra.presentation} : {}),...(settings ? {settings} : {}),...(auth ? {auth} : {}),
    network:{origins:[base,...origins].filter((value,index,all) => all.indexOf(value) === index),imageOrigins:[base,...images].filter((value,index,all) => all.indexOf(value) === index),
      authOrigins:auth?.cookieOrigins ?? [base],allowSubdomains:true,methods:['GET','POST','HEAD'],maxConcurrentRequests:6,...network},
    media:{userAgentProfile:'browser',refererOrigin:base,sendOrigin:false,...media},
    // Build-only dispatcher mapping; not a source-manifest property.
    _module:module};
}
const cookieAuth = (host,login = '/login/') => ({profileId:'host.cookie.v1',loginUrl:new URL(login,origin(host)).href,
  cookieOrigins:[origin(host)],sessionExport:{headers:['Cookie'],values:[]}});
const metadata = (id,name,host,module,extra = {}) => source(id,name,host,module,{...extra,metadataOnly:true,recommendations:true,auth:cookieAuth(host,extra.login ?? '/login'),template:extra.template ?? '/manga/{id}'});
export const registrations = [
  ...['ru','en'].map(language => source(`${language}.mangadex`,'MangaDex','mangadex.org','engines/mangadex.mjs',{engine:'MangaDex API JS',recommendations:true,parameters:{translatedLanguage:language},origins:['https://api.mangadex.org'],images:['https://uploads.mangadex.org','https://mangadex.network'],template:'/title/{id}',bindings:{tags:'tags'},
    network:{authOrigins:['https://mangadex.org','https://api.mangadex.org','https://uploads.mangadex.org']}})),
  source('en.mangakakalot','Mangakakalot','www.kakamanga.com','sources/mangakakalot.mjs',{engine:'MangaBox HTML/API JS',origins:['https://kakamanga.com','https://www.mangakakalove.com','https://mangakakalove.com'],images:['https://2xstorage.com','https://kakamanga.com','https://mangakakalot.gg','https://mangakakalove.com','https://manganelo.com','https://manganato.com'],template:'/manga/{id}',
    // Explicit parent Domain grants for this source's own anti-bot cookies;
    // no account/raw session export and no shared browser jar.
    network:{authOrigins:['https://www.kakamanga.com','https://kakamanga.com','https://www.mangakakalove.com','https://mangakakalove.com']}}),
  source('en.weebcentral','Weeb Central','weebcentral.com','sources/weebcentral.mjs',{recommendations:true,images:['https://planeptune.us','https://weebcentral.com','https://compsci88.com','https://scans.lastation.us'],template:'/series/{id}',bindings:{author:'author',artist:'author',tags:'tag'}}),
  source('ru.mangachan','MangaChan','im.manga-chan.me','engines/chan.mjs',{recommendations:true,template:'/{id}',encoding:'path',images:['https://manga-chan.me'],network:{authOrigins:['https://im.manga-chan.me','https://manga-chan.me']},bindings:{tags:'genres'}}),
  source('ru.desu','Desu','desu.uno','sources/desu.mjs',{custom:true,refresh:true,recommendations:true,template:'/{id}',encoding:'path',images:['https://desu.uno','https://desu.me'],bindings:{tags:'genres'}}),
  metadata('ru.shikimori','Shikimori','shikimori.io','sources/shikimori.mjs',{template:'/mangas/{id}',login:'/users/sign_in',images:['https://shikimori.io','https://shikimori.one']}),
  metadata('en.anilist','AniList','anilist.co','sources/anilist.mjs',{origins:['https://graphql.anilist.co'],images:['https://anilist.co'],login:'/login'}),
  metadata('en.myanimelist','MyAnimeList','myanimelist.net','sources/myanimelist.mjs',{engine:'MyAnimeList HTML JS',images:['https://cdn.myanimelist.net'],login:'/login.php',
    // The site's own Request Desktop Site preference keeps markup and offsets consistent.
    network:{cookieDefaults:[{origin:'https://myanimelist.net',name:'view',value:'pc'}]}}),
];
export function sourceDefinitions() { return registrations.map(({_module,...definition}) => definition); }
export function manifestDefinition({version,publisherKeyId}) {
  return {schemaVersion:1,extensionId:'official.mangalaunch.core.sources',name:'MangaLaunch Official Extensions',version,publisherKeyId,
    icon:'assets/icon.png',sourceApiVersion:1,minAppVersion:'1.0.0',minRuntimeAbi:1,entrypoint:'src/index.mjs',license:'LicenseRef-Proprietary',permissions:['http','html','sourceSettings','sourceSession'],sources:sourceDefinitions(),files:{}};
}
