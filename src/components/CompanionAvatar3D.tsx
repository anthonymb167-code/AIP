import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RotateCcw, Orbit } from "lucide-react";
import {
  ARCHETYPES,
  AVATAR_FRAMING_OPTIONS,
  DEFAULT_BACKGROUND_SPEC,
  DEFAULT_RIG_MOTION_CONFIG,
  FACIAL_RIG_STATES,
  GESTURE_LABELS,
  type AvatarFraming,
  type CompanionIdentity,
  type GestureId,
  type RigMotionConfig,
  type VisemeId,
} from "../types/kith";
import { createSurroundingsRig } from "../lib/threeSurroundings";

interface CompanionAvatar3DProps {
  identity: CompanionIdentity;
  gesture: GestureId;
  framing?: AvatarFraming;
  onChangeFraming?: (framing: AvatarFraming) => void;
  isSpeaking?: boolean;
  speechEnergy?: number;
  speechViseme?: VisemeId;
  rigConfig?: RigMotionConfig;
  heightClass?: string;
  onRegisterCapture?: (fn: (() => string | null) | null) => void;
}

// Pre-allocated scratch helpers (zero GC inside render loop)
const _targetColor = new THREE.Color();
const _silverColor = new THREE.Color(0xcbd5e1);
const _goalCamPos = new THREE.Vector3(0, 1.72, 2.75);
const _goalTarget = new THREE.Vector3(0, 1.56, 0);

function getFramingCameraVectors(
  framing: AvatarFraming,
  surfaceY: number,
  outPos: THREE.Vector3,
  outTarget: THREE.Vector3
) {
  if (framing === "headshot") {
    outPos.set(0, surfaceY + 2.02, 1.28);
    outTarget.set(0, surfaceY + 1.98, 0);
  } else if (framing === "full_body") {
    outPos.set(0, surfaceY + 1.32, 5.25);
    outTarget.set(0, surfaceY + 1.06, 0);
  } else {
    // half_body
    outPos.set(0, surfaceY + 1.66, 2.72);
    outTarget.set(0, surfaceY + 1.54, 0);
  }
}

