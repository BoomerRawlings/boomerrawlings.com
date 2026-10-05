// Choice-specific feedback for the existing curriculum questions.
// Choice text is intentionally retained: tests prevent feedback/choice order drift.
// References resolve through curriculum.js; these explain mechanisms, not a learner diagnosis.
export const questionFeedback = {
  "brain-overview": {
    "choices": [
      {
        "choice": "Afferent",
        "explanation": "Afferent describes a projection arriving at the named reference structure. This fiber carries information into the thalamus, so it is afferent relative to the thalamus."
      },
      {
        "choice": "Efferent",
        "explanation": "Efferent describes a projection leaving the reference structure. A fiber entering the thalamus is traveling in the opposite direction relative to that reference.",
        "correction": "State the reference structure first: toward it is afferent; away from it is efferent."
      },
      {
        "choice": "Necessarily inhibitory",
        "explanation": "Incoming direction does not determine whether a synapse excites or inhibits its target. Afferent and efferent describe anatomical direction, while inhibition describes an effect on signaling.",
        "correction": "Keep direction separate from synaptic effect: this fiber is afferent, but its inhibitory or excitatory action is unspecified."
      }
    ],
    "sourceIds": [
      "organization",
      "allen"
    ]
  },
  "cerebral-cortex": {
    "choices": [
      {
        "choice": "All functions occur in the cerebellum",
        "explanation": "The cerebellum contributes to multiple functions, but it does not contain every circuit supporting behavior. Moving all functions to another single structure repeats the same localization error.",
        "correction": "Explain complex behavior through interacting cortical and subcortical networks, including specialized contributions within them."
      },
      {
        "choice": "Complex behavior depends on interacting networks",
        "explanation": "Frontal regions make important contributions, but behavior depends on connections within the frontal lobe and with other cortical and subcortical regions. A lobe label alone does not explain the network or computation."
      },
      {
        "choice": "The frontal lobe contains only white matter",
        "explanation": "The frontal lobe includes cortical gray matter as well as underlying white matter. Its contribution to behavior involves local neurons and their connections, not white matter alone.",
        "correction": "Distinguish cortical processing from connecting axons, then explain how frontal regions participate in larger networks."
      }
    ],
    "sourceIds": [
      "internal-anatomy",
      "motor-lab",
      "visual",
      "thalamus-circuits"
    ]
  },
  "thalamus": {
    "choices": [
      {
        "choice": "Ventral posterolateral nucleus",
        "explanation": "VPL is a major somatosensory relay for the body, including input carried by the medial lemniscus. It is not the main relay from retina to primary visual cortex.",
        "correction": "Match the pathway to the nucleus: body sensation to VPL; retinal visual input to LGN."
      },
      {
        "choice": "Medial geniculate nucleus",
        "explanation": "The medial geniculate nucleus is an auditory relay. Its similar name to the lateral geniculate nucleus can obscure their different sensory connections.",
        "correction": "Medial geniculate is auditory; lateral geniculate is visual."
      },
      {
        "choice": "Lateral geniculate nucleus",
        "explanation": "The lateral geniculate nucleus receives retinal input and projects through the optic radiation toward primary visual cortex. It is a major visual relay, although not the only target of retinal projections."
      }
    ],
    "sourceIds": [
      "thalamus-lab",
      "thalamic-communication",
      "thalamus-circuits"
    ]
  },
  "hypothalamus": {
    "choices": [
      {
        "choice": "Autonomic, endocrine, and behavioral regulation",
        "explanation": "Hypothalamic circuits coordinate autonomic outputs, hormone regulation and behaviors related to internal state. These routes let a physiological need influence both the body and the actions used to meet that need."
      },
      {
        "choice": "Only voluntary skeletal movement",
        "explanation": "Voluntary skeletal movement involves cortical, brainstem and spinal motor circuits. Restricting hypothalamic output to this route leaves out its central roles in hormone control and autonomic regulation.",
        "correction": "Associate the hypothalamus with coordinated autonomic, endocrine and behavioral responses to internal conditions."
      },
      {
        "choice": "Only visual processing",
        "explanation": "The hypothalamus can use light-related input in circadian regulation, but this does not make it exclusively a visual processor. Its outputs regulate many aspects of internal state.",
        "correction": "Separate a sensory input to a regulatory circuit from the broader autonomic, endocrine and behavioral functions of that circuit."
      }
    ],
    "sourceIds": [
      "hypothalamus-source"
    ]
  },
  "hippocampus": {
    "choices": [
      {
        "choice": "It stores every memory permanently",
        "explanation": "The hippocampus is important for forming and organizing episodic and relational memories, but it is not a permanent store for every kind of memory. Skills, habits and long-term representations involve additional systems.",
        "correction": "Specify the memory type and stage instead of treating the hippocampus as a universal memory storage site."
      },
      {
        "choice": "It helps form and organize certain kinds of memory",
        "explanation": "The hippocampus helps form and organize certain memories within distributed networks. This allows substantial involvement in episodic and relational memory without assigning every memory process to one structure."
      },
      {
        "choice": "It is the only region capable of plasticity",
        "explanation": "Experience-dependent change occurs in many cortical and subcortical circuits. Hippocampal plasticity is extensively studied, but that does not make plasticity exclusive to the hippocampus.",
        "correction": "Distinguish a well-studied example of plasticity from a claim that no other brain region can change."
      }
    ],
    "sourceIds": [
      "hippocampus-source",
      "memory-foundation",
      "hippocampal-computation"
    ]
  },
  "amygdala": {
    "choices": [
      {
        "choice": "Only one nucleus contains neurons",
        "explanation": "Each amygdala nucleus contains neurons; the important distinction is their cell populations and connections. A nucleus is not an empty compartment except for one uniquely neuronal region.",
        "correction": "Compare nuclear connections: basolateral circuits interact with cortical and hippocampal information, while central outputs influence hypothalamic and brainstem responses."
      },
      {
        "choice": "All nuclei have identical inputs",
        "explanation": "Amygdala nuclei do not all receive identical inputs or send identical outputs. Treating them as interchangeable hides how learned significance can influence different responses.",
        "correction": "Use each nucleus’s inputs and outputs to explain its contribution rather than assigning one uniform function to the entire amygdala."
      },
      {
        "choice": "Each nucleus has distinct connections and contributions",
        "explanation": "The nuclei have different connections and contributions to learning and coordinated responses. For example, basolateral and central circuits occupy different positions between information about an event and physiological responses to it."
      }
    ],
    "sourceIds": [
      "amygdala-source"
    ]
  },
  "cerebellum": {
    "choices": [
      {
        "choice": "Inhibitory GABAergic",
        "explanation": "Purkinje cells release GABA and provide inhibitory output from cerebellar cortex. They act on deep cerebellar nuclei and, in some circuits, vestibular nuclei."
      },
      {
        "choice": "Excitatory glutamatergic",
        "explanation": "Glutamatergic excitation characterizes several inputs within cerebellar circuitry, including parallel and climbing fibers. Purkinje-cell output is a different connection: it is GABAergic and inhibitory.",
        "correction": "Identify the cell and connection before assigning a transmitter: Purkinje output is inhibitory GABAergic."
      },
      {
        "choice": "Always electrically silent",
        "explanation": "An inhibitory neuron can be electrically active and produce action potentials. Inhibitory describes its synaptic effect on a target, not an absence of firing in the neuron itself.",
        "correction": "Separate the Purkinje cell’s own electrical activity from the inhibitory effect of the GABA it releases."
      }
    ],
    "sourceIds": [
      "cerebellum-source",
      "cerebellum-modern"
    ]
  },
  "brainstem": {
    "choices": [
      {
        "choice": "It contains every cortical neuron",
        "explanation": "Cortical neuronal cell bodies are in cerebral cortex, not all concentrated in the brainstem. Brainstem influence instead reflects important local nuclei and many axons passing through the region.",
        "correction": "Distinguish where a neuron’s cell body lies from where its axon travels or receives influence."
      },
      {
        "choice": "Many important tracts and projecting nuclei are concentrated there",
        "explanation": "The brainstem contains concentrated ascending and descending pathways as well as nuclei with widespread projections. A small region can therefore participate in many distant processes through its connectivity."
      },
      {
        "choice": "Signals bypass the brainstem entirely",
        "explanation": "Many major pathways pass through or originate in the brainstem. Assuming all signals bypass it misses both tracts of passage and the outputs of its own nuclei.",
        "correction": "Consider both the routes through the brainstem and the signals generated by brainstem neurons."
      }
    ],
    "sourceIds": [
      "organization",
      "monoamines"
    ]
  },
  "white-matter": {
    "choices": [
      {
        "choice": "A photographed single axon",
        "explanation": "A diffusion-tractography streamline is computed from imaging data and tracking assumptions. It is not a microscope photograph identifying one physical axon.",
        "correction": "Interpret each line as an estimated trajectory, not a directly observed individual fiber."
      },
      {
        "choice": "A measured neurotransmitter concentration",
        "explanation": "Diffusion tractography uses water-diffusion information to estimate pathways. It does not identify a bundle’s neurotransmitter concentration or the transmitter released by its axons.",
        "correction": "Separate a reconstruction of candidate routes from a biochemical measurement of signaling molecules."
      },
      {
        "choice": "A model-derived candidate trajectory",
        "explanation": "A streamline is a model-derived candidate trajectory. Crossing fibers and reconstruction choices can produce missed or spurious paths, so streamline number is not an axon count and conventional tractography does not establish signaling direction."
      }
    ],
    "sourceIds": [
      "tract-atlas",
      "tractography-limits"
    ]
  },
  "corpus-callosum": {
    "choices": [
      {
        "choice": "Commissural fibers",
        "explanation": "Callosal fibers cross the midline to connect the cerebral hemispheres, which defines them as commissural. Their endpoints can be corresponding or different cortical regions."
      },
      {
        "choice": "Association fibers",
        "explanation": "Association fibers connect cortical areas within one hemisphere. The corpus callosum instead connects between hemispheres, placing it in the commissural class.",
        "correction": "Classify by connection pattern: within one hemisphere is association; between hemispheres is commissural."
      },
      {
        "choice": "Peripheral sensory nerves",
        "explanation": "The corpus callosum is a central white-matter structure connecting cerebral hemispheres. Peripheral sensory nerves connect peripheral receptors and the nervous system; they are a different anatomical class.",
        "correction": "Locate the bundle in the CNS and identify its interhemispheric endpoints: it is a commissure."
      }
    ],
    "sourceIds": [
      "internal-anatomy",
      "tract-atlas"
    ]
  },
  "corticospinal": {
    "choices": [
      {
        "choice": "Corpus callosum",
        "explanation": "The corpus callosum carries interhemispheric connections. Most corticospinal fibers cross farther down their descending route, at the pyramidal decussation in the caudal medulla.",
        "correction": "Do not assign every midline crossing to the callosum; identify the crossing belonging to the specific pathway."
      },
      {
        "choice": "Lower medulla",
        "explanation": "Most corticospinal fibers cross at the pyramidal decussation in the lower, or caudal, medulla before entering the lateral corticospinal tract. Smaller components have different crossing and termination patterns."
      },
      {
        "choice": "Neuromuscular junction",
        "explanation": "A neuromuscular junction is a synapse between a lower motor neuron and muscle. It is not where descending corticospinal axons cross the midline.",
        "correction": "Keep the descending CNS pathway separate from the lower motor neuron’s peripheral connection to muscle."
      }
    ],
    "sourceIds": [
      "corticospinal-source",
      "internal-capsule"
    ]
  },
  "dorsal-column": {
    "choices": [
      {
        "choice": "Contralaterally in the optic tract",
        "explanation": "The optic tract belongs to the visual pathway. Primary body afferents in the dorsal-column pathway ascend on the same side before reaching a medullary relay.",
        "correction": "Trace body sensation through ipsilateral dorsal columns, then gracile or cuneate nuclei, rather than through visual pathways."
      },
      {
        "choice": "Through the corpus callosum",
        "explanation": "The corpus callosum connects cerebral hemispheres; it is not the ascending route to gracile or cuneate nuclei. These primary afferents reach the medulla through spinal dorsal columns.",
        "correction": "The first leg is ipsilateral dorsal column; the later medullary crossing belongs to second-order axons."
      },
      {
        "choice": "Ipsilaterally in the dorsal column",
        "explanation": "Primary afferents ascend ipsilaterally to gracile or cuneate nuclei. Second-order axons then cross in the medulla and ascend as the medial lemniscus toward VPL."
      }
    ],
    "sourceIds": [
      "somatosensory"
    ]
  },
  "optic-radiation": {
    "choices": [
      {
        "choice": "The left visual hemifield from both eyes",
        "explanation": "Right primary visual cortex mainly represents the left visual hemifield using information from both eyes. Partial crossing at the optic chiasm sorts projections by visual-field side, not simply by eye."
      },
      {
        "choice": "The right eye only",
        "explanation": "Each eye samples both sides of the visual field. At the chiasm, nasal retinal axons cross and temporal retinal axons do not, so right-sided postchiasmal pathways contain input from both eyes.",
        "correction": "Use visual hemifield, not eye identity, to describe the main left–right organization of visual cortex."
      },
      {
        "choice": "The entire visual field from the left eye",
        "explanation": "The left eye’s entire field does not project only to right visual cortex. Its nasal and temporal retinal outputs take different sides at the chiasm.",
        "correction": "Right visual cortex mainly receives the left visual hemifield from both eyes, not all visual information from one eye."
      }
    ],
    "sourceIds": [
      "visual",
      "sight"
    ]
  },
  "association-fibers": {
    "choices": [
      {
        "choice": "It must cross the midline",
        "explanation": "Crossing between cerebral hemispheres characterizes commissural fibers. Association tracts are defined by connecting cortical regions within the same hemisphere.",
        "correction": "Use within-hemisphere endpoints to identify association fibers; use interhemispheric endpoints to identify commissural fibers."
      },
      {
        "choice": "It links cortical regions within one hemisphere",
        "explanation": "An association tract connects cortical regions within one hemisphere. This class includes short U-fibers between neighboring gyri and longer fasciculi between more distant territories."
      },
      {
        "choice": "It contains only unmyelinated fibers",
        "explanation": "Myelination is not the feature defining association fibers. The term describes their endpoints; many association axons contribute to cerebral white matter.",
        "correction": "Classify an association tract by where it connects, not by claiming every axon has the same myelination state."
      }
    ],
    "sourceIds": [
      "tract-atlas",
      "tractography-limits"
    ]
  },
  "cortical-circuit": {
    "choices": [
      {
        "choice": "Axonal myelination",
        "explanation": "Myelination changes axonal conduction; it does not name a circuit in which an excited interneuron inhibits the cell that recruited it. The question describes a returning inhibitory connection.",
        "correction": "Trace the loop: excitatory neuron to interneuron, then inhibition back to the original neuron."
      },
      {
        "choice": "Vesicle recycling",
        "explanation": "Vesicle recycling restores membrane and release resources at a synapse. It does not describe the sign and arrangement of connections among the two neurons in this loop.",
        "correction": "Separate machinery within a terminal from the circuit motif formed by connections between cells."
      },
      {
        "choice": "Feedback inhibition",
        "explanation": "The excitatory neuron recruits inhibition that returns to influence its own activity, forming feedback inhibition. This differs from feedforward inhibition, in which an incoming pathway recruits inhibition of a downstream target."
      }
    ],
    "sourceIds": [
      "cns-synapses",
      "hippocampus-source",
      "interneuron-connections",
      "interneuron-types"
    ]
  },
  "basal-ganglia": {
    "choices": [
      {
        "choice": "By inhibiting another inhibitory neuron",
        "explanation": "Inhibiting a neuron that normally inhibits a target can release that target from inhibition. This is disinhibition: the downstream increase does not require the first synapse to become excitatory."
      },
      {
        "choice": "By converting GABA into glutamate instantly",
        "explanation": "The increased downstream activity does not require GABA to change into glutamate. It follows from the arrangement of inhibitory connections and the reduction of inhibition on a later target.",
        "correction": "Track the signs across successive synapses: inhibition of inhibition can produce disinhibition."
      },
      {
        "choice": "By bypassing all synapses",
        "explanation": "The effect depends on connected synapses rather than bypassing them. In the example, changing one inhibitory neuron’s activity changes how strongly it inhibits its own target.",
        "correction": "Explain the downstream effect by following the inhibitory connections one step at a time."
      }
    ],
    "sourceIds": [
      "basal-circuits",
      "basal-modern"
    ]
  },
  "hippocampal-circuit": {
    "choices": [
      {
        "choice": "Dentate gyrus to CA3",
        "explanation": "Dentate granule-cell axons project to CA3 as mossy fibers. That is the preceding connection in the familiar trisynaptic sequence, not the Schaffer collateral projection.",
        "correction": "Distinguish dentate gyrus to CA3 via mossy fibers from CA3 to CA1 via Schaffer collaterals."
      },
      {
        "choice": "CA3 to CA1",
        "explanation": "Schaffer collaterals are CA3 axon branches projecting to CA1. This distinguishes them from dentate granule-cell mossy fibers that project to CA3."
      },
      {
        "choice": "Thalamus to cerebellum",
        "explanation": "Schaffer collaterals are a hippocampal projection, not a pathway defined by thalamic and cerebellar endpoints. The named connection runs from CA3 to CA1.",
        "correction": "Anchor this fiber name to its hippocampal subfields: CA3 is the source and CA1 the target."
      }
    ],
    "sourceIds": [
      "hippocampus-source",
      "plasticity-memory",
      "hippocampal-computation",
      "ca3-study"
    ]
  },
  "cerebellar-circuit": {
    "choices": [
      {
        "choice": "Dentate granule cell",
        "explanation": "Dentate granule cells belong to the hippocampal dentate gyrus, where their mossy fibers reach CA3. Cerebellar granule cells are different cells whose axons form parallel fibers; neither is the source of climbing fibers.",
        "correction": "Keep similarly named cells separate: cerebellar climbing fibers arise from the inferior olive."
      },
      {
        "choice": "Primary visual cortex",
        "explanation": "Primary visual cortex is not the source of the cerebellar climbing-fiber system. Climbing fibers originate in the inferior olive and make distinctive connections onto Purkinje cells.",
        "correction": "Identify the afferent by its origin: inferior olive to cerebellar cortex is the climbing-fiber route."
      },
      {
        "choice": "Inferior olive",
        "explanation": "Climbing fibers originate from inferior olivary neurons and strongly influence Purkinje cells. Cerebellar granule cells instead supply parallel-fiber input, a separate afferent route."
      }
    ],
    "sourceIds": [
      "cerebellum-source",
      "cerebellum-modern"
    ]
  },
  "neuron": {
    "choices": [
      {
        "choice": "Its membrane and branches actively transform inputs",
        "explanation": "Membrane conductances, cell shape and the placement of inputs determine how a neuron transforms incoming signals. Integration and spike generation therefore involve more than passive transmission along a wire."
      },
      {
        "choice": "Every input always produces exactly one spike",
        "explanation": "A synaptic input can be subthreshold, combine with other inputs or reduce the chance of firing. There is no general one-input-to-one-spike rule.",
        "correction": "Predict output from the combined inputs, conductances and threshold conditions, not from a fixed spike count per input."
      },
      {
        "choice": "All neurons have identical electrical properties",
        "explanation": "Neurons vary in morphology, channels and other electrical properties. These differences affect integration and firing, which is part of why neuron type matters.",
        "correction": "Use the relevant cell’s structure and conductances rather than assuming every neuron transforms input identically."
      }
    ],
    "sourceIds": [
      "organization",
      "allen-cells",
      "axon-initial-segment",
      "axonal-transport"
    ]
  },
  "dendrites": {
    "choices": [
      {
        "choice": "All locations affect the soma identically",
        "explanation": "Inputs at different dendritic locations do not necessarily produce equal effects at the soma. Electrical spread, branch geometry and local channels alter their influence.",
        "correction": "Consider distance, branch structure and local conductances when comparing two synaptic locations."
      },
      {
        "choice": "Distance, branching, and local conductances alter its impact",
        "explanation": "Distance, branching and local conductances influence how a dendritic input affects the rest of the cell. Dendrites can also support local nonlinear events, so location matters beyond distance alone."
      },
      {
        "choice": "Dendrites contain no membrane proteins",
        "explanation": "Dendritic membranes contain receptors and ion channels that affect synaptic responses and electrical spread. Excluding these proteins would remove a major part of dendritic integration.",
        "correction": "Treat dendrites as membranes with spatially organized receptors and conductances, not protein-free branches."
      }
    ],
    "sourceIds": [
      "cns-synapses",
      "spine-study"
    ]
  },
  "myelin": {
    "choices": [
      {
        "choice": "A synaptic vesicle",
        "explanation": "Synaptic vesicles package transmitter at release sites; they do not travel from node to node to carry the action potential. Internodal spread is electrical.",
        "correction": "Distinguish propagation along one axon from vesicle-mediated communication at a chemical synapse."
      },
      {
        "choice": "A packet of neurotransmitter inside myelin",
        "explanation": "A packet of transmitter inside the myelin sheath is not the signal traveling between nodes. Myelin changes the electrical properties of the axonal membrane and supports efficient local current spread.",
        "correction": "Local electrical current spreads beneath myelin and helps bring the next node to spike threshold."
      },
      {
        "choice": "A local electrical current",
        "explanation": "Local electrical current spreads between nodes beneath the myelin sheath. Voltage-gated channels at nodes regenerate the action potential, so the spike is renewed rather than physically leaping through empty space."
      }
    ],
    "sourceIds": [
      "glia",
      "propagation"
    ]
  },
  "astrocytes": {
    "choices": [
      {
        "choice": "Maintaining extracellular ion and transmitter conditions",
        "explanation": "Astrocytes help regulate extracellular ions and transmitter levels, supporting conditions in which neurons signal. This includes potassium regulation and transmitter uptake rather than replacing neuronal signaling machinery."
      },
      {
        "choice": "Replacing every neuron’s axon",
        "explanation": "Astrocytes support and regulate neurons but do not replace each neuron’s axon. Axons remain specialized neuronal processes that carry signals toward their targets.",
        "correction": "Separate glial support of the extracellular environment from the neuron’s own axonal conduction."
      },
      {
        "choice": "Producing all CNS action potentials",
        "explanation": "Neuronal membranes generate the action potentials considered here. Astrocytes influence the surrounding conditions and have their own signaling, but do not produce every CNS spike.",
        "correction": "Distinguish modulation of neuronal excitability from generating the neuron’s action potential."
      }
    ],
    "sourceIds": [
      "glia",
      "glia-mesh"
    ]
  },
  "microglia": {
    "choices": [
      {
        "choice": "Static structural glue",
        "explanation": "Microglia are active resident immune cells with motile processes and context-dependent responses. Describing them as static glue misses surveillance and interactions with surrounding tissue.",
        "correction": "Recognize microglia by their dynamic immune and tissue-surveillance functions rather than a passive structural role."
      },
      {
        "choice": "Dynamic resident immune cells",
        "explanation": "Microglia are resident immune cells whose processes survey their surroundings and change with local conditions. Their roles extend beyond a simple on/off distinction between resting and active states."
      },
      {
        "choice": "Myelin-producing peripheral cells",
        "explanation": "Schwann cells produce peripheral myelin; oligodendrocytes form CNS myelin. Microglia are a different glial population with resident immune functions.",
        "correction": "Match each glial role to the cell type: microglia for immune surveillance, Schwann cells or oligodendrocytes for myelin."
      }
    ],
    "sourceIds": [
      "glia-mesh",
      "glia-modern",
      "microglia-origin"
    ]
  },
  "resting-potential": {
    "choices": [
      {
        "choice": "Channels always pump ions inward",
        "explanation": "An open potassium channel allows passive movement down the electrochemical gradient; it does not pump ions in a fixed direction. Pumps and channels have different mechanisms.",
        "correction": "Determine potassium-current direction from membrane voltage relative to the potassium equilibrium potential."
      },
      {
        "choice": "Potassium loses its charge",
        "explanation": "Potassium remains a positively charged ion while passing through a potassium channel. A change in net movement reflects the balance of electrical and chemical forces, not loss of charge.",
        "correction": "Track both the concentration gradient and the membrane’s electrical gradient for the same charged ion."
      },
      {
        "choice": "The electrochemical driving force can favor inward movement",
        "explanation": "If membrane voltage is more negative than the potassium equilibrium potential, the net electrochemical force favors potassium entry through an open channel. A channel’s selectivity does not fix current direction."
      }
    ],
    "sourceIds": [
      "resting-source",
      "resting-ut"
    ]
  },
  "synaptic-release": {
    "choices": [
      {
        "choice": "A local rise in calcium",
        "explanation": "An arriving spike opens presynaptic voltage-gated calcium channels. The resulting local calcium rise acts on the release machinery to trigger rapid vesicle fusion."
      },
      {
        "choice": "Sodium–potassium pump reversal",
        "explanation": "The sodium–potassium pump maintains ion gradients over time but is not the immediate trigger for fast vesicle fusion. Spike-triggered calcium entry supplies that local coupling signal.",
        "correction": "Separate gradient maintenance by pumps from rapid calcium-triggered exocytosis at the active zone."
      },
      {
        "choice": "A new axon growing across the cleft",
        "explanation": "Fast transmission uses an existing presynaptic terminal and postsynaptic membrane separated by a cleft. It does not require growing a new axon across the space.",
        "correction": "Vesicles fuse with the presynaptic membrane; released transmitter crosses the cleft to reach postsynaptic receptors."
      }
    ],
    "sourceIds": [
      "release-ut",
      "synaptic-transmission"
    ]
  },
  "synaptic-integration": {
    "choices": [
      {
        "choice": "No, all depolarization always triggers a spike",
        "explanation": "Depolarization means voltage becomes less negative; it does not guarantee threshold or a spike. An input can depolarize slightly while its added conductance reduces the effect of other excitatory inputs.",
        "correction": "Judge inhibition by its effect on firing, including conductance and reversal potential, rather than voltage direction alone."
      },
      {
        "choice": "Yes, through effects such as shunting",
        "explanation": "An added conductance can shunt excitatory input even while causing some depolarization. Whether the input inhibits firing depends on reversal potential, threshold and the surrounding pattern of activity."
      },
      {
        "choice": "Only if the neuron has no channels",
        "explanation": "Shunting requires membrane conductance, typically through open channels. Removing all channels would remove this mechanism rather than make it possible.",
        "correction": "Use the extra channel conductance to explain how excitation is reduced despite a depolarizing voltage change."
      }
    ],
    "sourceIds": [
      "cns-synapses",
      "resting-source"
    ]
  },
  "electrical-synapses": {
    "choices": [
      {
        "choice": "It always releases dopamine",
        "explanation": "Dopamine release is a chemical signaling mechanism, not a requirement for an electrical synapse. Electrical coupling directly links the cells through intercellular channels.",
        "correction": "Identify electrical transmission by current through gap-junction channels rather than by a released transmitter."
      },
      {
        "choice": "It requires a vesicle to cross the cleft",
        "explanation": "Electrical synapses do not require vesicular release. Even at chemical synapses, transmitter molecules cross the cleft after a vesicle fuses; the intact vesicle does not cross to the next cell.",
        "correction": "Distinguish direct intercellular current from release and diffusion of transmitter at a chemical synapse."
      },
      {
        "choice": "Direct current flow through intercellular channels",
        "explanation": "Gap-junction channels provide a direct route for ionic current between cells. This allows rapid electrical coupling without requiring transmitter release into a synaptic cleft."
      }
    ],
    "sourceIds": [
      "synaptic-transmission",
      "electrical-review"
    ]
  },
  "transmitter-clearance": {
    "choices": [
      {
        "choice": "Acetylcholine",
        "explanation": "Acetylcholinesterase rapidly hydrolyzes acetylcholine into choline and acetate. Choline can then be taken up for reuse, which is distinct from simply transporting intact acetylcholine back into the terminal."
      },
      {
        "choice": "All transmitters identically",
        "explanation": "Transmitters do not all use one identical clearance route. Enzymatic breakdown is prominent for acetylcholine, while uptake transporters are important for molecules such as glutamate and monoamines.",
        "correction": "Identify the transmitter before choosing its main combination of uptake, diffusion and enzymatic breakdown."
      },
      {
        "choice": "Potassium",
        "explanation": "Potassium is an ion involved in electrical signaling and ionic homeostasis. It is not hydrolyzed by acetylcholinesterase as if it were acetylcholine.",
        "correction": "Separate ion redistribution from enzymatic breakdown of a transmitter molecule; the cleft-enzyme example is acetylcholine."
      }
    ],
    "sourceIds": [
      "ach-source",
      "glutamate-system",
      "release-ut"
    ]
  },
  "short-term-plasticity": {
    "choices": [
      {
        "choice": "Every second spike is twice as large",
        "explanation": "A larger second synaptic response does not require an action potential twice as large. Residual presynaptic calcium can change how much transmitter is released by a later spike.",
        "correction": "Distinguish presynaptic spike size from release probability and the size of the resulting postsynaptic response."
      },
      {
        "choice": "Residual calcium can increase release probability",
        "explanation": "Calcium remaining after the first spike can increase release probability for a closely following spike. This can produce facilitation, although depletion and other processes can instead favor depression."
      },
      {
        "choice": "The postsynaptic cell must grow a new dendrite",
        "explanation": "Growth of a new dendrite is not required for a response to change across a closely spaced pair of stimuli. Existing synapses can change efficacy through short-lived changes in release machinery and resources.",
        "correction": "Match the timescale: paired-pulse facilitation can arise from residual calcium in an existing terminal."
      }
    ],
    "sourceIds": [
      "short-term-review",
      "calcium-plasticity"
    ]
  },
  "glutamate": {
    "choices": [
      {
        "choice": "It always turns into GABA in the cleft",
        "explanation": "GABA can be synthesized from glutamate within GABAergic neurons, but glutamate does not invariably turn into GABA in the synaptic cleft. The downstream inhibition in this example comes from circuit connections.",
        "correction": "Follow the cells: glutamate excites an inhibitory interneuron, which then inhibits its own targets."
      },
      {
        "choice": "All glutamate receptors are chloride channels",
        "explanation": "Ionotropic glutamate receptors are cation channels, and metabotropic glutamate receptors are GPCRs. They are not uniformly chloride channels; a downstream inhibitory effect can arise without changing this receptor classification.",
        "correction": "Keep the receptor’s direct action separate from the net effect of the neurons it recruits."
      },
      {
        "choice": "It may excite an inhibitory interneuron",
        "explanation": "Glutamate can excite an inhibitory interneuron, whose output then reduces activity in another cell. The sign of the first synapse and the effect of the complete circuit therefore need not be the same."
      }
    ],
    "sourceIds": [
      "glutamate-system",
      "glutamate-receptors",
      "gabab"
    ]
  },
  "gaba": {
    "choices": [
      {
        "choice": "The relevant ion gradients and membrane voltage",
        "explanation": "GABA-A receptors conduct anions, so current direction depends on the relevant ion gradients and membrane voltage. The effect on firing also depends on conductance and threshold; depolarizing need not mean excitatory."
      },
      {
        "choice": "The name of the transmitter alone",
        "explanation": "The transmitter name alone does not determine current direction. For GABA-A receptors, the anion reversal potential relative to membrane voltage matters, and GABA-B receptors act through a different mechanism.",
        "correction": "Specify the receptor and electrochemical conditions before predicting a GABA response."
      },
      {
        "choice": "Whether the synapse is drawn blue",
        "explanation": "Blue is a diagram convention, not a determinant of ion flow. Changing a model’s color cannot change a receptor’s permeability, ion gradients or membrane voltage.",
        "correction": "Use physiological variables, especially anion gradients and membrane voltage, to predict GABA-A current."
      }
    ],
    "sourceIds": [
      "gaba-source",
      "ligand-channels",
      "gabab"
    ]
  },
  "dopamine": {
    "choices": [
      {
        "choice": "A universal increase in happiness",
        "explanation": "Dopamine has diverse roles across circuits and is not a universal happiness signal. A neuron’s response depends on its receptors and the signaling network in which it participates.",
        "correction": "Replace a single emotional label with a receptor-specific and circuit-specific explanation."
      },
      {
        "choice": "Receptors and circuit context",
        "explanation": "Dopamine acts through receptor families with different coupling, including D1-like and D2-like receptors. Receptor expression and circuit context therefore help explain why its effects vary between cells and conditions."
      },
      {
        "choice": "Molecular color in the model",
        "explanation": "A molecular model’s display color helps visualize the structure but does not determine its physiological action. Dopamine’s effect depends on receptor interactions and the receiving circuit.",
        "correction": "Use receptor type and cellular context to predict signaling, not the palette used to draw the molecule."
      }
    ],
    "sourceIds": [
      "monoamines",
      "dopamine-receptors"
    ]
  },
  "serotonin": {
    "choices": [
      {
        "choice": "Every serotonin receptor",
        "explanation": "Most serotonin receptor families are GPCRs, so the ion-channel mechanism cannot be assigned to every serotonin receptor. The key exception is 5-HT3.",
        "correction": "Distinguish the ionotropic 5-HT3 receptor from the metabotropic serotonin receptor families."
      },
      {
        "choice": "No serotonin receptor",
        "explanation": "5-HT3 is a ligand-gated ion channel, so serotonin signaling is not exclusively metabotropic. Other serotonin receptor families use G-protein signaling.",
        "correction": "Keep the exception explicit: 5-HT3 directly gates a cation channel."
      },
      {
        "choice": "5-HT3",
        "explanation": "5-HT3 is a ligand-gated cation channel. The other recognized serotonin receptor families are GPCRs, so receptor identity changes the mechanism and time course of the response."
      }
    ],
    "sourceIds": [
      "monoamines",
      "serotonin-channel"
    ]
  },
  "acetylcholine": {
    "choices": [
      {
        "choice": "Nicotinic: ion channel; muscarinic: GPCR",
        "explanation": "Nicotinic acetylcholine receptors are ligand-gated ion channels; muscarinic receptors are GPCRs. The same transmitter can therefore produce different responses by acting at different receptor proteins."
      },
      {
        "choice": "Both are voltage-gated sodium channels",
        "explanation": "Acetylcholine receptors are activated by ligand binding, not classified as voltage-gated sodium channels. Nicotinic receptors form cation channels, while muscarinic receptors signal through G proteins.",
        "correction": "Separate the activating signal from the permeant ions: ligand-gated nicotinic channels are not voltage-gated sodium channels."
      },
      {
        "choice": "Muscarinic: ion channel; nicotinic: enzyme",
        "explanation": "This reverses the receptor classes and confuses a receptor with an enzyme. Acetylcholinesterase is the enzyme that breaks down acetylcholine; nicotinic receptors are ion channels and muscarinic receptors are GPCRs.",
        "correction": "Keep three roles distinct: nicotinic channel, muscarinic GPCR and acetylcholinesterase enzyme."
      }
    ],
    "sourceIds": [
      "ach-source",
      "ach-ut",
      "ligand-channels",
      "gabab"
    ]
  },
  "norepinephrine": {
    "choices": [
      {
        "choice": "Gamma-aminobutyric acid",
        "explanation": "Gamma-aminobutyric acid is GABA, a different transmitter. Norepinephrine is a catecholamine that acts at adrenergic receptors.",
        "correction": "Pair norepinephrine with its synonym noradrenaline; reserve gamma-aminobutyric acid for GABA."
      },
      {
        "choice": "Noradrenaline",
        "explanation": "Noradrenaline and norepinephrine are two names for the same molecule. Its effects depend on adrenergic receptor subtype and circuit context, rather than on which name is used."
      },
      {
        "choice": "Acetyl-CoA",
        "explanation": "Acetyl-CoA is a metabolic molecule used in acetylcholine synthesis, not another name for norepinephrine. Norepinephrine belongs to the catecholamine pathway.",
        "correction": "Distinguish a biosynthetic substrate from a transmitter synonym: norepinephrine is noradrenaline."
      }
    ],
    "sourceIds": [
      "monoamines",
      "noradrenaline",
      "gabab"
    ]
  },
  "glycine": {
    "choices": [
      {
        "choice": "It changes its identity into glutamate",
        "explanation": "Glycine does not need to become glutamate to have different effects. It binds different receptor proteins, including inhibitory glycine receptors and the coagonist site of NMDA receptors.",
        "correction": "Explain the difference through molecular targets, not through a change in glycine’s chemical identity."
      },
      {
        "choice": "All glycine receptors are NMDA receptors",
        "explanation": "Inhibitory glycine receptors are separate anion-channel proteins. The glycine-binding site on an NMDA receptor belongs to a different receptor complex that conducts cations.",
        "correction": "Separate the glycine receptor from the glycine site on an NMDA receptor."
      },
      {
        "choice": "It acts at distinct receptor proteins with different properties",
        "explanation": "The same glycine molecule acts at different receptor proteins. Glycine receptors are inhibitory anion channels, while glycine can serve as a coagonist at NMDA receptors alongside glutamate."
      }
    ],
    "sourceIds": [
      "gaba-source",
      "glycine-receptor",
      "nmda-structure"
    ]
  },
  "histamine": {
    "choices": [
      {
        "choice": "Can still have distinct receptor-mediated roles in the brain",
        "explanation": "A signaling molecule can serve different functions in different tissues. Brain histamine is released by projecting neurons and acts through receptor-mediated mechanisms despite also having immune roles."
      },
      {
        "choice": "Cannot be a neurotransmitter",
        "explanation": "Having an immune role does not exclude a molecule from neurotransmission. Histaminergic neurons and central histamine receptors support signaling in the brain.",
        "correction": "Classify the role by the releasing cells, receptors and tissue context instead of giving the molecule one exclusive function."
      },
      {
        "choice": "Has only one receptor subtype",
        "explanation": "Histamine has multiple receptor subtypes with different signaling roles. Its involvement in immune responses does not imply one receptor type or one universal effect.",
        "correction": "Keep tissue role and receptor diversity separate; histamine can engage distinct receptor-mediated pathways in the brain."
      }
    ],
    "sourceIds": [
      "histamine-source",
      "noradrenaline"
    ]
  },
  "neuropeptides": {
    "choices": [
      {
        "choice": "Every neuron releases every transmitter",
        "explanation": "Cotransmission means that a neuron can release more than one messenger; it does not mean every neuron synthesizes and releases every transmitter. Messenger expression and release remain cell-specific.",
        "correction": "Replace the absolute one-transmitter rule with specific combinations of cotransmitters in particular neurons."
      },
      {
        "choice": "Neurons can release peptides alongside other transmitters",
        "explanation": "Neurons can release neuropeptides alongside other transmitters. The messengers can recruit different receptors and differ in release conditions or time course, so one neuron need not have one signaling product."
      },
      {
        "choice": "Peptides cannot act on receptors",
        "explanation": "Neuropeptides act through receptors, often GPCRs. Their capacity to signal is precisely why peptide release can complement another transmitter from the same neuron.",
        "correction": "Connect cotransmission to distinct receptor actions rather than treating peptides as unable to communicate."
      }
    ],
    "sourceIds": [
      "peptide-source",
      "peptide-regulation"
    ]
  },
  "sodium-channel": {
    "choices": [
      {
        "choice": "All sodium instantly disappears",
        "explanation": "A sodium current can fall before the sodium gradient is exhausted. Channel inactivation reduces available conducting channels during continued depolarization.",
        "correction": "Explain the rapid current decline through channel state changes, not instantaneous disappearance of all sodium."
      },
      {
        "choice": "Every sodium channel becomes a potassium pump",
        "explanation": "Sodium channels do not become potassium pumps. Their protein identity remains the same while voltage-dependent conformational changes alter whether the pore can conduct.",
        "correction": "Distinguish gating states within one channel from changing into a different transporter or ion-selective protein."
      },
      {
        "choice": "Voltage-gated sodium channels can inactivate",
        "explanation": "Voltage-gated sodium channels can enter an inactivated, nonconducting state despite continued depolarization. Repolarization promotes recovery, helping explain why availability depends on recent voltage history."
      }
    ],
    "sourceIds": [
      "ionic-mechanisms",
      "sodium-structure",
      "axon-initial-segment"
    ]
  },
  "potassium-channel": {
    "choices": [
      {
        "choice": "Voltage moves back toward the potassium equilibrium potential",
        "explanation": "During a typical spike, increased potassium conductance permits outward current that moves voltage toward the potassium equilibrium potential. This contributes to repolarization and can contribute to an afterhyperpolarization."
      },
      {
        "choice": "A guaranteed larger sodium spike",
        "explanation": "Opening more potassium conductance does not guarantee a larger sodium spike. Under typical spike conditions, potassium current opposes depolarization and promotes repolarization.",
        "correction": "Predict the added current from potassium’s driving force rather than assuming all channel opening increases spike amplitude."
      },
      {
        "choice": "Vesicles cross the axonal membrane",
        "explanation": "Potassium channels conduct potassium ions, not vesicles. Vesicle fusion is part of secretion and is not what a potassium current carries across the axonal membrane.",
        "correction": "Separate ion conduction through a pore from membrane fusion during neurotransmitter release."
      }
    ],
    "sourceIds": [
      "ionic-mechanisms",
      "channel-transport",
      "ligand-channels"
    ]
  },
  "calcium-channel": {
    "choices": [
      {
        "choice": "Calcium cannot move inside cells",
        "explanation": "Calcium can enter through open channels and spread within the cell, while buffering shapes its distribution. The concentration near an open channel can therefore differ greatly from that farther away.",
        "correction": "Use local calcium gradients to explain why a release sensor’s distance from the channel matters."
      },
      {
        "choice": "Calcium concentration varies sharply near the open channel",
        "explanation": "Calcium concentration rises most strongly close to an open channel and falls with distance as diffusion and buffering shape the signal. Channel–vesicle spacing therefore affects the calcium exposure of release sensors."
      },
      {
        "choice": "Vesicles carry the voltage sensor for every channel",
        "explanation": "The voltage sensor is part of the voltage-gated channel protein, not a component every vesicle supplies. Vesicle-associated release machinery responds to the resulting calcium signal.",
        "correction": "Separate the channel’s voltage sensor from the release machinery’s calcium sensor and their physical spacing."
      }
    ],
    "sourceIds": [
      "release-ut",
      "calcium-plasticity",
      "ligand-channels"
    ]
  },
  "ampa": {
    "choices": [
      {
        "choice": "Their location anywhere in the cortex",
        "explanation": "Cortical location alone does not determine an AMPA receptor’s calcium permeability. Subunit composition and GluA2 RNA editing are the important molecular distinctions in this question.",
        "correction": "Identify whether edited GluA2 is present instead of inferring permeability from the brain region alone."
      },
      {
        "choice": "Absence of all glutamate",
        "explanation": "Removing glutamate prevents ligand activation but does not change the pore’s intrinsic ion permeability. This confuses whether the channel opens with which ions an open channel can pass.",
        "correction": "Separate gating from selectivity: edited GluA2 limits calcium permeability, while glutamate binding supports channel activation."
      },
      {
        "choice": "The presence of edited GluA2",
        "explanation": "The edited form of GluA2 strongly limits calcium permeability in many AMPA receptors. Receptors lacking this edited subunit can be calcium-permeable, so not all AMPA receptors have identical ionic properties."
      }
    ],
    "sourceIds": [
      "glutamate-receptors",
      "plasticity-molecular"
    ]
  },
  "nmda": {
    "choices": [
      {
        "choice": "Glutamate, a coagonist, and relief of magnesium block",
        "explanation": "Conventional NMDA receptors require glutamate and a coagonist such as glycine or D-serine. Depolarization relieves the voltage-dependent magnesium block, permitting substantial current under suitable driving-force conditions."
      },
      {
        "choice": "Dopamine alone",
        "explanation": "Dopamine is not a substitute for the glutamate and coagonist required for conventional NMDA receptor activation. Modulation of a circuit does not replace the receptor’s ligand requirements.",
        "correction": "Identify NMDA receptor ligands separately from modulatory transmitters that can affect the surrounding circuit."
      },
      {
        "choice": "Magnesium binding with no ligand",
        "explanation": "Magnesium obstructs the NMDA receptor pore at negative voltages; binding magnesium without the agonists does not activate the receptor. Ligand binding and relief of block are distinct requirements.",
        "correction": "Treat magnesium as a voltage-dependent blocker here, not as the activating ligand."
      }
    ],
    "sourceIds": [
      "glutamate-receptors",
      "nmda-structure"
    ]
  },
  "gabaa": {
    "choices": [
      {
        "choice": "No, inhibition always requires a large hyperpolarization",
        "explanation": "Inhibition does not require a large hyperpolarization. If opening GABA-A channels adds conductance near the current membrane voltage, it can reduce the voltage effect of coincident excitation.",
        "correction": "Assess conductance and the effect on firing, not only the size or direction of the voltage deflection."
      },
      {
        "choice": "Yes, increased conductance can shunt excitation",
        "explanation": "Increased GABA-A conductance can shunt excitatory input even when it produces little voltage change on its own. The reversal potential relative to membrane voltage and spike threshold helps determine the outcome."
      },
      {
        "choice": "Only if it conducts dopamine",
        "explanation": "GABA-A receptors conduct anions, not dopamine molecules. Shunting follows from increased membrane conductance and does not require a different neurotransmitter to pass through the pore.",
        "correction": "Distinguish the ligand that binds a receptor from the ions conducted by its channel."
      }
    ],
    "sourceIds": [
      "gaba-structure",
      "ligand-channels"
    ]
  },
  "ltp": {
    "choices": [
      {
        "choice": "Left hemisphere versus right hemisphere",
        "explanation": "Induction and expression are stages of a plasticity process, not names for opposite hemispheres. Either hemisphere can contain synapses at which plasticity is initiated and expressed.",
        "correction": "Ask separately what triggers the change and what makes later synaptic responses larger."
      },
      {
        "choice": "Electrical signals versus no electrical signals",
        "explanation": "Electrical activity can help trigger plasticity and can also measure its expression. The distinction is not whether electrical signals exist, but what role a mechanism plays in the change.",
        "correction": "Separate the initiating signal from the altered synaptic machinery that produces a stronger response."
      },
      {
        "choice": "The trigger for change versus the mechanism producing the larger response",
        "explanation": "Induction refers to the events that trigger potentiation; expression refers to the changes that make the response larger. At some synapses, calcium-dependent signaling initiates changes in AMPA receptor function or number, but other LTP forms differ."
      }
    ],
    "sourceIds": [
      "plasticity-memory",
      "plasticity-molecular"
    ]
  },
  "ltd": {
    "choices": [
      {
        "choice": "No; synaptic effectiveness can decrease without eliminating the synapse",
        "explanation": "LTD describes a lasting decrease in synaptic effectiveness, not obligatory deletion of the connection. Changes such as altered receptor trafficking can weaken transmission while the synapse remains present."
      },
      {
        "choice": "Yes; LTD always destroys the entire neuron",
        "explanation": "LTD is a form of synaptic plasticity, not a requirement for the neuron to die. A neuron can remain functional while particular synapses transmit less effectively.",
        "correction": "Keep cell survival, synapse structure and synaptic efficacy as distinct properties."
      },
      {
        "choice": "Yes; all LTD is irreversible",
        "explanation": "Long-term means the change persists beyond a short-lived response; it does not mean the synapse can never change again. Later activity can further modify synaptic strength.",
        "correction": "Distinguish persistence from irreversibility; LTD does not by definition permanently eliminate a synapse."
      }
    ],
    "sourceIds": [
      "ltd-source",
      "plasticity-memory"
    ]
  },
  "spike-timing": {
    "choices": [
      {
        "choice": "Spike timing is never measurable",
        "explanation": "Spike timing can be measured electrophysiologically and related to changes in synaptic strength. The concern is how broadly a measured timing rule generalizes, not whether timing is measurable.",
        "correction": "Interpret a timing curve with its cell type, stimulation pattern and recording conditions."
      },
      {
        "choice": "The timing rule varies across cells and conditions",
        "explanation": "The relationship between spike timing and plasticity varies with synapse type, developmental stage, activity pattern and experimental conditions. A familiar timing curve is an example under defined conditions, not a universal rule."
      },
      {
        "choice": "All synapses follow one identical curve",
        "explanation": "Different synapses and conditions can produce different timing relationships, including different requirements for postsynaptic bursts or repetition. One curve cannot specify every form of plasticity.",
        "correction": "Use the experimental context to judge which timing rule applies rather than transferring one curve to all synapses."
      }
    ],
    "sourceIds": [
      "stdp-study",
      "stdp-context"
    ]
  },
  "homeostatic-plasticity": {
    "choices": [
      {
        "choice": "Because every quiet neuron must die",
        "explanation": "Low activity does not mean every neuron must die. Homeostatic mechanisms can adjust synaptic strength or excitability while the cell remains alive and integrated in a circuit.",
        "correction": "Interpret strengthening after prolonged inactivity as compensation for reduced activity, not as an automatic cell-death response."
      },
      {
        "choice": "To remove its membrane potential",
        "explanation": "Removing the membrane potential would not explain a regulated increase in synaptic efficacy. Homeostatic plasticity adjusts properties that help maintain activity within a workable range.",
        "correction": "Look for compensatory changes in synaptic strength or excitability rather than abolition of electrical signaling."
      },
      {
        "choice": "To compensate for reduced activity",
        "explanation": "Prolonged inactivity can recruit compensatory strengthening that helps stabilize activity. Such homeostatic change can coexist with input-specific learning rules rather than encoding the same information as every Hebbian change."
      }
    ],
    "sourceIds": [
      "scaling-study",
      "scaling-in-vivo"
    ]
  },
  "structural-plasticity": {
    "choices": [
      {
        "choice": "A morphological change",
        "explanation": "An enlarged spine establishes that its morphology changed. Inferring synaptic efficacy requires additional functional evidence, and identifying the exact represented memory requires still more evidence."
      },
      {
        "choice": "The exact content of a stored memory",
        "explanation": "Spine shape alone does not reveal the content of a particular memory. Structural and functional plasticity can be related without each visible spine acting as a directly readable memory label.",
        "correction": "Describe the observed morphological change, then distinguish it from claims about function or memory content."
      },
      {
        "choice": "That every nearby synapse strengthened",
        "explanation": "A change in one spine does not establish that every neighboring synapse strengthened. Each synapse’s structural and functional state would need evidence of its own.",
        "correction": "Keep the observation local: the measured spine changed shape; broader functional changes are not proven by that observation alone."
      }
    ],
    "sourceIds": [
      "spine-study",
      "plasticity-molecular"
    ]
  },
  "memory-consolidation": {
    "choices": [
      {
        "choice": "A single molecule contains an entire autobiographical memory",
        "explanation": "A single molecule cannot by itself specify an entire autobiographical memory. Molecular processes contribute to changes in synapses embedded within larger networks that support memory.",
        "correction": "Connect molecular and cellular mechanisms to network organization rather than assigning a complete experience to one molecule."
      },
      {
        "choice": "Memory depends on interacting cellular and network changes",
        "explanation": "Memory consolidation involves changes at cellular and network scales. Synaptic consolidation concerns stabilization at connections, while systems consolidation concerns changes in the contribution of distributed brain networks."
      },
      {
        "choice": "Only the hippocampus can change with experience",
        "explanation": "Experience-dependent changes occur in many brain regions. The hippocampus has important roles in certain memories, but cortical and other circuits also participate in learning and consolidation.",
        "correction": "Distinguish hippocampal contributions from the wider cellular and network changes supporting different memory systems."
      }
    ],
    "sourceIds": [
      "memory-foundation",
      "plasticity-molecular",
      "memory-trace"
    ]
  }
};
