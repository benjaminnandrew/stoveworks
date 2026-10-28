# Third-party notices

The photo helper uses the following open-source software and model weights. Each keeps its own license.

## MobileSAM (image encoder weights) — Apache License 2.0
Chaoning Zhang et al., "Faster Segment Anything: Towards Lightweight SAM for Mobile Applications" (2023).
https://github.com/ChaoningZhang/MobileSAM

## Segment Anything (mask decoder weights, ViT-H checkpoint) — Apache License 2.0
Meta Platforms, Inc. https://github.com/facebookresearch/segment-anything

## ONNX exports — Apache License 2.0
The two models were taken in ONNX form from Intel's `@geti-ui/smart-tools` package (version 1.7.0, npm).
Changes made here: the encoder's matrix weights are quantized to 8 bits and its convolution weights and
attention tables stored at 16 bits (computed at 32 bits); the decoder's weights are quantized to 8 bits.
Masks match the full-precision models closely (intersection-over-union 0.97 or better on test photos).

## ONNX Runtime Web 1.22.0 — MIT License
Copyright (c) Microsoft Corporation. https://github.com/microsoft/onnxruntime

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The full text of the Apache License 2.0 is at https://www.apache.org/licenses/LICENSE-2.0
