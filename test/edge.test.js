import test from "node:test";
import assert from "node:assert/strict";
import {createRun,applyAction,challengePlan,snapshotRun,restoreRun,emptyStore,rememberRun,normalizeStore,MAX_UNDO} from "../dist/src/session.js";
import {writeStore,readStore,SESSION_KEY,clearStore} from "../dist/src/storage.js";

test("edge: seed min/max trimming and type boundaries retain deterministic board",()=>{
 for(const seed of ["a","a".repeat(40)])assert.deepEqual(createRun(1,seed).puzzle,createRun(1," "+seed+" ").puzzle);
 for(const seed of ["","a".repeat(41),NaN,Infinity,null,{},["a"]])assert.throws(()=>createRun(1,seed));
});
test("edge: rotation index type boundaries reject without mutating run",()=>{
 const run=createRun(18,"edge-index"),before=structuredClone(run);
 for(const index of [-1,run.pieces.length,0.5,NaN,Infinity,-Infinity,"0",null,[],{}]){
  assert.throws(()=>applyAction(run,{type:"rotate",index}));assert.deepEqual(run,before);
 }
});
test("edge: exact undo retention can drain to empty without erasing hint costs",()=>{
 let run=createRun(1,"edge-undo"),index=run.pieces.findIndex(p=>p.decoy);
 for(let i=0;i<MAX_UNDO+1;i++)run=applyAction(run,{type:"rotate",index});
 run=applyAction(run,{type:"hint"});
 for(let i=0;i<MAX_UNDO;i++)run=applyAction(run,{type:"undo"});
 assert.equal(run.history.length,0);assert.equal(run.moves,513);assert.equal(run.hints,1);
 assert.equal(run.pieces[index].turn,1-run.puzzle.pieces[index].turn);
 assert.deepEqual(restoreRun(snapshotRun(run)),run);assert.throws(()=>applyAction(run,{type:"undo"}));
});
test("edge: corrupt last and achievement do not erase other valid records",()=>{
 let done=createRun(1,"edge-retain");
 for(const index of challengePlan(done.puzzle).rotations)done=applyAction(done,{type:"rotate",index});
 const good=snapshotRun(done),bad={...good,moves:good.moves+1};
 const store=normalizeStore({...emptyStore(),last:bad,records:[bad,good]});
 assert.equal(store.last,null);assert.deepEqual(store.records,[good]);
 const again=rememberRun(store,done);assert.equal(again.records.length,1);
});
test("edge: malformed replay type and terminal trailing action preserve source snapshot",()=>{
 let run=createRun(1,"edge-terminal");
 for(const index of challengePlan(run.puzzle).rotations)run=applyAction(run,{type:"rotate",index});
 const saved=snapshotRun(run),before=structuredClone(saved);
 for(const action of [null,0,[],{type:"hint"},{type:"undo"},{type:"rotate",index:0}])assert.throws(()=>restoreRun({...saved,actions:[...saved.actions,action]}));
 assert.deepEqual(saved,before);
});
test("edge: private write must confirm readback before claiming durability",()=>{
 const store=emptyStore(),before=structuredClone(store);
 for(const getItem of [()=>null,()=>"older",()=>{throw Error("read denied");}]){
  assert.equal(writeStore(store,{setItem(){},getItem}),false,"unconfirmed private write must fail");
 }
 assert.deepEqual(store,before);
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)??null,removeItem:k=>values.delete(k)};
 values.set("echo-vault-save-v1","keep");assert.equal(writeStore(store,storage),true);assert.deepEqual(readStore(storage),store);
 assert.equal(clearStore(storage),true);assert.equal(values.get(SESSION_KEY),undefined);assert.equal(values.get("echo-vault-save-v1"),"keep");
});
