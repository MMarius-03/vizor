const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'chrome'});
  try {
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:4173/rift-next/studies/');
    const result=await page.evaluate(async()=>{
      const T=await import('three');
      const {createAtlasPoseTracker,smoothAtlasPose}=await import('../atlas-pose.js?v=2');
      const {createFrameBudget,createAtlasCanvasModule}=await import('../atlas-quality.js?v=1');
      const q=new T.Quaternion(), p=new T.Vector3();
      const tracker=createAtlasPoseTracker(T);
      tracker.measure(p,q,1,0,.75,true);
      const rejected=!tracker.measure(new T.Vector3(.9,0,0),q,1,33,.75);
      tracker.measure(p,q,1,66,.75);
      const afterSpike=tracker.position.length();
      const frames=[];
      for(const fps of [30,60,120]) {
        const tracking=createAtlasPoseTracker(T),root=new T.Group(),baseline=new T.Group();
        tracking.measure(p,q,1,0,.75,true);
        for(let i=1;i<=fps;i++) {
          const now=i*1000/fps, x=.12*i/fps;
          tracking.measure(new T.Vector3(x,0,0),q,1+.08*i/fps,now,.75);
          smoothAtlasPose(root,tracking.position,tracking.rotation,tracking.scale,1/fps,.75,tracking.motionAt(now));
          smoothAtlasPose(baseline,tracking.position,tracking.rotation,tracking.scale,1/fps,.75);
        }
        frames.push({fps,lag:.12-root.position.x,baselineLag:.12-baseline.position.x,scaleLag:1.08-root.scale.x});
      }
      const move=new T.Vector3(.3,0,0);
      const firstMove=tracker.measure(move,q,1,100,.75);
      const confirmedMove=tracker.measure(move,q,1,133,.75);
      tracker.measure(new T.Vector3(2,1,0),q,1,20000,.75,true);
      const reacquired=tracker.position.x;
      const budget=createFrameBudget();
      const feed=(fps,seconds)=>{for(let i=0;i<fps*seconds;i++)budget.sample(1000/fps);};
      feed(60,8); const healthy=budget.scale;
      budget.sample(3000); feed(60,4); const afterBackground=budget.scale;
      feed(30,5); const reduced=budget.scale;
      feed(30,10); const minimum=budget.scale;
      feed(60,24); const recovered=budget.scale;
      const sizedBudget=createFrameBudget();
      const canvas={width:1200,height:2400};
      const original={name:'fullwindowcanvas',onAttach(){canvas.width=1200;canvas.height=2400;},
        onCanvasSizeChange(){canvas.width=1200;canvas.height=2400;},
        onDeviceOrientationChange(){canvas.width=2400;canvas.height=1200;}};
      const module=createAtlasCanvasModule(original,sizedBudget);
      module.onAttach({canvas});
      const initial=[canvas.width,canvas.height];
      for(let i=0;i<10;i++)module.onCanvasSizeChange({});
      const stable=[canvas.width,canvas.height];
      for(let i=0;i<150;i++)sizedBudget.sample(1000/30);
      module.onCanvasSizeChange({});
      const lower=[canvas.width,canvas.height];
      module.onDeviceOrientationChange({});
      const landscape=[canvas.width,canvas.height];
      module.onDetach({});
      return {rejected,afterSpike,frames,firstMove,confirmedMove,reacquired,
        healthy,afterBackground,reduced,minimum,recovered,initial,stable,lower,landscape};
    });
    assert.ok(result.rejected && result.afterSpike===0,'single-frame jumps must not displace the anchor');
    assert.ok(!result.firstMove && result.confirmedMove && result.reacquired===2,'sustained motion and reacquisition must work');
    for(const sample of result.frames) {
      assert.ok(sample.lag>0 && sample.lag<sample.baselineLag*.85 && sample.scaleLag<.025,
        `adaptive tracking should reduce lag without overshoot: ${JSON.stringify(sample)}`);
    }
    assert.equal(result.healthy,1); assert.equal(result.afterBackground,1);
    assert.equal(result.reduced,.85); assert.equal(result.minimum,.7); assert.equal(result.recovered,1);
    assert.deepEqual(result.initial,[720,1440]); assert.deepEqual(result.stable,result.initial);
    assert.deepEqual(result.lower,[612,1224]); assert.deepEqual(result.landscape,[1224,612]);
    console.log('ATLAS performance controls: OK',JSON.stringify(result));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
