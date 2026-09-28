// Inference stays in this browser. The only fetched resources are the local
// JavaScript bundles and the self-hosted, unmodified COCO-SSD model weights.
const MODEL_URL = '/models/kem-cat/model.json';
const CAT_THRESHOLD = 0.5;
let modelPromise;
let detectionQueue = Promise.resolve();

async function loadModel() {
  const tf = await import('@tensorflow/tfjs-core');
  const [cocoSsd] = await Promise.all([
    import('@tensorflow-models/coco-ssd'),
    import('@tensorflow/tfjs-backend-cpu'),
    import('@tensorflow/tfjs-backend-webgl'),
  ]);

  // COCO-SSD also uses the CPU backend for non-maximum suppression.
  let webglReady = false;
  try {
    if (tf.env().getNumber('WEBGL_VERSION') > 0) {
      webglReady = await tf.setBackend('webgl');
    }
  } catch {
    // Browsers may expose WebGL but refuse context creation.
  }
  if (!webglReady && !(await tf.setBackend('cpu'))) {
    throw new Error('No supported image-recognition backend is available.');
  }
  await tf.ready();
  return cocoSsd.load({ base: 'lite_mobilenet_v2', modelUrl: MODEL_URL });
}

function getModel() {
  if (!modelPromise) {
    modelPromise = loadModel().catch((cause) => {
      modelPromise = undefined; // A failed download must not poison Retry.
      console.warn('Cat recognition startup:', cause?.message || 'Unknown model error');
      throw Object.assign(new Error('Cat recognition could not load. Please try again.', { cause }), {
        code: 'CAT_MODEL_UNAVAILABLE',
      });
    });
  }
  return modelPromise;
}

/**
 * Detect a cat in a decoded image or canvas without uploading the picture.
 * A negative result is not a loading/inference error; errors reject explicitly.
 * This recognizes the object class "cat", not identity or image authenticity.
 * @param {HTMLImageElement|HTMLCanvasElement} image
 * @returns {Promise<{isCat: boolean, confidence: number}>}
 */
export async function detectCat(image) {
  const model = await getModel();
  // The underlying detector temporarily changes TensorFlow's global backend;
  // serialize overlapping validations so those changes cannot race each other.
  const result = detectionQueue.then(async () => {
    try {
      const predictions = await model.detect(image, 20, CAT_THRESHOLD);
      const confidence = predictions.reduce((highest, prediction) => (
        prediction.class === 'cat' && Number.isFinite(prediction.score)
          ? Math.max(highest, prediction.score)
          : highest
      ), 0);
      return { isCat: confidence >= CAT_THRESHOLD, confidence };
    } catch (cause) {
      throw Object.assign(new Error('Cat recognition could not read this picture. Please try again.', { cause }), {
        code: 'CAT_DETECTION_FAILED',
      });
    }
  });
  detectionQueue = result.catch(() => {});
  return result;
}
