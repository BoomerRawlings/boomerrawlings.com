import { topics } from './curriculum.js';

// Curated retrieval prompts grounded in the corresponding curriculum lessons.
// Recall explanations reuse the existing, sourced question explanation.
// Tuple fields: prompt, answer, optional additional context.
const cardsByTopic = {
  'brain-overview': {
    recall: ['A fiber carries information into the thalamus. What directional term describes it relative to the thalamus?', 'It is afferent to the thalamus.'],
    mechanism: ['How do sagittal, coronal and axial planes divide the brain?', 'Sagittal separates left and right; coronal separates front and back; axial separates upper and lower.', 'These planes provide a shared reference when comparing anatomical views.'],
    apply: ['A CNS structure contains a cluster of neuronal cell bodies; another contains axons connecting locations. What anatomical terms distinguish them?', 'The cell-body cluster is a nucleus; the connecting axon bundle is a tract.', 'A ganglion usually names a PNS cell-body cluster, with “basal ganglia” as a historical exception.'],
  },
  'cerebral-cortex': {
    recall: ['Why is “the frontal lobe controls personality” an incomplete explanation?', 'Complex behavior depends on interacting cortical and subcortical networks, rather than one entire lobe acting alone.'],
    mechanism: ['How do superficial and deep neocortical layers differ in their typical connections?', 'Superficial layers support many connections between cortical areas, while deeper layers include subcortical outputs and corticothalamic feedback.', 'These are broad patterns; layer membership does not specify an exclusive destination for every neuron.'],
    apply: ['You compare primary sensory and primary motor cortex. Should you expect an equally prominent layer IV in both?', 'No. Layer IV is especially prominent in primary sensory cortex and less conspicuous in primary motor cortex.', 'Major thalamic input reaches sensory layer IV; layer V includes major descending projection neurons.'],
  },
  thalamus: {
    recall: ['Which thalamic nucleus relays retinal information toward primary visual cortex?', 'The lateral geniculate nucleus is a major visual relay.'],
    mechanism: ['Why can thalamic transmission change even when the ascending input stays similar?', 'Thalamic relays also receive feedback and inhibitory influences that alter transmission through the circuit.', 'Corticothalamic feedback, cerebellar input and basal ganglia influences contribute through different thalamic circuits.'],
    apply: ['A thalamic relay receives a major driving input from cortex rather than a subcortical source. Which relay category fits this arrangement?', 'It fits a higher-order relay conveying information through a transthalamic route.', 'First-order and higher-order describe the source of driving input; layer VI feedback and reticular inhibition are additional influences.'],
  },
  hypothalamus: {
    recall: ['What three broad routes let the hypothalamus adjust the body’s internal state?', 'Hypothalamic circuits coordinate autonomic, endocrine and behavioral regulation.'],
    mechanism: ['Describe one complete feedback loop through hypothalamic regulation.', 'A sensed internal condition changes hypothalamic output; that output changes the body, producing new feedback to the circuit.', 'Different nuclei contribute different outputs, including pituitary regulation and autonomic responses.'],
    apply: ['One hypothalamic neuron releases a hormone through the posterior pituitary; another controls the anterior pituitary. How do their output routes differ?', 'Magnocellular neurons send axons toward the posterior pituitary, while parvocellular releasing factors reach anterior-pituitary control through portal blood.', 'The median eminence provides the portal-blood route; supraoptic and paraventricular nuclei contain the magnocellular populations described here.'],
  },
  hippocampus: {
    recall: ['How does the hippocampus contribute to memory without serving as a permanent store for every memory?', 'It helps form and organize certain kinds of memory, especially episodic and relational memory, within a broader set of memory systems.'],
    mechanism: ['How does information enter hippocampal processing and reconnect with wider cortical networks?', 'Entorhinal pathways provide input, and hippocampal outputs return information to broader cortical networks.', 'Dentate granule cells and CA pyramidal cells occupy different positions in these routes; the fornix provides important additional connections.'],
    apply: ['A model assigns pattern separation to dentate gyrus and pattern completion to CA3. What anatomical feature makes the CA3 proposal plausible, and what caveat belongs with it?', 'CA3 recurrent excitatory connections support interactions among representations, making pattern completion a plausible interpretation.', 'These are influential computational models, not exclusive functions established for every cell or task.'],
  },
  amygdala: {
    recall: ['Why study the amygdala as several nuclei rather than one “fear center”?', 'Its nuclei have distinct connections and contributions to association, learning and coordinated responses.'],
    mechanism: ['How do basolateral and central amygdala circuits differ in their major partners?', 'Basolateral circuits interact with cortical and hippocampal information; central amygdala outputs influence hypothalamic and brainstem responses.', 'Nuclear organization helps explain how learned significance becomes a coordinated response.'],
    apply: ['A learned response becomes weaker after new experience. Must the original association have been deleted?', 'No. New learning and competition between representations can change the response without simply deleting the original association.', 'Amygdala populations participate in diverse associations involving threat, reward and context.'],
  },
  cerebellum: {
    recall: ['What transmitter and synaptic sign characterize Purkinje-cell output?', 'Purkinje-cell output is inhibitory and GABAergic.'],
    mechanism: ['What two major afferent routes supply cerebellar cortex, and what is its principal output cell?', 'Mossy fibers and climbing fibers supply different inputs; Purkinje cells provide inhibitory output from cerebellar cortex.', 'That output shapes activity in deep cerebellar nuclei and, in some circuits, vestibular nuclei.'],
    apply: ['You are tracing major pontocerebellar input and a major output route from deep nuclei. Which peduncles should you distinguish?', 'Major pontocerebellar input travels through the middle peduncle; the superior peduncle is a major deep-nuclear output route.', 'Many superior-peduncle fibers cross in the midbrain; the inferior peduncle carries several inputs and some outputs.'],
  },
  brainstem: {
    recall: ['Why can activity in a small brainstem region influence many distant structures?', 'The brainstem concentrates major tracts and small nuclei with widespread projections.'],
    mechanism: ['A tract passes through a brainstem region containing a modulatory nucleus. Why distinguish the tract from that nucleus?', 'The tract carries axons along a route, while neurons in the nucleus contribute their own local processing and projecting outputs.', 'Corticospinal axons descend through the brainstem; small modulatory nuclei can influence widespread targets.'],
    apply: ['A section shows the cerebral aqueduct, substantia nigra and colliculi. Which brainstem level does this identify?', 'Those landmarks identify the midbrain.', 'The pons contains pontine nuclei and transverse fibers; medullary landmarks include pyramids, olives and dorsal-column relay nuclei.'],
  },
  'white-matter': {
    recall: ['What does a tractography streamline represent?', 'It represents a model-derived candidate trajectory inferred from diffusion data.'],
    mechanism: ['How do projection fibers change their arrangement between the internal capsule and corona radiata?', 'They converge in the compact internal capsule and fan outward through the corona radiata.', 'Each axon signals through its own membrane; a displayed bundle can contain fibers with different origins, destinations and roles.'],
    apply: ['Two tractography images show different streamline counts for one bundle. Does that establish a difference in axon number?', 'No. Streamline count is not an axon count and depends on reconstruction and display choices.', 'Crossing and fanning fibers can produce missed or spurious trajectories; conventional tractography also does not establish signaling direction.'],
  },
  'corpus-callosum': {
    recall: ['Which white-matter fiber class includes the corpus callosum, and why?', 'It is commissural because its fibers connect across the midline between cerebral hemispheres.'],
    mechanism: ['How can an excitatory callosal projection reduce activity in part of its destination circuit?', 'It can recruit local inhibitory neurons, producing an inhibitory downstream effect despite an excitatory projecting synapse.', 'Synaptic sign and the net effect of a connected circuit are different properties.'],
    apply: ['A callosal connection links corresponding cortical areas; another links different areas. What terms distinguish them?', 'The corresponding-area connection is homotopic; the different-area connection is heterotopic.', 'The callosum is not the only interhemispheric route: the anterior commissure provides another connection.'],
  },
  corticospinal: {
    recall: ['Where do most corticospinal fibers cross the midline?', 'Most cross at the pyramidal decussation in the caudal medulla.'],
    mechanism: ['Trace the main corticospinal route from the internal capsule to the lateral spinal tract.', 'Fibers descend through the cerebral peduncle, basis pontis and medullary pyramid, then mostly cross at the pyramidal decussation into the lateral corticospinal tract.', 'Spinal interneurons and motor neurons receive cortical influences; lower motor neurons provide the final peripheral route to muscle.'],
    apply: ['You follow the principal corticospinal pathway from one hemisphere across its medullary decussation. How does its relationship to the target body side change?', 'Above the crossing it relates mainly to the opposite body side; below the crossing it travels on the side of its spinal targets.', 'A smaller anterior component has different crossing and bilateral termination patterns, so this rule does not describe every corticospinal fiber.'],
  },
  'dorsal-column': {
    recall: ['On which side does a primary body afferent ascend before reaching a gracile or cuneate nucleus?', 'It ascends ipsilaterally in the dorsal column.'],
    mechanism: ['Where does the dorsal column–medial lemniscus pathway change neurons and cross?', 'Primary afferents synapse in gracile or cuneate nuclei; second-order axons cross as internal arcuate fibers and ascend in the medial lemniscus.', 'The next thalamic relay is VPL, which sends information toward somatosensory cortex.'],
    apply: ['A diagram puts the crossing of dorsal-column primary afferents in the spinal cord. What needs correction?', 'The primary afferents ascend ipsilaterally to a medullary relay; the second-order axons cross in the medulla.', 'Anterolateral pain and temperature pathways generally cross in the spinal cord, so neighboring sensory systems cannot share one crossing rule.'],
  },
  'optic-radiation': {
    recall: ['Which part of the visual field is mainly represented by right primary visual cortex?', 'It mainly represents the left visual hemifield from both eyes.'],
    mechanism: ['How does partial crossing at the optic chiasm sort information by visual hemifield?', 'Nasal retinal axons cross while temporal retinal axons remain ipsilateral, so each optic tract carries the opposite visual hemifield from both eyes.', 'LGN relay axons then form the optic radiation toward retinotopically organized visual cortex.'],
    apply: ['You trace Meyer’s loop. Which retinal region and visual-field region must you keep distinct?', 'Meyer’s loop carries inferior-retinal information representing the superior contralateral visual field.', 'It reaches cortex below the calcarine sulcus; the more dorsal radiation carries superior-retinal information representing the inferior field.'],
  },
  'association-fibers': {
    recall: ['What connection pattern defines an association tract?', 'It connects cortical regions within one hemisphere.'],
    mechanism: ['How do short U-fibers differ from long association fasciculi?', 'U-fibers curve beneath adjacent gyri, while long fasciculi connect more distant cortical territories.', 'A bundle can gain or lose fibers along its course, so its endpoints do not describe every connection.'],
    apply: ['A diagram draws the cingulum as one uninterrupted wire joining two endpoints. What information does that picture miss?', 'Fibers join and leave the cingulum along its medial course, so it is not simply one end-to-end connection.', 'Association-bundle boundaries also vary across naming systems; structure alone does not prove one exclusive cognitive function.'],
  },
  'cortical-circuit': {
    recall: ['An active excitatory neuron recruits an interneuron that inhibits it. What circuit motif is this?', 'This is feedback inhibition.'],
    mechanism: ['What distinguishes feedforward inhibition from feedback inhibition?', 'Feedforward inhibition accompanies incoming excitation; feedback inhibition is recruited by the activated network itself.', 'Both can shape which inputs summate and when principal neurons respond.'],
    apply: ['An interneuron inhibits another inhibitory interneuron. How can that increase principal-neuron activity?', 'It can release the principal neuron from inhibition, producing disinhibition.', 'VIP-expressing interneurons can participate in this motif, but the outcome depends on the recruited connections.'],
  },
  'basal-ganglia': {
    recall: ['How can an inhibitory striatal neuron increase activity in a downstream target?', 'It can inhibit another inhibitory neuron, thereby disinhibiting the downstream target.'],
    mechanism: ['In the classical motor-loop model, how does direct-pathway striatal inhibition affect GPi/SNr targets?', 'Inhibiting GPi/SNr output can release its targets from suppression.', 'The indirect route includes GPe and the subthalamic nucleus; subthalamic output is excitatory while principal striatal output is inhibitory.'],
    apply: ['A cortical projection directly excites the subthalamic nucleus. Which route is this, and what output effect can it support?', 'This is the hyperdirect route, which provides a short path toward increased inhibitory GPi/SNr output.', 'Pathway signs help explain the simplified loop, but coactivity and collateral connections complicate a universal “go/no-go” interpretation.'],
  },
  'hippocampal-circuit': {
    recall: ['Which hippocampal regions are connected by Schaffer collaterals?', 'Schaffer collaterals connect CA3 to CA1.'],
    mechanism: ['How do recurrent CA3 connections and inhibitory interneurons contribute different operations to the hippocampal network?', 'CA3 recurrent excitation permits interactions among representations, while interneurons constrain timing and recruitment.', 'CA1 and subiculum connect hippocampal processing with broader networks.'],
    apply: ['You demonstrate NMDA-dependent LTP at CA3–CA1 synapses. Can you assume the same mechanism at dentate–CA3 mossy-fiber synapses?', 'No. Mossy-fiber and Schaffer-collateral plasticity can differ fundamentally.', 'A mechanism established for one connection should not be copied to another merely because both are inside the hippocampal circuit.'],
  },
  'cerebellar-circuit': {
    recall: ['Where do climbing fibers originate?', 'Climbing fibers originate from neurons in the inferior olive.'],
    mechanism: ['What opposing synaptic influences do deep cerebellar nuclei integrate?', 'They integrate excitatory afferent influences with inhibitory Purkinje-cell output.', 'Local cortical interneurons also shape the timing of activity before it reaches the output stage.'],
    apply: ['A cerebellar learning model includes only parallel-fiber–Purkinje LTD. Which other plastic mechanisms might it be leaving out?', 'It may omit plasticity in deep nuclei and changes in intrinsic excitability.', 'Parallel-fiber–Purkinje LTD is a classic mechanism, but it is not the only site or form of change in cerebellar learning.'],
  },
  neuron: {
    recall: ['Why is a neuron more than a passive wire?', 'Its branches, membrane conductances and threshold mechanisms actively transform inputs into outputs.'],
    mechanism: ['How can compartment specialization connect input integration to chemical output?', 'Integrated input can trigger an action potential near the axon initial segment, and terminal depolarization can trigger chemical transmission.', 'Different compartments have different electrical properties rather than functioning as interchangeable pieces of membrane.'],
    apply: ['A neuron’s soma and axon have different shapes. What additional molecular differences should you look for to explain their behavior?', 'Look for different channel, scaffold and transport-protein distributions, because these support distinct electrical and metabolic tasks.', 'The initial segment concentrates voltage-gated channels and ankyrin-G; microtubule motors transport cargo along the axon.'],
  },
  dendrites: {
    recall: ['Why can identical synaptic conductances have different effects at different dendritic locations?', 'Distance, branching, nearby inputs and local conductances change their impact on the neuron.'],
    mechanism: ['What happens to a synaptic voltage change as it spreads through a dendrite?', 'It can weaken and change over distance, while active channels can amplify or otherwise transform the local signal.', 'A dendrite therefore combines cable properties with local membrane conductances.'],
    apply: ['A calcium signal stays relatively localized to one spine head. Which structural feature could help explain that localization?', 'The narrow spine neck can restrict diffusion between the head and dendritic shaft.', 'Electrical isolation also depends on geometry and membrane properties; local biochemical compartmentalization does not make every spine electrically independent.'],
  },
  myelin: {
    recall: ['What spreads between nodes of Ranvier to trigger regeneration of an action potential?', 'Local electrical current spreads along the axon and depolarizes the next node.'],
    mechanism: ['How does myelin help current reach the next node efficiently?', 'It increases membrane resistance and reduces effective capacitance across the internode.', 'Voltage-gated channels at the next node regenerate the action potential; individual ions do not leap from node to node.'],
    apply: ['One glial cell forms several internodes on different axons. Does this match an oligodendrocyte or a myelinating Schwann cell?', 'It matches an oligodendrocyte in the CNS.', 'A myelinating Schwann cell forms one internode on one PNS axon; internode geometry and axon diameter also influence propagation.'],
  },
  astrocytes: {
    recall: ['What major astrocyte function helps neurons maintain reliable signaling conditions?', 'Astrocytes help maintain extracellular ion and transmitter conditions.'],
    mechanism: ['How can astrocytes connect glutamate clearance with metabolic exchange?', 'They take up extracellular glutamate through EAAT transporters and can convert it to glutamine through glutamine synthetase.', 'This supports exchange with neurons rather than simply returning released transmitter inside an intact vesicle.'],
    apply: ['An image shows astrocytic endfeet around a vessel. Does that mean the endfeet form the principal physical blood–brain barrier seal?', 'No. Endothelial tight junctions form the principal physical seal.', 'Astrocytes support and regulate the vascular environment while also contributing to ion homeostasis and transmitter handling.'],
  },
  microglia: {
    recall: ['What kind of resident CNS cell is a microglial cell?', 'Microglia are dynamic resident immune cells.'],
    mechanism: ['Why can microglial behavior differ between development, routine surveillance and tissue injury?', 'Signals from the surrounding tissue alter microglial process movement, immune signaling and phagocytic behavior.', 'The effect depends on context; a response can support repair or contribute to dysfunction.'],
    apply: ['A study observes weaker synaptic transmission. Does that alone establish that microglia pruned the synapse?', 'No. Synaptic weakening does not by itself establish immune-cell pruning.', 'Complement-related mechanisms can participate in developmental refinement, but this is a selective process rather than an explanation for all weakening.'],
  },
  'resting-potential': {
    recall: ['What could make potassium move inward through an open potassium channel?', 'The electrochemical driving force can favor inward movement.'],
    mechanism: ['What does the sodium–potassium ATPase transport per ATP, and how does its role differ from an open channel?', 'It moves three sodium ions out and two potassium ions in, helping maintain gradients over time.', 'An open channel permits current according to electrochemical driving force rather than pumping ions against that force.'],
    apply: ['During a spike, voltage rapidly returns toward rest. Should you describe this as the pump resetting each individual action potential?', 'No. Rapid repolarization mainly reflects changing channel conductances.', 'The pump maintains the ion gradients that support signaling over time; current through a channel depends on conductance and driving force.'],
  },
  'synaptic-release': {
    recall: ['What signal directly couples a typical presynaptic spike to rapid vesicle fusion?', 'A local rise in presynaptic calcium activates release machinery associated with primed vesicles.'],
    mechanism: ['What different jobs do SNARE proteins and synaptotagmins perform in fast release?', 'SNARE machinery helps drive membrane fusion, while synaptotagmins couple calcium entry to rapid release at many fast synapses.', 'Synaptobrevin/VAMP, syntaxin and SNAP-25 participate in the fusion machinery; additional proteins regulate docking and priming.'],
    apply: ['Two vesicles are docked near the membrane. Must both be equally ready to fuse after the next spike?', 'No. Docking alone does not establish equal release readiness.', 'The readily releasable pool supplies primed vesicles, and calcium-channel proximity, sensor properties and replenishment help determine release probability.'],
  },
  'synaptic-integration': {
    recall: ['Can a synaptic input depolarize the membrane yet still reduce firing probability?', 'Yes. A conductance can inhibit through shunting even when it depolarizes the membrane.'],
    mechanism: ['What determines the current produced by an open synaptic receptor channel?', 'Current depends on its conductance and the difference between membrane voltage and reversal potential.', 'The same open receptor can carry a different current as the membrane voltage changes.'],
    apply: ['An anion conductance has a reversal potential above rest but below spike threshold. Why might opening it still inhibit?', 'It can shunt concurrent excitation and hold voltage below threshold, reducing firing probability despite depolarization.', 'Excitatory versus inhibitory cannot be inferred from depolarizing versus hyperpolarizing alone.'],
  },
  'electrical-synapses': {
    recall: ['What route carries the signal through an electrical synapse?', 'Current flows directly between cells through intercellular channels.'],
    mechanism: ['How are the cells’ interiors connected at a vertebrate gap junction?', 'Six connexin subunits form a connexon, and two connexons dock across adjacent membranes.', 'This creates a conductive intercellular route; connexin-36 is important in many neuronal electrical synapses.'],
    apply: ['An electrical connection transfers a slow voltage change more effectively than a rapid spike. Is that incompatible with direct electrical coupling?', 'No. Junctional conductance and the electrical properties of both cells shape how different signals transfer.', 'Many connections are bidirectional, but rectification and cellular asymmetry can also favor one direction.'],
  },
  'transmitter-clearance': {
    recall: ['Which transmitter is rapidly hydrolyzed by acetylcholinesterase in the cleft?', 'Acetylcholine is hydrolyzed into choline and acetate.'],
    mechanism: ['How does glutamate clearance differ from acetylcholine clearance?', 'Glutamate clearance involves EAAT uptake, whereas acetylcholinesterase breaks down acetylcholine.', 'Choline can then be recovered for acetylcholine resynthesis; these are different routes for terminating a signal.'],
    apply: ['A terminal recovers vesicle membrane after release. Has it necessarily already recovered and repackaged the released transmitter?', 'No. Membrane recovery and transmitter removal or reloading are distinct processes.', 'Endocytosis recovers membrane, vesicular transporters reload transmitter, and extracellular clearance occurs through transmitter-specific mechanisms.'],
  },
  'short-term-plasticity': {
    recall: ['Why can the second response in a rapid pair be larger without a larger presynaptic spike?', 'Residual presynaptic calcium can increase release probability and facilitate the second response.'],
    mechanism: ['How can one synapse show both facilitation and depression during repeated activity?', 'Residual calcium can favor facilitation while depletion of release-ready vesicles and other mechanisms reduce subsequent responses.', 'The observed response reflects their balance, together with replenishment and the initial release probability.'],
    apply: ['Responses shrink during a train of spikes. Does this prove that the terminal has exhausted all its transmitter?', 'No. Depression can reflect depletion of release-ready vesicles, altered calcium entry or receptor desensitization.', 'A smaller response does not identify a single mechanism; several state variables change during repeated stimulation.'],
  },
  glutamate: {
    recall: ['How can glutamate release ultimately suppress a downstream neuron?', 'It can excite an inhibitory interneuron that suppresses the downstream target.'],
    mechanism: ['Trace glutamate from precursor supply to vesicular packaging and extracellular removal.', 'Glutaminase can convert glutamine to glutamate; VGLUT proteins package glutamate, and EAAT transporters remove it after release.', 'Vesicular packaging uses the proton electrochemical gradient; astrocytic glutamine formation supports a broader metabolic cycle.'],
    apply: ['Two neurons receive glutamate but express different receptor families. Must their responses have identical kinetics and intracellular effects?', 'No. Ionotropic and metabotropic glutamate receptors perform different cellular operations.', 'AMPA, kainate and NMDA receptors differ in subunits and permeability; metabotropic families engage different G-protein pathways.'],
  },
  gaba: {
    recall: ['What most directly shapes the direction of the voltage response when GABA-A channels open?', 'The relevant ion gradients and membrane voltage shape the response.'],
    mechanism: ['How is GABA synthesized, packaged and removed after release?', 'GAD enzymes convert glutamate to GABA, VGAT/VIAAT packages it into vesicles, and GAT transporters participate in clearance.', 'GAD uses a vitamin-B6-derived cofactor; GABA-A and GABA-B receptors then produce different forms of signaling.'],
    apply: ['A GABA response changes potassium-channel activity through G proteins. Which receptor family fits, and why is chloride regulation a different issue?', 'GABA-B fits this response: Gi/o-linked signaling can activate GIRK potassium channels.', 'GABA-A directly creates an anion conductance shaped by chloride and bicarbonate gradients; those gradients do not define GABA-B signaling.'],
  },
  dopamine: {
    recall: ['What information best predicts dopamine’s effect on a particular neuron?', 'Its receptors, cellular signaling and circuit context are more informative than a universal emotional label.'],
    mechanism: ['Which two enzymatic steps produce dopamine from tyrosine?', 'Tyrosine hydroxylase produces L-DOPA, and aromatic L-amino-acid decarboxylase converts L-DOPA to dopamine.', 'VMAT2 supports vesicular storage; DAT contributes to uptake, while MAO and COMT participate in metabolism.'],
    apply: ['Dopamine acts on a receptor that provides feedback on dopamine-cell firing or terminal release. What receptor role is being described?', 'An autoreceptor role is being described; D2 autoreceptors can provide this feedback.', 'The same transmitter acts through different receptor families and projections, so one dopamine signal does not specify a universal circuit outcome.'],
  },
  serotonin: {
    recall: ['Which serotonin receptor family directly gates a cation channel?', 'The 5-HT3 receptor family directly gates a cation channel.'],
    mechanism: ['Trace serotonin synthesis from tryptophan and name its uptake transporter.', 'Tryptophan hydroxylase produces 5-hydroxytryptophan, which aromatic L-amino-acid decarboxylase converts to serotonin; SERT contributes to uptake.', 'VMAT2 supports vesicular storage, and MAO participates in metabolism.'],
    apply: ['A diagram assigns the same G-protein pathway to every serotonin receptor. What corrections are needed?', 'Different families couple differently, and 5-HT3 is an ion channel rather than a GPCR.', '5-HT1 commonly engages Gi/o, 5-HT2 engages Gq/11, and 5-HT4, 5-HT6 and 5-HT7 commonly engage Gs.'],
  },
  acetylcholine: {
    recall: ['How do nicotinic and muscarinic acetylcholine receptors differ in receptor type?', 'Nicotinic receptors are ion channels; muscarinic receptors are G-protein-coupled receptors.'],
    mechanism: ['Trace acetylcholine synthesis, vesicular loading and cleft breakdown.', 'Choline acetyltransferase combines choline with acetyl-CoA, VAChT loads acetylcholine into vesicles, and acetylcholinesterase hydrolyzes it after release.', 'High-affinity choline uptake supports resynthesis rather than recovering the intact transmitter through a monoamine transporter.'],
    apply: ['A neuron changes excitability through a relatively prolonged cholinergic conductance effect. Is a muscarinic route plausible?', 'Yes. Muscarinic signaling can change conductances and excitability over longer periods.', 'M1, M3 and M5 commonly couple to Gq/11, while M2 and M4 commonly couple to Gi/o; cholinergic transmission is not uniformly excitatory.'],
  },
  norepinephrine: {
    recall: ['What is another name for norepinephrine?', 'Norepinephrine is also called noradrenaline.'],
    mechanism: ['Which step distinguishes norepinephrine synthesis from dopamine synthesis?', 'Dopamine beta-hydroxylase converts dopamine to norepinephrine within the vesicular pathway.', 'NET contributes to uptake, while MAO and COMT participate in metabolism.'],
    apply: ['Norepinephrine release activates presynaptic alpha2 receptors and reduces further release. What feedback arrangement does this illustrate?', 'It illustrates negative feedback through presynaptic alpha2 autoreceptors.', 'Alpha2 commonly couples to Gi/o; alpha1 and beta receptors commonly couple to different G-protein pathways.'],
  },
  glycine: {
    recall: ['How can glycine participate in both inhibitory transmission and NMDA-receptor signaling?', 'It acts at distinct receptor proteins with different properties.'],
    mechanism: ['What route supports glycine’s role as an inhibitory transmitter?', 'Glycine can be synthesized from serine and packaged by VGAT/VIAAT; binding to glycine receptors opens an anion-selective pore.', 'Glycine transporters regulate availability, and the voltage effect of the open pore depends on ion gradients.'],
    apply: ['Glycine occupies a site on GluN1. Does this mean an inhibitory glycine receptor has become an excitatory channel?', 'No. The GluN1 site belongs to an NMDA-receptor complex, a different molecular target.', 'Conventional NMDA receptors also require glutamate at GluN2 and appropriate membrane conditions; inhibitory glycine receptors are separate pentameric anion channels.'],
  },
  histamine: {
    recall: ['Does histamine’s role in immune signaling prevent it from serving as a brain transmitter?', 'No. Histamine can have distinct receptor-mediated roles in the brain and other tissues.'],
    mechanism: ['How do central histamine synthesis and metabolism differ from a generic reuptake-only model?', 'Histidine decarboxylase produces histamine, while histamine N-methyltransferase contributes to central metabolism and signal termination.', 'Central histamine receptors are GPCRs; the system does not rely on one universal synaptic reuptake route shared by every transmitter.'],
    apply: ['An H3 receptor on a nonhistaminergic terminal regulates that terminal’s transmitter release. Which receptor role describes this?', 'It acts as a heteroreceptor rather than an autoreceptor for histamine.', 'H3 receptors commonly engage Gi/o and can regulate their own transmitter system or other chemical pathways, depending on location.'],
  },
  neuropeptides: {
    recall: ['Why is “one neuron, one transmitter” an inadequate general rule?', 'A neuron can release neuropeptides alongside other transmitters.'],
    mechanism: ['Why does peptide transmitter replenishment depend on the cell body and secretory pathway?', 'Peptides start as gene-encoded precursor proteins, undergo processing and are packaged into dense-core vesicles for transport.', 'Their release can accompany another transmitter, and their receptors often engage G-protein signaling.'],
    apply: ['A released peptide is broken down extracellularly. Can the terminal generally refill vesicles by recapturing that peptide intact?', 'No. Intact peptides generally are not recovered and reloaded locally in that way.', 'Replenishment depends on biosynthesis and transport; one precursor protein can yield several active peptide products.'],
  },
  'sodium-channel': {
    recall: ['Why can sodium current decline while depolarization continues?', 'Voltage-gated sodium channels can inactivate and become temporarily unavailable.'],
    mechanism: ['How does sodium-channel activation produce positive feedback during a typical spike?', 'Depolarization increases opening, inward sodium current produces further depolarization, and that recruits additional channels.', 'Fast inactivation limits this feedback; repolarization supports recovery toward an available state.'],
    apply: ['A channel model labels magnesium pore block as the sodium channel’s voltage sensor. What should replace that explanation?', 'A sodium-channel voltage-sensing region includes charged S4 segments that respond to membrane voltage.', 'S5–S6 regions contribute to the pore, and the domain III–IV intracellular linker is central to fast inactivation; these are distinct molecular operations.'],
  },
  'potassium-channel': {
    recall: ['During typical spike conditions, what often happens when potassium conductance increases?', 'Outward potassium current moves voltage toward the potassium equilibrium potential, contributing to repolarization.'],
    mechanism: ['Why can potassium-channel opening contribute to both repolarization and an afterhyperpolarization?', 'Potassium conductance often rises more slowly than the rapid sodium current and can remain elevated as voltage returns toward rest.', 'Opening controls conductance; electrochemical driving force determines current direction, so the channel does not pump potassium outward.'],
    apply: ['Someone explains potassium selectivity only by comparing ion diameters. What molecular feature does that miss?', 'It misses the selectivity filter’s chemical geometry and its coordination of dehydrated potassium ions.', 'Selectivity and gating are separate properties; potassium-channel families also differ in activation, rectification and inactivation.'],
  },
  'calcium-channel': {
    recall: ['Why does the distance between a calcium channel and a release sensor matter?', 'Calcium concentration varies sharply near an open channel, so sensor location affects the speed and strength of its signal.'],
    mechanism: ['Why can equal total calcium entry produce different cellular responses?', 'The location and timing of entry, together with buffering and removal, determine the local calcium signal experienced by effectors.', 'Buffers, organelles, pumps and exchangers shape that signal after entry through the channel.'],
    apply: ['You compare fast transmitter release with low-voltage rebound firing. Which calcium-channel families are relevant to each example?', 'CaV2.1 and CaV2.2 support release at many fast synapses; CaV3 T-type channels support low-voltage rebound and rhythmic firing.', 'Channel family, localization, auxiliary subunits and coupling to nearby effectors all influence the resulting function.'],
  },
  ampa: {
    recall: ['What subunit feature strongly limits calcium permeability in many AMPA receptors?', 'The presence of Q/R-site-edited GluA2 strongly limits calcium permeability.'],
    mechanism: ['How does glutamate binding lead to AMPA-receptor opening?', 'Binding changes extracellular ligand-binding domains, coupling their movement to the transmembrane gate.', 'At typical resting voltage, net cation flow produces an inward current; subunit composition influences calcium permeability.'],
    apply: ['AMPA current declines while glutamate remains present. Is this the same process as current declining after transmitter removal?', 'No. Continued ligand exposure can produce desensitization, whereas transmitter removal favors deactivation.', 'AMPA receptors can enter a nonconducting state despite ligand presence; auxiliary proteins can further modify their kinetics.'],
  },
  nmda: {
    recall: ['What conditions support current through a conventional NMDA receptor?', 'Glutamate, a coagonist and relief of magnesium block support current through the receptor.'],
    mechanism: ['How does an NMDA receptor combine chemical input with postsynaptic activity?', 'Ligand occupancy supports gating, while depolarization reduces magnesium pore block and permits greater ion flux.', 'The pore can carry sodium, potassium and calcium, connecting transmission to local calcium-dependent signaling.'],
    apply: ['A conventional NMDA receptor has glutamate bound, but the membrane remains strongly negative. Why might its current still be limited?', 'Magnesium can block much of the current at negative voltages even when ligand binding supports gating.', 'Depolarization relieves this pore block; it is a different mechanism from the voltage-sensing domains of a sodium channel.'],
  },
  gabaa: {
    recall: ['Can GABA-A channels inhibit without producing a large hyperpolarization?', 'Yes. Increased conductance can shunt concurrent excitation.'],
    mechanism: ['How can opening a GABA-A channel change the impact of another synaptic current?', 'Its anion conductance drives voltage toward its reversal potential and can lower input resistance, reducing the voltage effect of concurrent excitation.', 'The inhibitory effect depends on reversal potential, membrane voltage and spike threshold, not solely on the size of hyperpolarization.'],
    apply: ['A molecule acts at an alpha–gamma interface on a benzodiazepine-sensitive GABA-A receptor. Is that the same site where GABA binds?', 'No. The alpha–gamma interface is a separate allosteric site, while GABA binds at beta–alpha interfaces.', 'Ligand binding, channel opening and modulation are distinct operations; M2 transmembrane segments line the anion pore.'],
  },
  ltp: {
    recall: ['What distinguishes induction from expression of LTP?', 'Induction is the trigger for change; expression is the mechanism producing the larger synaptic response.'],
    mechanism: ['At classic CA3–CA1 synapses, connect NMDA-dependent calcium entry to stronger AMPA transmission.', 'Calcium–calmodulin signaling can activate CaMKII and contribute to strengthening AMPA-mediated transmission.', 'Expression can involve receptor number, phosphorylation and conductance; later stabilization recruits additional molecular and structural processes.'],
    apply: ['Two synapses both show a lasting increase in response size. Must they share the same NMDA–CaMKII induction pathway?', 'No. LTP names a physiological outcome, and some forms are NMDA-independent or expressed presynaptically.', 'Induction, expression and stabilization should be tested for the specific synapse rather than inferred from the label alone.'],
  },
  ltd: {
    recall: ['Does LTD necessarily eliminate an affected synapse permanently?', 'No. Synaptic effectiveness can decrease without eliminating the synapse.'],
    mechanism: ['How can postsynaptic AMPA receptors contribute to a classic hippocampal form of LTD?', 'Calcium-dependent, phosphatase-associated signaling can reduce the AMPA contribution, including through receptor removal.', 'This describes one form of LTD; mechanisms differ across synapses and receptor systems.'],
    apply: ['A hippocampal synapse and a parallel-fiber–Purkinje synapse both weaken. Can you infer identical signaling in both?', 'No. Similar weakening can arise through different induction and expression mechanisms.', 'Cerebellar examples involve calcium and metabotropic glutamate pathways, including PKC-related signaling; some LTD elsewhere changes presynaptic release.'],
  },
  'spike-timing': {
    recall: ['Why should an STDP curve specify the preparation and experimental conditions?', 'Timing rules vary across cells, activity patterns and conditions.'],
    mechanism: ['How can changing relative spike timing change the plasticity signal?', 'Timing changes the overlap between presynaptic release, postsynaptic depolarization and calcium-dependent signaling.', 'Firing rate, bursts, local dendritic activity and neuromodulators also influence the resulting learning rule.'],
    apply: ['Presynaptic-before-postsynaptic activity produces potentiation in one experiment. Is that sequence guaranteed to potentiate every synapse?', 'No. The classic timing relationship applies under specified conditions, and other synapses or activity patterns can follow different rules.', 'Receptor composition, developmental stage, initial strength, inhibition and neuromodulation can modify the outcome.'],
  },
  'homeostatic-plasticity': {
    recall: ['Why might a neuron strengthen excitatory inputs after prolonged inactivity?', 'It may compensate for reduced activity and restore responsiveness toward an operating range.'],
    mechanism: ['How can synaptic scaling change overall responsiveness while preserving differences between inputs?', 'It can adjust excitatory response amplitudes approximately in proportion to their previous strengths.', 'The relative weights can remain different even as overall gain changes.'],
    apply: ['A neuron’s firing rate remains stable after experience. Does that establish that its synapses stayed unchanged?', 'No. Synapse-specific changes can coexist with compensatory synaptic, intrinsic or inhibitory plasticity.', 'These mechanisms can stabilize activity without sharing one sensor or time constant, and compensation need not be complete.'],
  },
  'structural-plasticity': {
    recall: ['What does an enlarged dendritic spine establish by itself?', 'It establishes a morphological change.'],
    mechanism: ['How can activity connect spine shape to synaptic composition?', 'Calcium-dependent signaling can regulate actin organization while receptor trafficking changes synaptic components.', 'Spine enlargement can accompany potentiation, but structure and functional strength are different measurements.'],
    apply: ['An imaging study finds a larger spine after learning. Can that image reveal the exact remembered event?', 'No. Morphology alone cannot identify the content of a stored memory.', 'Longitudinal imaging distinguishes transient and persistent changes, while functional measurements are needed to connect structure with electrical or behavioral effects.'],
  },
  'memory-consolidation': {
    recall: ['What kinds of change connect memory across cellular and network scales?', 'Memory depends on interacting cellular and network changes across multiple regions.'],
    mechanism: ['How can activity-dependent cellular signaling support a lasting change in a memory network?', 'It can engage gene expression, protein synthesis and altered synaptic organization within interacting hippocampal and cortical networks.', 'Reactivation can influence later processing; no single molecular change contains an entire autobiographical memory.'],
    apply: ['One experiment studies persistent synaptic function; another studies changing hippocampal and cortical contributions over time. Which kinds of consolidation are they addressing?', 'The first addresses synaptic consolidation; the second addresses systems consolidation.', 'Retrieval can also modify memory and sometimes engage reconsolidation, so remembering is not merely replaying an immutable record.'],
  },
};

const cardTypes = [
  ['recall', 'essentials', 'recall'],
  ['mechanism', 'mechanism', 'explain'],
  ['apply', 'advanced', 'apply'],
];

export const flashcards = topics.flatMap(topic => cardTypes.map(([suffix, level, kind]) => {
  const [prompt, answer, context] = cardsByTopic[topic.id][suffix];
  return {
    id: `${topic.id}-${suffix}`,
    topicId: topic.id,
    level,
    kind,
    prompt,
    answer,
    detail: context ?? topic.question.explanation,
    visual: topic.scene === 'tracts' ? 'tract' : topic.scene,
  };
}));
