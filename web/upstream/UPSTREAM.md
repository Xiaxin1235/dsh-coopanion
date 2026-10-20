# Imported Coopanion runtime

This file records the pinned import and adaptations. For the current plugin's dependencies and notices, read the root [third-party notices](../../THIRD_PARTY_NOTICES.md). The adjacent `THIRD_PARTY_NOTICES.md` is the original upstream notice: its speech-recognition dependencies, model paths and Electron version describe that upstream package. Its relative `LICENSE` link is supported by an identical copy of the root AGPL license here.

Source: https://github.com/Pal-AI-Lab/Coopanion/tree/d7b1a0026fed3eb1975a6e0387527d806192cdbf/packages/cortico-world-desktop-pet

Commit: `d7b1a0026fed3eb1975a6e0387527d806192cdbf` (pinned; no runtime download).

License: AGPL-3.0-or-later for code and model data; whale textures and thumbnails follow the separate notice in `THIRD_PARTY_NOTICES.md`. The combined application retains the license text at the repository root.

Imported unchanged:

- `kit/rig.js`: shared movement, gestures, expressions, particles, WebGL mesh rendering.
- `whale/`: original model, all eight schemes and assets. The figure entry has the opt-in adaptation recorded below.
- `figure-frame.js`: API 2 factory and sandbox message protocol (optional extension recorded below).
- `sound.js`: original Web Audio synthesis and pack sound support.

Harness adaptations, 2026-10-09:

- `body-host.js` locates the sandbox page relative to its module instead of `/figure-frame`. It allows one outstanding animation tick per body and accumulates elapsed time up to 50 ms, preventing slow renderers from queuing frames ahead of input.
- `figure-frame.html` locates its script relatively. The local server supplies the original isolation policy: opaque iframe origin, restricted script/image URLs, no connections, no forms or child frames.
- `src/upstream/packs.ts` retains the upstream manifest reader and types, with the small vocabulary type/limit inline; World registration and bot-specific helpers are omitted.
- `web/speech.js` adapts original `typeText`: adaptive speed (at least 22 characters/second, at most about 3 seconds per preview), punctuation pauses, babble and mouth pulses; Unicode-safe plain text. `web/style.css` adapts the original outlined bubble and tail.
- Harness state mapping, loopback asset server, pack storage, native-window integration, source download and UI are implemented by dsh-coopanion.

No Cortico World service, upstream bot, speech-recognition runtime or independent model credentials are introduced.

Harness refinements, 2026-10-10:

- The host listens to public assistant-stream and lifecycle events. Thinking remains active through the body state; active tasks wake sleeping bodies. Live deltas drive animation only; speech is reserved for confirmed final replies.
- Authenticated upstream touch events drive interaction feedback, with double-click and task-output precedence. Drag feedback closes panels only while the current pointer is held, so a late frame cannot dismiss a later chat. The rig and whale renderer remain unchanged.
- Outlined menus and conversation cards use manifest console hues and thumbnails. Session identity comes from public human prompts, cwd, timestamps and distinct short IDs.
- The native tray projects the same snapshot, selected appearance and acknowledged settings as the desktop page. macOS uses an icon-only template with aggregate attention markers, while menu and tooltip retain state details.

- `kit/body.js` adds optional persistent `set({ expression })` for Harness task faces, without repeating expression sounds or bounces. All other original body behavior is retained.
- Final replies retain complete text and per-result read identity. Bounded previews use the original typewriter, punctuation and mouth pulses; a stable full-text reader and explicit session focus prevent concurrent tasks from interrupting reading or redirecting chat.

Harness opt-in prop binding, 2026-10-19:

- `whale/figure.js` accepts a `gripProp` descriptor and a `gripPose()` callback supplied by an explicit body factory. The prop uses the existing `armFar` deformer, UV mapping and draw order between the body and front cuff. `gripFrame` returns projected hand/prop anchors and the prop quad from the same rig states and SVG transform used for drawing.
- No default factory supplies these options; existing API 2 character motion, appearance and public protocol remain unchanged. The isolated O03 scene supplies its own commands, ownership strategy and visual evidence. This extension is not a declaration of general two-dimensional motion or native desktop contact acceptance.
- Shell artwork and authoring provenance are separate from the original whale assets. Original model, texture and notice bytes are preserved.

Harness opt-in authored motion, 2026-10-19:

- `whale/figure.js` accepts an explicit `motionPose()` callback for bounded waist/drop/arm/look controls, gradual foot planting and prop-angle compensation. Existing leg meshes compress while their soles stay planted; this does not add knee, elbow or finger joints. A child deformer at the same hand anchor preserves grip while changing the shell's orientation.
- `gripFrame` adds pose, actual facing, arm angles and foot projections only in this mode. The O03 motion lab supplies its own contact-gated controller and clock. Default factories, original model/textures and API 2 protocol are unchanged; first-round prop binding retains its original behavior.

Harness opt-in hand artwork, 2026-10-19:

