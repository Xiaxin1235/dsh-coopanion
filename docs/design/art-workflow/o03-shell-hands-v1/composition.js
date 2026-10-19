// The prop uses one persistent surface regardless of gameplay ownership. All
// decoded layers are painted together, so no partial new frame is ever exposed.
export function drawComposite(canvas, { frame, detail, spec, shellImage, bodyImage, frontImage, width, floorY=320, height=390, scale=2 }) {
  if(canvas.width!==width*scale || canvas.height!==height*scale) {canvas.width=width*scale;canvas.height=height*scale;}
  const ctx=canvas.getContext('2d'), b=spec.visibleBounds;
  ctx.setTransform(scale,0,0,scale,0,0);ctx.clearRect(0,0,width,height);
  ctx.fillStyle='#11182738';ctx.beginPath();ctx.ellipse(frame.bodyX,floorY+1,48*180/256,5,0,0,2*Math.PI);ctx.fill();
  const drawBody=image=>{ctx.save();ctx.transform(...detail.matrix);const [x,y,x1,y1]=detail.view;ctx.drawImage(image,x,y,x1-x,y1-y);ctx.restore();};
  drawBody(bodyImage);
  const [p0,p1,p2]=frame.owner==='ground'?frame.groundQuad:frame.heldQuad;
  const w=spec.displayWidth,h=w*b.height/b.width;
  ctx.save();ctx.transform((p1.x-p0.x)/w,(p1.y-p0.y)/w,(p2.x-p0.x)/h,(p2.y-p0.y)/h,p0.x,p0.y);
  ctx.drawImage(shellImage,b.x,b.y,b.width,b.height,0,0,w,h);ctx.restore();
  drawBody(frontImage);
}
