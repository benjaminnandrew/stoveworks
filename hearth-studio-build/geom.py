"""Camera + plane homographies for rendered scenes (Blender camera conventions)."""
import numpy as np

IN_PER_M = 39.37007874


def camera_K_R_C(cam, W, H):
    M = np.array(cam["matrix_world"], float)
    f = cam["lens"] / cam["sensor_width"] * W  # sensor_fit HORIZONTAL
    cx = W / 2 - cam["shift_x"] * W
    cy = H / 2 + cam["shift_y"] * W
    K = np.array([[f, 0, cx], [0, f, cy], [0, 0, 1]])
    Rbl = M[:3, :3].T            # world -> blender camera
    C = M[:3, 3]
    Rcv = np.diag([1, -1, -1]) @ Rbl   # blender cam (x right,y up,z back) -> cv (x right,y down,z fwd)
    return K, Rcv, C


def project(K, R, C, P):
    p = R @ (np.asarray(P, float) - C)
    return np.array([K[0, 0] * p[0] / p[2] + K[0, 2], K[1, 1] * p[1] / p[2] + K[1, 2]])


def zone_homography(K, R, C, z, W, H):
    """Returns 3x3 H mapping normalized image coords (x/W, y/H, 1) -> wall texture
    coords in inches (u + u_off, v). Plus forward matrix for checks."""
    O = np.array(z["O"], float); U = np.array(z["U"], float); V = np.array(z["V"], float)
    A = np.column_stack([R @ U, R @ V, R @ (O - C)])
    Hf = K @ A                                   # (u_m, v_m, 1) -> pixel
    S = np.diag([1 / IN_PER_M, 1 / IN_PER_M, 1.0])  # inches -> metres
    off = np.array([[1, 0, -z["u_off"] * IN_PER_M], [0, 1, 0], [0, 0, 1]])
    Hf_tex = Hf @ S @ off                        # (u_tex_in, v_in, 1) -> pixel
    Npix = np.diag([W, H, 1.0])                  # normalized -> pixel
    Hinv = np.linalg.inv(Hf_tex) @ Npix          # normalized image -> texture inches
    Hinv = Hinv / Hinv[2, 2] if abs(Hinv[2, 2]) > 1e-12 else Hinv
    return Hinv, Hf_tex


def apply_h(Hm, x, y):
    w = Hm[2, 0] * x + Hm[2, 1] * y + Hm[2, 2]
    return (Hm[0, 0] * x + Hm[0, 1] * y + Hm[0, 2]) / w, (Hm[1, 0] * x + Hm[1, 1] * y + Hm[1, 2]) / w


def polygon_area_m2(z):
    a = (z["u1"] - z["u0"]) * (z["v1"] - z["v0"])
    for h in z["holes"]:
        hu0, hu1 = max(h[0], z["u0"]), min(h[1], z["u1"])
        hv0, hv1 = max(h[2], z["v0"]), min(h[3], z["v1"])
        if hu1 > hu0 and hv1 > hv0:
            a -= (hu1 - hu0) * (hv1 - hv0)
    return a
