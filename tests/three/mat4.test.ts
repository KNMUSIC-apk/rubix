import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { identity, lookAt, multiply, rotationAxis, translation } from '../../src/app/view3d/mat4';
import { rotateVec } from '../../src/app/view3d/cubeView';

const close = (a: ArrayLike<number>, b: ArrayLike<number>) => {
  assert.equal(a.length, b.length);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-5, `index ${i}: ${a[i]} vs ${b[i]}`);
};

/** Áp ma trận lên điểm (cột-major). */
const apply = (m: Float32Array, v: [number, number, number]): [number, number, number] => [
  m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
  m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
  m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
];

describe('mat4', () => {
  it('nhân với đơn vị không đổi ma trận', () => {
    const t = translation(1, 2, 3);
    close(multiply(identity(), t), t);
    close(multiply(t, identity()), t);
  });

  it('tịnh tiến đúng điểm', () => {
    assert.deepEqual(apply(translation(1, -2, 3), [0, 0, 0]), [1, -2, 3]);
  });

  it('rotationAxis khớp với rotateVec của lõi (chiều CW khi góc = -π/2)', () => {
    const axes: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    const points: Array<[number, number, number]> = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
      [1, 1, -1],
    ];
    for (const axis of axes) {
      for (const p of points) {
        const m = rotationAxis(axis, -Math.PI / 2);
        const got = apply(m, p);
        const want = rotateVec(p, axis);
        for (let i = 0; i < 3; i++) assert.ok(Math.abs(got[i] - want[i]) < 1e-5, `axis ${axis} point ${p}`);
      }
    }
  });

  it('quay bốn lần bằng đơn vị', () => {
    let m = identity();
    for (let i = 0; i < 4; i++) m = multiply(rotationAxis([0, 0, 1], -Math.PI / 2), m);
    close(m, identity());
  });

  it('lookAt đặt điểm nhìn ở trục -z của không gian camera', () => {
    const v = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const p = apply(v, [0, 0, 0]);
    assert.ok(Math.abs(p[0]) < 1e-6 && Math.abs(p[1]) < 1e-6);
    assert.ok(Math.abs(p[2] + 5) < 1e-6);
  });
});
