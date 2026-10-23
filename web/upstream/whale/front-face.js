// One frontal calibration for authoring and the production expression painter.
// Master coordinates match the existing face sprites, independently of expression.
import model from './directions/model.js';
export const FRONT_FACE=Object.freeze(model.directions.front.faceCalibration);
export function composeFrontFace(g,{eye,mouth,brows,lift=0,inner=0,calibration=FRONT_FACE}) {
 const f=calibration;
 g.setTransform(3,0,0,3,36,24);g.clearRect(-12,-8,280,280);
 for(const [i,cx] of f.centres.entries()) {
  const surface=eye(i);g.save();g.translate(cx,f.y);if(i)g.scale(-1,1);
  g.drawImage(surface,15,0,185,200,(15-f.iris[0])*f.scale,-f.iris[1]*f.scale,185*f.scale,200*f.scale);g.restore();
 }
 // Neutral source mouth centre in the master face is (245.5,191.5).
 g.drawImage(mouth(),194,160,100,80,f.mouth[0]-51.5*.2,f.mouth[1]-31.5*.2,20,16);
 for(const [i,cx] of f.centres.entries()) {g.save();g.translate(cx,f.browY-lift*.3);if(i)g.scale(-1,1);g.rotate(-inner*.025);g.drawImage(brows,0,0,70,brows.height,-13,0,24,5.4);g.restore();}
}