function detectSoftwareWebGL(): boolean {
  try {
    const probeCanvas = document.createElement("canvas");
    const gl = probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 124);
    grad.addColorStop(0, "rgba(15, 23, 42, 0.55)");
    grad.addColorStop(0.55, "rgba(15, 23, 42, 0.2)");
    grad.addColorStop(1, "rgba(15, 23, 42, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVinylLabelTexture(accentHex: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#18181B";
    ctx.fillRect(0, 0, 256, 256);
    for (let r = 46; r < 122; r += 5) {
      ctx.beginPath();
      ctx.arc(128, 128, r, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(128, 128, 42, 0, Math.PI * 2);
    ctx.fillStyle = accentHex;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 128, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#F8FAFC";
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function CompanionAvatar3D({
  identity,
  gesture,
  framing,
  onChangeFraming,
  isSpeaking = false,
  speechEnergy = 0,
  speechViseme = "closed",
  rigConfig = DEFAULT_RIG_MOTION_CONFIG,
  heightClass = "h-[380px] sm:h-[430px]",
  onRegisterCapture,
}: CompanionAvatar3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [autoOrbit, setAutoOrbit] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const captureCallbackRef = useRef(onRegisterCapture);
  captureCallbackRef.current = onRegisterCapture;

  const activeFraming: AvatarFraming =
    framing || identity.cameraFraming || "half_body";

  // Mutable live state refs read smoothly by the Three.js tick without rebuilding WebGL
  const stateRef = useRef({
    identity,
    gesture,
    framing: activeFraming,
    isSpeaking,
    speechEnergy,
    speechViseme,
    rigConfig,
    autoOrbit,
    transitioningCamera: false,
    surfaceY: 0.08,
  });

  useEffect(() => {
    const prevFraming = stateRef.current.framing;
    stateRef.current.identity = identity;
    stateRef.current.gesture = gesture;
    stateRef.current.framing = activeFraming;
    stateRef.current.isSpeaking = isSpeaking;
    stateRef.current.speechEnergy = speechEnergy;
    stateRef.current.speechViseme = speechViseme;
    stateRef.current.rigConfig = rigConfig;
    stateRef.current.autoOrbit = autoOrbit;
    if (prevFraming !== activeFraming) {
      stateRef.current.transitioningCamera = true;
    }
  }, [
    identity,
    gesture,
    activeFraming,
    isSpeaking,
    speechEnergy,
    speechViseme,
    rigConfig,
    autoOrbit,
  ]);

  const resetCamera = () => {
    stateRef.current.transitioningCamera = true;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareWebGL();
    const width = container.clientWidth || 640;
    const height = container.clientHeight || 400;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: "high-performance",
      });
    } catch {
      setContextLost(true);
      return;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => setContextLost(false);
    renderer.domElement.addEventListener("webglcontextlost", onContextLost);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored);

    const scene = new THREE.Scene();
    const bgHex = 0x090d16;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.042);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 45);
    getFramingCameraVectors(
      stateRef.current.framing,
      stateRef.current.surfaceY,
      _goalCamPos,
      _goalTarget
    );
    camera.position.copy(_goalCamPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(_goalTarget);
    controls.enablePan = false;
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.07;
    controls.minDistance = 0.85;
    controls.maxDistance = 8.5;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI * 0.54;
    controls.autoRotateSpeed = 1.6;
    controls.addEventListener("start", () => {
      stateRef.current.transitioningCamera = false;
    });
    controls.update();

    // 3-Point Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xf1f5f9, 0x94a3b8, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 2.2);
    keyLight.position.set(2.4, 4.4, 3.4);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 14;
    const d = 3.2;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xdbeafe, 1.35);
    rimLight.position.set(-2.6, 3.0, -2.5);
    scene.add(rimLight);

    // Track disposable resources
    const disposables: { dispose: () => void }[] = [envTex];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // Ground Studio Pedestal & Soft Contact Shadow
    const contactTex = track(createContactShadowTexture());
    const contactMat = track(
      new THREE.MeshBasicMaterial({
        map: contactTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.48,
      })
    );
    const contactPlane = new THREE.Mesh(
      track(new THREE.PlaneGeometry(3.0, 3.0)),
      contactMat
    );
    contactPlane.rotation.x = -Math.PI / 2;
    contactPlane.position.y = 0.084;
    scene.add(contactPlane);

    const plinthMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xdce2ec,
        roughness: 0.72,
        metalness: 0.08,
      })
    );
    const brassTrimMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xc28a37,
        roughness: 0.22,
        metalness: 0.92,
        clearcoat: 0.4,
      })
    );
    const silverTrimMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xcbd5e1,
        roughness: 0.18,
        metalness: 0.94,
        clearcoat: 0.5,
      })
    );

    const plinthGroup = new THREE.Group();
    const plinthBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.95, 1.05, 0.08, 48)),
      plinthMat
    );
    plinthBase.position.y = 0.04;
    plinthBase.receiveShadow = true;
    plinthGroup.add(plinthBase);

    const plinthRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.94, 0.016, 16, 64)),
      brassTrimMat
    );
    plinthRing.rotation.x = Math.PI / 2;
    plinthRing.position.y = 0.08;
    plinthGroup.add(plinthRing);
    scene.add(plinthGroup);

    const surroundingsRig = createSurroundingsRig(track);
    scene.add(surroundingsRig.root);

    // =========================================================================
    // FULL-LENGTH RIGGED COMPANION ROOT + SOCKET HIERARCHY (Feet at y=0)
    // =========================================================================
    const companionRoot = new THREE.Group();
    companionRoot.position.y = 0.08;
    scene.add(companionRoot);

    const skinMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xf1cbb5,
        roughness: 0.54,
        metalness: 0.02,
        clearcoat: 0.06,
        clearcoatRoughness: 0.7,
      })
    );
    const coatMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x444d3b,
        roughness: 0.84,
        metalness: 0.05,
      })
    );
    const trouserMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e242e,
        roughness: 0.82,
        metalness: 0.06,
      })
    );
    const shoeMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x181311,
        roughness: 0.36,
        metalness: 0.12,
      })
    );
    const lapelMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        roughness: 0.65,
        metalness: 0.12,
      })
    );
    const shirtMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf4f1ea,
        roughness: 0.88,
        metalness: 0.02,
      })
    );
    const hairMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x3b2b22,
        roughness: 0.68,
        metalness: 0.08,
      })
    );
    const templeSilverMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xcbd5e1,
        roughness: 0.52,
        metalness: 0.22,
      })
    );
    const eyeWhiteMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xfefefe,
        roughness: 0.22,
        metalness: 0,
      })
    );
    const irisMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x2b3e52,
        roughness: 0.18,
        metalness: 0.12,
      })
    );
    const pupilMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x090d16,
        roughness: 0.12,
      })
    );
    const lipMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x9b5a49,
        roughness: 0.42,
        metalness: 0.02,
      })
    );
    const darkMouthMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x381619,
        roughness: 0.9,
        metalness: 0,
      })
    );
    const teethMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xf8f5ee,
        roughness: 0.25,
        metalness: 0.02,
      })
    );
    const glassLensMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xe0f2fe,
        roughness: 0.05,
        metalness: 0.08,
        clearcoat: 1.0,
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      })
    );
    const accentGlowMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x1e3a5f,
        emissive: 0x1e3a5f,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.5,
      })
    );

    // -------------------------------------------------------------------------
    // 0. FULL-LENGTH LOWER BODY RIG (Shoes, Tapered Trousers, Pelvis & Skirt)
    // -------------------------------------------------------------------------
    const lowerBodyGroup = new THREE.Group();
    companionRoot.add(lowerBodyGroup);

    const createLegAndBoot = (xOffset: number) => {
      const legUnit = new THREE.Group();
      legUnit.position.set(xOffset, 0, 0);

      // Tailored trouser leg
      const trouser = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.118, 0.076, 0.78, 22)),
        trouserMat
      );
      trouser.position.y = 0.47;
      trouser.scale.set(1.02, 1, 1.08);
      trouser.castShadow = true;
      trouser.receiveShadow = true;
      legUnit.add(trouser);

      // Boot cuff / ankle
      const cuff = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.072, 0.068, 0.08, 18)),
        shoeMat
      );
      cuff.position.y = 0.085;
      cuff.castShadow = true;
      legUnit.add(cuff);

      // Sleek Oxford/boot upper + rounded toe
      const footMain = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.125, 0.075, 0.23)),
        shoeMat
      );
      footMain.position.set(0, 0.038, 0.045);
      footMain.castShadow = true;
      legUnit.add(footMain);

      const toeCap = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.062, 16, 12)),
        shoeMat
      );
      toeCap.position.set(0, 0.034, 0.155);
      toeCap.scale.set(1.0, 0.62, 1.15);
      toeCap.castShadow = true;
      legUnit.add(toeCap);

      return legUnit;
    };

    const legLeft = createLegAndBoot(-0.145);
    const legRight = createLegAndBoot(0.145);
    lowerBodyGroup.add(legLeft, legRight);

    // Pelvis / Waist foundation
    const pelvisMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.28, 0.25, 0.18, 28)),
      trouserMat
    );
    pelvisMesh.position.y = 0.85;
    pelvisMesh.scale.set(1.24, 1, 0.72);
    pelvisMesh.castShadow = true;
    lowerBodyGroup.add(pelvisMesh);

    const beltMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.285, 0.285, 0.045, 28)),
      shoeMat
    );
    beltMesh.position.y = 0.88;
    beltMesh.scale.set(1.25, 1, 0.74);
    lowerBodyGroup.add(beltMesh);

    const beltBuckle = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.068, 0.052, 0.025)),
      brassTrimMat
    );
    beltBuckle.position.set(0, 0.88, 0.215);
    lowerBodyGroup.add(beltBuckle);

    // Tailored Long Coat Skirt (flares slightly below waist, adjusts with coatLayering)
    const coatSkirtGeo = track(
      new THREE.CylinderGeometry(0.32, 0.42, 0.42, 32, 1, true, Math.PI * 0.14, Math.PI * 1.72)
    );
    const coatSkirt = new THREE.Mesh(coatSkirtGeo, coatMat);
    coatSkirt.position.y = 0.72;
    coatSkirt.rotation.y = Math.PI;
    coatSkirt.scale.set(1.26, 1, 0.72);
    coatSkirt.castShadow = true;
    lowerBodyGroup.add(coatSkirt);

    // -------------------------------------------------------------------------
    // 1. UPPER TORSO & TAILORED COAT + MULTI-LAYER BREATHING RIG (y = 0.84)
    // -------------------------------------------------------------------------
    const TORSO_BASE_Y = 0.84;
    const torsoGroup = new THREE.Group();
    torsoGroup.position.y = TORSO_BASE_Y;
    companionRoot.add(torsoGroup);

    const chestBreathingGroup = new THREE.Group();
    torsoGroup.add(chestBreathingGroup);

    const bustPoints = [
      new THREE.Vector2(0.0, 0.0),
      new THREE.Vector2(0.32, 0.0),
      new THREE.Vector2(0.37, 0.24),
      new THREE.Vector2(0.46, 0.56),
      new THREE.Vector2(0.41, 0.71),
      new THREE.Vector2(0.17, 0.78),
      new THREE.Vector2(0.0, 0.78),
    ];
    const bustGeo = track(new THREE.LatheGeometry(bustPoints, 40));
    bustGeo.scale(1.18, 1.0, 0.66);
    const bustMesh = new THREE.Mesh(bustGeo, coatMat);
    bustMesh.castShadow = true;
    bustMesh.receiveShadow = true;
    chestBreathingGroup.add(bustMesh);

    const shirtMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.16, 0.11, 0.48, 24)),
      shirtMat
    );
    shirtMesh.position.set(0, 0.56, 0.18);
    shirtMesh.rotation.x = -0.14;
    shirtMesh.scale.set(1.06, 1, 0.54);
    chestBreathingGroup.add(shirtMesh);

    const lapelShape = new THREE.Shape();
    lapelShape.moveTo(0, 0);
    lapelShape.lineTo(0.15, 0.34);
    lapelShape.lineTo(0.04, 0.38);
    lapelShape.lineTo(-0.04, 0.06);
    lapelShape.closePath();

    const lapelGeo = track(
      new THREE.ExtrudeGeometry(lapelShape, {
        depth: 0.035,
        bevelEnabled: true,
        bevelThickness: 0.01,
        bevelSize: 0.01,
        bevelSegments: 3,
      })
    );

    const lapelLeft = new THREE.Mesh(lapelGeo, lapelMat);
    lapelLeft.position.set(-0.04, 0.42, 0.24);
    lapelLeft.rotation.set(-0.18, -0.25, 0.14);
    lapelLeft.castShadow = true;
    chestBreathingGroup.add(lapelLeft);

    const lapelRight = new THREE.Mesh(lapelGeo, lapelMat);
    lapelRight.position.set(0.04, 0.42, 0.24);
    lapelRight.scale.x = -1;
    lapelRight.rotation.set(-0.18, 0.25, -0.14);
    lapelRight.castShadow = true;
    chestBreathingGroup.add(lapelRight);

    const collarGeo = track(new THREE.TorusGeometry(0.21, 0.042, 16, 36, Math.PI * 1.35));
    const collarMesh = new THREE.Mesh(collarGeo, coatMat);
    collarMesh.position.set(0, 0.77, -0.02);
    collarMesh.rotation.set(Math.PI / 2 + 0.16, 0, Math.PI * 0.82);
    collarMesh.castShadow = true;
    chestBreathingGroup.add(collarMesh);

    const shoulderGeo = track(new THREE.SphereGeometry(0.175, 24, 20));
    const shoulderLeft = new THREE.Mesh(shoulderGeo, coatMat);
    shoulderLeft.position.set(-0.43, 0.57, 0);
    shoulderLeft.scale.set(1.02, 0.9, 0.92);
    shoulderLeft.castShadow = true;
    chestBreathingGroup.add(shoulderLeft);

    const shoulderRight = new THREE.Mesh(shoulderGeo, coatMat);
    shoulderRight.position.set(0.43, 0.57, 0);
    shoulderRight.scale.set(1.02, 0.9, 0.92);
    shoulderRight.castShadow = true;
    chestBreathingGroup.add(shoulderRight);

    // Articulated Left & Right Arms + Hands (full-body posture + thumbs-up lift)
    const createArm = (side: -1 | 1) => {
      const armPivot = new THREE.Group();
      armPivot.position.set(side * 0.45, 0.57, 0);

      const upperSleeve = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.092, 0.078, 0.34, 18)),
        coatMat
      );
      upperSleeve.position.set(side * 0.02, -0.17, 0);
      upperSleeve.rotation.z = side * 0.08;
      upperSleeve.castShadow = true;
      armPivot.add(upperSleeve);

      const forearmPivot = new THREE.Group();
      forearmPivot.position.set(side * 0.035, -0.34, 0);
      armPivot.add(forearmPivot);

      const lowerSleeve = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.074, 0.058, 0.31, 18)),
        coatMat
      );
      lowerSleeve.position.set(0, -0.15, 0.02);
      lowerSleeve.rotation.x = -0.12;
      lowerSleeve.castShadow = true;
      forearmPivot.add(lowerSleeve);

      const shirtCuff = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.059, 0.056, 0.035, 16)),
        shirtMat
      );
      shirtCuff.position.set(0, -0.305, 0.038);
      shirtCuff.rotation.x = -0.12;
      forearmPivot.add(shirtCuff);

      const handMesh = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.056, 16, 14)),
        skinMat
      );
      handMesh.position.set(0, -0.365, 0.048);
      handMesh.scale.set(0.78, 1.25, 0.68);
      handMesh.castShadow = true;
      forearmPivot.add(handMesh);

      const thumbFinger = new THREE.Mesh(
        track(new THREE.CapsuleGeometry(0.016, 0.055, 6, 10)),
        skinMat
      );
      thumbFinger.position.set(-side * 0.025, -0.355, 0.085);
      thumbFinger.rotation.z = side * 0.4;
      thumbFinger.visible = false;
      forearmPivot.add(thumbFinger);

      chestBreathingGroup.add(armPivot);
      return { armPivot, forearmPivot, thumbFinger };
    };

    const armRigL = createArm(-1);
    const armRigR = createArm(1);

    // NECK SOCKET & CHEST ACCOMPANIMENTS
    const neckSocket = new THREE.Group();
    neckSocket.position.set(0, 0.73, 0.21);
    chestBreathingGroup.add(neckSocket);

    const tieMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.075, 0.28, 0.028)),
      lapelMat
    );
    tieMesh.position.set(0, -0.12, 0.03);
    tieMesh.rotation.x = -0.16;
    neckSocket.add(tieMesh);

    const medallionGroup = new THREE.Group();
    medallionGroup.position.set(0, -0.15, 0.06);
    const outerMedRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(0.068, 0.009, 12, 32)),
      brassTrimMat
    );
    const innerMedGem = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.028, 0)),
      accentGlowMat
    );
    medallionGroup.add(outerMedRing, innerMedGem);
    neckSocket.add(medallionGroup);

    const lapelPin = new THREE.Mesh(
      track(new THREE.OctahedronGeometry(0.026, 1)),
      silverTrimMat
    );
    lapelPin.position.set(-0.14, 0.62, 0.28);
    chestBreathingGroup.add(lapelPin);

    const neckMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.115, 0.135, 0.24, 24)),
      skinMat
    );
    neckMesh.position.set(0, 0.87, 0.01);
    neckMesh.castShadow = true;
    torsoGroup.add(neckMesh);

    // =========================================================================
    // 2. HEAD SOCKET + LIFELIKE ARTICULATED FACIAL RIG
    // =========================================================================
    const headSocket = new THREE.Group();
    headSocket.position.set(0, 1.15, 0.02);
    torsoGroup.add(headSocket);

    const cranium = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.255, 36, 32)),
      skinMat
    );
    cranium.scale.set(0.92, 1.08, 0.96);
    cranium.castShadow = true;
    cranium.receiveShadow = true;
    headSocket.add(cranium);

    const upperFace = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.21, 0.16, 0.13, 28)),
      skinMat
    );
    upperFace.position.set(0, -0.065, 0.022);
    upperFace.scale.set(0.92, 1, 0.95);
    upperFace.castShadow = true;
    headSocket.add(upperFace);

    const jawPivot = new THREE.Group();
    jawPivot.position.set(0, -0.06, 0.01);
    headSocket.add(jawPivot);

    const lowerJawMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.165, 0.118, 0.14, 28)),
      skinMat
    );
    lowerJawMesh.position.set(0, -0.085, 0.02);
    lowerJawMesh.scale.set(0.9, 1, 0.94);
    lowerJawMesh.castShadow = true;
    jawPivot.add(lowerJawMesh);

    const chin = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.112, 24, 20)),
      skinMat
    );
    chin.position.set(0, -0.14, 0.048);
    chin.scale.set(1.04, 0.76, 0.88);
    jawPivot.add(chin);

    const nose = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.036, 0.12, 16)),
      skinMat
    );
    nose.position.set(0, -0.01, 0.24);
    nose.rotation.x = 0.28;
    nose.castShadow = true;
    headSocket.add(nose);

    const earGeo = track(new THREE.SphereGeometry(0.055, 16, 16));
    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.235, -0.01, 0);
    earL.scale.set(0.48, 1.15, 0.75);
    headSocket.add(earL);

    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(0.235, -0.01, 0);
    earR.scale.set(0.48, 1.15, 0.75);
    headSocket.add(earR);

    // Hair Socket
    const hairSocket = new THREE.Group();
    headSocket.add(hairSocket);

    const hairCrown = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.268, 32, 28, 0, Math.PI * 2, 0, Math.PI * 0.62)),
      hairMat
    );
    hairCrown.position.set(0, 0.04, -0.015);
    hairCrown.rotation.x = -0.22;
    hairCrown.scale.set(0.96, 1.06, 1.02);
    hairCrown.castShadow = true;
    hairSocket.add(hairCrown);

    const waveCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.19, 0.13, 0.12),
      new THREE.Vector3(-0.05, 0.22, 0.21),
      new THREE.Vector3(0.11, 0.2, 0.19),
      new THREE.Vector3(0.21, 0.11, 0.1),
    ]);
    const frontWave = new THREE.Mesh(
      track(new THREE.TubeGeometry(waveCurve, 24, 0.058, 14, false)),
      hairMat
    );
    frontWave.castShadow = true;
    hairSocket.add(frontWave);

    const templeGeo = track(new THREE.CapsuleGeometry(0.036, 0.1, 8, 12));
    const templeL = new THREE.Mesh(templeGeo, templeSilverMat);
    templeL.position.set(-0.22, 0.04, 0.05);
    templeL.rotation.z = 0.15;
    hairSocket.add(templeL);

    const templeR = new THREE.Mesh(templeGeo, templeSilverMat);
    templeR.position.set(0.22, 0.04, 0.05);
    templeR.rotation.z = -0.15;
    hairSocket.add(templeR);

    const sideLockGeo = track(new THREE.CapsuleGeometry(0.052, 0.24, 8, 14));
    const sideLockL = new THREE.Mesh(sideLockGeo, hairMat);
    sideLockL.position.set(-0.22, -0.06, -0.02);
    sideLockL.rotation.z = 0.14;
    sideLockL.castShadow = true;
    hairSocket.add(sideLockL);

    const sideLockR = new THREE.Mesh(sideLockGeo, hairMat);
    sideLockR.position.set(0.22, -0.06, -0.02);
    sideLockR.rotation.z = -0.14;
    sideLockR.castShadow = true;
    hairSocket.add(sideLockR);

    const backHairDrape = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.28, 0.34, 24, 1, false, Math.PI * 0.65, Math.PI * 0.7)),
      hairMat
    );
    backHairDrape.position.set(0, -0.12, -0.05);
    backHairDrape.castShadow = true;
    hairSocket.add(backHairDrape);

    // Eyes
    const createEye = (xPos: number) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(xPos, 0.035, 0.21);

      const sclera = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.038, 20, 16)),
        eyeWhiteMat
      );
      sclera.scale.set(1.05, 0.9, 0.72);
      eyeGroup.add(sclera);

      const gazeGroup = new THREE.Group();
      eyeGroup.add(gazeGroup);

      const iris = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.022, 16, 16)),
        irisMat
      );
      iris.position.set(0, 0, 0.018);
      iris.scale.z = 0.5;
      gazeGroup.add(iris);

      const pupil = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.012, 12, 12)),
        pupilMat
      );
      pupil.position.set(0, 0, 0.025);
      pupil.scale.z = 0.4;
      gazeGroup.add(pupil);

      const catchlight = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.0042, 8, 8)),
        eyeWhiteMat
      );
      catchlight.position.set(0.007, 0.007, 0.029);
      gazeGroup.add(catchlight);

      const upperLid = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.041, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.56)),
        skinMat
      );
      upperLid.rotation.x = -1.1;
      eyeGroup.add(upperLid);

      const lowerLid = new THREE.Mesh(
        track(new THREE.SphereGeometry(0.0405, 18, 12, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38)),
        skinMat
      );
      lowerLid.rotation.x = 0.58;
      eyeGroup.add(lowerLid);

      const lashLine = new THREE.Mesh(
        track(new THREE.TorusGeometry(0.041, 0.0038, 8, 18, Math.PI * 0.75)),
        hairMat
      );
      lashLine.position.set(0, 0.005, 0.012);
      lashLine.rotation.set(0.35, 0, Math.PI * 0.12);
      eyeGroup.add(lashLine);

      headSocket.add(eyeGroup);
      return { eyeGroup, gazeGroup, upperLid, lowerLid, lashLine };
    };

    const eyeL = createEye(-0.088);
    const eyeR = createEye(0.088);

    const browGeo = track(new THREE.CapsuleGeometry(0.012, 0.068, 6, 10));
    const browL = new THREE.Mesh(browGeo, hairMat);
    browL.position.set(-0.09, 0.105, 0.225);
    browL.rotation.z = Math.PI / 2;
    headSocket.add(browL);

    const browR = new THREE.Mesh(browGeo, hairMat);
    browR.position.set(0.09, 0.105, 0.225);
    browR.rotation.z = Math.PI / 2;
    headSocket.add(browR);

    // Mouth & Lip-Sync Rig
    const mouthAnchor = new THREE.Group();
    mouthAnchor.position.set(0, -0.108, 0.206);
    headSocket.add(mouthAnchor);

    const mouthCavity = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.036, 16, 12)),
      darkMouthMat
    );
    mouthCavity.position.set(0, -0.005, -0.006);
    mouthCavity.scale.set(1.25, 0.55, 0.5);
    mouthAnchor.add(mouthCavity);

    const upperTeeth = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.056, 0.014, 0.014)),
      teethMat
    );
    upperTeeth.position.set(0, 0.006, 0.004);
    mouthAnchor.add(upperTeeth);

    const upperLipGroup = new THREE.Group();
    upperLipGroup.position.set(0, 0.007, 0.014);
    mouthAnchor.add(upperLipGroup);

    const upperLipL = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0085, 0.034, 6, 10)),
      lipMat
    );
    upperLipL.position.set(-0.025, 0.002, 0);
    upperLipL.rotation.z = Math.PI / 2 + 0.12;

    const upperLipC = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0095, 0.028, 6, 10)),
      lipMat
    );
    upperLipC.rotation.z = Math.PI / 2;

    const upperLipR = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0085, 0.034, 6, 10)),
      lipMat
    );
    upperLipR.position.set(0.025, 0.002, 0);
    upperLipR.rotation.z = Math.PI / 2 - 0.12;
    upperLipGroup.add(upperLipL, upperLipC, upperLipR);

    const lowerLipGroup = new THREE.Group();
    lowerLipGroup.position.set(0, -0.008, 0.014);
    mouthAnchor.add(lowerLipGroup);

    const lowerLipL = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0095, 0.032, 6, 10)),
      lipMat
    );
    lowerLipL.position.set(-0.024, 0.002, 0);
    lowerLipL.rotation.z = Math.PI / 2 + 0.12;

    const lowerLipC = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0105, 0.03, 6, 10)),
      lipMat
    );
    lowerLipC.rotation.z = Math.PI / 2;

    const lowerLipR = new THREE.Mesh(
      track(new THREE.CapsuleGeometry(0.0095, 0.032, 6, 10)),
      lipMat
    );
    lowerLipR.position.set(0.024, 0.002, 0);
    lowerLipR.rotation.z = Math.PI / 2 - 0.12;
    lowerLipGroup.add(lowerLipL, lowerLipC, lowerLipR);

    // =========================================================================
    // 3. EYEWEAR SOCKET
    // =========================================================================
    const eyewearSocket = new THREE.Group();
    eyewearSocket.position.set(0, 0.035, 0.262);
    headSocket.add(eyewearSocket);

    const rimGeo = track(new THREE.TorusGeometry(0.062, 0.007, 12, 32));
    const lensGeo = track(new THREE.CircleGeometry(0.058, 28));
    const templeArmGeo = track(new THREE.BoxGeometry(0.008, 0.01, 0.24));

    const rimL = new THREE.Mesh(rimGeo, brassTrimMat);
    rimL.position.set(-0.09, 0, 0);
    const lensL = new THREE.Mesh(lensGeo, glassLensMat);
    lensL.position.set(-0.09, 0, 0.002);

    const rimR = new THREE.Mesh(rimGeo, brassTrimMat);
    rimR.position.set(0.09, 0, 0);
    const lensR = new THREE.Mesh(lensGeo, glassLensMat);
    lensR.position.set(0.09, 0, 0.002);

    const bridgeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.028, 0.008, 0),
      new THREE.Vector3(0, 0.018, 0.008),
      new THREE.Vector3(0.028, 0.008, 0),
    ]);
    const bridge = new THREE.Mesh(
      track(new THREE.TubeGeometry(bridgeCurve, 12, 0.006, 8, false)),
      brassTrimMat
    );

    const armL = new THREE.Mesh(templeArmGeo, brassTrimMat);
    armL.position.set(-0.15, 0.008, -0.12);
    armL.rotation.y = -0.16;

    const armR = new THREE.Mesh(templeArmGeo, brassTrimMat);
    armR.position.set(0.15, 0.008, -0.12);
    armR.rotation.y = 0.16;

    eyewearSocket.add(rimL, lensL, rimR, lensR, bridge, armL, armR);

    // =========================================================================
    // 4. ARCHETYPE 3D AURA & PROPS SOCKET (Aligned to raised upper torso)
    // =========================================================================
    const auraSocket = new THREE.Group();
    companionRoot.add(auraSocket);

    const bookGroup = new THREE.Group();
    bookGroup.position.set(-0.78, 1.88, 0.16);
    bookGroup.rotation.set(0.28, 0.45, -0.12);
    const coverMat = track(
      new THREE.MeshStandardMaterial({ color: 0x3b261d, roughness: 0.6, metalness: 0.15 })
    );
    const pagesMat = track(
      new THREE.MeshStandardMaterial({ color: 0xf8f4e8, roughness: 0.9, metalness: 0 })
    );
    const coverL = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.018, 0.3)), coverMat);
    coverL.position.set(-0.11, 0, 0);
    coverL.rotation.z = -0.22;
    const coverR = new THREE.Mesh(track(new THREE.BoxGeometry(0.22, 0.018, 0.3)), coverMat);
    coverR.position.set(0.11, 0, 0);
    coverR.rotation.z = 0.22;
    const pagesL = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 0.028, 0.28)), pagesMat);
    pagesL.position.set(-0.105, 0.022, 0);
    pagesL.rotation.z = -0.22;
    const pagesR = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 0.028, 0.28)), pagesMat);
    pagesR.position.set(0.105, 0.022, 0);
    pagesR.rotation.z = 0.22;
    const spine = new THREE.Mesh(track(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 12)), brassTrimMat);
    spine.rotation.x = Math.PI / 2;
    bookGroup.add(coverL, coverR, pagesL, pagesR, spine);
    auraSocket.add(bookGroup);

    const gimbalGroup = new THREE.Group();
    gimbalGroup.position.set(0.8, 2.08, -0.05);
    const gRing1 = new THREE.Mesh(track(new THREE.TorusGeometry(0.21, 0.011, 12, 48)), brassTrimMat);
    const gRing2 = new THREE.Mesh(track(new THREE.TorusGeometry(0.16, 0.009, 12, 42)), silverTrimMat);
    const gCore = new THREE.Mesh(track(new THREE.OctahedronGeometry(0.05, 0)), accentGlowMat);
    gimbalGroup.add(gRing1, gRing2, gCore);
    auraSocket.add(gimbalGroup);

    const vinylGroup = new THREE.Group();
    vinylGroup.position.set(-0.8, 1.98, 0.12);
    const vinylTex = track(createVinylLabelTexture("#B46B24"));
    const vinylMat = track(
      new THREE.MeshStandardMaterial({ map: vinylTex, roughness: 0.32, metalness: 0.15 })
    );
    const vinylDisc = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.24, 0.012, 48)),
      vinylMat
    );
    vinylDisc.rotation.x = Math.PI / 2;
    vinylGroup.add(vinylDisc);
    auraSocket.add(vinylGroup);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 640;
      const h = container.clientHeight || 400;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    let nextBlinkAt = 1.8;
    let blinkProgress = -1;
    let doubleBlinkPending = false;

    let nextSaccadeAt = 1.4;
    let targetGazeX = 0;
    let targetGazeY = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === "function") {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          if (disposed) return;
          const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (status === gl.UNSIGNALED) {
            frameId = window.setTimeout(poll, 5);
          } else {
            if (sync) gl.deleteSync(sync);
            frameId = window.setTimeout(cb, 80);
          }
        };
        frameId = window.setTimeout(poll, 5);
      } else {
        frameId = window.setTimeout(cb, 80);
      }
    };

    const tick = () => {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const {
        identity: id,
        gesture: gest,
        framing: activeFrame,
        isSpeaking: speaking,
        speechEnergy: energy,
        speechViseme: viseme,
        rigConfig: cfg,
        autoOrbit: orbit,
      } = stateRef.current;

      const arch = ARCHETYPES[id.archetype];
      const decade = id.decadeStage;
      const rigSpec = FACIAL_RIG_STATES[gest] || FACIAL_RIG_STATES.warm_nod;

      const envResult = surroundingsRig.update(
        elapsed,
        delta,
        id.backgroundSpec || DEFAULT_BACKGROUND_SPEC,
        scene,
        hemiLight,
        keyLight,
        rimLight,
        plinthMat
      );

      plinthGroup.visible = envResult.showStudioPlinth;
      companionRoot.position.y = envResult.surfaceY;
      contactPlane.position.y = envResult.surfaceY + 0.004;
      stateRef.current.surfaceY = envResult.surfaceY;

      // Smoothly update materials to match archetype + decade
      _targetColor.set(arch.coatHex);
      coatMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      _targetColor.set(arch.shirtHex);
      shirtMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      _targetColor.set(arch.accentHex);
      lapelMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      accentGlowMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      accentGlowMat.emissive.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      _targetColor.set(arch.hairHex);
      hairMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));

      // Coordinate trousers nicely with coat
      _targetColor.set(arch.coatHex).multiplyScalar(0.58);
      trouserMat.color.lerp(_targetColor, 1 - Math.exp(-6 * delta));

      const isMaturing = id.maturityMode !== "timeless";
      const effectiveDecade = isMaturing ? decade : 0;
      const silverMix =
        effectiveDecade === 0
          ? 0
          : effectiveDecade === 1
          ? 0.28
          : effectiveDecade === 2
          ? 0.62
          : 0.92;
      _targetColor.set(arch.hairHex).lerp(_silverColor, silverMix);
      templeSilverMat.color.lerp(_targetColor, 1 - Math.exp(-8 * delta));
      if (effectiveDecade === 3) {
        hairMat.color.lerp(_silverColor, 0.35);
      }

      // Slider-driven & gender-driven 3D proportions
      const gender = id.gender || "masculine";
      const coatScale = 0.85 + (id.coatLayering / 100) * 0.45;
      lapelLeft.scale.set(coatScale, 1, 1);
      lapelRight.scale.set(-coatScale, 1, 1);
      collarMesh.scale.setScalar(0.92 + (id.coatLayering / 100) * 0.22);
      coatSkirt.visible = id.coatLayering >= 25;
      coatSkirt.scale.y = 0.72 + (id.coatLayering / 100) * 0.55;

      const targetJawWidth = gender === "feminine" ? 0.78 : gender === "nonbinary" ? 0.86 : 0.94;
      const targetChinWidth = gender === "feminine" ? 0.84 : gender === "nonbinary" ? 0.94 : 1.06;
      const targetBrowThick = gender === "feminine" ? 0.72 : gender === "nonbinary" ? 0.88 : 1.08;
      const targetShoulderOffset = gender === "feminine" ? 0.41 : gender === "nonbinary" ? 0.43 : 0.45;

      lowerJawMesh.scale.x = THREE.MathUtils.damp(lowerJawMesh.scale.x, targetJawWidth, 8, delta);
      chin.scale.x = THREE.MathUtils.damp(chin.scale.x, targetChinWidth, 8, delta);
      browL.scale.x = THREE.MathUtils.damp(browL.scale.x, targetBrowThick, 8, delta);
      browR.scale.x = THREE.MathUtils.damp(browR.scale.x, targetBrowThick, 8, delta);
      shoulderLeft.position.x = THREE.MathUtils.damp(shoulderLeft.position.x, -targetShoulderOffset, 8, delta);
      shoulderRight.position.x = THREE.MathUtils.damp(shoulderRight.position.x, targetShoulderOffset, 8, delta);
      armRigL.armPivot.position.x = THREE.MathUtils.damp(armRigL.armPivot.position.x, -(targetShoulderOffset + 0.02), 8, delta);
      armRigR.armPivot.position.x = THREE.MathUtils.damp(armRigR.armPivot.position.x, targetShoulderOffset + 0.02, 8, delta);

      eyeL.lashLine.visible = gender === "feminine";
      eyeR.lashLine.visible = gender === "feminine";

      const hairScale = 0.96 + (id.hairLength / 100) * 0.14;
      hairSocket.scale.set(1, hairScale, 1);

      const lengthNorm = id.hairLength / 100;
      const showLongLocks = gender === "feminine" || (gender === "nonbinary" && lengthNorm >= 0.35) || lengthNorm >= 0.72;
      const lockScaleY = gender === "feminine" ? 0.95 + lengthNorm * 0.55 : 0.65 + lengthNorm * 0.45;
      sideLockL.visible = showLongLocks;
      sideLockR.visible = showLongLocks;
      backHairDrape.visible = gender === "feminine" || (gender === "nonbinary" && lengthNorm >= 0.45) || lengthNorm >= 0.78;
      sideLockL.scale.set(1, lockScaleY, 1);
      sideLockR.scale.set(1, lockScaleY, 1);
      backHairDrape.scale.set(1, lockScaleY, 1);

      // Eyewear & accessory visibility
      const showGlasses =
        id.archetype === "classic_scholar" ||
        id.accessoryDetail >= 45 ||
        effectiveDecade >= 2;
      eyewearSocket.visible = showGlasses;
      medallionGroup.visible = id.archetype === "arcane_fantasy" || id.accessoryDetail >= 68;
      tieMesh.visible = id.archetype === "classic_scholar" || id.archetype === "goth_academia";
      lapelPin.visible = id.accessoryDetail >= 35;

      // Archetype 3D props visibility & motion
      bookGroup.visible =
        id.archetype === "classic_scholar" || id.archetype === "goth_academia";
      gimbalGroup.visible =
        id.archetype === "arcane_fantasy" || id.archetype === "sporty_vanguard";
      vinylGroup.visible = id.archetype === "retro_analog";

      bookGroup.position.y = 1.88 + Math.sin(elapsed * 1.4) * 0.035;
      bookGroup.rotation.y = 0.45 + Math.sin(elapsed * 0.7) * 0.1;

      gRing1.rotation.x = elapsed * 0.7;
      gRing1.rotation.y = elapsed * 0.5;
      gRing2.rotation.y = -elapsed * 0.9;
      gRing2.rotation.z = elapsed * 0.4;
      gCore.rotation.y = elapsed * 1.2;

      vinylGroup.position.y = 1.98 + Math.sin(elapsed * 1.3) * 0.03;
      vinylDisc.rotation.y = elapsed * 1.1;

      // Breathing rig
      let breathCurve = 0;
      if (cfg.breathing) {
        const breathRate = id.voiceTone === "excited" || gest === "laugh" ? 2.15 : 1.55;
        const raw = Math.sin(elapsed * breathRate) + 0.22 * Math.sin(elapsed * breathRate * 2 - 0.6);
        breathCurve = (raw + 1.22) * 0.41;
      }
      const targetChestScaleZ = 1 + breathCurve * 0.028;
      const targetChestScaleX = 1 + breathCurve * 0.014;
      chestBreathingGroup.scale.z = THREE.MathUtils.damp(
        chestBreathingGroup.scale.z,
        targetChestScaleZ,
        6,
        delta
      );
      chestBreathingGroup.scale.x = THREE.MathUtils.damp(
        chestBreathingGroup.scale.x,
        targetChestScaleX,
        6,
        delta
      );
      torsoGroup.position.y = THREE.MathUtils.damp(
        torsoGroup.position.y,
        TORSO_BASE_Y + breathCurve * 0.011,
        6,
        delta
      );
      const shoulderY = 0.57 + breathCurve * 0.011;
      shoulderLeft.position.y = THREE.MathUtils.damp(shoulderLeft.position.y, shoulderY, 7, delta);
      shoulderRight.position.y = THREE.MathUtils.damp(shoulderRight.position.y, shoulderY, 7, delta);

      // Arm posture & thumbs-up gesture articulation
      const swayArm = cfg.breathing ? Math.sin(elapsed * 1.2) * 0.025 : 0;
      armRigL.armPivot.rotation.z = THREE.MathUtils.damp(armRigL.armPivot.rotation.z, -0.05 - swayArm, 7, delta);
      armRigL.armPivot.rotation.x = THREE.MathUtils.damp(armRigL.armPivot.rotation.x, 0.04, 7, delta);

      const isThumbsUp = gest === "thumbs_up";
      armRigR.armPivot.rotation.x = THREE.MathUtils.damp(
        armRigR.armPivot.rotation.x,
        isThumbsUp ? -0.95 : 0.04,
        8,
        delta
      );
      armRigR.armPivot.rotation.z = THREE.MathUtils.damp(
        armRigR.armPivot.rotation.z,
        isThumbsUp ? -0.18 : 0.05 + swayArm,
        8,
        delta
      );
      armRigR.forearmPivot.rotation.x = THREE.MathUtils.damp(
        armRigR.forearmPivot.rotation.x,
        isThumbsUp ? -0.82 : -0.06,
        8,
        delta
      );
      armRigR.thumbFinger.visible = isThumbsUp;

      // Head expression & speaking sway kinematics
      const speakSwayY = speaking && cfg.lipSync ? Math.sin(elapsed * 3.1) * 0.035 : 0;
      const speakNodX = speaking && cfg.lipSync ? Math.sin(elapsed * 5.2) * 0.028 : 0;

      const degToRad = Math.PI / 180;
      const targetHeadRotZ =
        -rigSpec.headTiltDeg * degToRad +
        (cfg.breathing ? Math.sin(elapsed * 0.7) * 0.015 : 0);
      const targetHeadRotX =
        rigSpec.headPitchDeg * degToRad +
        (gest === "warm_nod" ? Math.sin(elapsed * 3.6) * 0.065 : 0) +
        (gest === "laugh" ? Math.sin(elapsed * 8.0) * 0.038 : 0) +
        speakNodX -
        breathCurve * 0.012;
      const targetHeadRotY =
        (gest === "smirk" ? 0.1 : gest === "wink" ? -0.08 : gest === "curious_brow" ? -0.11 : 0) +
        Math.sin(elapsed * 0.55) * 0.035 +
        speakSwayY;

      headSocket.rotation.z = THREE.MathUtils.damp(headSocket.rotation.z, targetHeadRotZ, 8, delta);
      headSocket.rotation.x = THREE.MathUtils.damp(headSocket.rotation.x, targetHeadRotX, 8, delta);
      headSocket.rotation.y = THREE.MathUtils.damp(headSocket.rotation.y, targetHeadRotY, 8, delta);

      // Blinking & Duchenne lids
      let blinkWeight = 0;
      if (cfg.autoBlink) {
        if (blinkProgress < 0 && elapsed >= nextBlinkAt) {
          blinkProgress = 0;
          if (!doubleBlinkPending && Math.random() < 0.24) {
            doubleBlinkPending = true;
          }
        }
        if (blinkProgress >= 0) {
          blinkProgress += delta / 0.21;
          if (blinkProgress >= 1) {
            blinkProgress = -1;
            if (doubleBlinkPending) {
              doubleBlinkPending = false;
              nextBlinkAt = elapsed + 0.14;
            } else {
              nextBlinkAt = elapsed + 2.4 + Math.random() * 2.8;
            }
          } else {
            blinkWeight =
              blinkProgress < 0.42
                ? blinkProgress / 0.42
                : 1 - (blinkProgress - 0.42) / 0.58;
          }
        }
      } else {
        blinkProgress = -1;
      }

      const squintL = Math.max(rigSpec.eyeSquintL * 0.65, blinkWeight);
      const squintR = Math.max(rigSpec.eyeSquintR * 0.92, blinkWeight);
      const targetUpperLidL = THREE.MathUtils.lerp(-1.12, -0.08, squintL);
      const targetUpperLidR = THREE.MathUtils.lerp(-1.12, -0.08, squintR);

      eyeL.upperLid.rotation.x = THREE.MathUtils.damp(eyeL.upperLid.rotation.x, targetUpperLidL, 26, delta);
      eyeR.upperLid.rotation.x = THREE.MathUtils.damp(eyeR.upperLid.rotation.x, targetUpperLidR, 26, delta);

      const targetLowerLidL = THREE.MathUtils.lerp(0.6, 0.24, rigSpec.eyeSquintL);
      const targetLowerLidR = THREE.MathUtils.lerp(0.6, 0.24, rigSpec.eyeSquintR);
      eyeL.lowerLid.rotation.x = THREE.MathUtils.damp(eyeL.lowerLid.rotation.x, targetLowerLidL, 14, delta);
      eyeR.lowerLid.rotation.x = THREE.MathUtils.damp(eyeR.lowerLid.rotation.x, targetLowerLidR, 14, delta);

      // Gaze micro-saccades
      if (cfg.gazeTracking) {
        if (elapsed >= nextSaccadeAt) {
          nextSaccadeAt = elapsed + 1.6 + Math.random() * 2.2;
          targetGazeX = (Math.random() - 0.5) * 0.008;
          targetGazeY = (Math.random() - 0.5) * 0.005 + (gest === "curious_brow" ? 0.002 : 0);
        }
      } else {
        targetGazeX = 0;
        targetGazeY = 0;
      }
      eyeL.gazeGroup.position.x = THREE.MathUtils.damp(eyeL.gazeGroup.position.x, targetGazeX, 18, delta);
      eyeL.gazeGroup.position.y = THREE.MathUtils.damp(eyeL.gazeGroup.position.y, targetGazeY, 18, delta);
      eyeR.gazeGroup.position.x = THREE.MathUtils.damp(eyeR.gazeGroup.position.x, targetGazeX, 18, delta);
      eyeR.gazeGroup.position.y = THREE.MathUtils.damp(eyeR.gazeGroup.position.y, targetGazeY, 18, delta);

      // Eyebrows
      const targetBrowLY = 0.102 + rigSpec.browLiftL * 0.024;
      const targetBrowRY = 0.102 + rigSpec.browLiftR * 0.024;
      browL.position.y = THREE.MathUtils.damp(browL.position.y, targetBrowLY, 12, delta);
      browR.position.y = THREE.MathUtils.damp(browR.position.y, targetBrowRY, 12, delta);

      const browTiltL = gest === "concerned_tilt" ? 0.18 : gest === "curious_brow" ? -0.14 : 0;
      const browTiltR =
        gest === "concerned_tilt" ? -0.18 : gest === "smirk" ? 0.14 : gest === "wink" ? -0.1 : 0;
      browL.rotation.z = THREE.MathUtils.damp(browL.rotation.z, Math.PI / 2 + browTiltL, 12, delta);
      browR.rotation.z = THREE.MathUtils.damp(browR.rotation.z, Math.PI / 2 + browTiltR, 12, delta);

      // Jaw & Lip-Sync Viseme Rig
      let activeJawDrop = rigSpec.jawDrop * 0.022;
      let mouthWidthScale = 1.0;
      let lipProtrusionZ = 0.0;

      if (speaking && cfg.lipSync) {
        const effectiveEnergy = energy > 0.04 ? energy : 0.35 + Math.abs(Math.sin(elapsed * 13)) * 0.45;
        const activeViseme: VisemeId =
          energy > 0.04
            ? viseme
            : (["aa", "ee", "oh", "mm"] as VisemeId[])[Math.floor(elapsed * 9) % 4];

        if (activeViseme === "aa") {
          activeJawDrop = Math.max(activeJawDrop, 0.026 * effectiveEnergy);
          mouthWidthScale = 1.02;
        } else if (activeViseme === "oh") {
          activeJawDrop = Math.max(activeJawDrop, 0.021 * effectiveEnergy);
          mouthWidthScale = 0.74;
          lipProtrusionZ = 0.008;
        } else if (activeViseme === "ee") {
          activeJawDrop = Math.max(activeJawDrop, 0.012 * effectiveEnergy);
          mouthWidthScale = 1.18;
        } else if (activeViseme === "mm") {
          activeJawDrop = 0.001;
          mouthWidthScale = 0.94;
        }
      }

      jawPivot.rotation.x = THREE.MathUtils.damp(jawPivot.rotation.x, activeJawDrop * 3.8, 22, delta);
      jawPivot.position.y = THREE.MathUtils.damp(jawPivot.position.y, -0.06 - activeJawDrop * 0.35, 22, delta);

      lowerLipGroup.position.y = THREE.MathUtils.damp(
        lowerLipGroup.position.y,
        -0.007 - activeJawDrop,
        24,
        delta
      );
      lowerLipGroup.position.z = THREE.MathUtils.damp(
        lowerLipGroup.position.z,
        0.014 + lipProtrusionZ,
        20,
        delta
      );
      upperLipGroup.position.z = THREE.MathUtils.damp(
        upperLipGroup.position.z,
        0.014 + lipProtrusionZ,
        20,
        delta
      );

      const smileDeltaL = rigSpec.smileCurve * 0.008 - rigSpec.asymSmirk * 0.006;
      const smileDeltaR = rigSpec.smileCurve * 0.008 + rigSpec.asymSmirk * 0.009;
      upperLipL.position.y = THREE.MathUtils.damp(upperLipL.position.y, 0.002 + smileDeltaL, 14, delta);
      upperLipR.position.y = THREE.MathUtils.damp(upperLipR.position.y, 0.002 + smileDeltaR, 14, delta);
      lowerLipL.position.y = THREE.MathUtils.damp(lowerLipL.position.y, 0.002 + smileDeltaL * 0.8, 14, delta);
      lowerLipR.position.y = THREE.MathUtils.damp(lowerLipR.position.y, 0.002 + smileDeltaR * 0.8, 14, delta);

      mouthAnchor.scale.x = THREE.MathUtils.damp(mouthAnchor.scale.x, mouthWidthScale, 18, delta);

      const openRatio = Math.min(1, activeJawDrop / 0.025);
      mouthCavity.scale.y = THREE.MathUtils.damp(mouthCavity.scale.y, 0.2 + openRatio * 0.85, 20, delta);
      upperTeeth.visible = openRatio > 0.16;

      // Camera smooth framing transition (Headshot / Half Body / Full Body) or auto-orbit
      controls.autoRotate = !isSoftwareGl && orbit;
      if (stateRef.current.transitioningCamera) {
        getFramingCameraVectors(
          activeFrame,
          envResult.surfaceY,
          _goalCamPos,
          _goalTarget
        );
        camera.position.x = THREE.MathUtils.damp(camera.position.x, _goalCamPos.x, 7, delta);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, _goalCamPos.y, 7, delta);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, _goalCamPos.z, 7, delta);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, _goalTarget.x, 7, delta);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, _goalTarget.y, 7, delta);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, _goalTarget.z, 7, delta);
        if (camera.position.distanceTo(_goalCamPos) < 0.025) {
          camera.position.copy(_goalCamPos);
          controls.target.copy(_goalTarget);
          stateRef.current.transitioningCamera = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    captureCallbackRef.current?.(() => {
      if (disposed) return null;
      try {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/png");
      } catch {
        return null;
      }
    });

    return () => {
      disposed = true;
      captureCallbackRef.current?.(null);
      cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      controls.dispose();
      disposables.forEach((dItem) => dItem.dispose());
      renderer.dispose();
    };
  }, []);

  if (contextLost) {
    return (
      <div
        className={`${heightClass} w-full rounded-xl bg-[#090D16] border border-[#1E293B] flex flex-col items-center justify-center p-6 text-center space-y-2`}
      >
        <p className="text-sm font-semibold text-slate-100">
          3D Viewport Paused
        </p>
        <p className="text-xs text-slate-400 max-w-xs">
          WebGL rendering is unavailable on this browser context. Switch to the 2D Rig or Portrait above.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`relative w-full ${heightClass} rounded-xl overflow-hidden border border-[#1E293B] bg-[#090D16] ring-1 ring-slate-900/10 dark:ring-white/5`}
      >
        <div
          ref={mountRef}
          aria-label={`Interactive 3D avatar of ${identity.primaryName} showing ${GESTURE_LABELS[gesture].label}`}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />
      </div>

      {/* Unobtrusive Below-Viewport Framing & Orbit Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
        <div className="flex items-center gap-1 p-1 bg-surface-alt border border-edge rounded-lg">
          {AVATAR_FRAMING_OPTIONS.map((opt) => {
            const selected = activeFraming === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  if (onChangeFraming) {
                    onChangeFraming(opt.id);
                  }
                  stateRef.current.framing = opt.id;
                  stateRef.current.transitioningCamera = true;
                }}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selected
                    ? "bg-surface text-ink ring-1 ring-edge"
                    : "text-ink-muted hover:text-ink"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[11px] text-ink-muted">
            Drag 360° · Scroll zoom
          </span>
          <button
            type="button"
            onClick={() => setAutoOrbit((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              autoOrbit
                ? "bg-accent text-accent-fg border-accent"
                : "bg-surface-alt text-ink-secondary border-edge hover:border-edge-strong"
            }`}
          >
            <Orbit className="w-3.5 h-3.5" />
            {autoOrbit ? "Auto-Orbit On" : "Auto-Orbit"}
          </button>
          <button
            type="button"
            onClick={resetCamera}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-surface-alt text-ink-secondary border border-edge rounded-lg hover:border-edge-strong transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reframe
          </button>
        </div>
      </div>
    </div>
  );
}
