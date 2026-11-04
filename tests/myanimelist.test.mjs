import test from 'node:test';
import assert from 'node:assert/strict';
import createMyAnimeList, {parseBrowse,browseUrl} from '../src/sources/myanimelist.mjs';
import {sourceDefinitions} from '../src/definitions.mjs';

const context = (http,html) => ({
  http:{request:async input => ({url:input.url,body:await http(input)})},
  html:{extract:async (body,query) => html(body,query)},
});
const card = {link:{href:'/manga/123/title',title:'Title'},info:'Manga (? vols) Aug 2020 -',rating:'8.7',
  image:{dataSrc:'https://cdn.myanimelist.net/r/50x70/cover.jpg',dataSet:'/cover-small.jpg 1x, /cover-large.jpg 2x'}};
const row = (label,value,links = []) => ({label,value,links});
const details = {title:'Title',cover:'https://cdn.myanimelist.net/images/manga/cover.jpg',description:'Synopsis',rating:'8.7',
  metadata:[row('English:','Title'),row('Japanese:','原作'),row('Type:','One-shot'),row('Status:','Finished'),
    row('Published:','Apr 12, 2020'),row('Authors:','Writer (Story), Illustrator (Art), Both (Story & Art)',['Writer','Illustrator','Both']),
    row('Genres:','Action',['Action']),row('Themes:','School',['School'])]};
const recommendation = (left,right) => ({title:'Related',href:'/recommendations/manga/'+left+'-'+right,image:{dataSrc:'/related.jpg'}});

test('public rankings use site paging, include CDN covers and need no API client ID', async () => {
  const calls = [];
  const source = createMyAnimeList(context(input => {calls.push(input); return 'HTML';}, (_,projection) =>
    projection.selector === 'tr.ranking-list' ? [card] : {tiles:[],rows:[card]}));
  const [item] = await source.getPopular({page:2});
  assert.equal((await source.getLatest({page:2}))[0].id,'123');
  assert.equal(item.id,'123');
  assert.equal(item.coverUrl,'https://myanimelist.net/cover-large.jpg');
  assert.equal(item.rating,8.7);
  assert.equal(item.releaseYear,'2020');
  const [popular,latest] = calls.map(input => new URL(input.url));
  assert.equal(popular.origin,'https://myanimelist.net');
  assert.equal(popular.pathname,'/topmanga.php');
  assert.equal(popular.searchParams.get('type'),'bypopularity');
  assert.equal(popular.searchParams.get('limit'),'50');
  assert.equal(latest.pathname,'/manga.php');
  assert.equal(latest.searchParams.get('o'),'9');
  assert.equal(latest.searchParams.get('c[0]'),'a');
  assert.equal(latest.searchParams.get('c[1]'),'d');
  assert.equal(latest.searchParams.get('cv'),'2');
  assert.equal(latest.searchParams.get('show'),'50');
  assert.ok(calls.every(input => input.responseType==='text' && !input.headers['X-MAL-CLIENT-ID']));
  const definition = sourceDefinitions().find(source => source.id === 'en.myanimelist');
  assert.ok(definition.metadataOnly && definition.network.imageOrigins.includes('https://cdn.myanimelist.net'));
  assert.deepEqual(definition.network.cookieDefaults,[{origin:definition.baseUrl,name:'view',value:'pc'}]);
});

test('unexpected empty preview markup is surfaced while empty search results remain valid', async () => {
  const source = createMyAnimeList(context(() => 'HTML',(_,projection) =>
    projection.selector ? [] : {tiles:[],rows:[]}));
  await assert.rejects(source.getPopular(),{code:'parse_error'});
  await assert.rejects(source.getLatest(),{code:'parse_error'});
  assert.deepEqual(await source.search({searchTerm:'unmatched',selectedFilters:{ranking:['latest']}}),[]);
});

