import assert from "node:assert/strict";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
const repo=process.cwd().split(/[\\/]/).at(-1),url=process.argv[2],probe=process.argv.includes("--probe-ime");
assert.equal(new URL(url).hostname,"127.0.0.1","loopback only");
const modulePath=process.env.PLAYWRIGHT_MODULE??resolve("../output/playwright/implement-20261012/node_modules/playwright/index.mjs");
const {chromium}=await import(pathToFileURL(modulePath).href);
const output=resolve(repo==="light-route"?".qa/edge-20261013":"output/playwright/edge-20261013");
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:"C:/Program Files/Google/Chrome/Application/chrome.exe",headless:true,args:["--mute-audio"]});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:"reduce"});
const page=await context.newPage(),checks=[],faults=[];
page.on("pageerror",e=>faults.push(e.message));
page.on("console",msg=>{if(msg.type()==="error"&&!msg.text().includes("Failed to load resource"))faults.push(msg.text());});
let requests=0;
await context.route("https://web-lab-ranking.hyeongmin92.workers.dev/**",async route=>{
 requests++;await route.fulfill({status:503,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:'{"error":"service_unavailable"}'});
});
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push(name);};
const press=key=>page.keyboard.press(key);
const text=id=>page.locator("#"+id).textContent();
const privateKey={"echo-vault":"echo-vault-save-v1","neon-tactics":"neon-tactics-save-v2","parcel-panic":"parcel-panic-save-v2","light-route":"light-route-session-v1"}[repo];
const raw=()=>page.evaluate(key=>localStorage.getItem(key),privateKey);
async function reveal(selector){
 for(const details of await page.locator(selector).locator("xpath=ancestor::details").all()){
  if(!await details.evaluate(d=>d.open))await details.locator(":scope > summary").click();
 }
}
async function open(){await page.goto(url);if(repo==="neon-tactics")await page.locator("#welcome-tutorial").click();}
async function moveTo(x,y){
 const board=page.locator("#board"),cx=Number(await board.getAttribute("data-cursor-x")),cy=Number(await board.getAttribute("data-cursor-y"));
 for(let i=0;i<Math.abs(x-cx);i++)await press(x>cx?"ArrowRight":"ArrowLeft");
 for(let i=0;i<Math.abs(y-cy);i++)await press(y>cy?"ArrowDown":"ArrowUp");
}
async function ime(){
 await open();
 if(repo==="echo-vault"){await page.locator("#board").focus();await press("ArrowUp");}
 if(repo==="parcel-panic"){await page.locator('[data-tool="sorter"]').click();await page.locator("#place").click();await page.locator("#board").focus();}
 if(repo==="neon-tactics")await page.locator("#board").focus();
 if(repo==="light-route"){
  await page.locator("#seed").fill("qa-0");await page.locator("#apply-seed").click();
  const buttons=page.locator("#board button:not([disabled])"),labels=await buttons.evaluateAll(bs=>bs.map(b=>({piece:b.dataset.piece,label:b.getAttribute("aria-label")})));
  const pair=labels.flatMap(a=>labels.filter(b=>b!==a&&b.label.match(/^(\d+)행/)[1]===a.label.match(/^(\d+)행/)[1]&&Number(b.label.match(/행 (\d+)열/)[1])>Number(a.label.match(/행 (\d+)열/)[1])).map(b=>[a,b]))[0];
  assert(pair,"keyboard focus pair");await page.locator('[data-piece="'+pair[0].piece+'"]').focus();
 }
 const before=await raw(),focusBefore=await page.evaluate(()=>document.activeElement?.dataset.piece??null);
 const code={"echo-vault":"KeyR","neon-tactics":"KeyT","parcel-panic":"KeyE","light-route":"ArrowRight"}[repo];
 for(const variant of [{isComposing:true},{keyCode:229}]){
  await page.evaluate(({code,variant})=>document.activeElement.dispatchEvent(new KeyboardEvent("keydown",{bubbles:true,cancelable:true,code,key:code==="ArrowRight"?"ArrowRight":code.slice(-1).toLowerCase(),...variant})),{code,variant});
  check("IME composition must preserve private run",await raw(),before);
  check("IME composition must preserve focus",await page.evaluate(()=>document.activeElement?.dataset.piece??null),focusBefore);
 }
}
async function primary(){
 if(repo==="echo-vault"){
  const prior=await raw();await page.locator("#clear").click();await page.locator('[data-close="clear-dialog"]').last().click();check("cancel clear preserves run",await raw(),prior);
  // Reuse the existing tutorial regression through the same actual UI.
  const old=await readFile("tools/ui-regression.cjs","utf8");await (0,eval)("("+old+")")(page);
  check("intro real score",(await text("result-numbers")).includes("2730"),true);
  await page.locator("#result-close").click();await page.reload();await page.locator("#resume").click();
  check("resume terminal is visible",await page.locator("#result-overlay").isVisible(),true);await page.locator("#result-close").click();
  await page.locator("#retry").click();await page.locator("#hint").click();await page.locator("#board").focus();await press("ArrowRight");await press("z");
  check("undo does not erase hint",JSON.parse(await raw()).current.hints,1);
  await page.locator("#advanced").click();
  const {solve}=await import("../tools/witnesses.mjs");const w=solve(13);
  for(let i=0;i<w.legs.length;i++){
   await page.locator("#board").focus();for(const action of w.legs[i])await press({up:"ArrowUp",down:"ArrowDown",left:"ArrowLeft",right:"ArrowRight",wait:"Space"}[action]);
   if(i<w.legs.length-1)await page.locator("#record").click();
  }
  check("relay 13 actual completion",await text("result-title"),"탈출 성공");check("relay actual score",(await text("result-numbers")).includes("2260"),true);
  await page.locator("#result-close").click();const ended=await raw();await page.locator("#board").focus();await press("ArrowRight");check("late terminal input frozen",await raw(),ended);
 }
 if(repo==="neon-tactics"){
  const old=await readFile("tools/ui-regression.cjs","utf8");await (0,eval)("("+old+")")(page);await page.locator("#result-close").click();
  const before=await raw();await page.locator("#clear-records").click();await page.locator('[data-close="clear-dialog"]').last().click();check("cancel clear preserves run",await raw(),before);
  await page.locator("#restart").click();await page.locator("#board").focus();await press("e");await press("ArrowUp");const ap=await text("ap");await press("Escape");check("cancel target preserves AP",await text("ap"),ap);
  const rankedPractice=await raw();await page.locator("#campaign").click();await page.locator("#start-ranked").click();check("ranked hint locked",await page.locator("#hint").isDisabled(),true);
  const {objectiveWitnesses}=await import("../tools/objective-witnesses.mjs");
  for(const c of objectiveWitnesses.find(w=>w.id===16).path){
   if(c.type==="end"){await page.locator("#board").focus();await press("t");continue;}
   await page.locator('[data-unit="'+c.unitId+'"]').click();await page.locator(c.type==="skill"?"#skill-mode":"#move-mode").click();await moveTo(c.x,c.y);await press("Enter");
  }
  check("ranked actual completion",await text("result-title"),"임무 완료");check("ranked actual score",(await text("result-numbers")).includes("4280"),true);
  check("ranked preserves practice save",await raw(),rankedPractice);await page.locator("#result-close").click();
  await page.locator("#public-ranking > details > summary").click();await page.getByRole("button",{name:"순위 보기",exact:true}).click();
  await page.locator(".ranking-status").filter({hasText:"연결할 수 없습니다"}).waitFor();
  check("ranking failure preserves practice",await raw(),rankedPractice);check("ranking failure enables retry",await page.getByRole("button",{name:"순위 보기",exact:true}).isEnabled(),true);
 }
 if(repo==="parcel-panic"){
  await page.locator('[data-tool="sorter"]').click();await page.locator('[data-direction="0"]').click();await page.locator("#place").click();
  const design=await raw();await page.locator("#undo").click();await page.locator("#redo").click();check("undo redo restores blueprint",await raw(),design);
  await reveal("#delete-save");await page.locator("#delete-save").click();check("cancel delete preserves design",await raw(),design);
  await page.locator("#board").focus();await press("p");await page.waitForTimeout(550);await press("Escape");const time=await text("clock");await page.waitForTimeout(500);check("pause freezes real scheduler",await text("clock"),time);
  await page.locator("#reset").click();for(let i=0;i<15;i++)await page.locator("#step").click();
  check("tutorial actual delivery",await text("delivered"),"2 / 2");check("tutorial actual tick",await text("clock"),"15박자");
  await page.locator("#result-close").click();await page.locator("#restore").click();check("restore returns blueprint",await text("phase"),"설계");
  await page.locator("#campaign").click();await page.locator('[data-level="13"]').click();
  const {advancedWitnesses}=await import("../tools/advanced-witnesses.mjs");
  for(const c of advancedWitnesses.find(w=>w.id===13).machines){
   await page.locator('[data-tool="'+c.type+'"]').click();await page.locator('[data-direction="'+c.dir+'"]').click();await page.locator("#board").focus();await moveTo(c.x,c.y);await press("Space");
  }
  for(let i=0;i<83;i++)await page.locator("#step").click();
  check("contract 13 actual delivery",await text("delivered"),"12 / 12");check("contract 13 actual tick",await text("clock"),"83박자");
  await page.locator("#result-close").click();const terminal=await text("clock");await page.locator("#board").focus();await press("p");check("late start frozen",await text("clock"),terminal);
  await page.locator("#public-ranking > details > summary").click();await page.getByRole("button",{name:"순위 보기",exact:true}).click();await page.locator(".ranking-status").filter({hasText:"연결할 수 없습니다"}).waitFor();
  check("ranking failure enables retry",await page.getByRole("button",{name:"순위 보기",exact:true}).isEnabled(),true);
 }
 if(repo==="light-route"){
  await page.locator("#seed").fill("qa-0");await page.locator("#apply-seed").click();await page.locator("#mode").selectOption("limited");await page.locator('[data-stage="18"]').click();
  const {createRun,challengePlan}=await import("../dist/src/session.js"),run=createRun(18,"qa-0","limited"),plan=challengePlan(run.puzzle);
  const cell=i=>page.locator('[data-piece="'+i+'"]');await cell(plan.rotations[0]).focus();await press("Space");check("keyboard rotation focus retained",await page.evaluate(()=>document.activeElement?.dataset.piece),String(plan.rotations[0]));
  await page.reload();await page.locator("#continue").click();check("restore exact moves",await text("moves"),"01");
  const before=await raw();await reveal("#clear");await page.locator("#clear").click();check("cancel delete preserves run",await raw(),before);
  for(const i of plan.rotations.slice(1))await cell(i).click();
  check("limited actual result",await page.locator("#result").isVisible(),true);check("limited actual score",(await page.locator("#result").textContent()).includes("835"),true);
  check("terminal board locked",await page.locator("#board button:not([disabled])").count(),0);
  await page.locator("#reset").click();const decoy=run.pieces.findIndex(p=>p.decoy);
  for(let i=0;i<plan.budget;i++)await cell(decoy).click();
  check("budget exhaustion locks hint",await page.locator("#hint").isDisabled(),true);check("budget failure earns no new result",await page.locator("#result").isVisible(),false);
  await page.locator("#reset").click();await page.locator("#seed").fill("<bad>");await page.locator("#apply-seed").click();check("invalid code preserves moves",await text("moves"),"00");check("invalid code visible", (await text("notice")).includes("1–40"),true);
 }
}
async function negativeStorage(){
 const second=await context.newPage();const faults2=[];second.on("pageerror",e=>faults2.push(e.message));
 await second.addInitScript(({privateKey})=>{localStorage.setItem(privateKey,"{");localStorage.setItem("edge-other-app","preserve");},{privateKey});
 await second.goto(url);check("corrupt import retains raw",await second.evaluate(k=>localStorage.getItem(k),privateKey),"{");check("corrupt load does not delete sibling",await second.evaluate(()=>localStorage.getItem("edge-other-app")),"preserve");
 await second.close();
 const denied=await browser.newContext({viewport:{width:390,height:900}}),p=await denied.newPage();p.on("pageerror",e=>faults2.push(e.message));
 await denied.route("https://web-lab-ranking.hyeongmin92.workers.dev/**",route=>route.abort());
 await denied.addInitScript(()=>{Storage.prototype.setItem=function(){throw new DOMException("fixture quota","QuotaExceededError");};});
 await p.goto(url);
 if(repo==="echo-vault"){await p.locator("#board").focus();await p.keyboard.press("ArrowUp");check("quota gameplay continues",await p.locator("#beat-count").textContent(),"1 / 60박자");}
 if(repo==="neon-tactics"){await p.locator("#welcome-tutorial").click();await p.locator("#board").focus();await p.keyboard.press("t");check("quota end turn continues",(await p.locator("#status").textContent()).length>0,true);}
 if(repo==="parcel-panic"){await p.locator('[data-tool="sorter"]').click();await p.locator("#place").click();check("quota placement continues",(await p.locator("#budget").textContent()).includes("10"),true);}
 if(repo==="light-route"){await p.locator("#seed").fill("qa-0");await p.locator("#apply-seed").click();await p.locator("#board button:not([disabled])").first().click();check("quota rotation continues",await p.locator("#moves").textContent(),"01");}
 const notice=await p.locator(repo==="light-route"?"#notice":"#save-status").textContent();check("quota is visible",/저장/.test(notice),true);
 await denied.close();check("negative contexts pageerrors",faults2,[]);
}
let result;
try{
 page.on("dialog",dialog=>dialog.dismiss());await ime();
 if(!probe){
  await primary();check("no unsolicited ranking requests",requests,["neon-tactics","parcel-panic"].includes(repo)?1:0);
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:width===1440?1000:900});
   if(repo==="echo-vault"){
    await page.locator("#retry").click();await page.locator('[data-move="up"]').click();await page.locator("#undo").click();
    check("pad and undo "+width,await text("beat-count"),"0 / 60박자");
   }else if(repo==="neon-tactics"){
    await page.locator("#restart").click();await page.locator("#board").focus();await press("ArrowRight");await press("Escape");
    check("keyboard target cancel "+width,await page.locator("#confirm").isDisabled(),true);
   }else if(repo==="parcel-panic"){
    await page.locator("#reset").click();await page.locator('[data-cursor="right"]').click();
    check("mobile pad usable "+width,await page.locator("#place").isEnabled(),true);
   }else{
    await page.locator("#reset").click();await page.locator("#board button:not([disabled])").first().focus();await press("Space");await page.locator("#undo").click();
    check("keyboard and undo "+width,await text("moves"),"02");
   }
   check("document fits "+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:resolve(output,"view-"+width+".png"),fullPage:true});
  }
  await negativeStorage();
 }
 check("pageerrors",faults,[]);result={status:"PASS",repo,checks,requests,synthetic:probe?["IME KeyboardEvent and 229"]:["IME KeyboardEvent and 229","quota exception","corrupt local payload",...(requests?["intercepted ranking 503"]:[])],limitations:["one Chrome engine","no physical touch","no all-seed/all-campaign browser enumeration","no remote CI or live API"]};
 console.log(JSON.stringify(result));
}catch(error){result={status:"FAIL",repo,checks,failure:error.message};console.error(JSON.stringify(result));process.exitCode=1;}
finally{await writeFile(resolve(output,probe?"ime-result.json":"browser-result.json"),JSON.stringify(result,null,2));await browser.close();}
