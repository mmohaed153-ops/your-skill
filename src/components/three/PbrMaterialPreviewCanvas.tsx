import { useCallback, useEffect, useRef, useState } from 'react';
import { Grid3x3, RotateCcw, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { retrieveFileBlob } from '../../lib/fileStorage';
import type { PbrMaterialSpec, StoredFileRef } from '../../types/workspace';
import { normalizePbrMaterialSpec } from '../../utils/workspaceLogic';

type MaterialPreviewShape = 'sphere' | 'cube' | 'plane' | 'torus';

interface PbrMaterialPreviewCanvasProps {
  files: StoredFileRef[];
  uid: string | null;
  materialSpec?: Partial<PbrMaterialSpec>;
  heightClass?: string;
}

const SHAPE_LABELS: { id: MaterialPreviewShape; label: string }[] = [
  { id: 'sphere', label: 'كرة PBR' },
  { id: 'cube', label: 'مكعب' },
  { id: 'torus', label: 'حلقة' },
  { id: 'plane', label: 'لوح أرضية' },
];

function createPreviewGeometry(shape: MaterialPreviewShape): THREE.BufferGeometry {
  switch (shape) {
    case 'cube':
      return new THREE.BoxGeometry(1.75, 1.75, 1.75, 24, 24, 24);
    case 'plane':
      return new THREE.PlaneGeometry(2.6, 2.6, 32, 32);
    case 'torus':
      return new THREE.TorusKnotGeometry(0.85, 0.3, 128, 32);
    case 'sphere':
    default:
      return new THREE.SphereGeometry(1.15, 64, 48);
  }
}

export function PbrMaterialPreviewCanvas({
  files,
  uid,
  materialSpec,
  heightClass = 'h-64 sm:h-72',
}: PbrMaterialPreviewCanvasProps) {
  const spec = normalizePbrMaterialSpec(materialSpec, files);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const requestRenderRef = useRef<() => void>(() => {});

  const [shape, setShape] = useState<MaterialPreviewShape>('sphere');
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [loadedMapLabels, setLoadedMapLabels] = useState<string[]>([]);

  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.set(0, 0.35, 3.4);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    requestRenderRef.current();
  }, []);

  // Live update scalar parameters without recreating WebGLRenderer
  useEffect(() => {
    const mat = materialRef.current;
    if (!mat) return;
    mat.color.set(spec.colorHex);
    mat.roughness = spec.roughness;
    mat.metalness = spec.metalness;
    mat.wireframe = wireframe;
    for (const tex of [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.bumpMap]) {
      if (tex) {
        tex.repeat.set(spec.tiling, spec.tiling);
        tex.needsUpdate = true;
      }
    }
    mat.needsUpdate = true;
    requestRenderRef.current();
  }, [spec.colorHex, spec.roughness, spec.metalness, spec.tiling, wireframe]);

  // Swap geometry when shape changes
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const oldGeo = mesh.geometry;
    mesh.geometry = createPreviewGeometry(shape);
    if (shape === 'plane') {
      mesh.rotation.x = -0.35;
    } else {
      mesh.rotation.set(0, 0, 0);
    }
    oldGeo.dispose();
    requestRenderRef.current();
  }, [shape]);

  useEffect(() => {
    if (controlsRef.current) {
      controlsRef.current.autoRotate = autoRotate;
      requestRenderRef.current();
    }
  }, [autoRotate]);

  useEffect(() => {
    const container = hostRef.current;
    if (!container) return;

    let cancelled = false;
    let rafId = 0;
    let needsRender = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let pmrem: THREE.PMREMGenerator | null = null;
    let envTarget: THREE.WebGLRenderTarget | null = null;
    let controls: OrbitControls | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const createdTextures: THREE.Texture[] = [];
    const createdObjectUrls: string[] = [];

    try {
      const probe = new THREE.WebGLRenderer({ antialias: false });
      const gl = probe.getContext();
      const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
      const glVendor = String(
        (debugExt ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || ''
      );
      const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glVendor);
      probe.dispose();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#091423');

      const width = Math.max(container.clientWidth, 300);
      const height = Math.max(container.clientHeight, 240);
      renderer.setSize(width, height, false);

      const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
      camera.position.set(0, 0.35, 3.4);
      cameraRef.current = camera;

      pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      envTarget = pmrem.fromScene(envScene, 0.04);
      scene.environment = envTarget.texture;
      envScene.dispose();

      const keyLight = new THREE.DirectionalLight(0xffffff, 1.25);
      keyLight.position.set(3.5, 5, 4);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xfef3c7, 0.55);
      fillLight.position.set(-4, -2, 3);
      scene.add(fillLight);

      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(spec.colorHex),
        roughness: spec.roughness,
        metalness: spec.metalness,
        wireframe,
      });
      materialRef.current = material;

      const mesh = new THREE.Mesh(createPreviewGeometry(shape), material);
      meshRef.current = mesh;
      scene.add(mesh);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 1.3;
      controlsRef.current = controls;

      const scheduleRender = () => {
        needsRender = true;
      };
      requestRenderRef.current = scheduleRender;
      controls.addEventListener('change', scheduleRender);

      resizeObserver = new ResizeObserver((entries) => {
        if (!renderer || !cameraRef.current) return;
        const rect = entries[0]?.contentRect;
        if (!rect || rect.width <= 0 || rect.height <= 0) return;
        renderer.setSize(rect.width, rect.height, false);
        cameraRef.current.aspect = rect.width / rect.height;
        cameraRef.current.updateProjectionMatrix();
        scheduleRender();
      });
      resizeObserver.observe(container);

      const tick = () => {
        if (cancelled) return;
        rafId = requestAnimationFrame(tick);
        if (controls && controls.autoRotate) {
          controls.update();
          needsRender = true;
        } else if (controls) {
          if (controls.update()) needsRender = true;
        }
        if (needsRender && renderer) {
          renderer.render(scene, camera);
          needsRender = false;
        }
      };
      rafId = requestAnimationFrame(tick);

      // Load attached PBR image maps asynchronously
      const texLoader = new THREE.TextureLoader();
      const mapEntries: Array<{ fileId?: string; slot: string; isColor: boolean; assign: (t: THREE.Texture) => void }> = [
        {
          fileId: spec.baseColorFileId,
          slot: 'Albedo',
          isColor: true,
          assign: (t) => {
            material.map = t;
          },
        },
        {
          fileId: spec.normalFileId,
          slot: 'Normal',
          isColor: false,
          assign: (t) => {
            material.normalMap = t;
          },
        },
        {
          fileId: spec.roughnessFileId,
          slot: 'Roughness',
          isColor: false,
          assign: (t) => {
            material.roughnessMap = t;
          },
        },
        {
          fileId: spec.metallicFileId,
          slot: 'Metallic',
          isColor: false,
          assign: (t) => {
            material.metalnessMap = t;
          },
        },
        {
          fileId: spec.heightFileId,
          slot: 'Height',
          isColor: false,
          assign: (t) => {
            material.bumpMap = t;
            material.bumpScale = 0.04;
          },
        },
      ];

      const activeLabels: string[] = [];
      Promise.all(
        mapEntries.map(async (entry) => {
          if (!entry.fileId) return;
          const fileRef = files.find((f) => f.id === entry.fileId);
          if (!fileRef) return;
          try {
            const blob = await retrieveFileBlob(fileRef, uid);
            if (cancelled) return;
            const url = URL.createObjectURL(blob);
            createdObjectUrls.push(url);
            const texture = await texLoader.loadAsync(url);
            if (cancelled) {
              texture.dispose();
              return;
            }
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(spec.tiling, spec.tiling);
            texture.colorSpace = entry.isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            texture.needsUpdate = true;
            createdTextures.push(texture);
            entry.assign(texture);
            activeLabels.push(entry.slot);
          } catch {
            // Skip unloadable texture gracefully
          }
        })
      ).then(() => {
        if (cancelled) return;
        material.needsUpdate = true;
        setLoadedMapLabels(activeLabels);
        scheduleRender();
      });
    } catch {
      // Fallback gracefully when WebGL is unavailable
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      controls?.dispose();
      meshRef.current?.geometry.dispose();
      materialRef.current?.dispose();
      for (const tex of createdTextures) tex.dispose();
      for (const u of createdObjectUrls) URL.revokeObjectURL(u);
      envTarget?.dispose();
      pmrem?.dispose();
      renderer?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    files,
    uid,
    spec.baseColorFileId,
    spec.normalFileId,
    spec.roughnessFileId,
    spec.metallicFileId,
    spec.heightFileId,
  ]);

  return (
    <div data-testid="pbr-material-preview" className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {SHAPE_LABELS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setShape(item.id)}
              className={`px-2.5 py-1 rounded-lg border font-bold cursor-pointer ${
                shape === item.id
                  ? 'bg-[#B92622] text-white border-[#062D4C]'
                  : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold cursor-pointer ${
              autoRotate
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>دوران</span>
          </button>
          <button
            type="button"
            onClick={() => setWireframe((v) => !v)}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border font-bold cursor-pointer ${
              wireframe
                ? 'bg-[#B92622] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/25'
            }`}
          >
            <Grid3x3 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>شبكة</span>
          </button>
          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-[#062D4C]/25 bg-white dark:bg-slate-800 font-bold text-[#062D4C] dark:text-slate-200 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>إعادة</span>
          </button>
        </div>
      </div>

      <div className={`relative w-full ${heightClass} rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-[#091423] overflow-hidden`}>
        <div ref={hostRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300 tabular-nums">
        <span>
          الخشونة: {spec.roughness.toFixed(2)} · المعدنية: {spec.metalness.toFixed(2)} · التكرار: {spec.tiling}x
        </span>
        <span>
          {loadedMapLabels.length > 0
            ? `الخرائط المفعّلة: ${loadedMapLabels.join(' · ')}`
            : 'معاينة Shader فيزيائية PBR فورية'}
        </span>
      </div>
    </div>
  );
}
