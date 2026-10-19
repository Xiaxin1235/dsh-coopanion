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
