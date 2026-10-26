import { CORNER_POSITIONS, EDGE_POSITIONS, STICKERS, stickerIndex, type Color, type Vec3 } from '../../cube/geometry';
import { LAYER_DEFS, type Move } from '../../cube/moves';
import type { CubeState } from '../../cube/state';
import { identity, lookAt, multiply, normalize, perspective, rotationAxis, translation, type Mat4 } from './mat4';

/**
 * Khối Rubik 3D bằng WebGL thuần.
 *
 * - Mỗi cubie có vị trí lưới nguyên (x,y,z). Màu sticker lấy từ CubeState tại đúng vị trí đó, nên
 *   hình ảnh luôn phản ánh dữ liệu logic.
 * - Quay một lớp: các cubie của lớp được xoay quanh trục với góc -π/2·amount (chiều kim đồng hồ khi
 *   nhìn từ mặt đang quay), cùng quy ước với rotateCW của lõi. Khi kết thúc, vị trí được cập nhật theo
 *   phép quay lưới và trạng thái mới được gán.
 */

export type RenderQuality = 'high' | 'low';

export const PALETTE: Readonly<Record<Color | 'body', readonly [number, number, number]>> = {
  W: [0.96, 0.96, 0.94],
  Y: [1.0, 0.82, 0.12],
  G: [0.12, 0.62, 0.34],
  B: [0.12, 0.37, 0.82],
  R: [0.84, 0.2, 0.22],
  O: [1.0, 0.48, 0.1],
  body: [0.085, 0.09, 0.11],
};

const CUBIE_HALF = 0.47;
const STICKER_HALF = 0.4;
const STICKER_LIFT = 0.4765;

const VERT_SHADER = `
attribute vec3 aPos;
attribute vec3 aNormal;
uniform mat4 uMVP;
uniform mat4 uModel;
varying vec3 vNormal;
void main() {
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMVP * vec4(aPos, 1.0);
}`;

const FRAG_SHADER = `
precision mediump float;
varying vec3 vNormal;
uniform vec3 uColor;
uniform vec3 uLight;
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uLight), 0.0);
  float rim = pow(1.0 - abs(n.z), 2.0) * 0.08;
  vec3 c = uColor * (0.5 + 0.55 * diff) + rim;
  gl_FragColor = vec4(c, 1.0);
}`;

interface Piece {
  /** Vị trí hiện tại của cubie trên lưới. */
  pos: Vec3;
}

export interface CubeViewOptions {
  readonly quality: RenderQuality;
  readonly quarterTurnMs: number;
  readonly onContextLost?: () => void;
  readonly preserveDrawingBuffer?: boolean;
}

export class WebGLUnsupportedError extends Error {
  constructor() {
    super('WebGL is not supported');
    this.name = 'WebGLUnsupportedError';
  }
}

/** Ma trận hướng cho mỗi pháp tuyến: biến trục z cục bộ của sticker thành pháp tuyến cần thiết. */
function faceOrientation(n: Vec3): Mat4 {
  if (n[2] === 1) return identity();
  if (n[2] === -1) return rotationAxis([0, 1, 0], Math.PI);
  if (n[0] === 1) return rotationAxis([0, 1, 0], Math.PI / 2);
  if (n[0] === -1) return rotationAxis([0, 1, 0], -Math.PI / 2);
  if (n[1] === 1) return rotationAxis([1, 0, 0], -Math.PI / 2);
  return rotationAxis([1, 0, 0], Math.PI / 2);
}

const AXIS_NORMALS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

export class CubeView {
  private readonly gl: WebGLRenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly program: WebGLProgram;
  private readonly uMVP: WebGLUniformLocation;
  private readonly uModel: WebGLUniformLocation;
  private readonly uColor: WebGLUniformLocation;
  private readonly uLight: WebGLUniformLocation;
  private readonly aPos: number;
  private readonly aNormal: number;
  private readonly cubeBuffer: { pos: WebGLBuffer; normal: WebGLBuffer; count: number };
  private readonly quadBuffer: { pos: WebGLBuffer; normal: WebGLBuffer; count: number };
  private readonly stickerOrient = AXIS_NORMALS.map((n) => faceOrientation(n));
  private readonly pieces: Piece[] = [];
  private state: CubeState | null = null;
  private quarterTurnMs: number;
  private readonly onContextLost?: () => void;

