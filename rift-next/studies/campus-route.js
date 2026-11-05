// A small graph built from the drawn campus paths. Coordinates match the poster (0–1000).
export function campusRoute(layout, start, destination) {
  const segments=layout.paths.flatMap(path=>path.points.slice(1).map((b,i)=>({a:path.points[i],b,splits:[]})));
  const nodes=[], edges=[];
  const point=(p)=>{
    const existing=nodes.findIndex(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<.02);
    if(existing>=0)return existing;
    nodes.push(p);edges.push([]);return nodes.length-1;
  };
  const connect=(a,b)=>{
    if(a===b)return;
    const weight=Math.hypot(nodes[a][0]-nodes[b][0],nodes[a][1]-nodes[b][1]);
    edges[a].push([b,weight]);edges[b].push([a,weight]);
  };
  const project=(p,s)=>{
    const dx=s.b[0]-s.a[0],dy=s.b[1]-s.a[1];
    const t=Math.max(0,Math.min(1,((p[0]-s.a[0])*dx+(p[1]-s.a[1])*dy)/(dx*dx+dy*dy)));
    const q=[s.a[0]+t*dx,s.a[1]+t*dy];
    return {t,q,distance:Math.hypot(p[0]-q[0],p[1]-q[1])};
  };
  const split=(s,p,t)=>{const id=point(p);s.splits.push({id,t});return id;};
  for(const s of segments){split(s,s.a,0);split(s,s.b,1);}
  for(let i=0;i<segments.length;i++)for(let j=i+1;j<segments.length;j++){
    const a=segments[i],b=segments[j];
    const ax=a.b[0]-a.a[0],ay=a.b[1]-a.a[1],bx=b.b[0]-b.a[0],by=b.b[1]-b.a[1];
    const cross=ax*by-ay*bx;
    if(Math.abs(cross)>1e-6){
      const cx=b.a[0]-a.a[0],cy=b.a[1]-a.a[1];
      const ta=(cx*by-cy*bx)/cross,tb=(cx*ay-cy*ax)/cross;
      if(ta>=0&&ta<=1&&tb>=0&&tb<=1){
        const p=[a.a[0]+ta*ax,a.a[1]+ta*ay];
        split(a,p,ta);split(b,p,tb);continue;
      }
    }
    // Drawn path segments sometimes miss a junction by a few map units.
    for(const [source,target] of [[a,b],[b,a]])for(const endpoint of [source.a,source.b]){
      const near=project(endpoint,target);
      if(near.distance>0 && near.distance<=16)connect(point(endpoint),split(target,near.q,near.t));
    }
  }
  const attach=p=>{
    const choices=segments.map(s=>({s,...project(p,s)})).sort((a,b)=>a.distance-b.distance);
    const entrance=point(p);
    for(const choice of choices.filter(c=>c.distance<=choices[0].distance+8).slice(0,2)){
      connect(entrance,split(choice.s,choice.q,choice.t));
    }
    return entrance;
  };
  const origin=attach(start),finish=attach(destination);
  for(const s of segments){
    s.splits.sort((a,b)=>a.t-b.t);
    for(let i=1;i<s.splits.length;i++)connect(s.splits[i-1].id,s.splits[i].id);
  }
  const distances=nodes.map(()=>Infinity),previous=nodes.map(()=>-1),visited=new Set();
  distances[origin]=0;
  while(visited.size<nodes.length){
    let current=-1;
    for(let i=0;i<nodes.length;i++)if(!visited.has(i)&&(current<0||distances[i]<distances[current]))current=i;
    if(current<0||!Number.isFinite(distances[current])||current===finish)break;
    visited.add(current);
    for(const [next,weight] of edges[current])if(distances[current]+weight<distances[next]){
      distances[next]=distances[current]+weight;previous[next]=current;
    }
  }
  if(!Number.isFinite(distances[finish]))return null;
  const route=[];
  for(let id=finish;id>=0;id=previous[id]){
    route.push(nodes[id]);if(id===origin)break;
  }
  return route.reverse().filter((p,i,points)=>i===0||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>.02);
}
