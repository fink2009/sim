// main.js - prototype
// Classes: Game, Player, MapGrid, EventManager, SimpleAI, MiniGames, UI, AudioSynth, DayCycle
// This is the updated single-file prototype with DayCycle and period choices (non-violent satirical actions).

class Utils {
  static randInt(a,b){return Math.floor(Math.random()*(b-a+1))+a}
  static choice(arr){return arr[Math.floor(Math.random()*arr.length)]}
}

// ---------- Player ----------
class Player {
  constructor(){
    this.name = "High Director";
    this.propaganda = 50;
    this.military = 30;
    this.economy = 40;
    this.morale = 50;
    this.day = 1;
    this.score = 0;
  }
}

// ---------- Map ----------
class MapGrid {
  constructor(cols, rows, tileSize){
    this.cols = cols; this.rows = rows; this.tileSize = tileSize;
    this.tiles = new Array(rows);
    for(let y=0;y<rows;y++){ 
      this.tiles[y]=new Array(cols);
      for(let x=0;x<cols;x++){
        this.tiles[y][x]=this.randomTile(x,y);
      }
    }
    this.controlled = new Set();
    for(let i=0;i<10;i++){
      let x=Utils.randInt(0,cols-1), y=Utils.randInt(0,rows-1);
      this.controlled.add(`${x},${y}`);
    }
  }
  randomTile(x,y){
    let r = Math.random();
    if(r<0.12) return {type:'mountain',color:'#4b4b4b'};
    if(r<0.45) return {type:'field',color:'#6b8f3a'};
    if(r<0.65) return {type:'village',color:'#c2a35b',pop:Utils.randInt(20,80)};
    return {type:'city',color:'#a58fb5',pop:Utils.randInt(80,220)};
  }
  isControlled(x,y){ return this.controlled.has(`${x},${y}`) }
  setControlled(x,y,flag){
    if(flag) this.controlled.add(`${x},${y}`); else this.controlled.delete(`${x},${y}`);
  }
}

// ---------- Events ----------
class EventManager {
  constructor(game){
    this.game=game;
    this.pool = this.defaultPool();
  }
  defaultPool(){
    return [
      {id:'speech', text:"Hold a grand speech to boost morale. Cost: propaganda 8", choices:[
        {t:"Inspire speech",effects:{propaganda:-8,morale:+12}},
        {t:"Blunt speech (safer)",effects:{propaganda:-4,morale:+5}}
      ]},
      {id:'conscription', text:"Enforce conscription to raise troops. Cost: economy 10", choices:[
        {t:"Full conscription",effects:{economy:-10,military:+15,morale:-6}},
        {t:"Volunteer push",effects:{economy:-4,military:+6,morale:+1}}
      ]},
      {id:'spy', text:"Launch espionage to sabotage rivals. Cost: propaganda 6", choices:[
        {t:"High-risk sabotage",effects:{propaganda:-6,military:+4,territory:+1}},
        {t:"Disinformation campaign",effects:{propaganda:-6,morale:-3,economy:+2}}
      ]},
      {id:'fete', text:"Organize a ridiculous holiday parade to distract people.", choices:[
        {t:"Lavish pageant",effects:{economy:-8,morale:+10,propaganda:-2}},
        {t:"Small spectacle",effects:{economy:-3,morale:+4}}
      ]}
    ]
  }
  drawEvent(){
    if(Math.random()<0.5) return null;
    return Utils.choice(this.pool);
  }
  applyChoice(choice){
    let p = this.game.player;
    for(let k in choice.effects){
      if(k==='territory'){
        if(choice.effects[k]>0){
          let mg=this.game.map;
          let attempts=100;
          while(attempts--){
            let x=Utils.randInt(0,mg.cols-1), y=Utils.randInt(0,mg.rows-1);
            if(!mg.isControlled(x,y) && mg.tiles[y][x].type!=='mountain'){  
              mg.setControlled(x,y,true);
              break;
            }
          }
        } else {
          let arr = Array.from(this.game.map.controlled);
          if(arr.length>0){
            let pick = Utils.choice(arr);
            this.game.map.controlled.delete(pick);
          }
        }
      } else {
        p[k] = Math.max(0, p[k] + choice.effects[k]);
      }
    }
  }
}

