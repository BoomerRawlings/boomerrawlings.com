# Feline photo check

TensorFlow.js COCO-SSD `ssdlite_mobilenet_v2` model, downloaded from the official TensorFlow model host:
https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/model.json

Model information and implementation: https://github.com/tensorflow/tfjs-models/tree/master/coco-ssd
License: Apache 2.0, included as LICENSE.

Weights are unchanged; shard filenames have a `.bin` extension and corresponding manifest paths for static hosting.

The weights are served locally and loaded only when a visitor validates a portrait. Inference runs in the visitor's browser. Model assets do not include visitor photos.