  private yaw = 0.7;
  private pitch = 0.45;
  private distance = 7.4;
  private yawVel = 0;
  private pitchVel = 0;
  private dirty = true;

  private animation: {
    move: Move;
    start: number;
    duration: number;
    after: CubeState;
    resolve: () => void;
  } | null = null;

  private frameId = 0;
  private disposed = false;
  private resizeObserver: ResizeObserver | null = null;
  private readonly listeners: Array<[EventTarget, string, EventListener]> = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchDist = 0;
  private lastMove = { x: 0, y: 0 };

  constructor(canvas: HTMLCanvasElement, opts: CubeViewOptions) {
    this.canvas = canvas;
    this.quarterTurnMs = opts.quarterTurnMs;
    this.onContextLost = opts.onContextLost;
    const gl = canvas.getContext('webgl', {
      antialias: opts.quality === 'high',
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: opts.preserveDrawingBuffer ?? false,
    }) as WebGLRenderingContext | null;
    if (!gl) throw new WebGLUnsupportedError();
    this.gl = gl;

    this.program = this.buildProgram();
    gl.useProgram(this.program);
    this.uMVP = this.uniform('uMVP');
    this.uModel = this.uniform('uModel');
    this.uColor = this.uniform('uColor');
    this.uLight = this.uniform('uLight');
    this.aPos = gl.getAttribLocation(this.program, 'aPos');
    this.aNormal = gl.getAttribLocation(this.program, 'aNormal');

    this.cubeBuffer = this.buildBox(CUBIE_HALF);
    this.quadBuffer = this.buildQuad(STICKER_HALF);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);

    for (const p of [...CORNER_POSITIONS, ...EDGE_POSITIONS, ...faceCenterPositions()]) {
      this.pieces.push({ pos: p });
    }

