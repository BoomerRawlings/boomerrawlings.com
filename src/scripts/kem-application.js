import {parsePhotoTimestamp, assertFresh} from './kem-freshness.js';
import {detectCat} from './kem-detector.js';

const form = document.querySelector('#kem-form');
const steps = [...form.querySelectorAll('.kem-step')];
const next = document.querySelector('#kem-next');
const back = document.querySelector('#kem-back');
const error = document.querySelector('#kem-error');
const status = document.querySelector('#kem-status');
const photoStatus = document.querySelector('#kem-photo-status');
const input = document.querySelector('#kem-photo-input');
const preview = document.querySelector('#kem-preview');
const video = document.querySelector('#kem-video');
const captureButton = document.querySelector('#kem-capture');
const stopButton = document.querySelector('#kem-stop-camera');
const startButton = document.querySelector('#kem-start-camera');
const storageKey = 'boomerkarma-kemberton-issued-v1';
const labels = ['Establish feline jurisdiction', 'File the temperament supplement', 'Proceed to portrait inspection', 'Review the applicant’s file', 'Send request & release Kem’s score'];
let step = 0;
let photo = null;
let previewUrl;
let stream;
let cameraOpening = false;
let generation = 0;
let processing = false;
let sending = false;
let supplementalRequirements = [];
const supplements = document.createElement('div');
supplements.id = 'kem-supplements';
supplements.className = 'bureau-supplements';
supplements.hidden = true;
steps[2].append(supplements);

function supplementalAnswers() {
  return supplementalRequirements.map(item => {
    const select = supplements.querySelector(`[name="supplement-${item.id}"]`);
    const checkbox = supplements.querySelector(`[name="supplement-${item.id}-confirmed"]`);
    return `${item.title}\n${item.prompt}: ${select.value}\n${checkbox.checked ? 'Yes' : 'No'} — ${item.attestation}`;
  }).join('\n\n');
}
function refreshSupplements() {
  if (!window.BoomerKarmaBureau) return false;
  window.BoomerKarmaBureau.inspect(document.querySelector('#kem-statement').value, 0, 'feline');
  const required = window.BoomerKarmaBureau.requirements('feline');
  if (required.map(item => item.id).join('|') === supplementalRequirements.map(item => item.id).join('|')) return false;
  supplementalRequirements = required;
  supplements.replaceChildren();
  supplements.hidden = required.length === 0;
  for (const item of required) {
    const section = document.createElement('section'); section.className = 'bureau-supplement';
    const heading = document.createElement('h3'); heading.textContent = item.title;
    const label = document.createElement('label'); label.textContent = item.prompt;
    const select = document.createElement('select');
    select.id = `feline-supplement-${item.id}`; select.name = `supplement-${item.id}`; select.required = true;
    label.htmlFor = select.id;
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Select an administratively acceptable explanation';
    select.append(placeholder);
    for (const answer of item.options) {
      const option = document.createElement('option'); option.value = answer; option.textContent = answer; select.append(option);
    }
    const declaration = document.createElement('label'); declaration.className = 'choice';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.name = `supplement-${item.id}-confirmed`; checkbox.required = true;
    const wording = document.createElement('span'); wording.textContent = item.attestation;
    declaration.append(checkbox, wording); section.append(heading, label, select, declaration); supplements.append(section);
  }
  document.querySelector('#kem-final').checked = false;
  return required.length > 0;
}

