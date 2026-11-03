import {filter, manga, normalizeText, parseError, record, string} from '../core/data.mjs';
import {finiteNumber, requireArray, requireRecord, urlWithQuery} from '../core/http.mjs';
import {recent} from '../core/recent.mjs';

const site = 'https://myanimelist.net';
const pageSize = 50;
const rankingOptions = [['all','All'],['bypopularity','Popularity'],['favorite','Favourites'],['manga','Manga'],
  ['novels','Novels'],['oneshots','One shots'],['doujin','Doujinshi'],['manhwa','Manhwa'],['manhua','Manhua']];
const typeOptions = [['manga|1','Manga'],['one_shot|3','One shot'],['doujinshi|4','Doujinshi'],['light_novel|2','Light novel'],
  ['novel|8','Novel'],['manhwa|5','Manhwa'],['manhua|6','Manhua']];
const statusOptions = [['currently_publishing|1','Publishing'],['finished|2','Finished'],['on_hiatus|4','On hiatus'],
  ['discontinued|5','Discontinued'],['not_yet_published|3','Not yet published']];
const values = input => (Array.isArray(input) ? input : []).map(value => value.trim()).filter(Boolean);
const selected = (filters,key) => values(filters[key])[0] ?? null;
const first = (list, excluding = null) => list.map(string).find(value => value && value !== excluding) ?? null;
const idFromUrl = value => string(value)?.match(/\/manga\/(\d+)(?:[/?#]|$)/u)?.[1] ?? null;
const year = value => string(value)?.match(/\b(?:19|20)\d{2}\b/u)?.[0] ?? null;
const displayStatus = input => ({publishing:'ongoing',finished:'completed','on hiatus':'hiatus',
  discontinued:'cancelled','not yet published':'not yet released'}[string(input)?.toLowerCase()] ?? string(input));
const imageProjection = {selector:'img',fields:{dataSrc:{attr:'data-src'},dataSet:{attr:'data-srcset'},src:{attr:'src'},srcSet:{attr:'srcset'}}};
const link = selector => ({selector,fields:{href:{attr:'href'},title:{text:true}}});
const rankingProjection = {selector:'tr.ranking-list',all:true,fields:{
  link:link('h3.manga_h3 a'),info:{selector:'.information',text:true},rating:{selector:'td.score .score-label',text:true},image:imageProjection,
}};
export const browseProjection = {fields:{
  tiles:{selector:'.seasonal-anime.js-seasonal-anime',all:true,fields:{
    href:{selector:'h2.h2_manga_title a.link-title',attr:'href'},title:{selector:'h2.h2_manga_title a.link-title',text:true},
    info:{selector:'.prodsrc .item',all:true,text:true},publishing:{selector:'.prodsrc .item.publishing',text:true},
    synopsis1:{selector:'.synopsis .preline',text:true},synopsis2:{selector:'.synopsis',text:true},
    synopsis3:{selector:'.information .synopsis',text:true},genres:{selector:'.genres a',all:true,text:true},image:imageProjection}},
  rows:{selector:'.js-categories-seasonal.js-block-list table > tbody > tr',all:true,fields:{link:link('a.hoverinfo_trigger.fw-b[href*="/manga/"]'),
    description:{selector:'td:nth-child(2) .pt4',text:true,exclude:'a'},type:{selector:'td:nth-child(3)',text:true},
    rating:{selector:'td:last-child',text:true},image:imageProjection}},
}};
function cover(input) {
  const image = record(input);
  const fromSet = value => string(value)?.split(',').at(-1).trim().split(/\s+/u)[0] ?? null;
  const candidate = first([fromSet(image.dataSet),image.dataSrc,fromSet(image.srcSet),image.src]);
  return candidate ? new URL(candidate,site).href : null;
}
export function parseBrowse(input) {
  const data = requireRecord(input,'MyAnimeList HTML catalog');
  const tiles = requireArray(data.tiles,'MyAnimeList tiles').map(value => {
    const item = requireRecord(value,'MyAnimeList tile'), id = idFromUrl(item.href);
    const title = string(item.title); if (!id || !title) return null;
    const info = requireArray(item.info,'MyAnimeList tile metadata').map(string).filter(Boolean), typeAndYear = info[0];
    return manga({id,title,coverUrl:cover(item.image),description:first([item.synopsis1,item.synopsis2,item.synopsis3]),
      status:displayStatus(first([item.publishing,info[1]])),type:string(typeAndYear?.split(',')[0]),
      releaseYear:year(typeAndYear),tags:requireArray(item.genres,'MyAnimeList tile genres').map(string).filter(Boolean)});
  }).filter(Boolean);
  if (tiles.length) return tiles;
  return requireArray(data.rows,'MyAnimeList search rows').map(value => {
    const item = requireRecord(value,'MyAnimeList row'), titleLink = record(item.link);
    const id = idFromUrl(titleLink.href), title = string(titleLink.title);
    if (!id || !title) return null;
    return manga({id,title,coverUrl:cover(item.image),description:string(item.description),type:string(item.type),rating:finiteNumber(item.rating,null)});
  }).filter(Boolean);
}
export function browseUrl({page = 1,searchTerm = '',selectedFilters = {}}) {
  const query = {cat:'manga'};
  if (page > 1) query.show = (page-1)*pageSize;
  if (searchTerm.trim()) query.q = searchTerm.trim();
  for (const key of ['type','status']) {
    const value = string(selected(selectedFilters,key)?.split('|')[1]); if (value) query[key] = value;
  }
  const genres = values(selectedFilters.genre); if (genres.length) query['genre[]'] = genres;
  return urlWithQuery('/manga.php',site,query);
}

const titleProjection = {fields:{
  title:{selector:'h1 [itemprop="name"]',text:true,exclude:'.title-english'},
  cover:{selector:'meta[property="og:image"]',attr:'content'},
  description:{selector:'[itemprop="description"]',text:true},
  rating:{selector:'.score .score-label',text:true},
  metadata:{selector:'.leftside .spaceit_pad',all:true,fields:{label:{selector:'.dark_text',text:true},
    value:{text:true,exclude:'.dark_text, [itemprop="genre"]'},links:{selector:'a[href*="/people/"], a[href*="/manga/genre/"]',all:true,text:true}}},
  recommendations:{selector:'#manga_recommendation li.btn-anime',all:true,fields:{title:{attr:'title'},label:{selector:'.title',text:true},
    href:{selector:'a[href*="/recommendations/manga/"]',attr:'href'},image:imageProjection}},
}};

function parseDetails(input,id) {
  const title = string(input.title);
  if (!title) throw parseError('MyAnimeList title is missing');
  const rows = requireArray(input.metadata,'MyAnimeList title metadata');
  const row = label => rows.find(item => string(item.label)?.replace(/:$/u,'').toLowerCase() === label);
  const text = label => string(row(label)?.value);
  const authors = row('authors');
  const names = Array.isArray(authors?.links) ? authors.links.map(normalizeText).filter(Boolean) : [];
  const credits = names.map(name => {
    const position = authors.value?.indexOf(name) ?? -1;
    const role = position < 0 ? '' : authors.value.slice(position + name.length).match(/^\s*\(([^)]+)\)/u)?.[1] ?? '';
    return {name,role};
  });
  const contributor = role => [...new Set(credits.filter(credit => credit.role.includes(role)).map(credit => credit.name))].join(', ') || null;
  const genres = ['genre','genres','theme','themes','demographic'].flatMap(label => row(label)?.links ?? []);
  return manga({id,title,coverUrl:string(input.cover),description:string(input.description),rating:finiteNumber(input.rating,null),
    secondaryTitle:first([text('english'),text('japanese'),text('synonyms')],title),
    author:contributor('Story'),artist:contributor('Art'),type:text('type'),status:displayStatus(text('status')),
    releaseYear:year(text('published')),tags:[...new Set(genres.map(normalizeText).filter(Boolean))]});
}

export default function createMyAnimeList(ctx) {
  let genres = null;
  async function html(url, projection) {
    const response = await ctx.http.request({method:'GET',url,responseType:'text',userAgentProfile:'browser',
      headers:{Accept:'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9'}});
    if (typeof response.body !== 'string' || !response.body.trim()) throw parseError('MyAnimeList returned an empty page');
    return ctx.html.extract(response.body,{baseUrl:response.url ?? url,...projection});
  }
  async function ranking(page, type) {
    const url = urlWithQuery('/topmanga.php',site,{type:type === 'all' ? null : type,limit:page > 1 ? (page-1)*pageSize : null});
    const rows = requireArray(await html(url,rankingProjection),'MyAnimeList rankings');
    return rows.map(item => {
      const id = idFromUrl(item.link?.href), title = string(item.link?.title);
      return id && title ? manga({id,title,coverUrl:cover(item.image),rating:finiteNumber(item.rating,null),
        type:string(item.info?.split(' (')[0]),releaseYear:year(item.info)}) : null;
    }).filter(Boolean);
  }
  async function browse(query,page) {
    try {
      return parseBrowse(await html(browseUrl(query),browseProjection));
    } catch (error) {
      if (page > 1 && error.httpStatus === 404) return [];
      throw error;
    }
  }
  const titlePage = recent(async id => {
    if (!/^\d+$/u.test(id)) throw parseError('Invalid MyAnimeList title ID');
    const data = requireRecord(await html(`${site}/manga/${id}`,titleProjection),'MyAnimeList title');
    return {details:parseDetails(data,id),recommendations:data.recommendations};
  });
  return {
    async getFilters({refresh = false} = {}) {
      if (genres === null || refresh) {
        const entries = requireArray(await html(`${site}/manga.php`,{selector:'[name="genre[]"]',all:true,
          fields:{value:{attr:'value'},label:{ascend:1,text:true}}}),'MyAnimeList genre controls');
        const seen = new Set();
        genres = entries.map(value => { const item = requireRecord(value,'MyAnimeList genre');
          return [string(item.value),string(item.label)?.replace(/\s*\(\d[\d,]*\)\s*$/u,'')]; })
          .filter(([id,label]) => id && label && !seen.has(id) && seen.add(id));
      }
      const sort = filter('sort','ranking','Rankings',rankingOptions); sort.caption = 'Used when browsing without a search query or filters.';
      return [sort,filter('singleSelect','type','Type',typeOptions),filter('singleSelect','status','Status',statusOptions),
        filter('multiSelect','genre','Genres',genres)];
    },
    async getPopular({page = 1} = {}) { return ranking(Math.max(1,page),'bypopularity'); },
    async getLatest({page = 1} = {}) { return ranking(Math.max(1,page),'all'); },
    async search(query) {
      const filters = query.selectedFilters ?? {}, page = Math.max(1,query.page ?? 1);
      if (query.searchTerm?.trim() || ['type','status','genre'].some(key => values(filters[key]).length)) return browse(query,page);
      const type = selected(filters,'ranking')?.split(':')[0].trim();
      return ranking(page,rankingOptions.some(([value]) => value === type) ? type : 'all');
    },
    async getDetails({mangaId}) { return (await titlePage(mangaId)).details; },
    async getChapters() { return []; },
    async getPages() { throw parseError('MyAnimeList titles do not provide chapters for reading'); },
    async getRecommendations({mangaId,page = 1}) {
      const normalized = Math.max(1,page); if (normalized > 1) return {items:[],page:normalized,hasNextPage:false};
      const entries = requireArray((await titlePage(mangaId)).recommendations,'MyAnimeList recommendations');
      const seen = new Set([mangaId]);
      const items = entries.map(value => {const item = requireRecord(value,'MyAnimeList recommendation');
        const pair = string(item.href)?.match(/\/recommendations\/manga\/(\d+)-(\d+)/u)?.slice(1);
        const id = pair?.includes(mangaId) ? pair.find(id => id !== mangaId) : null;
        const title = normalizeText(item.title ?? item.label);
        if (!id || !title || seen.has(id)) return null; seen.add(id);
        return manga({id,title,coverUrl:cover(item.image)});}).filter(Boolean);
      return {items,page:normalized,hasNextPage:false};
    },
  };
}
