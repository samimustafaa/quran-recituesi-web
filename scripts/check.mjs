import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizePage, spreadFor, adjacentPage, groupPageLines, pageTurnJourney, journeyTurnDuration} from '../dist/reader-core.js';
import {paintOpeningPage} from '../dist/opening-page.js';
import {surahMeanings, normalizeSearch} from '../dist/surah-names.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root,'dist',p),'utf8'));
const chapters = read('data/chapters.json');
const index = read('data/index.json');
const provenance = read('data/provenance.json');
const openingText=[];
const drawing={fillRect(){},strokeRect(){},save(){},restore(){},translate(){},rotate(){},measureText(text){return {width:text.length*40};},fillText(text){openingText.push({text,font:this.font});}};
const firstPage=read('data/1.json');
paintOpeningPage(drawing,firstPage,'QuranPage1',chapters);
assert.deepEqual(openingText.filter(item=>item.font.includes('QuranPage1')).flatMap(item=>item.text.split(' ')),firstPage.verses.flatMap(verse=>verse.words.map(word=>word[1])),'Opening-book texture must include every first-page glyph exactly once and in source order');
assert.ok(openingText.some(item=>item.text==='سورة '+chapters[0].name_arabic),'Opening-book texture must identify Al-Fatihah');
assert.equal(chapters.length,114); assert.equal(index.length,604); assert.equal(provenance.verses,6236);
assert.equal(surahMeanings.length,114,'Every Surah needs an Albanian interface label');
assert.ok(surahMeanings.every(name=>typeof name==='string'&&name.trim()));
assert.equal(normalizeSearch('KËSHILLIMI'),normalizeSearch('keshillimi'),'Albanian search should work without typing accents');
assert.equal(normalizeSearch('ÇARJA'),normalizeSearch('carja'));
const verseMap = new Map();
for (let p=1;p<=604;p++) {
  const data=read(`data/${p}.json`); assert.equal(data.page,p); assert.ok(data.verses.length);
  const lines=groupPageLines(data,chapters);
  assert.ok(lines.length<=15);
  assert.equal(lines.flatMap(l=>l.words).length,data.verses.flatMap(v=>v.words).length,`Lost words on page ${p}`);
  if (p<=32) { const font=fs.readFileSync(path.join(root,`dist/assets/fonts/p${p}.woff2`));assert.equal(font.subarray(0,4).toString(),'wOF2'); }
  for(const verse of data.verses){if(verseMap.has(verse.key))assert.equal(verseMap.get(verse.key),verse.text);verseMap.set(verse.key,verse.text);}
  assert.deepEqual(spreadFor(p,true),[null,p]);
  const [left,right]=spreadFor(p,false); assert.ok(left>=1&&left<=604); assert.ok(right>=1&&right<=604); assert.equal(left,right+1); assert.equal(right%2,1);
  assert.ok(adjacentPage(p,true,1)<=604);assert.ok(adjacentPage(p,true,-1)>=1);
}
assert.equal(verseMap.size,6236);
for(const chapter of chapters){for(let ayah=1;ayah<=chapter.verses_count;ayah++)assert.ok(verseMap.has(`${chapter.id}:${ayah}`));}
const lastLines=groupPageLines(read('data/604.json'),chapters);
assert.equal(lastLines.filter(l=>l.type==='surah').length,3);
assert.equal(groupPageLines(read('data/187.json'),chapters).filter(l=>l.type==='bismillah').length,0,'Do not add Bismillah to At-Tawbah');
assert.equal(normalizePage(NaN),1); assert.equal(normalizePage(999),604);assert.equal(normalizePage(-1),1);
assert.deepEqual(spreadFor(604,false),[604,603]);
assert.deepEqual(spreadFor(adjacentPage(603,false,1),false),[604,603]);
for (const mobile of [false, true]) {
  for (const [from,to] of [[1,604],[604,1],[42,77],[77,42],[1,2],[2,1],[603,604],[604,603],[100,100]]) {
    const steps=pageTurnJourney(from,to,mobile);
    assert.ok(steps.length<=8);
    const start=spreadFor(from,mobile)[1],end=spreadFor(to,mobile)[1];
    if (start===end) assert.deepEqual(steps,[]);
    else {
      assert.equal(steps.at(-1),to);
      let previous=start;
      for(const page of steps){assert.ok(page>=1&&page<=604);const right=spreadFor(page,mobile)[1];assert.ok((right-previous)*(end-start)>0,'Jump must move strictly toward its destination');previous=right;}
      assert.ok(steps.reduce((sum,_,i)=>sum+journeyTurnDuration(i,steps.length),0)<=1250,'Long jumps must finish their animation within 1.25 seconds');
    }
  }
}
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
assert.ok(html.includes('<html lang="sq">'),'The interface language must be Albanian');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'Duplicate HTML ids');
for(const match of html.matchAll(/(?:src|href)="(\/(?!\/)[^"#]+)"/g))assert.ok(fs.existsSync(path.join(root,'dist',match[1])),`Missing asset ${match[1]}`);
console.log('Passed: 604 complete pages, 114 Surahs, 6,236 verses, no dropped words, bundled page fonts, Surah headings, At-Tawbah, RTL navigation and local assets.');