- New local helper `whale/hand-art.js` maps original generated pixels to shared wrist/contact anchors and samples reach/grip/release pose weights from the authored motion clock. `whale/figure.js` accepts optional `handArt`; a cropped sleeve and one continuously deformed grip texture replace the hand. Pose weights drive the 24×32 mesh, while surface opacity and cuff geometry stay fixed. Complementary source-pixel masks separate palm and front fingertips without duplicate outlines. Scheme changes retain the optional hand textures.
- `gripFrame.handArt` reports pose weights, mesh closure, surface opacity, projected wrist/contact registration and ordering. Optional `handDetail` reuses the same raster frame; the isolated workbench also requests `externalProp` and composites decoded body, prop and front-finger rasters atomically with a shared layer order across ownership changes. Default character factories supply none of these options. Original model, textures and rights notices remain unchanged. Generated derivative hand images and prompts are separate in `web/props/shell/hands/`.

Harness opt-in two-dimensional navigation, 2026-10-19:

- `kit/navigation.js` is a local module for full-body Minkowski geometry, conservative visibility-graph planning and acceleration/braking with swept-segment checks. `kit/body.js` enables it only with `navigation:true`, drives actual x/y inside the body, and derives render, shadow, hits and bubble anchors from that root. Default factories retain horizontal motion.
- `figure-frame.js` and `body-host.js` negotiate `navigation-2d-v1` in ready, forward explicit navigation/cancel/editor placement commands, and bound reported x/y/navigation metadata. Navigation events carry operation id, generation and geometry revision independently of legacy walkId events.
- The O03 space factory explicitly enables the option for its map bounds, keeps prop motion ownership separate, and cancels routes on lifecycle gaps. Original model, texture, hand artwork and historical evidence bytes remain unchanged. Native single-screen evidence belongs to the isolated map entry, not the production life scheduler.

Ground-space calibration correction, 2026-10-19:

- `kit/navigation.js` accepts optional `groundBody` only for explicitly classified `ground-solid` obstacles. Full body bounds remain authoritative for restricted content, world edges and unclassified solids. The finite ground body retains the full horizontal envelope and a nonzero authored depth; swept checks, planning, drag and replanning use the same per-obstacle expansion.
- The local courtyard maps authored base bands separately from vertical artwork, and uses their physical ground depth for occlusion. This corrects the reported flowerbox `(570,515)` layout, where screen-height expansion had falsely connected the planter, station and content boundary into a wall. No original image/model/notice bytes change.

Selected upstream motion fixes, 2026-10-19:

