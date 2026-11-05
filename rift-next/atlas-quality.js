// Slow quality changes avoid oscillation and ignore startup/background stalls.
export function createFrameBudget() {
  let level=0, elapsed=0, frames=0, slow=0, fast=0, cooldown=4;
  const scales=[1,.85,.7];
  return {
    get scale() { return scales[level]; },
    sample(ms,visible=true) {
      if (!visible || !Number.isFinite(ms) || ms<=0 || ms>100) {
        elapsed=frames=slow=fast=0; cooldown=4; return false;
      }
      cooldown=Math.max(0,cooldown-ms/1000); elapsed+=ms; frames++;
      if (elapsed<2000) return false;
      const fps=frames*1000/elapsed; elapsed=frames=0;
      slow=fps<45 ? slow+1 : 0; fast=fps>56 ? fast+1 : 0;
      if (cooldown>0) return false;
      const next=slow>=2 ? Math.min(2,level+1) : fast>=4 ? Math.max(0,level-1) : level;
      if (next===level) return false;
      level=next; slow=fast=0; cooldown=8; return true;
    },
  };
}

// Wrap XRExtras sizing rather than overriding Three's renderer/projection.
// XR8 observes canvas dimension changes and updates the camera feed and projection.
export function createAtlasCanvasModule(fullWindowModule, budget) {
  let canvas=null, nativeWidth=0, nativeHeight=0, last=0, appliedWidth=0, appliedHeight=0;
  const fit=()=>{
    if (!canvas || !nativeWidth || !nativeHeight) return;
    const cap=Math.min(1,1440/Math.max(nativeWidth,nativeHeight))*budget.scale;
    const width=Math.max(1,Math.round(nativeWidth*cap)), height=Math.max(1,Math.round(nativeHeight*cap));
    if(canvas.width!==width) canvas.width=width;
    if(canvas.height!==height) canvas.height=height;
    appliedWidth=width; appliedHeight=height;
  };
  const module={...fullWindowModule};
  for(const event of ['onAttach','onVideoSizeChange','onCanvasSizeChange','onDeviceOrientationChange']) {
    module[event]=args=>{
      if(event==='onAttach') canvas=args.canvas;
      fullWindowModule[event]?.(args);
      if(canvas) { nativeWidth=canvas.width; nativeHeight=canvas.height; fit(); }
    };
  }
  module.onUpdate=args=>{
    fullWindowModule.onUpdate?.(args);
    if(canvas && (canvas.width!==appliedWidth || canvas.height!==appliedHeight)) {
      nativeWidth=canvas.width; nativeHeight=canvas.height; fit();
    }
    const now=performance.now();
    if(last && budget.sample(now-last,!document.hidden)) fit();
    last=now;
  };
  module.onDetach=args=>{ fullWindowModule.onDetach?.(args); canvas=null; last=0; };
  return module;
}
