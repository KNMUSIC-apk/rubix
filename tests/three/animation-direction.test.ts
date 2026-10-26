import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LAYER_DEFS, type MoveFace } from '../../src/cube/moves';
import { rotateCW, type Vec3 } from '../../src/cube/geometry';

/**
 * CubeViewer quay pivot quanh `axis` với góc -π/2·amount (theo công thức Rodrigues).
 * Kiểm tra ở đây rằng phép quay đó trùng với rotateCW của lõi logic, để hình ảnh và dữ liệu luôn khớp.
 * Không import three.js trong test để chạy được không cần trình duyệt.
 */
function rodrigues(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  const cr: Vec3 = [
    axis[1] * v[2] - axis[2] * v[1],
    axis[2] * v[0] - axis[0] * v[2],
    axis[0] * v[1] - axis[1] * v[0],
  ];
  return [
    v[0] * c + cr[0] * s + axis[0] * d * (1 - c),
    v[1] * c + cr[1] * s + axis[1] * d * (1 - c),
    v[2] * c + cr[2] * s + axis[2] * d * (1 - c),
  ];
}

const close = (a: Vec3, b: Vec3) => a.every((x, i) => Math.abs(x - b[i]) < 1e-9);

describe('hướng quay của animation khớp với logic', () => {
  const faces = Object.keys(LAYER_DEFS) as MoveFace[];
  for (const face of faces) {
    it(`quay ${face} một lượt (CW) khớp với rotateCW`, () => {
      const def = LAYER_DEFS[face];
      const probes: Vec3[] = [
        [1, 0, 0],
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 0],
        [0, 1, -1],
        [-1, 1, 1],
      ];
      for (const v of probes) {
        const expected = rotateCW(v, def.axis);
        const viewed = rodrigues(v, def.axis, -Math.PI / 2);
        assert.ok(close(expected, viewed), `${face}: ${v} -> ${expected} vs ${viewed}`);
      }
    });
  }

  it('góc 180° và 270° khớp với hai và ba lượt CW', () => {
    const axis: Vec3 = [0, 0, 1];
    const v: Vec3 = [1, 1, 1];
    const twice = rotateCW(rotateCW(v, axis), axis);
    assert.ok(close(twice, rodrigues(v, axis, -Math.PI)));
    const thrice = rotateCW(twice, axis);
    assert.ok(close(thrice, rodrigues(v, axis, (-3 * Math.PI) / 2)));
  });
});
