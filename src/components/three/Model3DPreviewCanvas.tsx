import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Grid3x3, RotateCcw, Sparkles } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { retrieveFileBlob } from '../../lib/fileStorage';
import type { StoredFileRef } from '../../types/workspace';
import { getFileExtension } from '../../utils/workspaceLogic';

interface Model3DPreviewCanvasProps {
  fileRef: StoredFileRef;
  uid: string | null;
  heightClass?: string;
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        for (const val of Object.values(m)) {
          if (val && typeof val === 'object' && 'isTexture' in val) {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      }
    }
  });
}

function setWireframeOnObject(root: THREE.Object3D, wireframe: boolean): void {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of mats) {
      if ('wireframe' in m) {
        (m as THREE.MeshStandardMaterial).wireframe = wireframe;
      }
    }
  });
}

export function Model3DPreviewCanvas({
  fileRef,
  uid,
  heightClass = 'h-72 sm:h-80',
}: Model3DPreviewCanvasProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const modelGroupRef = useRef<THREE.Object3D | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const initialCamPosRef = useRef<THREE.Vector3>(new THREE.Vector3(2.8, 2.0, 3.2));
  const requestRenderRef = useRef<() => void>(() => {});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wireframe, setWireframe] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [meshStats, setMeshStats] = useState<{ meshes: number; triangles: number } | null>(null);

  const handleResetView = useCallback(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    cameraRef.current.position.copy(initialCamPosRef.current);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
    requestRenderRef.current();
  }, []);

  useEffect(() => {
    if (modelGroupRef.current) {
      setWireframeOnObject(modelGroupRef.current, wireframe);
      requestRenderRef.current();
    }
  }, [wireframe]);

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
    let loadedModel: THREE.Object3D | null = null;

    setLoading(true);
    setError(null);
    setMeshStats(null);

    try {
      const probeRenderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      const gl = probeRenderer.getContext();
      const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
      const glVendorStr = String(
        (debugExt ? gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || ''
      );
      const isSoftwareGl = /swiftshader|llvmpipe|software/i.test(glVendorStr);
      probeRenderer.dispose();

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: true,
        preserveDrawingBuffer: false,
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#0B1626');

      const width = Math.max(container.clientWidth, 320);
      const height = Math.max(container.clientHeight, 260);
      renderer.setSize(width, height, false);

      const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 500);
      camera.position.copy(initialCamPosRef.current);
      cameraRef.current = camera;

      pmrem = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      envTarget = pmrem.fromScene(envScene, 0.04);
      scene.environment = envTarget.texture;
      envScene.dispose();

      const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x1e293b, 0.75);
      scene.add(hemiLight);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.35);
      keyLight.position.set(4, 7, 5);
      scene.add(keyLight);
      const rimLight = new THREE.DirectionalLight(0xf59e0b, 0.45);
      rimLight.position.set(-5, 3, -4);
      scene.add(rimLight);

      const grid = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
      grid.position.y = -0.8;
      scene.add(grid);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.autoRotate = autoRotate;
      controls.autoRotateSpeed = 1.25;
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
          const moved = controls.update();
          if (moved) needsRender = true;
        }
        if (needsRender && renderer) {
          renderer.render(scene, camera);
          needsRender = false;
        }
      };
      rafId = requestAnimationFrame(tick);

      const fitAndMount = (obj: THREE.Object3D) => {
        if (cancelled) {
          disposeObject3D(obj);
          return;
        }
        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 2.0 / maxDim;
        obj.scale.multiplyScalar(scale);
        obj.position.sub(center.multiplyScalar(scale));

        // Put grid slightly under the normalized object
        const normalizedBox = new THREE.Box3().setFromObject(obj);
        grid.position.y = normalizedBox.min.y - 0.02;

        let meshCount = 0;
        let triCount = 0;
        obj.traverse((child) => {
          const m = child as THREE.Mesh;
          if (m.isMesh && m.geometry) {
            meshCount += 1;
            const pos = m.geometry.attributes.position;
            if (m.geometry.index) {
              triCount += Math.round(m.geometry.index.count / 3);
            } else if (pos) {
              triCount += Math.round(pos.count / 3);
            }
          }
        });

        setMeshStats({ meshes: meshCount, triangles: triCount });
        setWireframeOnObject(obj, wireframe);
        loadedModel = obj;
        modelGroupRef.current = obj;
        scene.add(obj);

        initialCamPosRef.current.set(2.5, 1.9, 2.8);
        camera.position.copy(initialCamPosRef.current);
        controls?.target.set(0, 0, 0);
        controls?.update();
        scheduleRender();
        setLoading(false);
      };

      const ext = getFileExtension(fileRef.name);
      retrieveFileBlob(fileRef, uid)
        .then(async (blob) => {
          if (cancelled) return;
          if (ext === 'GLB' || ext === 'GLTF') {
            const buffer = await blob.arrayBuffer();
            const loader = new GLTFLoader();
            loader.parse(
              buffer,
              '',
              (gltf) => fitAndMount(gltf.scene),
              (err) => {
                if (!cancelled) {
                  setError(
                    err instanceof Error
                      ? `تعذر قراءة نموذج glTF: ${err.message}`
                      : 'تعذر قراءة ملف النموذج ثلاثي الأبعاد.'
                  );
                  setLoading(false);
                }
              }
            );
          } else if (ext === 'OBJ') {
            const text = await blob.text();
            const obj = new OBJLoader().parse(text);
            obj.traverse((c) => {
              const m = c as THREE.Mesh;
              if (m.isMesh) {
                m.material = new THREE.MeshStandardMaterial({
                  color: 0xcbd5e1,
                  roughness: 0.45,
                  metalness: 0.15,
                });
              }
            });
            fitAndMount(obj);
          } else if (ext === 'STL') {
            const buffer = await blob.arrayBuffer();
            const geo = new STLLoader().parse(buffer);
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
              color: 0xd97706,
              roughness: 0.4,
              metalness: 0.25,
            });
            fitAndMount(new THREE.Mesh(geo, mat));
          } else if (ext === 'PLY') {
            const buffer = await blob.arrayBuffer();
            const geo = new PLYLoader().parse(buffer);
            geo.computeVertexNormals();
            const mat = new THREE.MeshStandardMaterial({
              color: 0x94a3b8,
              roughness: 0.45,
              metalness: 0.2,
              vertexColors: Boolean(geo.attributes.color),
            });
            fitAndMount(new THREE.Mesh(geo, mat));
          } else {
            setError('الصيغة مدعومة للتنزيل المباشر؛ المعاينة التفاعلية الفورية تدعم GLB / GLTF / OBJ / STL / PLY.');
            setLoading(false);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات النموذج ثلاثي الأبعاد.');
            setLoading(false);
          }
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تهيئة عارض Three.js ثلاثي الأبعاد.');
      setLoading(false);
    }

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      controls?.dispose();
      if (loadedModel) {
        disposeObject3D(loadedModel);
      }
      modelGroupRef.current = null;
      envTarget?.dispose();
      pmrem?.dispose();
      renderer?.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileRef.id, fileRef.blobId, fileRef.name, uid]);

  return (
    <div data-testid="model-3d-preview" className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 font-bold text-[#062D4C] dark:text-slate-200">
          <span className="inline-flex items-center gap-1 text-[#B92622] dark:text-amber-300">
            <Box className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>عارض 3D تفاعلي</span>
          </span>
          {meshStats && (
            <span className="tabular-nums text-slate-600 dark:text-slate-300">
              · {meshStats.meshes} مجسم · {meshStats.triangles.toLocaleString()} مثلث
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
              autoRotate
                ? 'bg-[#062D4C] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30'
            }`}
          >
            <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>دوران تلقائي</span>
          </button>

          <button
            type="button"
            onClick={() => setWireframe((v) => !v)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-bold cursor-pointer ${
              wireframe
                ? 'bg-[#B92622] text-white border-[#062D4C]'
                : 'bg-white dark:bg-slate-800 text-[#062D4C] dark:text-slate-200 border-[#062D4C]/30'
            }`}
          >
            <Grid3x3 className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>شبكة هندسية</span>
          </button>

          <button
            type="button"
            onClick={handleResetView}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#062D4C]/30 bg-white dark:bg-slate-800 text-xs font-bold text-[#062D4C] dark:text-slate-200 hover:bg-amber-50 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3 shrink-0" aria-hidden="true" />
            <span>تصفير الكاميرا</span>
          </button>
        </div>
      </div>

      <div className={`relative w-full ${heightClass} rounded-xl border-2 border-[#062D4C] dark:border-slate-600 bg-[#0B1626] overflow-hidden`}>
        <div ref={hostRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0B1626]/80 text-xs font-bold text-amber-300">
            جاري تحميل المجسم ثلاثي الأبعاد...
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center p-4 bg-[#0B1626]/92 text-center text-xs font-bold text-rose-300">
            {error}
          </div>
        )}
      </div>

      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
        اسحب لتدوير النموذج · عجلة الفأرة للتقريب والتبعيد · اسحب بزر الفأرة الأيمن للتحريك.
      </p>
    </div>
  );
}