    this.attachEvents();
    this.observeSize();
    this.resize();
    this.listeners.push([canvas, 'webglcontextlost', this.handleContextLost as EventListener]);
    canvas.addEventListener('webglcontextlost', this.handleContextLost);
    this.loop(performance.now());
  }

  /** Đặt trạng thái hiện tại (dùng khi không đang animation). */
  setState(state: CubeState): void {
    this.assertAlive();
    this.state = state;
    this.dirty = true;
  }

  setQuarterTurnMs(ms: number): void {
    this.quarterTurnMs = Math.max(0, ms);
  }

  /**
   * Quay một lớp. `after` là trạng thái logic sau khi quay; nó được gán khi animation kết thúc.
   * Trả về promise hoàn tất sau khi hình ảnh và trạng thái đã đồng bộ.
   */
  animate(move: Move, after: CubeState): Promise<void> {
    this.assertAlive();
    if (this.animation) throw new Error('An animation is already running');
    const duration = this.quarterTurnMs * move.amount;
    if (duration <= 0) {
      this.commitMove(move);
      this.state = after;
      this.dirty = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.animation = { move, start: performance.now(), duration, after, resolve };
      this.dirty = true;
    });
  }

  /** Dừng animation và chốt trạng thái sau cùng ngay lập tức. */
  finishAnimation(): void {
    if (!this.animation) return;
    const a = this.animation;
    this.animation = null;
    this.commitMove(a.move);
    this.state = a.after;
    this.dirty = true;
    a.resolve();
  }

  isAnimating(): boolean {
    return this.animation !== null;
  }

  /** Đưa góc nhìn về mặc định. */
  resetView(): void {
    this.yawVel = 0;
    this.pitchVel = 0;
    this.yaw = 0.7;
    this.pitch = 0.45;
    this.distance = 7.4;
    this.dirty = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.resizeObserver?.disconnect();
    for (const [target, type, fn] of this.listeners) target.removeEventListener(type, fn);
    this.listeners.length = 0;
    const gl = this.gl;
    gl.deleteBuffer(this.cubeBuffer.pos);
    gl.deleteBuffer(this.cubeBuffer.normal);
    gl.deleteBuffer(this.quadBuffer.pos);
    gl.deleteBuffer(this.quadBuffer.normal);
    gl.deleteProgram(this.program);
    const ext = gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
    this.animation = null;
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('CubeView has been disposed');
  }

  // --- Thiết lập WebGL ---

  private buildProgram(): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string): WebGLShader => {
      const sh = gl.createShader(type);
      if (!sh) throw new Error('Cannot create shader');
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(sh) ?? 'unknown';
        gl.deleteShader(sh);
        throw new Error(`Shader compile failed: ${log}`);
      }
      return sh;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SHADER);
    const prog = gl.createProgram();
    if (!prog) throw new Error('Cannot create program');
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog) ?? 'unknown'}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return prog;
  }

  private uniform(name: string): WebGLUniformLocation {
    const loc = this.gl.getUniformLocation(this.program, name);
    if (!loc) throw new Error(`Uniform ${name} missing`);
    return loc;
  }

  private buffer(data: Float32Array): WebGLBuffer {
    const b = this.gl.createBuffer();
    if (!b) throw new Error('Cannot create buffer');
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, b);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, data, this.gl.STATIC_DRAW);
    return b;
  }

  /** Hộp đặc với pháp tuyến từng mặt (24 đỉnh, 36 chỉ số không cần: vẽ TRIANGLES theo thứ tự). */
  private buildBox(h: number): { pos: WebGLBuffer; normal: WebGLBuffer; count: number } {
    const pos: number[] = [];
    const nor: number[] = [];
    const faces: Array<[Vec3, Vec3, Vec3, Vec3, Vec3]> = [];
    const add = (n: Vec3, a: Vec3, b: Vec3, c: Vec3, d: Vec3) => faces.push([n, a, b, c, d]);
    add([1, 0, 0], [h, -h, -h], [h, h, -h], [h, h, h], [h, -h, h]);
    add([-1, 0, 0], [-h, -h, h], [-h, h, h], [-h, h, -h], [-h, -h, -h]);
    add([0, 1, 0], [-h, h, -h], [-h, h, h], [h, h, h], [h, h, -h]);
    add([0, -1, 0], [-h, -h, h], [-h, -h, -h], [h, -h, -h], [h, -h, h]);
    add([0, 0, 1], [-h, -h, h], [h, -h, h], [h, h, h], [-h, h, h]);
    add([0, 0, -1], [h, -h, -h], [-h, -h, -h], [-h, h, -h], [h, h, -h]);
    for (const [n, a, b, c, d] of faces) {
      for (const v of [a, b, c, a, c, d]) {
        pos.push(v[0], v[1], v[2]);
        nor.push(n[0], n[1], n[2]);
      }
    }
    return {
      pos: this.buffer(new Float32Array(pos)),
      normal: this.buffer(new Float32Array(nor)),
      count: pos.length / 3,
    };
  }

  /** Ô vuông phẳng trên mặt z=0, pháp tuyến +z. */
  private buildQuad(h: number): { pos: WebGLBuffer; normal: WebGLBuffer; count: number } {
    const p = [-h, -h, 0, h, -h, 0, h, h, 0, -h, -h, 0, h, h, 0, -h, h, 0];
    const n = new Array(18).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0));
    return { pos: this.buffer(new Float32Array(p)), normal: this.buffer(new Float32Array(n)), count: 6 };
  }

  private bindBuffer(b: { pos: WebGLBuffer; normal: WebGLBuffer }): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.pos);
    gl.enableVertexAttribArray(this.aPos);
    gl.vertexAttribPointer(this.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, b.normal);
    gl.enableVertexAttribArray(this.aNormal);
    gl.vertexAttribPointer(this.aNormal, 3, gl.FLOAT, false, 0, 0);
  }

  // --- Đồng bộ hình ảnh và animation ---

  private commitMove(move: Move): void {
    const def = LAYER_DEFS[move.face];
    for (const piece of this.pieces) {
      const along = piece.pos[0] * def.axis[0] + piece.pos[1] * def.axis[1] + piece.pos[2] * def.axis[2];
      if (!def.depths.includes(along)) continue;
      const n = rotateVec(piece.pos, def.axis);
      piece.pos = n;
    }
  }

  private layerFor(move: Move): Set<Piece> {
    const def = LAYER_DEFS[move.face];
    const set = new Set<Piece>();
    for (const piece of this.pieces) {
      const along = piece.pos[0] * def.axis[0] + piece.pos[1] * def.axis[1] + piece.pos[2] * def.axis[2];
      if (def.depths.includes(along)) set.add(piece);
    }
    return set;
  }

  private draw(now: number): void {
    const gl = this.gl;
    const { width, height } = this.canvas;
    gl.viewport(0, 0, width, height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!this.state) return;

    const aspect = width / Math.max(1, height);
    const eye: Vec3 = [
      this.distance * Math.cos(this.pitch) * Math.sin(this.yaw),
      this.distance * Math.sin(this.pitch),
      this.distance * Math.cos(this.pitch) * Math.cos(this.yaw),
    ];
    const view = lookAt(eye, [0, 0, 0], [0, 1, 0]);
    const proj = perspective((35 * Math.PI) / 180, aspect, 0.1, 100);
    const vp = multiply(proj, view);
    gl.uniform3fv(this.uLight, normalize([0.45, 0.85, 0.6]));

    let animRot: Mat4 | null = null;
    let animSet: Set<Piece> | null = null;
    if (this.animation) {
      const a = this.animation;
      const t = Math.min(1, Math.max(0, (now - a.start) / a.duration));
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const def = LAYER_DEFS[a.move.face];
      animRot = rotationAxis(def.axis, (-Math.PI / 2) * a.move.amount * eased);
      animSet = this.layerFor(a.move);
      if (t >= 1) {
        this.finishAnimation();
        return;
      }
    }

    this.bindBuffer(this.cubeBuffer);
    for (const piece of this.pieces) {
      const base = translation(piece.pos[0], piece.pos[1], piece.pos[2]);
      const model = animRot && animSet?.has(piece) ? multiply(animRot, base) : base;
      gl.uniformMatrix4fv(this.uModel, false, model);
      gl.uniformMatrix4fv(this.uMVP, false, multiply(vp, model));
      gl.uniform3fv(this.uColor, PALETTE.body);
      gl.drawArrays(gl.TRIANGLES, 0, this.cubeBuffer.count);
    }

    this.bindBuffer(this.quadBuffer);
    for (const piece of this.pieces) {
      const base = translation(piece.pos[0], piece.pos[1], piece.pos[2]);
      const pieceModel = animRot && animSet?.has(piece) ? multiply(animRot, base) : base;
      AXIS_NORMALS.forEach((n, i) => {
        const along = piece.pos[0] * n[0] + piece.pos[1] * n[1] + piece.pos[2] * n[2];
        if (along !== 1) return;
        const color = this.state!.stickers[stickerIndex(piece.pos, n)];
        const local = multiply(translation(n[0] * STICKER_LIFT, n[1] * STICKER_LIFT, n[2] * STICKER_LIFT), this.stickerOrient[i]);
        const model = multiply(pieceModel, local);
        gl.uniformMatrix4fv(this.uModel, false, model);
        gl.uniformMatrix4fv(this.uMVP, false, multiply(vp, model));
        gl.uniform3fv(this.uColor, PALETTE[color]);
        gl.drawArrays(gl.TRIANGLES, 0, this.quadBuffer.count);
      });
    }
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.frameId = requestAnimationFrame(this.loop);
    // Quán tính xoay camera: giảm dần khi người dùng thả chuột.
    if (Math.abs(this.yawVel) > 1e-4 || Math.abs(this.pitchVel) > 1e-4) {
      this.yaw += this.yawVel;
      this.pitch = clamp(this.pitch + this.pitchVel, -1.25, 1.25);
      this.yawVel *= 0.9;
      this.pitchVel *= 0.9;
      this.dirty = true;
    }
    if (this.animation || this.dirty) {
      this.dirty = false;
      this.draw(now);
      if (this.animation) this.dirty = true;
    }
  };

  // --- Điều khiển camera và kích thước ---

  private attachEvents(): void {
    const c = this.canvas;
    c.style.touchAction = 'none';
    const onDown = (e: Event) => {
      const pe = e as PointerEvent;
      c.setPointerCapture?.(pe.pointerId);
      this.pointers.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });
      this.lastMove = { x: pe.clientX, y: pe.clientY };
      if (this.pointers.size === 2) this.pinchDist = this.currentPinch();
    };
    const onMove = (e: Event) => {
      const pe = e as PointerEvent;
      if (!this.pointers.has(pe.pointerId)) return;
      this.pointers.set(pe.pointerId, { x: pe.clientX, y: pe.clientY });
      if (this.pointers.size === 2) {
        const d = this.currentPinch();
        if (this.pinchDist > 0) this.distance = clamp(this.distance * (this.pinchDist / d), 5.2, 14);
        this.pinchDist = d;
        this.dirty = true;
        return;
      }
      const dx = pe.clientX - this.lastMove.x;
      const dy = pe.clientY - this.lastMove.y;
      this.lastMove = { x: pe.clientX, y: pe.clientY };
      this.yaw += dx * 0.008;
      this.pitch = clamp(this.pitch + dy * 0.008, -1.25, 1.25);
      this.yawVel = dx * 0.008;
      this.pitchVel = dy * 0.008;
      this.dirty = true;
    };
    const onUp = (e: Event) => {
      const pe = e as PointerEvent;
      this.pointers.delete(pe.pointerId);
      if (this.pointers.size < 2) this.pinchDist = 0;
    };
    const onWheel = (e: Event) => {
      const we = e as WheelEvent;
      e.preventDefault();
      this.distance = clamp(this.distance * (1 + we.deltaY * 0.001), 5.2, 14);
      this.dirty = true;
    };
    const add = (t: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      t.addEventListener(type, fn, opts);
      this.listeners.push([t, type, fn]);
    };
    add(c, 'pointerdown', onDown);
    add(c, 'pointermove', onMove);
    add(c, 'pointerup', onUp);
    add(c, 'pointercancel', onUp);
    add(c, 'wheel', onWheel, { passive: false });
  }

  private currentPinch(): number {
    const pts = [...this.pointers.values()];
    if (pts.length < 2) return 0;
    return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
  }

  private observeSize(): void {
    if (typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    if (this.canvas.parentElement) this.resizeObserver.observe(this.canvas.parentElement);
  }

  private resize(): void {
    const parent = this.canvas.parentElement;
    const cssW = parent?.clientWidth ?? this.canvas.clientWidth;
    const cssH = parent?.clientHeight ?? this.canvas.clientHeight;
    if (cssW === 0 || cssH === 0) return;
    const dpr = this.canvasDpr();
    const w = Math.round(cssW * dpr);
    const h = Math.round(cssH * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.dirty = true;
    }
  }

  private canvasDpr(): number {
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  private handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.onContextLost?.();
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Các cubie 26 mảnh nhìn thấy được: 6 tâm mặt (tâm khối (0,0,0) không tồn tại). */
function faceCenterPositions(): Vec3[] {
  return [
    [0, 1, 0],
    [0, -1, 0],
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
}

/** Công thức của lõi: v' = v×n + (v·n)n (quay CW khi nhìn từ đầu trục). */
export function rotateVec(v: Vec3, axis: Vec3): Vec3 {
  const cx = v[1] * axis[2] - v[2] * axis[1];
  const cy = v[2] * axis[0] - v[0] * axis[2];
  const cz = v[0] * axis[1] - v[1] * axis[0];
  const d = v[0] * axis[0] + v[1] * axis[1] + v[2] * axis[2];
  return [cx + d * axis[0], cy + d * axis[1], cz + d * axis[2]];
}
