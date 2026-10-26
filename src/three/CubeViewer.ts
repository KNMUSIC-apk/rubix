import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STICKERS, rotateCW, stickerIndex, type Color, type Vec3 } from '../cube/geometry';
import { LAYER_DEFS, type Move } from '../cube/moves';
import type { CubeState } from '../cube/state';

/**
 * Bộ dựng 3D của khối Rubik bằng three.js, không phụ thuộc React.
 *
 * Nguyên tắc: trạng thái màu luôn lấy từ CubeState (nguồn dữ liệu duy nhất).
 * Khi quay một lớp, các cubie của lớp đó được gắn vào một pivot rồi xoay dần.
 * Khi animation kết thúc, caller cập nhật trạng thái logic và gọi `syncFromState`
 * để đặt lại màu sticker theo trạng thái mới, nên hình ảnh không bao giờ lệch khỏi dữ liệu.
 */

export type RenderQuality = 'low' | 'high';

export interface CubeViewerOptions {
  readonly quality: RenderQuality;
  /** Thời gian quay một lượt 90° (ms). 0 nghĩa là tắt animation. */
  readonly quarterTurnMs: number;
}

export class WebGLUnavailableError extends Error {
  constructor() {
    super('WebGL is not available in this browser');
    this.name = 'WebGLUnavailableError';
  }
}

export const PALETTE: Readonly<Record<Color | 'body', string>> = {
  W: '#f4f4f1',
  Y: '#ffd21f',
  G: '#1f9d55',
  B: '#1e5fd1',
  R: '#d6333a',
  O: '#ff7a1a',
  body: '#16161a',
};

const CUBIE_SIZE = 0.94;
const STICKER_SIZE = 0.8;
const STICKER_LIFT = 0.4755;

const posKey = (p: Vec3) => `${p[0]},${p[1]},${p[2]}`;

const GRID_POSITIONS: readonly Vec3[] = (() => {
  const out: Vec3[] = [];
  for (const x of [-1, 0, 1]) for (const y of [-1, 0, 1]) for (const z of [-1, 0, 1]) {
    if (x === 0 && y === 0 && z === 0) continue;
    out.push([x, y, z]);
  }
  return out;
})();

const AXIS_NORMALS: readonly Vec3[] = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];

interface CubieView {
  readonly group: THREE.Group;
  /** Các mesh sticker theo chỉ số pháp tuyến trong AXIS_NORMALS. */
  readonly stickers: readonly THREE.Mesh[];
}

