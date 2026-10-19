const clamp = k => Math.max(0, Math.min(1, k));
const ease = k => { const t = clamp(k); return t * t * (3 - 2 * t); };
const weights = (original = 0, reach = 0, grip = 0, release = 0) => ({ original, reach, grip, release });

// Frame-driven art selection. Pause retains elapsed time; inspection never commits ownership.
export function handWeights(state, profile) {
  if (!profile.handArt) return weights(1);
  if (state.inspection) return ({ contact: weights(0, 1), contactHeld: weights(0, 0, 1), carry: weights(0, 0, 1), retract: weights(0, 0, 0, 1) })[state.inspection] ?? weights(1);
  const phase = state.phase === 'paused' ? state.suspended : state.phase;
  const k = ease(state.elapsed / (profile.seconds[phase] ?? 1));
  if (phase === 'reach') { const a = ease((state.elapsed / profile.seconds.reach - .15) / .65); return weights(1 - a, a); }
  if (phase === 'grasp') return weights(0, 1 - k, k);
  if (['lift', 'held', 'carry', 'settleDrop', 'lower', 'touch'].includes(phase)) return weights(0, 0, 1);
  if (phase === 'release') return weights(0, 0, 1 - k, k);
  if (phase === 'retract') return weights(0, 0, 0, 1);
  if (phase === 'rise') return weights(k, 0, 0, 1 - k);
  return weights(1);
}

// Map unmodified source pixels to the same wrist/contact anchors using a similarity transform.
export function planHandArt(spec) {
  const [wx, wy] = spec.wrist, [cx, cy] = spec.contact;
  return Object.fromEntries(['reach', 'grip', 'release'].map(name => {
    const asset = spec.assets[name], [sx, sy] = asset.wrist, [gx, gy] = asset.contact;
    const distance = Math.hypot(gx - sx, gy - sy);
    if (!(distance > 1)) throw new Error('Hand source anchors are degenerate');
    const scale = Math.hypot(cx - wx, cy - wy) / distance;
    const angle = (Math.atan2(cy - wy, cx - wx) - Math.atan2(gy - sy, gx - sx)) * 180 / Math.PI;
    const part = rect => ({ box: [wx + (rect.x - sx) * scale, wy + (rect.y - sy) * scale, rect.width * scale, rect.height * scale],
      uvBox: [rect.x / asset.canvas.width, rect.y / asset.canvas.height, (rect.x + rect.width) / asset.canvas.width, (rect.y + rect.height) / asset.canvas.height] });
    return [name, { asset, scale, angle, pivot: [wx, wy], sourceContact: [wx + (gx - sx) * scale, wy + (gy - sy) * scale],
      full: part(asset.visibleBounds), front: asset.frontRect ? part(asset.frontRect) : null }];
  }));
}

// A single painted hand stays visible throughout the action. Pose weights drive a
// deformation, never separate source-over opacity fades between different cuffs.
export function handSurfaceModel(spec) {
  const plan = planHandArt(spec).grip;
  return { plan, view: [150, 180, 180, 212],
    // This division lies across the knuckles, above the shell contact pocket.
    // Both surfaces use identical UVs and deformation; each source pixel belongs
    // to exactly one surface, so there is no duplicated translucent outline.
    frontBoundary: [[515,880],[605,860],[725,858],[795,810],[920,820],[1110,850],[1110,1120],[515,1120]],
    parts: ['palm', 'fingers'].map((name, i) => ({ id: `__hand_${name}`, tex: `__hand_${name}`, parent: '__handShape', z: i ? 5.2 : 5.02, ...plan.full, grid: [24,32] })),
    deformers: { __handRegister: { kind:'rot', parent:'armFar', pivot:plan.pivot },
      __handShape: { kind:'warp', parent:'__handRegister', rect:[plan.full.box[0],plan.full.box[1],plan.full.box[0]+plan.full.box[2],plan.full.box[1]+plan.full.box[3]] } },
  };
}

export function handSurfaceState(surface, pose) {
  const closure = clamp((pose.grip ?? 0) + .25 * (pose.original ?? 0)), open = 1 - closure;
  const p = surface.plan, [sx,sy] = p.asset.wrist, [gx,gy] = p.asset.contact;
  return { closure, __handRegister: { a:p.angle }, __handShape: { fn: (_u,_v,x,y) => {
    const sourceX = sx + (x-p.pivot[0])/p.scale, sourceY = sy + (y-p.pivot[1])/p.scale;
    const k = ease((sourceY-620)/230) * open;
    // Opening spreads the same thumb/fingers around the fixed grasp pocket;
    // the cuff, wrist and virtual prop contact remain fixed in every pose.
    return [(sourceX-gx)*.48*k*p.scale, (sourceY-gy)*.28*k*p.scale];
  } }, alpha:{ __hand_palm:1, __hand_fingers:1 } };
}

export function splitHandRgba(pixels, width, height, boundary) {
  const palm = new Uint8ClampedArray(pixels.length), fingers = new Uint8ClampedArray(pixels.length);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    let front=false;
    for(let i=0,j=boundary.length-1;i<boundary.length;j=i++) {
      const [xi,yi]=boundary[i], [xj,yj]=boundary[j];
      if((yi>y+.5)!==(yj>y+.5) && x+.5 < (xj-xi)*(y+.5-yi)/(yj-yi)+xi) front=!front;
    }
    const at=(y*width+x)*4, out=front?fingers:palm;
    out.set(pixels.subarray(at,at+4),at);
  }
  return { palm, fingers };
}
