/**
 * Toán ma trận 4×4 tối thiểu cho WebGL. Ma trận lưu theo thứ tự cột (column-major),
 * đúng với cách WebGL đọc uniform. Mọi hàm đều trả về mảng mới, không thay đổi đầu vào.
 */
export type Mat4 = Float32Array;
export type Vec3Tuple = readonly [number, number, number];

export function identity(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

export function translation(x: number, y: number, z: number): Mat4 {
  const m = identity();
  m[12] = x;
  m[13] = y;
  m[14] = z;
  return m;
}

/** Quay quanh trục (đã chuẩn hóa) một góc tính bằng radian, theo quy tắc bàn tay phải. */
export function rotationAxis(axis: Vec3Tuple, angle: number): Mat4 {
  const [x, y, z] = axis;
  const len = Math.hypot(x, y, z) || 1;
  const ux = x / len;
  const uy = y / len;
  const uz = z / len;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  const m = new Float32Array(16);
  m[0] = t * ux * ux + c;
  m[1] = t * ux * uy + s * uz;
  m[2] = t * ux * uz - s * uy;
  m[4] = t * ux * uy - s * uz;
  m[5] = t * uy * uy + c;
  m[6] = t * uy * uz + s * ux;
  m[8] = t * ux * uz + s * uy;
  m[9] = t * uy * uz - s * ux;
  m[10] = t * uz * uz + c;
  m[15] = 1;
  return m;
}

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) / (near - far);
  m[11] = -1;
  m[14] = (2 * far * near) / (near - far);
  return m;
}

export function lookAt(eye: Vec3Tuple, target: Vec3Tuple, up: Vec3Tuple): Mat4 {
  const f = normalize([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const s = normalize(cross(f, up));
  const u = cross(s, f);
  const m = identity();
  m[0] = s[0];
  m[4] = s[1];
  m[8] = s[2];
  m[1] = u[0];
  m[5] = u[1];
  m[9] = u[2];
  m[2] = -f[0];
  m[6] = -f[1];
  m[10] = -f[2];
  m[12] = -(s[0] * eye[0] + s[1] * eye[1] + s[2] * eye[2]);
  m[13] = -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]);
  m[14] = f[0] * eye[0] + f[1] * eye[1] + f[2] * eye[2];
  return m;
}

export function normalize(v: Vec3Tuple): Vec3Tuple {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

export function cross(a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