function setError(message = '') {
  error.textContent = message;
  error.hidden = !message;
}
function updateButtons() {
  next.disabled = sending || processing;
  back.disabled = sending || processing;
  input.disabled = sending || processing;
  startButton.disabled = sending || processing;
  captureButton.disabled = sending || processing;
  next.textContent = labels[step];
  back.hidden = step === 0;
}
function showStep(index) {
  if (step === 3 && index !== 3) stopCamera();
  step = index;
  steps.forEach((section, index) => { section.hidden = index !== step; section.disabled = index !== step; });
  document.querySelector('#kem-progress').value = step + 1;
  document.querySelector('#kem-step-label').textContent = `Step ${step + 1} of ${steps.length} · ${steps[step].dataset.title}`;
  setError();
  updateButtons();
  if (step === 4) {
    const review = document.querySelector('#kem-review');
    review.replaceChildren();
    for (const [label, value] of Object.entries({Applicant: 'Kem / Kemberton', Purpose: document.querySelector('#kem-purpose').value, Statement: document.querySelector('#kem-statement').value, ...(supplementalRequirements.length ? {'Additional paperwork': supplementalAnswers()} : {}), Portrait: photo ? 'Cat detected. Bureau portrait accepted.' : 'Portrait required.'})) {
      const term = document.createElement('dt'); term.textContent = label;
      const description = document.createElement('dd'); description.textContent = value;
      review.append(term, description);
    }
  }
  steps[step].querySelector('legend')?.focus();
}
function stopCamera() {
  if (stream) stream.getTracks().forEach(track => track.stop());
  stream = null;
  cameraOpening = false;
  video.srcObject = null;
  video.hidden = true;
  captureButton.hidden = true;
  stopButton.hidden = true;
}
function clearPortrait() {
  photo = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  preview.removeAttribute('src');
  preview.hidden = true;
}
function imageFrom(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This browser could not open that portrait. Try a JPEG, or use the bureau camera.')); };
    image.src = url;
  });
}
function portraitCanvas(source, width, height) {
  if (!width || !height || width * height > 60000000) throw new Error('That portrait is too large to inspect. Use the bureau camera or a smaller image.');
  const scale = Math.min(1, 1280 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function inspect(canvas, timing, requestGeneration) {
  photoStatus.textContent = 'Consulting the Department of Catness… The first inspection may take a moment.';
  const result = await detectCat(canvas);
  if (requestGeneration !== generation) return;
  if (!result.isCat) throw new Error('The bureau could not confidently find a cat in this portrait. Show the applicant’s face, ears, and body clearly, then try again.');
  assertFresh(timing.capturedAt);
  // The emailed JPEG is resized and re-encoded, stripping location and other original metadata.
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86));
  if (!blob || blob.size > 2000000) throw new Error('The portrait could not be prepared for the file. Please try another picture.');
  if (requestGeneration !== generation) return;
  photo = {...timing, confidence: result.confidence, file: new File([blob], 'kemberton-portrait.jpg', {type: 'image/jpeg'})};
  previewUrl = URL.createObjectURL(blob);
  preview.src = previewUrl;
  preview.hidden = false;
  photoStatus.textContent = 'Portrait accepted. The applicant appears sufficiently feline.';
}
async function validateUpload(file) {
  const requestGeneration = ++generation;
  stopCamera();
  clearPortrait();
  if (!file) { photoStatus.textContent = ''; return; }
  processing = true;
  updateButtons();
  setError();
  photoStatus.textContent = 'Inspecting the applicant’s portrait…';
  try {
    if (file.size > 20000000) throw new Error('Please choose a portrait smaller than 20 MB, or use the bureau camera.');
    if (!/\.(jpe?g|png|webp|hei[cf])$/i.test(file.name) && !/^image\/(jpeg|png|webp|heic|heif)$/.test(file.type)) throw new Error('The bureau accepts JPEG, PNG, WebP, or HEIC portraits. Please choose a photo.');
    const {default: exifr} = await import('exifr');
    let tags;
    try {
      tags = await exifr.parse(file, {pick: ['DateTimeOriginal', 'OffsetTimeOriginal', 'SubSecTimeOriginal', 'GPSDateStamp', 'GPSTimeStamp'], reviveValues: false, translateValues: false, xmp: false, icc: false, iptc: false});
    } catch {
      throw new Error('The bureau cannot read this portrait’s capture metadata. Use the bureau camera to take a picture now; portraits must be taken within the last five minutes.');
    }
    const timing = parsePhotoTimestamp(tags || {});
    const image = await imageFrom(file);
    await inspect(portraitCanvas(image, image.naturalWidth, image.naturalHeight), timing, requestGeneration);
  } catch (cause) {
    if (requestGeneration === generation) { clearPortrait(); photoStatus.textContent = cause.message || 'The portrait could not be inspected. Please try again.'; }
  } finally {
    if (requestGeneration === generation) { processing = false; updateButtons(); }
  }
}
input.addEventListener('change', () => validateUpload(input.files?.[0]));
startButton.addEventListener('click', async () => {
  if (processing || sending || document.hidden) return;
  const requestGeneration = ++generation;
  stopCamera();
  clearPortrait();
  input.value = '';
  cameraOpening = true;
  processing = true;
  updateButtons();
  photoStatus.textContent = 'Opening the bureau camera…';
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
    const cameraStream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 960}}, audio: false});
    if (requestGeneration !== generation || document.hidden) { cameraStream.getTracks().forEach(track => track.stop()); return; }
    stream = cameraStream;
    video.srcObject = stream;
    video.hidden = false;
    await video.play();
    if (requestGeneration !== generation || document.hidden) {
      if (stream === cameraStream) stopCamera();
      else cameraStream.getTracks().forEach(track => track.stop());
      return;
    }
    captureButton.hidden = false;
    stopButton.hidden = false;
    photoStatus.textContent = 'Invite the applicant into frame. Press Take portrait when he is ready for official business.';
  } catch {
    if (requestGeneration === generation) {
      stopCamera();
      photoStatus.textContent = 'The camera could not open. Allow camera access, or choose an original photo from your device.';
    }
  } finally {
    if (requestGeneration === generation) { cameraOpening = false; processing = false; updateButtons(); }
  }
});
captureButton.addEventListener('click', async () => {
  if (processing || !stream) return;
  const requestGeneration = ++generation;
  processing = true;
  updateButtons();
  try {
    const capturedAt = Date.now();
    const canvas = portraitCanvas(video, video.videoWidth, video.videoHeight);
    stopCamera();
    await inspect(canvas, {capturedAt, source: 'Live bureau camera capture'}, requestGeneration);
  } catch (cause) {
    if (requestGeneration === generation) { clearPortrait(); photoStatus.textContent = cause.message || 'The camera portrait could not be checked. Please try again.'; }
  } finally {
    if (requestGeneration === generation) { processing = false; updateButtons(); }
  }
});
stopButton.addEventListener('click', () => { ++generation; stopCamera(); processing = false; updateButtons(); photoStatus.textContent = 'Camera closed. No portrait taken.'; });
window.addEventListener('pagehide', () => {
  const interrupted = processing;
  const hadCamera = stream || cameraOpening;
  ++generation;
  stopCamera();
  processing = false;
  if (interrupted) { clearPortrait(); input.value = ''; }
  if (interrupted || hadCamera) photoStatus.textContent = 'Portrait inspection paused when this page closed. Choose a photo or open the camera to continue.';
  // A browser may restore this exact page from its back/forward cache. A
  // cancelled inspection must not leave its controls disabled on restoration.
  // Keep sending intact: only the outstanding delivery can settle that state.
  updateButtons();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && (stream || cameraOpening)) { ++generation; stopCamera(); processing = false; updateButtons(); photoStatus.textContent = 'Camera closed while this page was away. Open it again when the applicant is ready.'; }
});

