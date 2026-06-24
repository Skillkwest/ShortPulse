export type PublicHomeGalleryItem = {
  src: string;
  alt: string;
  size: "tall" | "portrait" | "square" | "wide";
  prompt: string;
  mediaType?: "image" | "video";
  posterSrc?: string;
  aspectRatio?: string;
};

export const publicHomeGalleryItems: PublicHomeGalleryItem[] = [
  {
    src: "/dashboard/gallery/seedance-podcast-demo.mp4",
    alt: "Seedance 2.0 podcast creator demo video",
    size: "square",
    mediaType: "video",
    aspectRatio: "1 / 1",
    prompt:
      'STYLE: Multi-shot live-action podcast realism, energetic creator-demo tone, warm indoor studio lighting, soft beige-neutral palette with burgundy hair accents, modern casual era, crisp digital texture. CANON (from image): [Character A: expressive woman with dark hair, blue eyes, red highlights, speaking into a podcast microphone] casual indoor podcast setup, seated near mic with animated hand gestures, warm neutral decor and clean modern studio feel. AUDIO BED: light modern promotional underscore, close indoor room tone, subtle mic presence, soft gesture rustle, confident upbeat delivery with clear spoken dialog. STORYBOARD (2-6 SHOTS): SHOT 1 (00:00-00:03) - [MS]: slow dolly push toward Character A as she leans toward the microphone and lifts one hand to start her point; cozy podcast corner with warm neutral lighting and calm indoor atmosphere; subtle lens bloom on highlights; room tone, faint fabric movement, music bed under dialog; Character A: "Okay so listen. I found this new tool; it\'s called Short pulse dot AI" Transition: HARD CUT. SHOT 2 (00:03-00:06) - [CU]: handheld drift as Character A turns slightly, points to herself, and smiles with animated emphasis; same mic position and studio setup, intimate conversational energy; natural motion blur on the gesture; close mic presence, small hand movement rustle, music continues; Character A: "I\'m literally being created on Short pulse right now." Transition: MATCH CUT. SHOT 3 (00:06-00:09) - [OTS]: slight orbit from behind the microphone framing Character A as she opens both hands and speaks faster with excitement; warm indoor backdrop, soft decor, focused podcast ambiance; gentle depth-of-field shift from mic to face; subtle room ambience, mic-forward voice, underscore lifts; Character A: "Honestly this is the best tool that I\'ve ever seen for AI content creation." Transition: HARD CUT. SHOT 4 (00:09-00:12) - [CU]: slow push-in as Character A lands the final line with a playful, emphatic gesture and raised brows; same podcast set, warm highlights, clean modern realism; slight emphasis on eye light and hair accents; music hits a small upbeat accent under the final statement; Character A: "Anyone who is not using Short pulse is honestly crazy." END: Character A holds a confident expression beside the mic as the music resolves on a clean promotional button.',
  },
  {
    src: "/dashboard/gallery/monster-wall-break-demo.mp4",
    alt: "One-shot monster wall break thriller demo video",
    size: "portrait",
    mediaType: "video",
    aspectRatio: "9 / 16",
    prompt:
      "Use the uploaded image as the exact first frame and preserve the man's identity, face, hair, outfit, body type, the existing background layout, and the same lighting throughout. Medium shot at a slightly low angle with clear focus on the man and natural depth in the background. Handheld tracking camera with tense, gritty micro-shake, staying continuous and physically plausible as it follows the man's movement in one uninterrupted take. In the exact environment shown in the image, the man is suddenly interrupted as a monster violently breaks through the wall behind him, throwing debris from that already-present wall area as he jolts, pivots hard, and turns to face it. He plants his feet, leans forward, and yells in defiance, then the monster rears back and roars with rage. The man braces for a beat, then surges forward and charges straight at the creature as the camera tracks with him, maintaining spatial continuity and the same environment, mood, and lighting from the reference image. Photorealistic grim dark thriller action, raw cinematic tension, harsh grounded impact, heavy atmosphere, and strict continuity from the reference frame. [Man, fierce and defiant]: \"Come on then!\"",
  },
  {
    src: "/dashboard/gallery/anime-cat-dance-demo.mp4",
    alt: "High-energy anime desert rave dance demo video",
    size: "portrait",
    mediaType: "video",
    aspectRatio: "31 / 54",
    prompt:
      "STYLE: Multi-shot high-energy anime dance sequence, snappy anime character animation, expressive keyframe-driven motion, stylized but physically grounded acrobatics, playful flirtatious mood, dramatic sunset-to-neon festival lighting, hot amber and magenta palette, contemporary desert rave setting, crisp digital anime linework, cel-shaded forms, selective motion blur, bloom from firelight, dust atmosphere. CANON (from image): [Character A: flirtatious anime woman, confident and playful, wearing the same festival outfit and accessories from the reference image] at an outdoor desert rave festival with crowd silhouettes, bikes, signage, dust haze, and a giant burning effigy in the background; preserve the same wardrobe, hairstyle, body type, silhouette, accessory bounce, and palette across all shots. AUDIO BED: Driving electronic rave anthem with crisp beat drops, crowd cheers and chatter, distant bass thumps, dry wind, jewelry jingle, foot impacts, cloth snaps, fire crackle; no dialog. STORYBOARD (6 SHOTS): SHOT 1 (00:00-00:02) - [WS]: fast crane drop into a subtle dolly push; Character A steps into the dance circle, pauses for a sharp anime-style anticipation beat, then snaps into precise footwork and a teasing smirk to camera; sunset festival ground with dust haze, crowd silhouettes, bikes, signage, and the burning effigy glowing behind her; cel-shaded dust puffs, crisp smear-frame feel, warm bloom; pounding rave beat, crowd murmur, fire crackle; Transition: HARD CUT. SHOT 2 (00:02-00:04) - [MS]: tracking follow with tight stabilized motion; Character A hits clean shoulder pops, a defined chest isolation, then a fast body wave that travels naturally from shoulders through torso to hips before resolving into two playful advancing steps; orange dust and neon accents pulse behind her while fabric and jewelry react with believable drag and follow-through; cloth snap, accessory bounce, dust flicks; bass thumps, foot taps, jewelry jingle; Transition: MATCH CUT. SHOT 3 (00:04-00:06) - [CU]: quick 180-degree orbit with a controlled stop; Character A locks eyes with camera, frames her face with her hands, gives a tiny held beat, then whips into a sharp spin and lands in a flirtatious over-shoulder look with settled balance; background collapses into anime bokeh firelight and color streaks from the festival; hair whip arcs, sparkle glints, selective motion blur; synth lead rises over the heavy beat, crowd swell; Transition: WHIP-PAN. SHOT 4 (00:06-00:08) - [WS]: lateral tracking pan; Character A widens her stance, loads weight into one leg, sweeps low, then performs a controlled cartwheel with clear hand placement and a clean recovery back into rhythm, keeping momentum readable at every step; the crowd opens around her on the dusty festival floor with the effigy larger in frame; dust arc, trailing fabric, grounded contact impacts; kick drum pulse, cheers, hand plant and landing scuff; Transition: HARD CUT. SHOT 5 (00:08-00:10) - [MS]: slow dolly in; Character A rebounds with snappy anime timing into rapid chest pops, playful hand flourishes near lens, then a rising turn with visible spotting and realistic deceleration that builds cleanly into the finale; firelight flickers across her outfit while neon smoke and dust pulse behind her; heat shimmer, bloom, accessory lag and settle; layered rave beat, wind brush, crowd anticipation; Transition: MATCH CUT. SHOT 6 (00:10-00:13) - [WS]: pull-back with slight tilt up; Character A takes two accelerating setup steps, launches into an aerial-style twist with a believable arc, tucks and opens at the right moments, lands solidly with bent knees to absorb impact, then snaps into a triumphant flirtatious finishing pose toward camera as the crowd jumps behind her; full festival vista opens with burning effigy, dust clouds, lights, and pulsing silhouettes; dust burst on landing, flame bloom, subtle smear accents on the snap pose; music peaks, crowd erupts, landing impact, fire crackle under the beat. END: Character A holds the final pose with hair, fabric, and jewelry settling naturally against the blazing effigy as drifting dust crosses frame and the bass hits one last emphatic drop.",
  },
  {
    src: "/dashboard/gallery/panda-villa-tour-demo.mp4",
    alt: "Panda luxury jungle villa tour demo video",
    size: "wide",
    mediaType: "video",
    aspectRatio: "54 / 31",
    prompt:
      'STYLE: Multi-shot photorealistic cinematic influencer vlog; warm tropical daylight, lush emerald and cream palette, modern luxury resort aesthetic, crisp digital texture, relaxed playful mood. CANON (from image): [Character A: Panda Influencer] cheerful anthropomorphic panda, consistent black-and-white fur, pendant necklace, vlog-host energy. Luxury jungle villa with open-air lounge, plunge pool, wooden beams, soft cream furniture, dense tropical greenery, upscale tropical decor that persists across all shots. AUDIO BED: Light upbeat travel-vlog music, tropical birds, soft pool water ambience, gentle leaf rustle, subtle footstep and camera-handling sounds; dialog is casual, punchy, playful, and confident. STORYBOARD (4 SHOTS): SHOT 1 - [POV]: handheld selfie drift; Character A walks into frame and starts the villa tour, smiling into camera and gesturing behind him; open-air villa entrance with sunlit wood beams, cream seating, and dense jungle foliage; natural lens sway and soft walking motion; tropical birds, light music bed, faint footsteps; Dialog: Character A: "Alright guys, welcome to my jungle villa tour." Transition: MATCH CUT. SHOT 2 - [WS]: slow pan follow; Character A turns the camera outward and presents the lounge and plunge pool with a proud sweep of his arm; bright tropical air, shimmering water, layered greenery, polished luxury surfaces; slight water sparkle and breeze through leaves; pool ambience, leaf rustle, music bed lifts; Dialog: Character A: "This lounge opens straight into the pool, and honestly, it is ridiculous." Transition: WHIP-PAN. SHOT 3 - [MS]: tracking follow; Character A walks along the poolside path, pointing out details and showing different corners of the villa like a seasoned host; cream furniture, warm wood textures, open jungle backdrop, sun reflections moving across the ground; subtle handheld bounce and pendant movement; water lapping, soft fabric rustle, birds, upbeat music; Dialog: Character A: "Over here, you\'ve got the chill zone, the jungle view, and maximum main-character energy." Transition: HARD CUT. SHOT 4 - [CU]: slow dolly push; Character A stops, leans toward the camera with a pleased grin, then glances back to reveal the best view behind him; luxury pool and jungle vista softly framed in the background, warm daylight and saturated greens holding consistent visual canon; slight fur movement in the breeze and shallow depth-of-field focus shift; music resolves with soft pool ambience and distant birds; Dialog: Character A: "I\'m telling you, if I disappear for a week, I\'m probably right here." END: Character A holds the camera steady on a final proud smile with the villa glowing behind him, while the music button lands over soft water and jungle ambience.',
  },
  {
    src: "/dashboard/gallery/forest-bear-encounter-demo.mp4",
    alt: "Live-action forest grizzly survival thriller demo video",
    size: "wide",
    mediaType: "video",
    aspectRatio: "16 / 9",
    prompt:
      "STYLE: Multi-shot live-action survival thriller, tense and grounded, cold natural light, muted forest greens and earthy browns, overcast wilderness atmosphere, modern cinematic realism, crisp digital texture. CANON (from image): [Character A: lone woman, tense and alert, consistent wardrobe and silhouette from the reference image] [Character B: giant grizzly bear, heavy build, dark matted fur]. Dense forest edge opening into a small clearing; subdued natural palette, damp ground, persistent wilderness mood. AUDIO BED: Low suspense drone, cold wind through trees, distant branch creaks, heavy animal footfalls, subtle heartbeat-like percussion; no dialog. STORYBOARD (2-6 SHOTS): SHOT 1 (00:00-00:02) - [MS]: slow dolly push; Character A stands facing off and holds still as she senses danger; forest clearing at the tree line under flat overcast light; faint leaf tremor and drifting breath; wind hiss, distant birds cut out, low suspense tone; Transition: J-CUT. SHOT 2 (00:02-00:04) - [CU]: slight handheld drift; Character A snaps her eyes toward the forest and her expression tightens with trepidation; dark trunks and tangled brush crowd the frame behind her; tiny breath plume and subtle hair movement; rising drone, branch crack deeper in the woods; Transition: HARD CUT. SHOT 3 (00:04-00:07) - [WS]: slow pan from Character A to the treeline; Character B pushes out of the forest and fully emerges into the clearing; dense shadowed woods give way to open ground with damp earth and scattered brush; branches part and debris shifts under its weight; heavy footfalls, brush scrape, bass swell; Transition: MATCH CUT. SHOT 4 (00:07-00:10) - [OTS]: slow push from behind Character A; Character B advances several deliberate steps toward her while she remains frozen and braced; the distance between them closes in the bleak clearing; subtle ground disturbance and visible body tension; bear huff, footfalls, tense score pulse. END: Character A holds her ground as the grizzly looms closer, ending on the sound of one final crushing step.",
  },
  {
    src: "/dashboard/gallery/viking-longship-storm-demo.mp4",
    alt: "Grimdark Viking longship storm survival demo video",
    size: "wide",
    mediaType: "video",
    aspectRatio: "54 / 31",
    prompt:
      "STYLE: Multi-shot grimdark historical action, cinematic live-action epic, Nordic survival drama; cold iron-blue and slate-gray palette, low-key storm lighting, wet textured surfaces, harsh wind-driven rain, grounded realism, tactile handheld camera energy. CANON (from image): [Character A: Viking warrior] grizzled man with intense eyes, wet hair, battle-worn furs and seafaring leathers. [Character B: Crewmen] rugged Norse sailors in soaked wool and leather, hauling lines and bracing at oars aboard a wooden Viking longship in rough open sea under black storm clouds. AUDIO BED: Low Nordic war-drum pulse under roaring wind, crashing waves, straining timber, snapping sailcloth, shouted exertion with no dialog. STORYBOARD (4 SHOTS): SHOT 1 (00:00-00:03) - [WS]: handheld drift from stern quarter; Character B fight to keep footing as the longship climbs a steep wave and the sail bellies hard to port; storm-black open sea, freezing rain, whitecaps exploding over the bow; sea spray and lens droplets; roaring wind, hull groan, wave crash, low drum pulse; Transition: HARD CUT. SHOT 2 (00:03-00:06) - [MS]: handheld tracking along the centerline; two Crewmen haul a flogging rope hand-over-hand while another drops low to secure footing against the gunwale as the ship rolls; slick deck, whipping sail shadow, chaotic but readable ship motion; rope snapback mist and flying spray; straining wood, shouted effort, flapping canvas, drums rising; Transition: MATCH CUT. SHOT 3 (00:06-00:09) - [CU]: sharp handheld push-in; Character A turns from the rail, squints through stinging rain, grabs a support line, and plants his stance as he gauges the next swell; gray horizon vanishing behind sheets of rain, torchless storm gloom, wet fur and war-worn textures; rain streaks and seawater running across face and beard; wind howl, close timber creak, drum pulse tightening; Transition: WHIP-PAN. SHOT 4 (00:09-00:12) - [OTS]: over Character A's shoulder with handheld sway; the crew execute his silent lead by shifting weight and dragging the steering oar back into line as the bow drops through the wave trough and steadies for one beat; violent sea briefly resolves into controllable forward motion beneath bruised storm light; heavy spray burst and shudder through the hull; crashing surf easing into rhythmic chop, wood strain settling, final drum hit. END: the longship punches forward into the storm as spray clears the frame and the drum pulse cuts on a deep timber groan.",
  },
  {
    src: "/dashboard/gallery/fufkin-butterfly-meadow-demo.mp4",
    alt: "Pixar-style Fufkin butterfly meadow fantasy demo video",
    size: "portrait",
    mediaType: "video",
    aspectRatio: "31 / 54",
    prompt:
      "STYLE: Multi-shot Pixar-style fantasy adventure, whimsical family animation with an emotional turn, warm storybook daylight softening into hushed concern, lush meadow greens and flower-bright pastels, gentle cinematic bloom, crisp polished digital texture. CANON (from image): [Character A: Fufkin] tiny fuzzy fantasy creature with oversized expressive eyes, rounded features, springy bouncy movement, joyful curiosity; [Character B: Butterfly] delicate bright-winged butterfly with one visibly damaged wing revealed in the clearing. Persistent setting: sunlit flower meadow leading into a small grassy clearing bordered by wildflowers and stones, warm pastel palette, light breeze, magical natural atmosphere. AUDIO BED: Light playful orchestral music that thins into tender melancholy, meadow breeze, soft foot patters, fluttering wings, distant birds, brief stunned hush, then a gentle hopeful swell; no dialog. STORYBOARD (2-6 SHOTS): SHOT 1 (00:00-00:02) - [WS]: tracking follow; Character A joyfully bounds through tall flowers chasing Character B in zigzag hops; sunny meadow sparkles with warm daylight and swaying blossoms; drifting pollen and soft lens bloom; playful strings, breeze, tiny foot patters, quick wing flutters; Transition: MATCH CUT. SHOT 2 (00:02-00:04) - [MS]: low-angle handheld drift with slight pan; Character A leaps over a small stone and nearly catches Character B, then lands and keeps bouncing forward as Character B veers into a quiet clearing; flower density thins and the atmosphere grows still at the clearing's edge; petals kick up on landing; music stays light but begins to thin, footsteps soften, birds fade back; Transition: J-CUT. SHOT 3 (00:04-00:06) - [OTS]: slow dolly push from behind Character A; Character A slows to a cautious stop as Character B flutters unevenly, drops to a low wildflower, and reveals a torn wing; small clearing feels suddenly fragile and hushed under the same warm daylight; subtle wing tremble and grass movement; music nearly drops out, close wing buzz, soft breeze, faint concerned orchestral note; Transition: HARD CUT. SHOT 4 (00:06-00:09) - [CU]: slow dolly push; Character A's face shifts step-by-step from breathless delight to confusion, then wide-eyed sadness and horror as the damage fully registers, ears lowering and body going still; background melts into soft blur to isolate the emotional beat; tiny eye shimmer and held breath; near-silence, a soft inhale, tender low strings; Transition: L-CUT. SHOT 5 (00:09-00:12) - [MS]: gentle push-in; Character A carefully crouches and extends a tiny paw without touching, staying still so Character B can rest safely on a flower, ending the chase as concern replaces play; the clearing feels calm and intimate, flowers barely moving in the breeze; dust motes drift through the sunbeams; hopeful orchestral swell returns under breeze and faint wing flutter. END: Character A watches over Character B in the clearing as the music resolves on a soft, compassionate note. Visual style reference: use a polished Pixar-style 3D animation aesthetic with smooth high-quality rendering, soft global illumination, expressive exaggerated character features, clean textures, warm cinematic lighting, and a vibrant yet natural color palette.",
  },
  {
    src: "/dashboard/gallery/luxury-purse-ugc-demo.mp4",
    alt: "Beige monogram shoulder bag UGC fashion showcase demo video",
    size: "square",
    mediaType: "video",
    aspectRatio: "1 / 1",
    prompt:
      'STYLE: Multi-shot candid realistic live-action UGC fashion showcase, warm indoor natural light, soft neutral beige and taupe palette, contemporary home setting, crisp digital texture, casual luxury mood. CANON (from image): [Character A: woman influencer, only partially seen, wearing a light gray fitted top and delicate gold jewelry, manicured pale pink nails.] Character A presents a small beige monogram shoulder bag with a curved baguette silhouette, slim matching shoulder strap with metal studs and rings, rounded leather end panels, and a front strap detail with silver-tone grommets and a large circular ring accent. AUDIO BED: Light trendy lifestyle music, soft room tone, subtle fabric movement, light metal hardware clicks; upbeat, conversational influencer delivery. STORYBOARD (2-6 SHOTS): SHOT 1 (00:00-00:02) - [MS]: slow handheld drift; Character A lifts the beige monogram shoulder bag into frame and beams at camera as if introducing a favorite accessory; softly lit neutral bedroom doorway area with warm daylight and clean home UGC atmosphere; natural hand movement and slight strap sway; soft room tone, quiet jewelry tick, upbeat lifestyle music; Transition: HARD CUT. SHOT 2 (00:02-00:05) - [CU]: gentle dolly push; Character A turns the bag left to right to show the repeating monogram canvas, the curved baguette shape, and the rounded beige leather corner panels; same warm indoor setting with soft background blur; realistic motion in the strap and hardware as the bag rotates; light hardware clicks, fabric rustle, music continues; Character A: "I\'m obsessed with the shape and this print." Transition: MATCH CUT. SHOT 3 (00:05-00:08) - [ECU]: slight tilt down; Character A taps and pulls the front strap detail toward camera to highlight the beige leather tab, silver-tone grommets, and oversized circular ring accent; warm neutral interior remains consistent and uncluttered; tiny specular glints on the metal hardware; crisp nail taps, faint bracelet movement, music bed continues; Transition: HARD CUT. SHOT 4 (00:08-00:11) - [MS]: slow pull-back; Character A slips the slim studded shoulder strap onto her shoulder, settles the bag naturally against her side, then turns back with a confident recommendation look; same soft bedroom doorway setting with cozy natural light; realistic body shift and gentle bag swing as it lands in place; room tone, soft strap creak, subtle jewelry clicks, music lifts; Character A: "It goes with everything and looks so cute on." END: Character A holds the pose with the bag resting on her shoulder as the music lands on a clean upbeat button.',
  },
  {
    src: "/dashboard/gallery/alpine-ski-pov-demo.mp4",
    alt: "First-person alpine ski cliff drop demo video",
    size: "portrait",
    mediaType: "video",
    aspectRatio: "31 / 54",
    prompt:
      "STYLE: Multi-shot live-action sports cinematic, first-person helmet-cam POV, realistic GoPro-style crisp digital image, cold alpine daylight, high-contrast snow whites and slate-gray rock tones, adrenaline-charged but physically grounded, clean action readability. CANON (from image): [Character A: skier] first-person athlete in consistent ski gear from the reference image, wearing helmet and gloves, using skis and poles; steep alpine backcountry terrain with deep powder, jagged rock walls, pillow snow formations, cold daylight, natural winter palette. AUDIO BED: Tense cinematic pulse under rushing wind, ski scrape, powder hiss, pole flicks, landing thumps, and tight mountain ambience; no dialog. STORYBOARD (4 SHOTS): SHOT 1 (00:00-00:03) - [POV]: fast helmet-cam glide with slight vibration; Character A carves off the ridge and drops into a narrow chute, planting poles and shifting edges; steep snow corridor under cold daylight with jagged rock rising on both sides; powder spray flicks across lens edges; sharp ski scrape, wind rush, powder hiss; Transition: MATCH CUT. SHOT 2 (00:03-00:06) - [POV]: forward tracking descent; Character A compresses and drops a short cliff into soft pillow snow, landing deep and absorbing the impact before driving forward; open pocket of powder between rock features, mounded snow pillows and loose slough trailing behind; burst of snow bloom and subtle camera jolt on impact; heavy landing thump, muffled powder burst, pulse music rising; Transition: HARD CUT. SHOT 3 (00:06-00:09) - [POV]: rapid weave with slight left-right pan from head movement; Character A threads tightly between jagged rocks, making two quick controlled turns through the choke without clipping either side; narrow rock gate with packed powder line and fractured snow texture under bright winter light; flecks of snow whip past the lens and edges chatter over uneven terrain; close scrape of skis, rushing air, tense musical build; Transition: WHIP-PAN. SHOT 4 (00:09-00:13) - [POV]: accelerating approach with subtle upward tilt at takeoff; Character A charges a clean cliff lip, pops into a single backflip, rotates smoothly over open powder, then spots the landing and drops toward the slope below; wide alpine void opening beyond the cliff with snowy valley backdrop and cold clear atmosphere; suspended snow crystals trail during rotation and lens catches a brief sun glint; wind swell, music peak, rotational whoosh, solid landing impact. END: Character A rides out stable into untouched powder as the camera levels and the music resolves on a final low hit.",
  },
  {
    src: "/dashboard/gallery/moonbound-crossing-demo.mp4",
    alt: "Moonlit desert survival crossing cinematic demo video",
    size: "portrait",
    mediaType: "video",
    aspectRatio: "31 / 54",
    prompt:
      "STYLE: Multi-shot documentary-inspired live-action cinematic realism, epic and eerie tone, moonlit desert survival mood, cold blue-silver highlights against muted sand and charcoal rock, late-night barren landscape, crisp digital texture with subtle film grain, naturalistic lighting, wind-blown atmosphere. CANON (from image): [Character A: hooded woman] blue eyes, dark hair with red highlights, weathered black cloak, fitted desert-worn outfit, determined desperate expression. Persistent setting: windswept rocky desert beneath an enormous moon, dusty air, barren stone ridges, cold moonlight, subdued blue-gray and sand palette. AUDIO BED: Low cinematic drone with sparse rising strings, constant desert wind, soft boot crunch on gravel, cloak rustle, occasional distant rock rattle; no dialog. STORYBOARD (2-6 SHOTS): SHOT 1 (00:00-00:03) - [WS]: slow crane rise; Character A walks alone across a rocky ridge line, head angled toward the far horizon; vast moonlit desert with blowing dust and jagged stone silhouettes; drifting sand and cloak movement; low wind, distant rumble, restrained drone; Transition: HARD CUT. SHOT 2 (00:03-00:05) - [MS]: tracking side follow; Character A pushes forward with determined desperation, one hand gripping her cloak as she scans the distance; uneven rock path under cold moonlight, dust sweeping past her legs; cloak flutter and gravel shift; boot crunch, cloth rustle, wind bed; Transition: MATCH CUT. SHOT 3 (00:05-00:07) - [CU]: slow dolly push; Character A's blue eyes lock ahead as strands of dark hair with red highlights whip across her face; background falls soft into moon haze and airborne grit; fine dust crossing lens and subtle skin texture; wind hiss, faint tonal swell; Transition: HARD CUT. SHOT 4 (00:07-00:10) - [OTS]: handheld drift; from behind Character A, she slows and fixes on a distant point on the horizon, shoulders tightening before taking another step; rocky desert opens wide beneath the huge moon, eerie empty expanse; suspended dust and slight lens bloom around the moon; ambient wind, low ominous drone, light gravel scrape; Transition: L-CUT. SHOT 5 (00:10-00:13) - [ECU]: rack focus; close on Character A's clenched jaw and wind-tugged cloak clasp, then focus shifts toward the blurred glowing horizon line ahead; moon-chilled air and dust shimmer in the foreground; fabric tremor and particulate sparkle; drone peaks softly with persistent wind. END: Character A continues forward into frame edge as the distant horizon remains unresolved, with wind and low eerie tone lingering after the cut.",
  },
  {
    src: "/dashboard/gallery/gallery-01.webp",
    alt: "ShortPulse cinematic gallery artwork",
    size: "tall",
    prompt:
      "A cinematic creator-world still with moody lighting, premium AI-generated detail, atmospheric depth, and a polished editorial finish for a high-converting social campaign.",
  },
  {
    src: "/dashboard/gallery/gallery-02.webp",
    alt: "ShortPulse creator gallery artwork",
    size: "wide",
    prompt:
      "A stylish creator-focused scene with authentic lifestyle energy, soft natural motion, cinematic composition, and a premium AI content studio aesthetic.",
  },
  {
    src: "/dashboard/gallery/gallery-03.webp",
    alt: "ShortPulse AI portrait gallery artwork",
    size: "tall",
    prompt:
      "A photoreal AI portrait with luminous skin texture, confident expression, soft editorial lighting, shallow depth of field, and polished creator-brand styling.",
  },
  {
    src: "/dashboard/gallery/gallery-04.webp",
    alt: "ShortPulse scene gallery artwork",
    size: "square",
    prompt:
      "A social-first cinematic scene with a strong central subject, immersive background details, dramatic contrast, and a premium generative video look.",
  },
  {
    src: "/dashboard/gallery/gallery-05.webp",
    alt: "ShortPulse moody forest gallery artwork",
    size: "portrait",
    prompt:
      "A moody atmospheric environment with layered shadows, subtle mist, cinematic color grading, and a refined AI film still texture.",
  },
  {
    src: "/dashboard/gallery/gallery-06.webp",
    alt: "ShortPulse abstract gallery artwork",
    size: "wide",
    prompt:
      "A bold abstract brand visual with layered color ribbons, sleek shadows, modern gradient lighting, and a futuristic ShortPulse creative-system feel.",
  },
  {
    src: "/dashboard/gallery/gallery-07.webp",
    alt: "ShortPulse character gallery artwork",
    size: "portrait",
    prompt:
      "A character-driven AI visual with expressive posing, polished styling, detailed wardrobe, cinematic lighting, and a production-ready campaign look.",
  },
  {
    src: "/dashboard/gallery/gallery-08.webp",
    alt: "ShortPulse cinematic collage gallery artwork",
    size: "tall",
    prompt:
      "A high-energy AI output collage showing creators, products, cinematic worlds, social ads, and visual experiments arranged as a premium creator gallery wall.",
  },
  {
    src: "/dashboard/gallery/gallery-09.webp",
    alt: "ShortPulse atmosphere gallery artwork",
    size: "wide",
    prompt:
      "An atmospheric visual study with deep contrast, glowing highlights, soft haze, and cinematic framing designed for a thumb-stopping AI video concept.",
  },
  {
    src: "/dashboard/gallery/gallery-10.webp",
    alt: "ShortPulse workspace gallery artwork",
    size: "square",
    prompt:
      "A refined creative workspace visual with organized media, elegant shadows, premium UI energy, and the feeling of every AI creation tool in one place.",
  },
];

