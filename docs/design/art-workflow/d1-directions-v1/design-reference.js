// Display the unchanged supplied artwork in the rig's common foot coordinate frame.
export async function mountDesignReferences(registration){
 const canvases={};
 for(const [id,ref]of Object.entries(registration.references)){
  const im=new Image();im.src=new URL('source/'+ref.file,import.meta.url);await im.decode();
  const canvas=document.createElement('canvas');canvas.width=840;canvas.height=840;canvas.className='design-reference';canvas.dataset.direction=id;canvas.setAttribute('aria-label',id+' 设计图同尺度对照');
  const g=canvas.getContext('2d'),s=registration.scale,[x,y]=ref.feet;
  g.setTransform(3*s,0,0,3*s,3*(140-x*s),3*(264-y*s));g.drawImage(im,0,0);
  const stage=document.getElementById(id).parentElement;stage.classList.add('has-reference');stage.append(canvas);canvases[id]=canvas;
 }
 return canvases;
}