// ---------- Simple AI (NPCs) ----------
class SimpleAI {
  constructor(game){
    this.game=game;
    this.npcs = [];
    this.spawnInitial();
  }
  spawnInitial(){
    for(let i=0;i<12;i++) this.spawn();
  }
  spawn(){
    let mg=this.game.map;
    let x=Utils.randInt(0,mg.cols-1), y=Utils.randInt(0,mg.rows-1);
    this.npcs.push({x,y,loyal: Math.random()>0.35,wait:Utils.randInt(0,100)});
  }
  update(){
    let mg=this.game.map;
    for(let n of this.npcs){
      if(Math.random()<0.02){ n.loyal = !n.loyal }
      if(--n.wait>0) continue;
      n.wait = Utils.randInt(20,80);
      let dx = Utils.randInt(-1,1), dy = Utils.randInt(-1,1);
      n.x = Math.min(mg.cols-1, Math.max(0,n.x+dx));
      n.y = Math.min(mg.rows-1, Math.max(0,n.y+dy));
      if(!n.loyal && mg.isControlled(n.x,n.y) && Math.random()<0.08){
        mg.setControlled(n.x,n.y,false);
        this.game.player.morale = Math.max(0,this.game.player.morale - 3);
      } else if(n.loyal && !mg.isControlled(n.x,n.y) && Math.random()<0.06){
        mg.setControlled(n.x,n.y,true);
      }
    }
    if(this.npcs.length < 20 && Math.random() < 0.02) this.spawn();
  }
}

// ---------- MiniGames ----------
class MiniGames {
  constructor(game){
    this.game = game;
    this.active = null;
    this.resolve = null;
    this.state = {};
  }

  startRally(){
    this.active = 'rally';
    this.state = {pos:0,dir:1,greenStart:0.45,greenEnd:0.65,elapsed:0};
    return new Promise(res => { this.resolve=res });
  }

  startEspionage(){
    this.active = 'espionage';
    let len = 3 + Math.floor(this.game.player.day/5);
    let seq = [];
    for(let i=0;i<len;i++) seq.push(Utils.randInt(0,3));
    this.state = {seq, stage:0, showTimer:120, phase:'show'};
    return new Promise(res => { this.resolve=res });
  }

  update(){
    if(!this.active) return;
    if(this.active==='rally'){
      let s=this.state; s.pos+=s.dir*0.02; if(s.pos>1){s.pos=1;s.dir=-1}else if(s.pos<0){s.pos=0;s.dir=1}
      s.elapsed++;
      if(s.elapsed>600){ this.resolve({success:false,reason:'timeout'}); this.active=null; }
    } else if(this.active==='espionage){
      let s=this.state; if(s.phase==='show'){ if(--s.showTimer<=0) s.phase='play' }
    }
  }

  onKey(e){
    if(!this.active) return;
    if(this.active==='rally' && e.code==='Space'){  
      let pos = this.state.pos;  
      let ok = pos>=this.state.greenStart && pos<=this.state.greenEnd;
      this.resolve({success:ok,precision:1 - Math.abs((this.state.greenStart+this.state.greenEnd)/2 - pos)});
      this.active=null;
    }
  }

  onClickTile(idx){
    if(this.active!=='espionage') return;
    let s=this.state; if(s.phase!=='play') return;
    if(idx===s.seq[s.stage]){ s.stage++; if(s.stage>=s.seq.length){ this.resolve({success:true}); this.active=null; } }
    else { this.resolve({success:false}); this.active=null; }
  }

  render(ctx, x, y, w, h){
    ctx.save(); ctx.translate(x,y); ctx.fillStyle="#080808"; ctx.fillRect(0,0,w,h);
    ctx.fillStyle="#fff"; ctx.font="12px monospace";
    if(this.active==='rally'){
      let s=this.state; ctx.fillStyle="#222"; ctx.fillRect(20,20,w-40,24);
      let gs = 20 + (w-40)*s.greenStart, ge = 20 + (w-40)*s.greenEnd; ctx.fillStyle="#2ecc71"; ctx.fillRect(gs,20,ge-gs,24);
      ctx.fillStyle="#f39c12"; ctx.fillRect(20 + s.pos*(w-40)-6,14,12,36);
      ctx.fillStyle="#fff"; ctx.fillText("Press Space to stop the meter in the green zone",20,70);
    } else if(this.active==='espionage'){
      let s=this.state; ctx.fillStyle="#fff"; ctx.fillText("Espionage sequence:",10,18);
      if(s.phase==='show'){ ctx.fillStyle="#ffcc00"; ctx.fillText(s.seq.map(_=>'▢').join(' '),10,40); ctx.fillStyle="#999"; ctx.fillText("Memorize the pattern...",10,60); }
      else { for(let i=0;i<4;i++){ ctx.fillStyle="#333"; ctx.fillRect(10 + i*40,30,32,32); ctx.fillStyle="#fff"; ctx.fillText(i+1,22 + i*40,52); } ctx.fillStyle="#999"; ctx.fillText("Click tiles in order (1-4) on the map",10,80); }
    }
    ctx.restore();
  }
}