const galleryVideoOrder = new Map(
  [
    "/dashboard/gallery/monster-wall-break-demo.mp4",
    "/dashboard/gallery/anime-cat-dance-demo.mp4",
    "/dashboard/gallery/panda-villa-tour-demo.mp4",
    "/dashboard/gallery/fufkin-butterfly-meadow-demo.mp4",
    "/dashboard/gallery/alpine-ski-pov-demo.mp4",
    "/dashboard/gallery/forest-bear-encounter-demo.mp4",
    "/dashboard/gallery/moonbound-crossing-demo.mp4",
    "/dashboard/gallery/seedance-podcast-demo.mp4",
    "/dashboard/gallery/viking-longship-storm-demo.mp4",
    "/dashboard/gallery/luxury-purse-ugc-demo.mp4",
  ].map((src, index) => [src, index] as const)
);

export const publicHomeGalleryVideos = [...publicHomeGalleryItems]
  .filter((item) => item.mediaType === "video")
  .sort(
    (a, b) =>
      (galleryVideoOrder.get(a.src) ?? Number.MAX_SAFE_INTEGER) -
      (galleryVideoOrder.get(b.src) ?? Number.MAX_SAFE_INTEGER)
  );

const publicHomeGalleryVideoRowSources = [
  [
    "/dashboard/gallery/monster-wall-break-demo.mp4",
    "/dashboard/gallery/anime-cat-dance-demo.mp4",
    "/dashboard/gallery/panda-villa-tour-demo.mp4",
  ],
  [
    "/dashboard/gallery/fufkin-butterfly-meadow-demo.mp4",
    "/dashboard/gallery/moonbound-crossing-demo.mp4",
    "/dashboard/gallery/forest-bear-encounter-demo.mp4",
  ],
  [
    "/dashboard/gallery/alpine-ski-pov-demo.mp4",
    "/dashboard/gallery/seedance-podcast-demo.mp4",
    "/dashboard/gallery/luxury-purse-ugc-demo.mp4",
    "/dashboard/gallery/viking-longship-storm-demo.mp4",
  ],
];

export const publicHomeGalleryVideoRows = publicHomeGalleryVideoRowSources
  .map((rowSources) =>
    rowSources
      .map((src) => publicHomeGalleryVideos.find((item) => item.src === src))
      .filter((item): item is PublicHomeGalleryItem => Boolean(item))
  )
  .filter((row) => row.length > 0);
