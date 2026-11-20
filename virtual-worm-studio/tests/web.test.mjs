import test from 'node:test';
import assert from 'node:assert/strict';
import {exportFilename,embedViewInPng,readSavedView} from '../web/view-files.js';
import {matchNames} from '../web/selection.js';

test('cross-platform export names',()=>{
 assert.equal(exportFilename('Figure 2.png','glb'),'Figure 2.glb');
 for(const value of ['CON','nul.csv','LPT1','a?b','a*b','a|b','a<b','a/b','.hidden'])assert.throws(()=>exportFilename(value,'png'));
});
test('PNG saves nested outline assignments and per-cell colors',()=>{
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=','base64'));
 const state={version:3,names:['Cuticle','Intestine','Pharynx'],colors:{Intestine:'ff2600'},lineArt:{enabled:true,names:['Cuticle'],color:'#243a3d',width:1.5}};
 assert.deepEqual(readSavedView(embedViewInPng(png,state)),state);
 assert.throws(()=>readSavedView(png),/no saved-view data/);
});
test('name columns and comma/colon lists',()=>{
 const objects=['Cuticle','Intestine','Pharynx'].map(name=>({name}));
 const result=matchNames('cuticle, Intestine:\nPharynx',objects);
 assert.deepEqual(result.found,['Cuticle','Intestine','Pharynx']);assert.deepEqual(result.missing,[]);
});