// ---------- DayCycle (new) ----------
class DayCycle {
  constructor(game){ this.game = game; this.periods = ['Morning','Afternoon','Evening']; this.idx = 0; this.currentChoices = []; }

  startNewDay(){ this.idx = 0; this.generateChoicesForPeriod(); }
  currentPeriod(){ return this.periods[this.idx]; }

  generateChoicesForPeriod(){
    const period = this.currentPeriod();
    const morningChoices = [
      { t: "Give an optimistic broadcast (big speech)", effects:{propaganda:-8, morale:+12} },
      { t: "Launch a job-incentive program", effects:{economy:-6, morale:+6} },
      { t: "Initiate a bureaucratic audit (symbolic surveillance)", effects:{propaganda:+6, morale:-4} }
    ];
    const afternoonChoices = [
      { t: "Host diplomatic talks with neighbors", effects:{economy:+4, territory:+0} },
      { t: "Hold a symbolic military parade", effects:{military:+8, economy:-5, morale:+3} },
      { t: "Fund a cultural festival", effects:{economy:-4, morale:+8} }
    ];
    const eveningChoices = [
      { t: "Propose a referendum (symbolic annexation via vote)", effects:{propaganda:-4, territory:+1, morale:+2} },
      { t: "Negotiate a trade pact", effects:{economy:+8, propaganda:-2} },
      { t: "Issue a bureaucratic reshuffle (replace ministers)", effects:{propaganda:+2, morale:-2} }
    ];
    if(period==='Morning') this.currentChoices = morningChoices;
    else if(period==='Afternoon') this.currentChoices = afternoonChoices;
    else this.currentChoices = eveningChoices;
  }

  applyChoice(index){
    const choice = this.currentChoices[index]; if(!choice) return;
    this.game.events.applyChoice({ effects: choice.effects });
    // hook into minigames for certain actions
    if(choice.t.toLowerCase().includes('broadcast') && Math.random()<0.6){
      this.game.minigames.startRally().then(res=>{ if(res.success){ this.game.player.morale = Math.min(100,this.game.player.morale+8); } else { this.game.player.morale = Math.max(0,this.game.player.morale-6); } });
    }
    if(choice.t.toLowerCase().includes('espionage') && Math.random()<0.6){
      this.game.minigames.startEspionage().then(res=>{ if(res.success){ this.game.player.military += 6; } else { this.game.player.propaganda = Math.max(0,this.game.player.propaganda - 4); } });
    }
    this.nextPeriod();
  }

  nextPeriod(){ this.idx++; if(this.idx >= this.periods.length){ this.endDay(); this.startNewDay(); } else { this.generateChoicesForPeriod(); } }

  endDay(){
    const p = this.game.player;
    // daily upkeep cost tied to territory (symbolic)
    p.economy = Math.max(0, p.economy - Math.floor(this.game.map.controlled.size / 6));
    // minor random drift
    p.propaganda = Math.max(0, p.propaganda + Utils.randInt(-2,2));
    p.military = Math.max(0, p.military + Utils.randInt(-1,1));
    p.morale = Math.max(0, Math.min(100, p.morale + Utils.randInt(-2,2)));
    // update score and advance day counter
    p.score = Math.round((p.propaganda + p.military + p.economy + p.morale) * this.game.map.controlled.size / Math.max(1,p.day));
    p.day += 1;
  }
}