function validateStep() {
  const invalid = [...steps[step].querySelectorAll('input,select,textarea')].find(field => !field.disabled && !field.checkValidity());
  if (invalid) { setError('Please complete every required declaration before sending the file to its next desk.'); invalid.focus(); return false; }
  if (step === 2 && document.querySelector('#kem-statement').value.trim().split(/\s+/u).filter(Boolean).length < 12) { setError('The committee requests at least 12 words in support of this cat. Padding is allowed.'); return false; }
  if (step === 3) {
    if (!photo) { setError('A portrait must pass inspection before the file can proceed. Choose another picture or use the bureau camera.'); return false; }
    try { assertFresh(photo.capturedAt); } catch (cause) { clearPortrait(); photoStatus.textContent = cause.message; setError(cause.message); return false; }
  }
  return true;
}
function revealReport() {
  document.querySelector('#kem-gate').hidden = true;
  document.querySelector('#kem-report').hidden = false;
}
try { if (sessionStorage.getItem(storageKey) === 'true') revealReport(); } catch { /* Optional convenience, never stores a photo. */ }
document.querySelector('#kem-request-again')?.addEventListener('click', () => {
  if (processing || sending) return;
  ++generation; stopCamera(); clearPortrait(); form.reset();
  supplementalRequirements = []; supplements.replaceChildren(); supplements.hidden = true;
  photoStatus.textContent = ''; status.textContent = '';
  document.querySelector('#kem-report').hidden = true;
  document.querySelector('#kem-gate').hidden = false;
  const returnToIssued = document.querySelector('#kem-return-issued');
  if (returnToIssued) returnToIssued.hidden = false;
  showStep(0);
});
document.querySelector('#kem-return-issued')?.addEventListener('click', () => {
  if (sending) return;
  const interrupted = processing;
  ++generation; stopCamera(); processing = false;
  if (interrupted) { clearPortrait(); input.value = ''; }
  updateButtons(); revealReport();
  document.querySelector('#kem-report-heading').focus();
});
back.addEventListener('click', () => { if (!processing && !sending && step > 0) showStep(step - 1); });
form.addEventListener('input', () => {
  setError();
  if (step < 4) document.querySelector('#kem-final').checked = false;
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (processing || sending) return;
  // Assign any extra desk work before the portrait is taken, so bureaucracy
  // does not consume the applicant's five-minute photo window.
  if (step === 2 && refreshSupplements()) {
    setError('Your file has acquired an additional department. Complete the supplemental declarations below, then continue.');
    supplements.querySelector('select')?.focus();
    return;
  }
  if (!validateStep()) return;
  if (step < steps.length - 1) { showStep(step + 1); return; }
  try {
    if (!photo) throw new Error('The portrait needs inspection before the request can be sent.');
    assertFresh(photo.capturedAt);
  } catch (cause) {
    clearPortrait(); showStep(3); photoStatus.textContent = cause.message; setError(cause.message); return;
  }
  photo.firstSubmissionAge ??= Math.floor((Date.now() - photo.capturedAt) / 1000);
  const declarations = [...form.querySelectorAll('input[type="checkbox"]')].filter(field => !field.name?.startsWith('supplement-')).map(field => `${field.checked ? 'Yes' : 'No'} — ${field.closest('label').textContent.trim().replace(/\s+/gu, ' ')}`).join('\n');
  const answers = {
    'Submitted message': document.querySelector('#kem-statement').value,
    'Applicant': 'Kem / Kemberton',
    'Current score': `${document.querySelector('#kem-score').textContent.trim()} points`,
    'Requestor capacity': document.querySelector('#kem-capacity').value,
    'Name on paperwork': document.querySelector('#kem-alias').value,
    'Purpose': document.querySelector('#kem-purpose').value,
    'Portrait inspection': `Cat detected (${Math.round(photo.confidence * 100)}% model confidence). Best-effort classification; not identity verification.`,
    'Capture time (UTC)': new Date(photo.capturedAt).toISOString(),
    'Timestamp source': photo.source,
    'Photo age at first send': `${photo.firstSubmissionAge} seconds (five-minute check passed; rechecked on every retry)`,
    'Declarations': declarations,
    ...(supplementalRequirements.length ? {'Additional paperwork': supplementalAnswers()} : {}),
  };
  sending = true; updateButtons(); status.textContent = 'Sending the applicant’s file and portrait to Boomer…';
  try {
    if (await window.BoomerKarmaDelivery.send('cat-report', answers, {attachment: photo.file}) !== true) throw new Error('Delivery not confirmed');
    revealReport();
    try { sessionStorage.setItem(storageKey, 'true'); } catch { /* Do not block issued reports. */ }
    stopCamera(); clearPortrait(); form.reset();
    const heading = document.querySelector('#kem-report-heading'); heading.focus(); heading.scrollIntoView({block: 'start'});
    status.textContent = '';
  } catch {
    setError('The file could not reach Boomer. Your answers and portrait are still here. Please try again.');
    status.textContent = '';
  } finally { sending = false; updateButtons(); }
});
updateButtons();
