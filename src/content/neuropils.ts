/**
 * FlyWire FAFB neuropil glossary — all 78 ids in the FlyWire v783
 * neuropil set (FlyConnectome "Neuropils and Point Lookups" mesh map;
 * Virtual Fly Brain lists the same 78 lateralised neuropils).
 * Names follow the insect-brain nomenclature used by FlyWire Codex.
 * Roles are one-line plain-English summaries for the select/info UI.
 * Brain activity shown on these regions is always labelled
 * "simulated model, assumed signs" in the UI (AGENT.md convention 8).
 */
export interface NeuropilInfo {
  /** Full anatomical name; paired neuropils carry their hemisphere. */
  readonly name: string;
  /** One-line plain-English role. */
  readonly role: string;
  /** Reference link (FlyWire Codex neuropil browser). */
  readonly source: string;
}

const CODEX = "https://codex.flywire.ai/app/neuropils";

export const NEUROPILS: Readonly<Record<string, NeuropilInfo>> = {
  AL_L: {
    name: "Antennal lobe (left)",
    role: "Smell center — first brain relay for odors detected by the antennae.",
    source: CODEX,
  },
  AL_R: {
    name: "Antennal lobe (right)",
    role: "Smell center — first brain relay for odors detected by the antennae.",
    source: CODEX,
  },
  AME_L: {
    name: "Accessory medulla (left)",
    role: "Small optic-lobe neuropil that hosts circadian clock neurons.",
    source: CODEX,
  },
  AME_R: {
    name: "Accessory medulla (right)",
    role: "Small optic-lobe neuropil that hosts circadian clock neurons.",
    source: CODEX,
  },
  AMMC_L: {
    name: "Antennal mechanosensory and motor center (left)",
    role: "The antenna's mechanical senses — vibration, wind, sound and touch.",
    source: CODEX,
  },
  AMMC_R: {
    name: "Antennal mechanosensory and motor center (right)",
    role: "The antenna's mechanical senses — vibration, wind, sound and touch.",
    source: CODEX,
  },
  AOTU_L: {
    name: "Anterior optic tubercle (left)",
    role: "Visual relay carrying compass cues from the optic lobes inward.",
    source: CODEX,
  },
  AOTU_R: {
    name: "Anterior optic tubercle (right)",
    role: "Visual relay carrying compass cues from the optic lobes inward.",
    source: CODEX,
  },
  ATL_L: {
    name: "Antler (left)",
    role: "Small neuropil beside the lateral horn; a relay in the lateral complex.",
    source: CODEX,
  },
  ATL_R: {
    name: "Antler (right)",
    role: "Small neuropil beside the lateral horn; a relay in the lateral complex.",
    source: CODEX,
  },
  AVLP_L: {
    name: "Anterior ventrolateral protocerebrum (left)",
    role: "Multimodal area mixing visual input with signals from elsewhere.",
    source: CODEX,
  },
  AVLP_R: {
    name: "Anterior ventrolateral protocerebrum (right)",
    role: "Multimodal area mixing visual input with signals from elsewhere.",
    source: CODEX,
  },
  BU_L: {
    name: "Bulb (left)",
    role: "Input port of the central complex; feeds heading cues to the compass ring.",
    source: CODEX,
  },
  BU_R: {
    name: "Bulb (right)",
    role: "Input port of the central complex; feeds heading cues to the compass ring.",
    source: CODEX,
  },
  CAN_L: {
    name: "Cantle (left)",
    role: "Superior neuropil relaying signals between higher brain regions.",
    source: CODEX,
  },
  CAN_R: {
    name: "Cantle (right)",
    role: "Superior neuropil relaying signals between higher brain regions.",
    source: CODEX,
  },
  CRE_L: {
    name: "Crepine (left)",
    role: "Sleeve of neuropil around the mushroom-body stalk.",
    source: CODEX,
  },
  CRE_R: {
    name: "Crepine (right)",
    role: "Sleeve of neuropil around the mushroom-body stalk.",
    source: CODEX,
  },
  EB: {
    name: "Ellipsoid body",
    role: "The compass ring — tracks which direction the fly is heading.",
    source: CODEX,
  },
  EPA_L: {
    name: "Epaulette (left)",
    role: "Sensory arborization zone feeding into the superior brain.",
    source: CODEX,
  },
  EPA_R: {
    name: "Epaulette (right)",
    role: "Sensory arborization zone feeding into the superior brain.",
    source: CODEX,
  },
  FB: {
    name: "Fan-shaped body",
    role: "Largest central-complex neuropil; steering and sleep-linked processing.",
    source: CODEX,
  },
  FLA_L: {
    name: "Flange (left)",
    role: "Connector neuropil between the bulb and the lateral complex.",
    source: CODEX,
  },
  FLA_R: {
    name: "Flange (right)",
    role: "Connector neuropil between the bulb and the lateral complex.",
    source: CODEX,
  },
  GA_L: {
    name: "Gall (left)",
    role: "Small neuropil linking mushroom-body output to the lateral complex.",
    source: CODEX,
  },
  GA_R: {
    name: "Gall (right)",
    role: "Small neuropil linking mushroom-body output to the lateral complex.",
    source: CODEX,
  },
  GNG: {
    name: "Gnathal ganglia",
    role: "Taste gateway and mouthpart motor control — feeding starts here.",
    source: CODEX,
  },
  GOR_L: {
    name: "Gorget (left)",
    role: "Inferior neuropil relaying signals toward descending neurons.",
    source: CODEX,
  },
  GOR_R: {
    name: "Gorget (right)",
    role: "Inferior neuropil relaying signals toward descending neurons.",
    source: CODEX,
  },
  IB_L: {
    name: "Inferior bridge (left)",
    role: "Paired neuropil in the belt around the protocerebral bridge.",
    source: CODEX,
  },
  IB_R: {
    name: "Inferior bridge (right)",
    role: "Paired neuropil in the belt around the protocerebral bridge.",
    source: CODEX,
  },
  ICL_L: {
    name: "Inferior clamp (left)",
    role: "Collecting zone where descending neurons pick up commands for the nerve cord.",
    source: CODEX,
  },
  ICL_R: {
    name: "Inferior clamp (right)",
    role: "Collecting zone where descending neurons pick up commands for the nerve cord.",
    source: CODEX,
  },
  IPS_L: {
    name: "Inferior posterior slope (left)",
    role: "Rear inferior neuropil rich in descending-neuron branches.",
    source: CODEX,
  },
  IPS_R: {
    name: "Inferior posterior slope (right)",
    role: "Rear inferior neuropil rich in descending-neuron branches.",
    source: CODEX,
  },
  LA_L: {
    name: "Lamina (left)",
    role: "First optic neuropil — photoreceptors hand visual signals off here.",
    source: CODEX,
  },
  LA_R: {
    name: "Lamina (right)",
    role: "First optic neuropil — photoreceptors hand visual signals off here.",
    source: CODEX,
  },
  LAL_L: {
    name: "Lateral accessory lobe (left)",
    role: "Premotor hub — steering commands pass through toward descending neurons.",
    source: CODEX,
  },
  LAL_R: {
    name: "Lateral accessory lobe (right)",
    role: "Premotor hub — steering commands pass through toward descending neurons.",
    source: CODEX,
  },
  LH_L: {
    name: "Lateral horn (left)",
    role: "Assigns meaning to odors — attraction, avoidance, arousal.",
    source: CODEX,
  },
  LH_R: {
    name: "Lateral horn (right)",
    role: "Assigns meaning to odors — attraction, avoidance, arousal.",
    source: CODEX,
  },
  LO_L: {
    name: "Lobula (left)",
    role: "Detects objects, looming and small moving features.",
    source: CODEX,
  },
  LO_R: {
    name: "Lobula (right)",
    role: "Detects objects, looming and small moving features.",
    source: CODEX,
  },
  LOP_L: {
    name: "Lobula plate (left)",
    role: "Wide-field motion vision — senses how the world sweeps past.",
    source: CODEX,
  },
  LOP_R: {
    name: "Lobula plate (right)",
    role: "Wide-field motion vision — senses how the world sweeps past.",
    source: CODEX,
  },
  MB_CA_L: {
    name: "Mushroom body calyx (left)",
    role: "Input zone of the learning-and-memory center; receives olfactory signals.",
    source: CODEX,
  },
  MB_CA_R: {
    name: "Mushroom body calyx (right)",
    role: "Input zone of the learning-and-memory center; receives olfactory signals.",
    source: CODEX,
  },
  MB_ML_L: {
    name: "Mushroom body medial lobes (left)",
    role: "Medial output lobes carrying learned odor values.",
    source: CODEX,
  },
  MB_ML_R: {
    name: "Mushroom body medial lobes (right)",
    role: "Medial output lobes carrying learned odor values.",
    source: CODEX,
  },
  MB_PED_L: {
    name: "Mushroom body pedunculus (left)",
    role: "Axon tract running from the calyx to the mushroom-body lobes.",
    source: CODEX,
  },
  MB_PED_R: {
    name: "Mushroom body pedunculus (right)",
    role: "Axon tract running from the calyx to the mushroom-body lobes.",
    source: CODEX,
  },
  MB_VL_L: {
    name: "Mushroom body vertical lobes (left)",
    role: "Vertical output lobes carrying learned odor values.",
    source: CODEX,
  },
  MB_VL_R: {
    name: "Mushroom body vertical lobes (right)",
    role: "Vertical output lobes carrying learned odor values.",
    source: CODEX,
  },
  ME_L: {
    name: "Medulla (left)",
    role: "Largest optic neuropil — computes local motion across the eye.",
    source: CODEX,
  },
  ME_R: {
    name: "Medulla (right)",
    role: "Largest optic neuropil — computes local motion across the eye.",
    source: CODEX,
  },
  NO: {
    name: "Noduli",
    role: "Base of the central complex — encodes travel direction and stride.",
    source: CODEX,
  },
  OCG: {
    name: "Ocellar ganglion",
    role: "Input zone for the ocelli, the fly's three simple eyes on top of the head.",
    source: CODEX,
  },
  PB: {
    name: "Protocerebral bridge",
    role: "Top of the central complex — first stage of the heading compass.",
    source: CODEX,
  },
  PLP_L: {
    name: "Posterior lateral protocerebrum (left)",
    role: "Higher visual area hosting projection-neuron glomeruli.",
    source: CODEX,
  },
  PLP_R: {
    name: "Posterior lateral protocerebrum (right)",
    role: "Higher visual area hosting projection-neuron glomeruli.",
    source: CODEX,
  },
  PRW: {
    name: "Prow",
    role: "Premotor shelf — many descending neurons collect the brain's output here.",
    source: CODEX,
  },
  PVLP_L: {
    name: "Posterior ventrolateral protocerebrum (left)",
    role: "Visual projection-neuron zone where looming detectors like LC4 terminate.",
    source: CODEX,
  },
  PVLP_R: {
    name: "Posterior ventrolateral protocerebrum (right)",
    role: "Visual projection-neuron zone where looming detectors like LC4 terminate.",
    source: CODEX,
  },
  SAD: {
    name: "Saddle",
    role: "Midline neuropil beside the mushroom-body output lobes.",
    source: CODEX,
  },
  SCL_L: {
    name: "Superior clamp (left)",
    role: "Relay between the lateral horn and higher-brain regions.",
    source: CODEX,
  },
  SCL_R: {
    name: "Superior clamp (right)",
    role: "Relay between the lateral horn and higher-brain regions.",
    source: CODEX,
  },
  SIP_L: {
    name: "Superior intermediate protocerebrum (left)",
    role: "Association neuropil linking higher brain regions.",
    source: CODEX,
  },
  SIP_R: {
    name: "Superior intermediate protocerebrum (right)",
    role: "Association neuropil linking higher brain regions.",
    source: CODEX,
  },
  SLP_L: {
    name: "Superior lateral protocerebrum (left)",
    role: "Target of many mushroom-body output neurons.",
    source: CODEX,
  },
  SLP_R: {
    name: "Superior lateral protocerebrum (right)",
    role: "Target of many mushroom-body output neurons.",
    source: CODEX,
  },
  SMP_L: {
    name: "Superior medial protocerebrum (left)",
    role: "Top association region integrating signals across the brain.",
    source: CODEX,
  },
  SMP_R: {
    name: "Superior medial protocerebrum (right)",
    role: "Top association region integrating signals across the brain.",
    source: CODEX,
  },
  SPS_L: {
    name: "Superior posterior slope (left)",
    role: "Rear superior neuropil feeding descending output neurons.",
    source: CODEX,
  },
  SPS_R: {
    name: "Superior posterior slope (right)",
    role: "Rear superior neuropil feeding descending output neurons.",
    source: CODEX,
  },
  VES_L: {
    name: "Vest (left)",
    role: "Neuropil belt around the esophagus; mechanosensory relay.",
    source: CODEX,
  },
  VES_R: {
    name: "Vest (right)",
    role: "Neuropil belt around the esophagus; mechanosensory relay.",
    source: CODEX,
  },
  WED_L: {
    name: "Wedge (left)",
    role: "Descending-neuron dendrite zone — brain output bound for the nerve cord.",
    source: CODEX,
  },
  WED_R: {
    name: "Wedge (right)",
    role: "Descending-neuron dendrite zone — brain output bound for the nerve cord.",
    source: CODEX,
  },
};

/** All known FlyWire neuropil ids (78). */
export const NEUROPIL_IDS: readonly string[] = Object.keys(NEUROPILS);