// ---------- UI (Canvas rendering only) ----------
class UI {
  constructor(game){ this.game = game; this.canvas = game.canvas; this.ctx = game.ctx; this.ctx.font = "12px monospace"; }
  render(){
    const ctx = this.ctx, g = this.game; ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    const mg = g.map, ts = mg.tileSize;
    for(let y=0;y<mg.rows;y++){
      for(let x=0;x<mg.cols;x++){
        let t = mg.tiles[y][x]; ctx.fillStyle = t.color; ctx.fillRect(x*ts, y*ts, ts, ts);
        if(mg.isControlled(x,y)){ ctx.strokeStyle = "#fffb99"; ctx.lineWidth=2; ctx.strokeRect(x*ts+2, y*ts+2, ts-4, ts-4); }
        if(t.type==='city'){ ctx.fillStyle="#2b2b2b"; ctx.fillRect(x*ts+ts/4, y*ts+ts/4, ts/2, ts/2); }
        else if(t.type==='village'){ ctx.fillStyle="#523515"; ctx.fillRect(x*ts+ts/3, y*ts+ts/3, ts/3, ts/3); }
      }
    }
    for(let n of g.ai.npcs){ ctx.fillStyle = n.loyal ? "#2ecc71" : "#e74c3c"; ctx.fillRect(n.x*ts + ts/3, n.y*ts + ts/3, ts/3, ts/3); }
    ctx.save(); ctx.fillStyle="#000"; ctx.globalAlpha=0.35; ctx.fillRect(0, this.canvas.height-56, this.canvas.width,56); ctx.globalAlpha=1; ctx.fillStyle="#fff";
    let p = g.player; ctx.fillText(`Day ${p.day}`, 8, this.canvas.height-36); ctx.fillText(`Propaganda: ${p.propaganda}`, 8, this.canvas.height-20);
    ctx.fillText(`Military: ${p.military}`, 170, this.canvas.height-36); ctx.fillText(`Economy: ${p.economy}`, 170, this.canvas.height-20);
    ctx.fillText(`Morale: ${p.morale}`, 340, this.canvas.height-36); ctx.fillText(`Territory: ${g.map.controlled.size}`, 340, this.canvas.height-20);
    ctx.restore();
    if(g.minigames.active){ g.minigames.render(this.ctx, 8,8,380,100); }
  }
}

// ---------- Audio (tiny synth) ----------
class AudioSynth { constructor(){ try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){ this.ctx = null } }
  beep(freq=440,duration=0.1, type='sine'){ if(!this.ctx) return; let o = this.ctx.createOscillator(); let g = this.ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = 0.0001; o.connect(g); g.connect(this.ctx.destination); let now = this.ctx.currentTime; g.gain.setTargetAtTime(0.12, now, 0.01); o.start(now); o.frequency.setValueAtTime(freq, now); g.gain.exponentialRampToValueAtTime(0.001, now + duration); o.stop(now + duration + 0.02); }
}

// ---------- Game ----------
class Game {
  constructor(canvas){
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.player = new Player(); this.map = new MapGrid(16,12,32);
    this.events = new EventManager(this); this.ai = new SimpleAI(this); this.minigames = new MiniGames(this); this.ui = new UI(this);
    this.dayCycle = new DayCycle(this); this.dayCycle.startNewDay();
    this.running = false; this._bind(); this.eventCurrent = null; this.lastEvent = null; this.sfx = new AudioSynth();
  }

  _bind(){ window.addEventListener('keydown', (e)=>{ this.minigames.onKey(e) }); this.canvas.addEventListener('click', (ev)=>{ if(this.minigames.active==='espionage'){ let rect = this.canvas.getBoundingClientRect(); let x = Math.floor((ev.clientX-rect.left)/this.map.tileSize); let zone = (x % 4); this.minigames.onClickTile(zone); } }); }

  start(){ this.running=true; this.loop(); }
  loop(){ if(!this.running) return; this.update(); this.ui.render(); requestAnimationFrame(()=>this.loop()); }
  update(){ this.ai.update(); this.minigames.update(); }

  advanceDay(){ // keep for compatibility: end current day and start new
    this.dayCycle.endDay(); this.dayCycle.startNewDay(); this.sfx.beep(220,0.05); this.checkFailure();
  }

