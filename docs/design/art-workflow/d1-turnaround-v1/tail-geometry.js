// Construction diagram only. It never reads or modifies character bitmap pixels.
const rad=degrees=>degrees*Math.PI/180;
export function project(point,yaw,elevation){
 const [x,y,z]=point,c=Math.cos(rad(yaw)),s=Math.sin(rad(yaw)),e=rad(elevation);
 const u=x*c+z*s,depth=-x*s+z*c;
 return[u,-y*Math.cos(e)+depth*Math.sin(e),y*Math.sin(e)+depth*Math.cos(e)];
}
export function tailMesh(spec){
 const triangles=[],ringSize=24,add=(a,b,c,color)=>triangles.push({points:[a,b,c],color});
 const rings=spec.peduncle.map((station,index)=>{
  const before=spec.peduncle[Math.max(0,index-1)].center,after=spec.peduncle[Math.min(spec.peduncle.length-1,index+1)].center;
  const dy=after[1]-before[1],dz=after[2]-before[2],length=Math.hypot(dy,dz);
  return Array.from({length:ringSize},(_,k)=>{const a=2*Math.PI*k/ringSize;return[station.center[0]+Math.cos(a)*station.radii[0],station.center[1]-dz/length*Math.sin(a)*station.radii[1],station.center[2]+dy/length*Math.sin(a)*station.radii[1]];});
 });
 for(let i=0;i<rings.length-1;i++)for(let k=0;k<ringSize;k++){
  const next=(k+1)%ringSize,color=k<ringSize/2?'#435a9d':'#cbd1e4';
  add(rings[i][k],rings[i+1][k],rings[i+1][next],color);add(rings[i][k],rings[i+1][next],rings[i][next],color);
 }
 const pitch=Math.tan(rad(spec.flukePitchDegrees)),joint=spec.peduncle.at(-1).center,center=[0,joint[1],joint[2]-.08];
 const outline=spec.flukePlanXZ.map(([x,z])=>[x,joint[1]+(z-joint[2])*pitch-spec.flukeDroop*Math.pow(Math.abs(x)/(spec.flukeSpan/2),1.4),z]);
 for(let k=0;k<outline.length;k++){
  const next=(k+1)%outline.length,top=p=>[p[0],p[1]+spec.flukeThickness/2,p[2]],bottom=p=>[p[0],p[1]-spec.flukeThickness/2,p[2]];
  add(top(center),top(outline[k]),top(outline[next]),'#435a9d');add(bottom(center),bottom(outline[next]),bottom(outline[k]),'#cbd1e4');
  add(top(outline[k]),bottom(outline[k]),bottom(outline[next]),'#263c70');add(top(outline[k]),bottom(outline[next]),top(outline[next]),'#263c70');
 }
 return triangles;
}
function mannequin(spec){
 const triangles=[],tube=(cx,z,y0,y1,r0,r1,color)=>{
  const points=(y,r)=>Array.from({length:40},(_,i)=>{const a=i*Math.PI/20;return[cx+r[0]*Math.cos(a),y,z+r[1]*Math.sin(a)];});
  const bottom=points(y0,r0),top=points(y1,r1);
  for(let k=0;k<40;k++){const n=(k+1)%40;triangles.push({points:[bottom[k],top[k],top[n]],color},{points:[bottom[k],top[n],bottom[n]],color});}
 };
 tube(0,0,spec.hemHeight,spec.skirt.waistHeight,spec.skirt.hemRadii,spec.skirt.waistRadii,'#e4e8ed');
 for(const x of [-.13,.13])tube(x,0,.05,.65,[.07,.08],[.075,.08],'#adb9c7');
 return triangles;
}
export function drawDiagram(canvas,spec){
 const gl=canvas.getContext('webgl',{antialias:true,preserveDrawingBuffer:true});
 if(!gl)throw Error('WebGL unavailable for construction reference');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec3 c; varying vec3 color; void main(){gl_Position=vec4(p,1.0);color=c;}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec3 color; void main(){gl_FragColor=vec4(color,1.0);}'));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
 const positions=[],colors=[],mesh=[...tailMesh(spec),...mannequin(spec)],columns=spec.layout?.columns??4,rows=Math.ceil(spec.views.length/columns),panelWidth=canvas.width/columns,panelHeight=canvas.height/rows;
 for(const [i,view]of spec.views.entries())for(const t of mesh){
  const rgb=t.color.match(/\w\w/g).map(value=>parseInt(value,16)/255);
  for(const point of t.points){const p=project(point,view.yaw,spec.projection.elevationDegrees),cx=(i%columns+.5)*panelWidth+(view.offsetX??0)*265,baseline=(Math.floor(i/columns)+1)*panelHeight-30;positions.push((cx+p[0]*265)/(canvas.width/2)-1,1-(baseline+p[1]*265)/(canvas.height/2),-p[2]/4);colors.push(...rgb);}
 }
 for(const [name,data]of [['p',positions],['c',colors]]){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,name);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(attr);}
 gl.viewport(0,0,canvas.width,canvas.height);gl.enable(gl.DEPTH_TEST);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,positions.length/3);
 return spec.views.map(view=>{
  const points=tailMesh(spec).flatMap(t=>t.points.map(point=>project(point,view.yaw,spec.projection.elevationDegrees)));
  return{yaw:view.yaw,projectedWidth:Math.max(...points.map(p=>p[0]))-Math.min(...points.map(p=>p[0]))};
 });
}