export class CubeViewer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly pivot = new THREE.Group();
  private readonly cubies: CubieView[] = [];
  /** Vị trí hiện tại (theo lưới) của mỗi cubie đang hiển thị. */
  private readonly objAt = new Map<string, CubieView>();
  private readonly resizeObserver: ResizeObserver;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private readonly materials: THREE.Material[] = [];
  private frameId: number | null = null;
  private disposed = false;
  private animating: { resolve: () => void } | null = null;
  private tween: ((now: number) => void) | null = null;
  private pendingFinish: (() => void) | null = null;
  private quarterTurnMs: number;
  private onContextLost: (() => void) | null = null;
  private readonly onContextLostHandler = (event: Event): void => {
    event.preventDefault();
    this.onContextLost?.();
  };

  constructor(private readonly container: HTMLElement, options: CubeViewerOptions) {
    this.quarterTurnMs = options.quarterTurnMs;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: options.quality === 'high',
        alpha: true,
        powerPreference: options.quality === 'high' ? 'high-performance' : 'low-power',
      });
    } catch {
      throw new WebGLUnavailableError();
    }
    this.renderer = renderer;
    const pixelRatio = options.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLostHandler);
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
    this.camera.position.set(4.6, 3.8, 6.6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(4, 6, 5);
    this.scene.add(key);
    this.scene.add(this.pivot);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 5;
    this.controls.maxDistance = 14;
    this.controls.enablePan = false;

    this.buildCubies();
    this.resize();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);

    this.startLoop();
  }

  setOnContextLost(cb: (() => void) | null): void {
    this.onContextLost = cb;
  }

  setQuarterTurnMs(ms: number): void {
    this.quarterTurnMs = Math.max(0, ms);
  }

  /** Cập nhật màu sticker của mọi cubie theo trạng thái. Không thay đổi vị trí hình học. */
  syncFromState(state: CubeState): void {
    this.assertAlive();
    for (const [key, view] of this.objAt) {
      const pos = keyToPos(key);
      AXIS_NORMALS.forEach((n, i) => {
        const mesh = view.stickers[i];
        const exposed = pos[0] * n[0] + pos[1] * n[1] + pos[2] * n[2] === 1;
        mesh.visible = exposed;
        if (!exposed) return;
        const idx = stickerIndex(pos, n);
        const color = state.stickers[idx];
        (mesh.material as THREE.MeshStandardMaterial).color.set(PALETTE[color]);
      });
    }
  }

  /**
   * Chỉ hiển thị animation quay. Trạng thái logic do caller cập nhật sau khi promise hoàn tất,
   * rồi gọi syncFromState với trạng thái mới.
   */
  animateMove(move: Move): Promise<void> {
    this.assertAlive();
    if (this.animating) return Promise.reject(new Error('An animation is already running'));
    const def = LAYER_DEFS[move.face];
    const axis = new THREE.Vector3(def.axis[0], def.axis[1], def.axis[2]);
    const layer = [...this.objAt.entries()].filter(([key]) => {
      const p = keyToPos(key);
      return def.depths.includes(p[0] * def.axis[0] + p[1] * def.axis[1] + p[2] * def.axis[2]);
    });

    const target = (-Math.PI / 2) * move.amount;
    const duration = this.quarterTurnMs * move.amount;

    const finish = () => {
      this.pendingFinish = null;
      this.pivot.quaternion.identity();
      for (const [key, view] of layer) {
        this.scene.attach(view.group);
        const newPos = rotateCW(keyToPos(key), def.axis);
        view.group.position.set(newPos[0], newPos[1], newPos[2]);
        view.group.quaternion.identity();
      }
      // Cập nhật bảng vị trí sau khi toàn bộ lớp đã được gắn lại.
      for (const [key] of layer) this.objAt.delete(key);
      for (const [key, view] of layer) {
        const newPos = rotateCW(keyToPos(key), def.axis);
        this.objAt.set(posKey(newPos), view);
      }
    };

    if (duration <= 0) {
      for (const [, view] of layer) this.pivot.attach(view.group);
      this.pivot.quaternion.setFromAxisAngle(axis, target);
      finish();
      return Promise.resolve();
    }

    for (const [, view] of layer) this.pivot.attach(view.group);

    return new Promise<void>((resolve) => {
      const start = performance.now();
      this.pendingFinish = finish;
      this.animating = {
        resolve: () => {
          this.animating = null;
          resolve();
        },
      };
      this.tween = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        this.pivot.quaternion.setFromAxisAngle(axis, target * eased);
        if (t >= 1) {
          this.tween = null;
          finish();
          this.animating?.resolve();
        }
      };
    });
  }

  /**
   * Dừng animation đang chạy và chốt lớp quay về vị trí cuối ngay lập tức.
   * Caller phải tự cập nhật trạng thái logic và gọi syncFromState sau đó.
   */
  cancelAnimation(): void {
    if (!this.animating) return;
    this.tween = null;
    const finish = this.pendingFinish;
    this.pendingFinish = null;
    finish?.();
    this.animating.resolve();
  }

  isAnimating(): boolean {
    return this.animating !== null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cancelAnimation();
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLostHandler);
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private assertAlive(): void {
    if (this.disposed) throw new Error('CubeViewer has been disposed');
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private startLoop(): void {
    const frame = (now: number) => {
      if (this.disposed) return;
      if (this.tween) this.tween(now);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.frameId = requestAnimationFrame(frame);
    };
    this.frameId = requestAnimationFrame(frame);
  }

  private buildCubies(): void {
    const body = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
    const sticker = new THREE.PlaneGeometry(STICKER_SIZE, STICKER_SIZE);
    const bodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.body, roughness: 0.55, metalness: 0.05 });
    this.geometries.push(body, sticker);
    this.materials.push(bodyMat);

    const stickerQuats = AXIS_NORMALS.map((n) =>
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(n[0], n[1], n[2])),
    );

    for (const pos of GRID_POSITIONS) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(body, bodyMat));
      const stickers = AXIS_NORMALS.map((n, i) => {
        const mat = new THREE.MeshStandardMaterial({
          color: PALETTE.W,
          roughness: 0.35,
          metalness: 0,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        });
        this.materials.push(mat);
        const mesh = new THREE.Mesh(sticker, mat);
        mesh.quaternion.copy(stickerQuats[i]);
        mesh.position.set(n[0] * STICKER_LIFT, n[1] * STICKER_LIFT, n[2] * STICKER_LIFT);
        group.add(mesh);
        return mesh;
      });
      group.position.set(pos[0], pos[1], pos[2]);
      this.scene.add(group);
      const view: CubieView = { group, stickers };
      this.cubies.push(view);
      this.objAt.set(posKey(pos), view);
    }
  }
}

function keyToPos(key: string): Vec3 {
  const [x, y, z] = key.split(',').map(Number);
  return [x, y, z];
}

/** Kiểm tra nhanh các hằng số đồng bộ với mô hình logic (dùng trong test). */
export const VIEWER_INTERNALS = { GRID_POSITIONS, AXIS_NORMALS, STICKERS };
