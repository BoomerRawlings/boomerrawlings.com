export const topics = { all: 'Mixed', planes: 'Planes', views: 'Views & folds', lobes: 'Lobes', inside: 'Inside the brain' };
export const sources = {
  planes: { label: 'University of Washington · Brain slices', url: 'https://faculty.washington.edu/chudler/slice.html' },
  lobes: { label: 'Queensland Brain Institute · Lobes', url: 'https://qbi.uq.edu.au/brain/brain-anatomy/lobes-brain' },
  forebrain: { label: 'Queensland Brain Institute · Forebrain', url: 'https://qbi.uq.edu.au/brain/brain-anatomy/forebrain' },
  callosum: { label: 'Queensland Brain Institute · Corpus callosum', url: 'https://qbi.uq.edu.au/brain/brain-anatomy/corpus-callosum' },
  hindbrain: { label: 'Queensland Brain Institute · Hindbrain', url: 'https://qbi.uq.edu.au/brain/brain-anatomy/hindbrain' },
  views: { label: 'California Lutheran University · Brain anatomy', url: 'https://earth.callutheran.edu/Academic_Programs/Departments/Biology/Anatomy/chapter14.html' },
};
export const images = {
  axial: { file: 'axial.png', alt: 'MRI slice showing both hemispheres in a rounded outline, with paired central fluid spaces.', kind: 'MRI', dark: true },
  coronal: { file: 'coronal.jpg', alt: 'MRI slice showing both hemispheres side by side, with the head extending down toward the neck.', kind: 'MRI', dark: true },
  sagittal: { file: 'sagittal-mri.jpg', alt: 'MRI slice showing a head in profile, with the face at left and an arch inside the brain.', kind: 'MRI', dark: true },
  lateral: { file: 'lateral.jpg', alt: 'Brain specimen showing one rounded outer surface with folds. The front is at left; the cerebellum is at lower right.', kind: 'Brain photograph' },
  medial: { file: 'medial.jpg', alt: 'Brain specimen showing the inner surface of one hemisphere, an exposed pale arch and a stalk below. The front is at right.', kind: 'Brain photograph' },
  superior: { file: 'superior.jpg', alt: 'Brain specimen showing two elongated hemispheres side by side, separated by a deep central gap.', kind: 'Brain photograph' },
};
const planes = ['Sagittal', 'Coronal', 'Axial (transverse)'];
const views = ['Superior (top)', 'Lateral (side)', 'Medial (inner surface)', 'Inferior (bottom)'];
const lobes = ['Frontal lobe', 'Parietal lobe', 'Temporal lobe', 'Occipital lobe'];
const inside = ['Corpus callosum', 'Thalamus', 'Hypothalamus', 'Hippocampus'];
const q = (id, topic, image, prompt, choices, answer, explanation, source, marker) => ({ id, topic, image, prompt, choices, answer, explanation, source, marker });
export const questions = [
  q('plane-sagittal', 'planes', 'sagittal', 'Which anatomical plane is shown?', planes, 'Sagittal', 'Sagittal slices separate left and right. This midline slice shows the head in profile and the arch of the corpus callosum.', 'planes'),
  q('plane-coronal', 'planes', 'coronal', 'Which anatomical plane is shown?', planes, 'Coronal', 'Coronal slices separate front (anterior) from back (posterior). Both hemispheres appear side by side.', 'planes'),
  q('plane-axial', 'planes', 'axial', 'Which anatomical plane is shown?', planes, 'Axial (transverse)', 'Axial slices separate top (superior) from bottom (inferior). Think of a horizontal cross-section.', 'planes'),
  q('divide-sagittal', 'planes', 'sagittal', 'This slice separates the brain into…', ['Left and right portions', 'Front and back portions', 'Top and bottom portions'], 'Left and right portions', 'Sagittal means left/right. Exactly through the midline is midsagittal.', 'planes'),
  q('divide-coronal', 'planes', 'coronal', 'This slice separates the brain into…', ['Left and right portions', 'Front and back portions', 'Top and bottom portions'], 'Front and back portions', 'Coronal means front/back. It is also called the frontal plane.', 'planes'),
  q('divide-axial', 'planes', 'axial', 'This slice separates the brain into…', ['Left and right portions', 'Front and back portions', 'Top and bottom portions'], 'Top and bottom portions', 'Axial, transverse and horizontal describe this brain-imaging plane.', 'planes'),
  q('view-lateral', 'views', 'lateral', 'Which external view is shown?', views, 'Lateral (side)', 'Lateral shows the outside of one hemisphere. It is an external view, rather than a sagittal cut through the brain.', 'views'),
  q('view-medial', 'views', 'medial', 'Which surface of this hemisphere is shown?', views, 'Medial (inner surface)', 'The medial surface faces the midline. A midsagittal separation exposes inner structures such as the corpus callosum.', 'views'),
  q('view-superior', 'views', 'superior', 'Which external view is shown?', views, 'Superior (top)', 'Superior means viewed from above. Both hemispheres and the gap between them are visible.', 'views'),
  q('fissure', 'views', 'superior', 'What is the deep gap between the hemispheres?', ['Longitudinal fissure', 'Central sulcus', 'Corpus callosum', 'Lateral ventricle'], 'Longitudinal fissure', 'The longitudinal fissure separates the left and right cerebral hemispheres.', 'views'),
  q('gyri', 'views', 'lateral', 'The raised folds on this surface are called…', ['Gyri', 'Sulci', 'Ventricles', 'Meninges'], 'Gyri', 'Gyri are the ridges. A single ridge is a gyrus.', 'views'),
  q('sulci', 'views', 'lateral', 'The grooves between these folds are called…', ['Gyri', 'Sulci', 'Ventricles', 'Meninges'], 'Sulci', 'Sulci are the grooves. A single groove is a sulcus.', 'views'),
  q('lobe-frontal', 'lobes', 'lateral', 'Which lobe is marked?', lobes, 'Frontal lobe', 'The frontal lobe sits at the front. It supports planning, reasoning and voluntary movement.', 'lobes', [22,43]),
  q('lobe-parietal', 'lobes', 'lateral', 'Which lobe is marked?', lobes, 'Parietal lobe', 'The parietal lobe lies behind the frontal lobe, toward the top. It integrates bodily sensory information.', 'lobes', [61,32]),
  q('lobe-temporal', 'lobes', 'lateral', 'Which lobe is marked?', lobes, 'Temporal lobe', 'The temporal lobe sits along the lower side. It contributes to hearing, memory and language comprehension.', 'lobes', [53,75]),
  q('lobe-occipital', 'lobes', 'lateral', 'Which lobe is marked?', lobes, 'Occipital lobe', 'The occipital lobe sits at the back and contains the primary visual cortex.', 'lobes', [87,50]),
  q('function-planning', 'lobes', 'lateral', 'Which lobe is especially involved in planning and reasoning?', lobes, 'Frontal lobe', 'Frontal regions support executive functions such as planning and reasoning.', 'lobes'),
  q('function-touch', 'lobes', 'lateral', 'Which lobe processes touch and temperature?', lobes, 'Parietal lobe', 'The primary somatosensory cortex is in the parietal lobe.', 'lobes'),
  q('function-hearing', 'lobes', 'lateral', 'Which lobe contains the primary auditory cortex?', lobes, 'Temporal lobe', 'The temporal lobe is strongly involved in processing sound.', 'lobes'),
  q('function-vision', 'lobes', 'lateral', 'Which lobe is the main center for visual processing?', lobes, 'Occipital lobe', 'The primary visual cortex lies in the occipital lobe at the back of the brain.', 'lobes'),
  q('function-motor', 'lobes', 'lateral', 'Which lobe contains the primary motor cortex?', lobes, 'Frontal lobe', 'The primary motor cortex, in the frontal lobe, helps control voluntary movement.', 'lobes'),
  q('function-language', 'lobes', 'lateral', 'Which lobe contributes to understanding speech?', lobes, 'Temporal lobe', 'Temporal regions contribute to language comprehension, working with a broader network.', 'lobes'),
  q('callosum-photo', 'inside', 'medial', 'Which structure is marked on the pale arch?', inside, 'Corpus callosum', 'The corpus callosum is a large bundle of nerve fibers connecting the cerebral hemispheres.', 'callosum', [56,44]),
  q('callosum-function', 'inside', 'medial', 'Which fiber bundle connects the two cerebral hemispheres?', inside, 'Corpus callosum', 'The corpus callosum allows information to pass between hemispheres.', 'callosum'),
  q('thalamus-function', 'inside', 'medial', 'Which structure relays sensory information toward the cortex?', inside, 'Thalamus', 'The thalamus processes and routes most sensory information to the cortex. Smell is the classic exception to the initial relay.', 'forebrain'),
  q('hypothalamus-function', 'inside', 'medial', 'Which structure helps regulate body temperature and hunger?', inside, 'Hypothalamus', 'The hypothalamus helps maintain internal balance, including temperature, appetite and hormonal regulation.', 'forebrain'),
  q('hippocampus-function', 'inside', 'coronal', 'Which structure is important for forming new memories?', inside, 'Hippocampus', 'The hippocampus lies in the medial temporal lobe. It is off the midline, so a true midsagittal cut does not expose it.', 'lobes'),
  q('brainstem-photo', 'inside', 'medial', 'Which major structure is marked?', ['Brainstem', 'Corpus callosum', 'Occipital lobe', 'Cerebellum'], 'Brainstem', 'The brainstem connects the brain with the spinal cord and supports functions such as breathing and heart rate.', 'hindbrain', [39,76]),
  q('brainstem-function', 'inside', 'sagittal', 'Which structure helps control breathing and heart rate?', ['Brainstem', 'Corpus callosum', 'Parietal lobe', 'Hippocampus'], 'Brainstem', 'Brainstem circuits, including those in the medulla, help regulate these vital functions.', 'hindbrain'),
  q('cerebellum-photo', 'inside', 'lateral', 'Which structure is marked below the back of the cerebrum?', ['Cerebellum', 'Thalamus', 'Frontal lobe', 'Corpus callosum'], 'Cerebellum', 'The cerebellum helps coordinate movement and balance.', 'hindbrain', [81,87]),
  q('cerebellum-function', 'inside', 'medial', 'Which structure fine-tunes movement and balance?', ['Cerebellum', 'Hypothalamus', 'Hippocampus', 'Corpus callosum'], 'Cerebellum', 'The cerebellum supports movement coordination, posture and balance.', 'hindbrain'),
];