- `kit/body.js` incorporates [upstream #105, `7b156c1e9eddb2e655b14229247453934204de53`](https://github.com/Pal-AI-Lab/Coopanion/commit/7b156c1e9eddb2e655b14229247453934204de53): explicit `sit` stays awake; a self-chosen sit decides its sleep intention at entry and only dozes near the end when appropriate. Seated/yawning eyes and drowsy blink duration follow the same patch. This does not enable upstream random roaming in the Harness product.
- `whale/figure.js` incorporates [upstream #228, `76a1179e1e31b52020bcc63dda606f7d0950e15a`](https://github.com/Pal-AI-Lab/Coopanion/commit/76a1179e1e31b52020bcc63dda606f7d0950e15a): leg-driven arm swing is added after the arm springs, fades for running/waving/shivering, and yields to fixed-arm expressions. Reset clears its envelope.
- Local adaptations keep each finite `motionPose` arm authoritative and exclude gait from a far arm controlled by the original spring-driven `gripPose`. The opt-in `navigate` mode supplies the same leg-driven arm swing without changing its navigation, collision or arrival protocol. Other figure physics and pose channels retain their existing behavior.
- The base import remains `d7b1a002...` plus the recorded adaptations and these two selected patches. No eyebrow overhaul, airborne catch, outfit, persona/memory service or upstream scheduler is imported. Original rig, model, textures and rights notice bytes remain unchanged.
- Regression entries: `tests/upstream-motion.test.js` observes final rig parameters; `tests/upstream-motion-ui.mjs` uses a controlled body clock with real WebGL and is included in `test:ui`. The existing inbox, navigation and O03 contact matrices cover the local integration; current results are recorded in `docs/aliveness-development.md`.

Native raster inspection correction, 2026-10-19:

- The raster-only SVG image in `whale/figure.js` now loads a short, owned Blob URL instead of a PNG data URL. `kit/raster.js` decodes the existing PNG bytes locally; replacement, remount, snapshot and disposal release the prior URL. Exported PNG frame bytes and the default canvas renderer retain their existing paths.
- The living-space compositor decodes those PNG frame bytes as `ImageBitmap` objects and closes both layers after painting or discarding a stale frame. This avoids turning each base64 frame into several large Chromium Network events. The sandbox already permits Blob images; no CSP or bridge permissions change.
- The failure was reproduced as native CDP traffic accumulation: 217 PNG data-URL loads carried 55,740,407 URL characters in the short probe. The same probe after correction observed zero PNG data-URL loads and 10,089 URL characters. The original seven native checks then completed without changing their assertions; the maintained native suite also checks frame URL traffic, a bounded deadline and cleanup.

Local courtyard continuous actions, 2026-10-20:

- `kit/space-action.js` is a locally authored, opt-in executor composing existing navigation receipts and `web/prop-motion.js` contact/pose gates. It preserves ownership, pose and committed operations across interruption, requires standing before navigation, and rejects stale identities. This is not imported upstream behavior.
- Only the isolated O03 factory with `bounds.continuousActions=true` uses this executor. The map owns independent object/destination planes and uses the calibrated ground-footprint/full-body restriction model. A distant ground object has its own depth plane; contact retains the existing atomic palm/prop/finger composition.
- `whale/figure.js` accepts optional `gripPose().mirror=-1` on the prop's hand-local deformer. The adapter preserves ground texture orientation when approaching from the opposite side, instead of flipping the prop on pickup. The grip anchor is fixed and default factories retain scale 1.
- The API 2 capability and default factory are unchanged. No new model, texture, hand artwork or license bytes are introduced. See `docs/design/continuous-action-contract.md` for scope and verification.

Stage 3 feedback geometry correction, 2026-10-20:

- The initial action model had expanded all visible elevations into full-body restricted rectangles, recreating the earlier floor/elevation regression. In the reported 580/528 planter layout it linked the station and planter into a virtual wall; after moving the planter to 558/252 it still rejected the shell approach beside the home as target-blocked.
- `actionNavigationModel` now shares the calibrated `navigationModel`: full-width finite ground footprints for known bases, full-body bounds for restricted content, world edges and unknown solids. The held-prop raster/envelope checks remain mandatory. Navigation rejection reasons are preserved through the action executor for actionable preview feedback. No upstream asset, rig or license bytes change.

Local courtyard life/work coordination, 2026-10-20:

- New local `kit/life-work.js` runs only in the explicit `bounds.lifeWork=true` authoring factory. It retains independent life/work intent and exclusively coordinates the existing navigator and contact executor inside the same body tick. `space-action.js` adds cooperative `yield` without resetting pose, ownership or committed counts.
- The Stage 4 authoring UI supplies clearly marked simulated facts through an adapter built from `src/work-facts.ts` and the shared `src/completion.ts`. It has no Harness connection, model calls, input-content inspection or second body scheduler. The default product factory, API 2 capabilities and Stage 2/3 entry behavior remain unchanged.
- The opt-in factory overlays bounded gaze/task expression, uses the existing awake sit at the actual station and rechecks the retained object/target on release. No original artwork, rig, model, prompt or license bytes change. Scope and verification are in `docs/design/life-work-contract.md` and `docs/aliveness-development.md`.

2026-10-20 第四阶段增量：`kit/work-performance.js` 是本仓库的元数据表现策略，沿既有身体时钟采样，区分模型／工具活动、审批与问题，冻结占用并提供减少动态；只在空闲且地面拥有权时覆盖手臂。`kit/life-work.js` 改为真实运行／请求／异常驻岗与稳定多来源仲裁，目标 active 独立保存。来源与测试见[本轮报告](../../docs/reports/stage-4-semantics-20261020.md)。

Local courtyard personality slice, 2026-10-20:

- `kit/personality.js` is a locally authored version-1 preference policy: explicit quiet/lively selection, bounded per-preset overrides, deterministic counter sampling, safe nearby candidates and a bounded explanation trace. It has no timers, persistence, invitations or model calls.
- Only the authoring factory with `bounds.personality=true` opts into the Stage 5A branches of `kit/life-work.js`. Existing work arbitration, contact executor and one navigator retain ownership; switching and permission changes re-evaluate from the actual body. No upstream persona service, assets, model or license bytes change. See `docs/design/personality-behavior-contract.md`.

Stage 5A visual feedback correction, 2026-10-20:

- The local preference policy now selects authored courtyard interests (shell, planter, home), with valid observation positions, actual orientation/gaze convergence and a bounded runtime observation ledger. Anonymous random waypoints and automatic sitting at every stop are removed. `kit/personality-performance.js` uses the existing expression vocabulary, object-directed gaze and a single nod after effective observation; no upstream persona service or new artwork is imported.
- `kit/space-action.js` gives seated yield its own `standUp` path, preserving ownership and waiting for the actual sitting weight to clear. It no longer routes ordinary rising through the prop-retraction 20-degree bend. Free observation/rising yields arm and waist pose control to the existing rig; finite contact poses remain authoritative. `kit/body.js` accepts an internal `clearGesture` setting so work/contact preemption can discard optional short gestures.
- `whale/figure.js` preserves its own gesture waist when an authored pose omits that channel, and exposes the projected gaze origin, actual face/gesture and posture only to the existing prop preview frame for verification. Work waiting sits only after 35 seconds of unchanged model/tool waiting and stands for actual new activity, replacing fixed sit/stand cycling. Work classification, request settlement, navigation and hand contact gates remain unchanged.
- The first Stage 5A engineering report is retained as a fixed pre-feedback snapshot; current scope and verification are in `docs/design/personality-behavior-contract.md` and `docs/aliveness-development.md`. Original models, textures, licenses and prior evidence bytes are unchanged.
