"""Make the photo helper's model files from the ONNX exports in Intel's @geti-ui/smart-tools 1.7.0 (npm).

  npm pack @geti-ui/smart-tools@1.7.0 && tar xzf geti-ui-smart-tools-1.7.0.tgz
  pip install onnx onnxruntime
  python prep_sam.py package/dist/esm/mobile_sam.encoder.onnx package/dist/esm/sam_vit_h_4b8939.decoder.onnx ../models

Encoder: matrix weights to 8 bits (convolutions stay full precision: quantizing those hurt the masks),
then the convolution weights and baked attention tables are stored at 16 bits with a Cast back to 32
(ONNX Runtime folds the Cast when it loads, so it still computes at 32 bits). 28 MB -> 9.8 MB.
Decoder: weights to 8 bits. 16.5 MB -> 4.8 MB. Masks match the originals at IoU 0.97 or better.
Also writes base64 text copies for hosts that won't serve .onnx files.
"""
import sys, base64, os, tempfile
import numpy as np, onnx
from onnx import numpy_helper, helper, TensorProto
from onnxruntime.quantization import quantize_dynamic, QuantType


def fp16_storage(src, dst, min_bytes=4096):
    m = onnx.load(src); g = m.graph
    conv_w = {n.input[1] for n in g.node if n.op_type == "Conv" and len(n.input) > 1}
    inits = {t.name: t for t in g.initializer}
    casts, new = [], []
    for name in conv_w:
        t = inits.get(name)
        if t is None or t.data_type != TensorProto.FLOAT: continue
        a = numpy_helper.to_array(t)
        if a.nbytes < min_bytes: continue
        h = numpy_helper.from_array(a.astype(np.float16), name + "_fp16")
        g.initializer.remove(t); new.append(h)
        casts.append(helper.make_node("Cast", [h.name], [name], to=TensorProto.FLOAT, name=name + "_cast"))
    for n in list(g.node):
        if n.op_type != "Constant": continue
        v = next((a for a in n.attribute if a.name == "value"), None)
        if v is None or v.t.data_type != TensorProto.FLOAT: continue
        a = numpy_helper.to_array(v.t)
        if a.nbytes < min_bytes: continue
        out = n.output[0]
        h = numpy_helper.from_array(a.astype(np.float16), out + "_fp16")
        i = list(g.node).index(n); g.node.remove(n)
        g.node.insert(i, helper.make_node("Cast", [h.name], [out], to=TensorProto.FLOAT, name=out + "_cast"))
        new.append(h)
    g.initializer.extend(new)
    for c in reversed(casts): g.node.insert(0, c)
    onnx.checker.check_model(m); onnx.save(m, dst)


def main(enc, dec, out):
    os.makedirs(out, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        q = os.path.join(tmp, "enc_q8.onnx")
        quantize_dynamic(enc, q, weight_type=QuantType.QUInt8, op_types_to_quantize=["MatMul", "Gemm"])
        fp16_storage(q, os.path.join(out, "sam-encoder.onnx"))
    quantize_dynamic(dec, os.path.join(out, "sam-decoder.onnx"), weight_type=QuantType.QUInt8)
    for n in ("sam-encoder", "sam-decoder"):
        raw = open(os.path.join(out, n + ".onnx"), "rb").read()
        open(os.path.join(out, n + ".onnx.b64.txt"), "wb").write(base64.b64encode(raw))
        print(n, len(raw), "bytes")


if __name__ == "__main__":
    main(*sys.argv[1:4])