test('search retains site filter values and stops beyond the last result page', async () => {
  const query = {page:2,searchTerm:' title ',selectedFilters:{type:['manhwa|5'],status:['finished|2'],genre:['1','2']}};
  const url = new URL(browseUrl(query));
  assert.equal(url.searchParams.get('cat'),'manga');
  assert.equal(url.searchParams.get('show'),'50');
  assert.equal(url.searchParams.get('q'),'title');
  assert.equal(url.searchParams.get('type'),'5');
  assert.equal(url.searchParams.get('status'),'2');
  assert.deepEqual(url.searchParams.getAll('genre[]'),['1','2']);
  const error = Object.assign(Error('No page'),{httpStatus:404});
  const source = createMyAnimeList(context(() => {throw error;}));
  assert.deepEqual(await source.search(query),[]);
  await assert.rejects(source.search({...query,page:1}),error);
});

test('MAL tile and table results retain cover, description and visible metadata', () => {
  const tile = parseBrowse({tiles:[{href:'/manga/123/title',title:'Title',info:['Manga, 2020','Publishing'],publishing:null,
    synopsis1:'Text',genres:['Action'],image:{dataSet:'/cover.jpg 1x, /cover2.jpg 2x'}}],rows:[]})[0];
  assert.equal(tile.coverUrl,'https://myanimelist.net/cover2.jpg');
  assert.equal(tile.status,'ongoing');
  assert.equal(tile.releaseYear,'2020');
  const table = parseBrowse({tiles:[],rows:[{link:card.link,description:'Short description',type:'Manga',rating:'8.7',image:{src:'/cover.jpg'}}]})[0];
  assert.equal(table.description,'Short description');
  assert.equal(table.rating,8.7);
  assert.equal(table.id,'123');
});

test('MAL catalogue requests a portrait thumbnail and preserves the CDN signature', () => {
  const src = 'https://cdn.myanimelist.net/r/150x170/images/manga/1/157897.jpg?s=f03b5f8bfeb0b0962b7d5e7cb9a8d0d3';
  const [item] = parseBrowse({tiles:[],rows:[{link:card.link,image:{dataSrc:src}}]});
  assert.equal(item.coverUrl,src.replace('/150x170/','/320x480/'));
  const full = src.replace('/r/150x170','');
  const [original] = parseBrowse({tiles:[],rows:[{link:card.link,image:{dataSrc:full}}]});
  assert.equal(original.coverUrl,full);
});

test('MAL genres cache is per context and count suffix is removed', async () => {
  let calls = 0;
  const ctx = context(() => {calls++; return 'HTML';},(_,projection) => {
    assert.equal(projection.selector,'[name="genre[]"]'); return [{value:'1',label:'Action (12,300)'},{value:'1',label:'Action'}];});
  const source = createMyAnimeList(ctx);
  assert.deepEqual((await source.getFilters())[3].options.map(value => [value.value,value.label]),[['1','Action']]);
  await source.getFilters(); assert.equal(calls,1);
  await source.getFilters({refresh:true}); assert.equal(calls,2);
  await createMyAnimeList(ctx).getFilters(); assert.equal(calls,3);
});

test('one title request supplies metadata and recommendations with either ID order', async () => {
  let calls = 0;
  const source = createMyAnimeList(context(input => {
    calls++;
    assert.equal(input.url,'https://myanimelist.net/manga/123');
    return 'HTML';
  }, () => ({...details,recommendations:[recommendation(123,123),recommendation(456,123),recommendation(123,456),
    recommendation(123,789),recommendation(12,34)]})));
  const mangaId = '123';
  assert.deepEqual((await source.getRecommendations({mangaId,page:2})).items,[]);
  assert.equal(calls,0);
  const [item,related] = await Promise.all([source.getDetails({mangaId}),source.getRecommendations({mangaId})]);
  assert.equal(item.author,'Writer, Both');
  assert.equal(item.artist,'Illustrator, Both');
  assert.equal(item.secondaryTitle,'原作');
  assert.equal(item.status,'completed');
  assert.equal(item.releaseYear,'2020');
  assert.deepEqual(item.tags,['Action','School']);
  assert.deepEqual(related.items.map(value => value.id),['456','789']);
  assert.equal(calls,1);
  assert.deepEqual(await source.getChapters(),[]);
  await assert.rejects(source.getPages(),{code:'parse_error'});
});