  chooseEvent(choiceIndex){ if(!this.eventCurrent) return; let choice = this.eventCurrent.choices[choiceIndex]; this.events.applyChoice(choice); if(this.eventCurrent.id==='speech' && Math.random()<0.6){ this.minigames.startRally().then(res=>{ if(res.success){ this.player.morale = Math.min(100,this.player.morale + 10); this.player.propaganda = Math.max(0,this.player.propaganda - 2); this.sfx.beep(880,0.12) } else { this.player.morale = Math.max(0,this.player.morale - 8); this.sfx.beep(120,0.12) } }) } else if(this.eventCurrent.id==='spy' && Math.random()<0.6){ this.minigames.startEspionage().then(res=>{ if(res.success){ this.player.military += 6; this.sfx.beep(660,0.12) } else { this.player.propaganda = Math.max(0,this.player.propaganda - 4); this.sfx.beep(160,0.12) } }) } this.eventCurrent = null; }

  checkFailure(){ let p = this.player; if(p.morale <= 0){ this.endGame("Empire of Enthusiasm collapses — morale hit rock bottom. Your absurd policies are rejected in a spectacular pie fight."); }
    else if(p.economy <= 0){ this.endGame("Economic meltdown — the grand parade's floats were actually paper mache. The treasury is empty and you must retire to interpretive dance."); }
    else if(this.map.controlled.size <= 0){ this.endGame("You lost every tile to baffled resistance. Your minions defect to a traveling circus."); }
  }
  endGame(msg){ this.running=false; alert("Game Over: " + msg + "\nScore: " + this.player.score); }
}

// ---------- Initialization and DOM bindings ----------
window.addEventListener('load',()=>{
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const statsDiv = document.getElementById('stats');
  const eventDiv = document.getElementById('event');
  const minigameDiv = document.getElementById('minigame');
  const nextDayBtn = document.getElementById('nextDay');

  function renderSidebar(){
    const p = game.player;
    statsDiv.innerHTML = `
      <div class="stat"><strong>Day:</strong> ${p.day}</div>
      <div class="stat"><strong>Propaganda:</strong> ${p.propaganda}</div>
      <div class="stat"><strong>Military:</strong> ${p.military}</div>
      <div class="stat"><strong>Economy:</strong> ${p.economy}</div>
      <div class="stat"><strong>Morale:</strong> ${p.morale}</div>
      <div class="stat"><strong>Territory:</strong> ${game.map.controlled.size}</div>
      <div class="stat"><strong>Score:</strong> ${p.score}</div>
      <div class="stat"><strong>Period:</strong> ${game.dayCycle.currentPeriod()}</div>
    `;

    // show events first, otherwise show DayCycle choices
    if(game.eventCurrent){
      let ev = game.eventCurrent;
      let html = `<div><strong>Event:</strong> ${ev.text}</div>`;
      ev.choices.forEach((c,i)=>{ html += `<button class="choice" data-idx="${i}">${c.t}</button>`; });
      eventDiv.innerHTML = html;
      eventDiv.querySelectorAll('button.choice').forEach(btn=>{ btn.onclick = ()=>{ game.chooseEvent(parseInt(btn.dataset.idx)); renderSidebar(); }; });
    } else {
      // render day-cycle choices
      const choices = game.dayCycle.currentChoices;
      let html = `<div><strong>Choices for ${game.dayCycle.currentPeriod()}:</strong></div>`;
      choices.forEach((c,i)=>{ html += `<button class="choice" data-idx="${i}">${c.t}</button>`; });
      eventDiv.innerHTML = html;
      eventDiv.querySelectorAll('button.choice').forEach(btn=>{ btn.onclick = ()=>{ game.dayCycle.applyChoice(parseInt(btn.dataset.idx)); renderSidebar(); }; });
    }

    if(game.minigames.active){ minigameDiv.innerHTML = `<div><strong>Mini-game active:</strong> ${game.minigames.active}</div>`; }
    else { minigameDiv.innerHTML = `<div><strong>No mini-game active.</strong></div>`; }
  }

  nextDayBtn.onclick = ()=>{ // advance to next period (or next day automatically when periods exhaust)
    game.dayCycle.nextPeriod(); renderSidebar(); };

  window.addEventListener('keydown', (e)=>{ if(e.code==='Space' && game.minigames.active==='rally'){ game.minigames.onKey(e); renderSidebar(); } });

  setInterval(renderSidebar, 250);

  game.start(); renderSidebar();
});
