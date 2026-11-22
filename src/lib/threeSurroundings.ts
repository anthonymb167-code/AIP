import * as THREE from "three";
import { DEFAULT_BACKGROUND_SPEC, type BackgroundSpec } from "../types/kith";

type TrackFn = <T extends { dispose: () => void }>(item: T) => T;

const _bgColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _keyColor = new THREE.Color();
const _rimColor = new THREE.Color();
const _hemiSkyColor = new THREE.Color();
const _hemiGroundColor = new THREE.Color();
const _plinthColor = new THREE.Color();
const _particleColor = new THREE.Color();
const _lightSlate = new THREE.Color(0xdce2ec);

export interface SurroundingsUpdateResult {
  surfaceY: number;
  showStudioPlinth: boolean;
}

export interface SurroundingsRig {
  root: THREE.Group;
  update: (
    elapsed: number,
    delta: number,
    spec: BackgroundSpec | undefined,
    scene: THREE.Scene,
    hemiLight: THREE.HemisphereLight,
    keyLight: THREE.DirectionalLight,
    rimLight: THREE.DirectionalLight,
    plinthMat: THREE.MeshStandardMaterial
  ) => SurroundingsUpdateResult;
}

export function createSurroundingsRig(track: TrackFn): SurroundingsRig {
  const root = new THREE.Group();

  // Shared materials for procedural architecture & terrain
  const darkWoodMat = track(
    new THREE.MeshStandardMaterial({ color: 0x3b261a, roughness: 0.78, metalness: 0.06 })
  );
  const boatTimberMat = track(
    new THREE.MeshStandardMaterial({ color: 0x6b4226, roughness: 0.72, metalness: 0.05 })
  );
  const slateFrameMat = track(
    new THREE.MeshStandardMaterial({ color: 0x263244, roughness: 0.65, metalness: 0.25 })
  );
  const warmGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xffd599,
      emissive: 0xffb347,
      emissiveIntensity: 0.9,
      roughness: 0.3,
    })
  );
  const coolWindowGlowMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xbae6fd,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.65,
      roughness: 0.25,
    })
  );
  const stoneMat = track(
    new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.85, metalness: 0.05 })
  );
  const brassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xc28a37,
      roughness: 0.24,
      metalness: 0.9,
      clearcoat: 0.35,
    })
  );
  const windowGlassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0x64748b,
      roughness: 0.12,
      metalness: 0.1,
      transparent: true,
      opacity: 0.28,
    })
  );

  // ---------------------------------------------------------------------------
  // 1. LIBRARY STUDY SURROUNDINGS
  // ---------------------------------------------------------------------------
  const libraryGroup = new THREE.Group();
  const shelfFrameL = new THREE.Mesh(track(new THREE.BoxGeometry(1.15, 2.5, 0.28)), darkWoodMat);
  shelfFrameL.position.set(-1.75, 1.25, -1.65);
  shelfFrameL.rotation.y = 0.28;
  shelfFrameL.receiveShadow = true;

  const shelfFrameR = new THREE.Mesh(track(new THREE.BoxGeometry(1.15, 2.5, 0.28)), darkWoodMat);
  shelfFrameR.position.set(1.75, 1.25, -1.65);
  shelfFrameR.rotation.y = -0.28;
  shelfFrameR.receiveShadow = true;
  libraryGroup.add(shelfFrameL, shelfFrameR);

  const bookColors = [0x7c2d12, 0x1e3a5f, 0x14532d, 0x4c1d95, 0x9a3412, 0x334155];
  const bookMats = bookColors.map((hex) =>
    track(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72, metalness: 0.08 }))
  );
  const bookGeo = track(new THREE.BoxGeometry(0.11, 0.3, 0.22));
  for (const frame of [shelfFrameL, shelfFrameR]) {
    for (let row = 0; row < 4; row++) {
      const shelfPlank = new THREE.Mesh(
        track(new THREE.BoxGeometry(1.06, 0.04, 0.32)),
        darkWoodMat
      );
      shelfPlank.position.set(0, -0.85 + row * 0.56, 0.03);
      frame.add(shelfPlank);
      for (let b = 0; b < 6; b++) {
        const book = new THREE.Mesh(bookGeo, bookMats[(row * 6 + b) % bookMats.length]);
        book.position.set(-0.38 + b * 0.145, -0.68 + row * 0.56, 0.06);
        book.rotation.z = b === 5 ? 0.14 : 0;
        frame.add(book);
      }
    }
  }

  const lampPost = new THREE.Mesh(track(new THREE.CylinderGeometry(0.024, 0.035, 1.85, 16)), brassMat);
  lampPost.position.set(-1.12, 0.92, -0.95);
  const lampShade = new THREE.Mesh(track(new THREE.ConeGeometry(0.22, 0.2, 24, 1, true)), warmGlowMat);
  lampShade.position.set(-1.12, 1.86, -0.95);
  libraryGroup.add(lampPost, lampShade);
  root.add(libraryGroup);

  // ---------------------------------------------------------------------------
  // 2. RAINY BOOKSHOP / CAFE WINDOW
  // ---------------------------------------------------------------------------
  const rainyGroup = new THREE.Group();
  const windowWall = new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 2.5, 0.12)), slateFrameMat);
  windowWall.position.set(0, 1.32, -1.85);
  const windowPane = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 2.0)), windowGlassMat);
  windowPane.position.set(0, 1.35, -1.78);

  const mullionV = new THREE.Mesh(track(new THREE.BoxGeometry(0.06, 2.05, 0.14)), darkWoodMat);
  mullionV.position.set(0, 1.35, -1.78);
  const mullionH = new THREE.Mesh(track(new THREE.BoxGeometry(2.25, 0.06, 0.14)), darkWoodMat);
  mullionH.position.set(0, 1.38, -1.78);

  const sconceL = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 16, 12)), warmGlowMat);
  sconceL.position.set(-1.5, 1.72, -1.55);
  const sconceR = new THREE.Mesh(track(new THREE.SphereGeometry(0.11, 16, 12)), warmGlowMat);
  sconceR.position.set(1.5, 1.72, -1.55);
  rainyGroup.add(windowWall, windowPane, mullionV, mullionH, sconceL, sconceR);
  root.add(rainyGroup);

  // ---------------------------------------------------------------------------
  // 3. MIDNIGHT OBSERVATORY
  // ---------------------------------------------------------------------------
  const observatoryGroup = new THREE.Group();
  const obsRingOuter = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.78, 0.032, 14, 64, Math.PI * 1.2)),
    brassMat
  );
  obsRingOuter.position.set(0, 1.55, -1.55);
  obsRingOuter.rotation.z = -0.3;

  const obsRingInner = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.38, 0.022, 12, 56)),
    slateFrameMat
  );
  obsRingInner.position.set(0, 1.55, -1.72);
  obsRingInner.rotation.x = 0.25;

  const telescopeBarrel = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.075, 0.11, 1.35, 20)),
    brassMat
  );
  telescopeBarrel.position.set(1.35, 1.45, -1.15);
  telescopeBarrel.rotation.set(0.55, -0.3, -0.45);

  const tripodLegGeo = track(new THREE.CylinderGeometry(0.018, 0.018, 1.15, 10));
  for (let i = 0; i < 3; i++) {
    const leg = new THREE.Mesh(tripodLegGeo, darkWoodMat);
    const ang = (i / 3) * Math.PI * 2;
    leg.position.set(1.35 + Math.cos(ang) * 0.18, 0.56, -1.15 + Math.sin(ang) * 0.18);
    leg.rotation.z = Math.cos(ang) * 0.24;
    leg.rotation.x = -Math.sin(ang) * 0.24;
    observatoryGroup.add(leg);
  }
  observatoryGroup.add(obsRingOuter, obsRingInner, telescopeBarrel);
  root.add(observatoryGroup);

  // ---------------------------------------------------------------------------
  // 4. GOLDEN-HOUR VINYL LOUNGE
  // ---------------------------------------------------------------------------
  const loungeGroup = new THREE.Group();
  const slatGeo = track(new THREE.BoxGeometry(0.09, 2.7, 0.08));
  for (let i = -7; i <= 7; i++) {
    const slat = new THREE.Mesh(slatGeo, darkWoodMat);
    slat.position.set(i * 0.24, 1.35, -1.9);
    loungeGroup.add(slat);
  }
  const speakerGeo = track(new THREE.BoxGeometry(0.42, 0.72, 0.34));
  const speakerConeGeo = track(new THREE.TorusGeometry(0.11, 0.018, 10, 28));
  for (const xPos of [-1.42, 1.42]) {
    const cab = new THREE.Mesh(speakerGeo, slateFrameMat);
    cab.position.set(xPos, 0.68, -1.28);
    cab.rotation.y = xPos < 0 ? 0.32 : -0.32;
    const woofer = new THREE.Mesh(speakerConeGeo, brassMat);
    woofer.position.set(0, -0.1, 0.18);
    cab.add(woofer);
    loungeGroup.add(cab);
  }
  const neonHalo = new THREE.Mesh(
    track(new THREE.TorusGeometry(0.95, 0.018, 10, 48)),
    warmGlowMat
  );
  neonHalo.position.set(0, 1.75, -1.78);
  loungeGroup.add(neonHalo);
  root.add(loungeGroup);

  // ---------------------------------------------------------------------------
  // 5. COASTAL TERRACE DUSK
  // ---------------------------------------------------------------------------
  const coastGroup = new THREE.Group();
  const terraceDisc = new THREE.Mesh(
    track(new THREE.CylinderGeometry(5.5, 5.5, 0.05, 48)),
    stoneMat
  );
  terraceDisc.position.y = -0.025;
  terraceDisc.receiveShadow = true;
  coastGroup.add(terraceDisc);

  const railBar = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 0.09, 0.22)), stoneMat);
  railBar.position.set(0, 0.76, -1.65);
  coastGroup.add(railBar);
  const balusterGeo = track(new THREE.CylinderGeometry(0.055, 0.075, 0.76, 12));
  for (let i = -4; i <= 4; i++) {
    const bal = new THREE.Mesh(balusterGeo, stoneMat);
    bal.position.set(i * 0.48, 0.38, -1.65);
    coastGroup.add(bal);
  }
  const cypressMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.88 })
  );
  for (const xPos of [-1.85, 1.85]) {
    const treeGroup = new THREE.Group();
    const trunk = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.08, 0.6, 10)), darkWoodMat);
    trunk.position.y = 0.3;
    const foliage = new THREE.Mesh(track(new THREE.ConeGeometry(0.32, 1.6, 14)), cypressMat);
    foliage.position.y = 1.25;
    treeGroup.add(trunk, foliage);
    treeGroup.position.set(xPos, 0, -1.9);
    coastGroup.add(treeGroup);
  }
  root.add(coastGroup);

  // ---------------------------------------------------------------------------
  // 6. CITY SKYLINE & STREETLAMP AVENUE
  // ---------------------------------------------------------------------------
  const cityGroup = new THREE.Group();
  const asphaltMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e2430, roughness: 0.84, metalness: 0.08 })
  );
  const towerDarkMat = track(
    new THREE.MeshStandardMaterial({ color: 0x182235, roughness: 0.65, metalness: 0.25 })
  );
  const towerMidMat = track(
    new THREE.MeshStandardMaterial({ color: 0x24334d, roughness: 0.6, metalness: 0.28 })
  );

  const cityStreetFloor = new THREE.Mesh(
    track(new THREE.CylinderGeometry(6.5, 6.5, 0.05, 48)),
    asphaltMat
  );
  cityStreetFloor.position.y = -0.025;
  cityStreetFloor.receiveShadow = true;
  cityGroup.add(cityStreetFloor);

  const curbRing = new THREE.Mesh(
    track(new THREE.TorusGeometry(2.15, 0.035, 10, 56)),
    stoneMat
  );
  curbRing.rotation.x = Math.PI / 2;
  curbRing.position.y = 0.015;
  cityGroup.add(curbRing);

  const buildingSpecs = [
    { x: -2.85, z: -2.9, w: 0.85, h: 3.8, d: 0.75, mat: towerDarkMat, warm: true },
    { x: -1.85, z: -3.25, w: 0.95, h: 4.5, d: 0.85, mat: towerMidMat, warm: false },
    { x: -0.78, z: -3.55, w: 1.05, h: 5.1, d: 0.9, mat: towerDarkMat, warm: true },
    { x: 0.45, z: -3.6, w: 1.0, h: 4.8, d: 0.85, mat: towerMidMat, warm: true },
    { x: 1.65, z: -3.15, w: 0.9, h: 4.1, d: 0.8, mat: towerDarkMat, warm: false },
    { x: 2.75, z: -2.8, w: 0.85, h: 3.5, d: 0.75, mat: towerMidMat, warm: true },
  ];
  const winStripGeo = track(new THREE.BoxGeometry(0.62, 0.055, 0.03));
  for (const b of buildingSpecs) {
    const tower = new THREE.Mesh(
      track(new THREE.BoxGeometry(b.w, b.h, b.d)),
      b.mat
    );
    tower.position.set(b.x, b.h * 0.5 - 0.05, b.z);
    const floors = Math.floor(b.h / 0.55);
    for (let f = 1; f < floors; f++) {
      const strip = new THREE.Mesh(winStripGeo, b.warm ? warmGlowMat : coolWindowGlowMat);
      strip.position.set(0, -b.h * 0.5 + f * 0.5 + 0.15, b.d * 0.5 + 0.015);
      strip.scale.x = b.w / 0.85;
      tower.add(strip);
    }
    cityGroup.add(tower);
  }

  for (const xPos of [-1.45, 1.45]) {
    const pole = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.025, 0.038, 2.35, 12)),
      slateFrameMat
    );
    pole.position.set(xPos, 1.17, -1.45);
    const lantern = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.11, 16, 12)),
      warmGlowMat
    );
    lantern.position.set(xPos, 2.38, -1.45);
    cityGroup.add(pole, lantern);
  }
  root.add(cityGroup);

  // ---------------------------------------------------------------------------
  // 7. RIVER BOAT DRIFT (Floating Wooden Skiff + Shimmering Water + Reeds)
  // ---------------------------------------------------------------------------
  const riverBoatGroup = new THREE.Group();
  const riverWaterMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x164e63,
      roughness: 0.18,
      metalness: 0.35,
    })
  );
  const reedMat = track(
    new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.82 })
  );

  const riverWaterPlane = new THREE.Mesh(
    track(new THREE.CylinderGeometry(7.0, 7.0, 0.04, 48)),
    riverWaterMat
  );
  riverWaterPlane.position.y = -0.02;
  riverWaterPlane.receiveShadow = true;
  riverBoatGroup.add(riverWaterPlane);

  const boatHullGroup = new THREE.Group();
  const deckGeo = track(new THREE.BoxGeometry(1.38, 0.09, 2.7));
  const boatDeck = new THREE.Mesh(deckGeo, boatTimberMat);
  boatDeck.position.set(0, 0.095, 0);
  boatDeck.receiveShadow = true;
  boatDeck.castShadow = true;
  boatHullGroup.add(boatDeck);

  // Tapered bow & stern prows
  const bowTip = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.72, 0.95, 4)),
    darkWoodMat
  );
  bowTip.rotation.x = Math.PI / 2;
  bowTip.rotation.y = Math.PI / 4;
  bowTip.scale.set(0.95, 1, 0.32);
  bowTip.position.set(0, 0.14, 1.75);
  boatHullGroup.add(bowTip);

  const sternTip = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.7, 0.85, 4)),
    darkWoodMat
  );
  sternTip.rotation.x = -Math.PI / 2;
  sternTip.rotation.y = Math.PI / 4;
  sternTip.scale.set(0.95, 1, 0.32);
  sternTip.position.set(0, 0.14, -1.7);
  boatHullGroup.add(sternTip);

  // Port & Starboard raised gunwales
  const gunwaleGeo = track(new THREE.BoxGeometry(0.08, 0.24, 2.85));
  const gunwaleL = new THREE.Mesh(gunwaleGeo, darkWoodMat);
  gunwaleL.position.set(-0.7, 0.19, 0);
  const gunwaleR = new THREE.Mesh(gunwaleGeo, darkWoodMat);
  gunwaleR.position.set(0.7, 0.19, 0);
  boatHullGroup.add(gunwaleL, gunwaleR);

  // Bow brass lantern post
  const bowPost = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.024, 0.03, 1.05, 12)),
    darkWoodMat
  );
  bowPost.position.set(-0.56, 0.65, 1.15);
  const bowLantern = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.09, 14, 12)),
    warmGlowMat
  );
  bowLantern.position.set(-0.56, 1.2, 1.15);
  boatHullGroup.add(bowPost, bowLantern);

  riverBoatGroup.add(boatHullGroup);

  // Distant riverbanks & reed clusters
  const bankMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1e3f20, roughness: 0.92 })
  );
  const farBank = new THREE.Mesh(
    track(new THREE.BoxGeometry(10.5, 0.5, 1.8)),
    bankMat
  );
  farBank.position.set(0, 0.18, -3.9);
  riverBoatGroup.add(farBank);

  const reedGeo = track(new THREE.CylinderGeometry(0.014, 0.026, 1.15, 6));
  const reedClusterPositions = [-2.6, -2.2, -1.8, 1.8, 2.25, 2.65];
  for (let idx = 0; idx < reedClusterPositions.length; idx++) {
    const rx = reedClusterPositions[idx];
    const reed = new THREE.Mesh(reedGeo, reedMat);
    reed.position.set(rx, 0.52, -2.55 - (idx % 2) * 0.45);
    reed.rotation.z = (idx % 2 === 0 ? 1 : -1) * 0.08;
    riverBoatGroup.add(reed);
  }
  root.add(riverBoatGroup);

  // ---------------------------------------------------------------------------
  // 8. EMERALD JUNGLE CANOPY
  // ---------------------------------------------------------------------------
  const jungleGroup = new THREE.Group();
  const mossFloorMat = track(
    new THREE.MeshStandardMaterial({ color: 0x1c3d29, roughness: 0.92, metalness: 0.02 })
  );
  const palmLeafMat = track(
    new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.76, metalness: 0.04 })
  );
  const jungleTrunkMat = track(
    new THREE.MeshStandardMaterial({ color: 0x4a3425, roughness: 0.88 })
  );

  const jungleFloor = new THREE.Mesh(
    track(new THREE.CylinderGeometry(6.5, 6.5, 0.05, 48)),
    mossFloorMat
  );
  jungleFloor.position.y = -0.025;
  jungleFloor.receiveShadow = true;
  jungleGroup.add(jungleFloor);

  const treeSpots = [
    { x: -1.95, z: -1.65, h: 2.8, tilt: 0.14 },
    { x: 1.95, z: -1.6, h: 3.05, tilt: -0.16 },
    { x: -1.1, z: -2.85, h: 3.4, tilt: 0.08 },
    { x: 1.25, z: -2.75, h: 3.2, tilt: -0.1 },
  ];
  const frondGeo = track(new THREE.ConeGeometry(0.28, 1.35, 8));
  for (const spot of treeSpots) {
    const tree = new THREE.Group();
    const trunk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.08, 0.14, spot.h, 10)),
      jungleTrunkMat
    );
    trunk.position.y = spot.h * 0.5;
    trunk.castShadow = true;
    tree.add(trunk);

    for (let f = 0; f < 6; f++) {
      const frond = new THREE.Mesh(frondGeo, palmLeafMat);
      const ang = (f / 6) * Math.PI * 2;
      frond.position.set(
        Math.cos(ang) * 0.42,
        spot.h - 0.05,
        Math.sin(ang) * 0.42
      );
      frond.rotation.z = -Math.cos(ang) * 1.15;
      frond.rotation.x = Math.sin(ang) * 1.15;
      tree.add(frond);
    }
    tree.position.set(spot.x, 0, spot.z);
    tree.rotation.z = spot.tilt;
    jungleGroup.add(tree);
  }

  // Mossy jungle boulders
  const boulderPositions = [
    { x: -1.35, z: -1.05, r: 0.36 },
    { x: 1.4, z: -1.15, r: 0.42 },
    { x: 0.25, z: -2.35, r: 0.5 },
  ];
  for (const bp of boulderPositions) {
    const rock = new THREE.Mesh(
      track(new THREE.DodecahedronGeometry(bp.r, 0)),
      mossFloorMat
    );
    rock.position.set(bp.x, bp.r * 0.45, bp.z);
    rock.scale.set(1.2, 0.72, 1.0);
    jungleGroup.add(rock);
  }
  root.add(jungleGroup);

  // ---------------------------------------------------------------------------
  // 9. GOLDEN DESERT PYRAMID
  // ---------------------------------------------------------------------------
  const pyramidGroup = new THREE.Group();
  const sandFloorMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd4a373, roughness: 0.92, metalness: 0.02 })
  );
  const sandstoneMat = track(
    new THREE.MeshStandardMaterial({ color: 0xc88d55, roughness: 0.85, metalness: 0.05 })
  );

  const desertFloor = new THREE.Mesh(
    track(new THREE.CylinderGeometry(7.0, 7.0, 0.05, 48)),
    sandFloorMat
  );
  desertFloor.position.y = -0.025;
  desertFloor.receiveShadow = true;
  pyramidGroup.add(desertFloor);

  // Stepped 5-tier monument pyramid behind the avatar
  const pyramidBaseGroup = new THREE.Group();
  pyramidBaseGroup.position.set(0, 0, -3.55);
  pyramidBaseGroup.rotation.y = Math.PI / 6;
  for (let tier = 0; tier < 5; tier++) {
    const size = 3.6 - tier * 0.68;
    const h = 0.54;
    const block = new THREE.Mesh(
      track(new THREE.BoxGeometry(size, h, size)),
      sandstoneMat
    );
    block.position.y = h * 0.5 + tier * h;
    block.receiveShadow = true;
    pyramidBaseGroup.add(block);
  }
  const apexCap = new THREE.Mesh(
    track(new THREE.ConeGeometry(0.45, 0.65, 4)),
    brassMat
  );
  apexCap.rotation.y = Math.PI / 4;
  apexCap.position.y = 5 * 0.54 + 0.32;
  pyramidBaseGroup.add(apexCap);
  pyramidGroup.add(pyramidBaseGroup);

  // Flanking carved stone obelisks
  for (const xPos of [-1.7, 1.7]) {
    const obelisk = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.11, 0.2, 2.1, 4)),
      sandstoneMat
    );
    obelisk.position.set(xPos, 1.05, -1.65);
    obelisk.rotation.y = Math.PI / 4;
    const tip = new THREE.Mesh(
      track(new THREE.ConeGeometry(0.155, 0.28, 4)),
      brassMat
    );
    tip.position.set(xPos, 2.24, -1.65);
    tip.rotation.y = Math.PI / 4;
    pyramidGroup.add(obelisk, tip);
  }

  const desertSun = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.42, 24, 18)),
    warmGlowMat
  );
  desertSun.position.set(2.3, 3.3, -4.8);
  pyramidGroup.add(desertSun);
  root.add(pyramidGroup);

  // ---------------------------------------------------------------------------
  // 10. MARS RED HORIZON & OUTPOST
  // ---------------------------------------------------------------------------
  const marsGroup = new THREE.Group();
  const marsSoilMat = track(
    new THREE.MeshStandardMaterial({ color: 0x9c422c, roughness: 0.94, metalness: 0.04 })
  );
  const marsBasaltMat = track(
    new THREE.MeshStandardMaterial({ color: 0x5c261b, roughness: 0.9, metalness: 0.08 })
  );
  const titaniumMat = track(
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.32, metalness: 0.8 })
  );

  const marsFloor = new THREE.Mesh(
    track(new THREE.CylinderGeometry(7.0, 7.0, 0.05, 48)),
    marsSoilMat
  );
  marsFloor.position.y = -0.025;
  marsFloor.receiveShadow = true;
  marsGroup.add(marsFloor);

  // Surrounding impact crater rim
  const craterRim = new THREE.Mesh(
    track(new THREE.TorusGeometry(2.65, 0.14, 10, 48)),
    marsBasaltMat
  );
  craterRim.rotation.x = Math.PI / 2;
  craterRim.position.y = 0.02;
  marsGroup.add(craterRim);

  // Layered Martian mesas & distant volcano ridge
  const mesaSpecs = [
    { x: -2.4, z: -3.2, rTop: 0.55, rBot: 1.05, h: 1.25 },
    { x: 0.25, z: -3.85, rTop: 0.95, rBot: 1.65, h: 1.65 },
    { x: 2.55, z: -3.05, rTop: 0.5, rBot: 0.95, h: 1.1 },
  ];
  for (const m of mesaSpecs) {
    const mesa = new THREE.Mesh(
      track(new THREE.CylinderGeometry(m.rTop, m.rBot, m.h, 10)),
      marsBasaltMat
    );
    mesa.position.set(m.x, m.h * 0.5 - 0.05, m.z);
    marsGroup.add(mesa);
  }

  // Sleek habitat outpost arch behind avatar
  const habitatArch = new THREE.Mesh(
    track(new THREE.TorusGeometry(1.48, 0.045, 12, 40, Math.PI)),
    titaniumMat
  );
  habitatArch.position.set(0, 0.05, -1.75);
  marsGroup.add(habitatArch);

  const beaconTip = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.08, 12, 12)),
    coolWindowGlowMat
  );
  beaconTip.position.set(0, 1.56, -1.75);
  marsGroup.add(beaconTip);

  // Dual Martian moons (Phobos & Deimos)
  const phobos = new THREE.Mesh(
    track(new THREE.DodecahedronGeometry(0.24, 1)),
    stoneMat
  );
  phobos.position.set(-1.85, 3.1, -4.4);
  const deimos = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.11, 14, 12)),
    warmGlowMat
  );
  deimos.position.set(1.95, 3.35, -4.6);
  marsGroup.add(phobos, deimos);
  root.add(marsGroup);

  // ---------------------------------------------------------------------------
  // AMBIENT MOTIF PARTICLE SYSTEM (Zero per-frame allocations)
  // ---------------------------------------------------------------------------
  const PARTICLE_COUNT = 72;
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleSeeds = new Float32Array(PARTICLE_COUNT);
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 5.2;
    particlePositions[i * 3 + 1] = 0.25 + Math.random() * 3.1;
    particlePositions[i * 3 + 2] = -2.6 + Math.random() * 3.4;
    particleSeeds[i] = Math.random() * Math.PI * 2;
  }
  const particleGeo = track(new THREE.BufferGeometry());
  const posAttr = new THREE.BufferAttribute(particlePositions, 3);
  particleGeo.setAttribute("position", posAttr);

  const particleMat = track(
    new THREE.PointsMaterial({
      color: 0xfff3c4,
      size: 0.045,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })
  );
  const particles = new THREE.Points(particleGeo, particleMat);
  root.add(particles);

  const update: SurroundingsRig["update"] = (
    elapsed,
    delta,
    specInput,
    scene,
    hemiLight,
    keyLight,
    rimLight,
    plinthMat
  ) => {
    const spec = specInput || DEFAULT_BACKGROUND_SPEC;
    const dampAlpha = 1 - Math.exp(-5 * delta);

    // Smooth atmospheric lighting & background colors
    _bgColor.set(spec.skyTopHex);
    if (scene.background instanceof THREE.Color) {
      scene.background.lerp(_bgColor, dampAlpha);
    }
    _fogColor.set(spec.fogHex);
    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.lerp(_fogColor, dampAlpha);
    }
    _keyColor.set(spec.keyLightHex);
    keyLight.color.lerp(_keyColor, dampAlpha);
    _rimColor.set(spec.rimLightHex);
    rimLight.color.lerp(_rimColor, dampAlpha);

    _hemiSkyColor.set(spec.skyTopHex).lerp(_lightSlate, 0.35);
    _hemiGroundColor.set(spec.skyBottomHex);
    hemiLight.color.lerp(_hemiSkyColor, dampAlpha);
    hemiLight.groundColor.lerp(_hemiGroundColor, dampAlpha);

    _plinthColor.set(spec.skyBottomHex).lerp(_lightSlate, 0.58);
    plinthMat.color.lerp(_plinthColor, dampAlpha);

    // Toggle active 3D scene
    const theme = spec.propTheme || "minimal";
    libraryGroup.visible = theme === "library";
    rainyGroup.visible = theme === "rainy_cafe";
    observatoryGroup.visible = theme === "observatory";
    loungeGroup.visible = theme === "music_lounge";
    coastGroup.visible = theme === "outdoor_coast";
    cityGroup.visible = theme === "city";
    riverBoatGroup.visible = theme === "river_boat";
    jungleGroup.visible = theme === "jungle";
    pyramidGroup.visible = theme === "pyramid";
    marsGroup.visible = theme === "mars";

    if (observatoryGroup.visible) {
      obsRingInner.rotation.y = elapsed * 0.15;
    }

    let boatBobY = 0;
    if (riverBoatGroup.visible) {
      boatBobY = Math.sin(elapsed * 1.15) * 0.014;
      boatHullGroup.position.y = boatBobY;
      boatHullGroup.rotation.z = Math.sin(elapsed * 0.9) * 0.015;
    }

    if (marsGroup.visible) {
      phobos.rotation.y = elapsed * 0.18;
    }

    // Ambient particle animation
    const motif = spec.ambientMotif || "none";
    particles.visible = motif !== "none";
    if (motif !== "none") {
      if (motif === "rain") {
        _particleColor.set(0xbfdbfe);
        particleMat.size = 0.036;
      } else if (motif === "stars") {
        _particleColor.set(0xe0e7ff);
        particleMat.size = 0.042;
      } else if (motif === "fireflies") {
        _particleColor.set(0xfde68a);
        particleMat.size = 0.055;
      } else {
        _particleColor.set(0xfef3c7);
        particleMat.size = 0.04;
      }
      particleMat.color.lerp(_particleColor, dampAlpha);

      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const seed = particleSeeds[i];
        if (motif === "rain") {
          arr[i * 3 + 1] -= delta * 2.1;
          if (arr[i * 3 + 1] < 0.05) arr[i * 3 + 1] = 3.2;
        } else if (motif === "stars") {
          arr[i * 3 + 1] = 1.2 + ((i % 19) / 19) * 2.1 + Math.sin(elapsed * 0.8 + seed) * 0.015;
        } else {
          arr[i * 3 + 1] += Math.sin(elapsed * 0.9 + seed) * delta * 0.14;
          arr[i * 3] += Math.cos(elapsed * 0.65 + seed) * delta * 0.1;
        }
      }
      posAttr.needsUpdate = true;
    }

    // Compute exact surface Y so the avatar's shoes rest cleanly on plinth, boat deck, or outdoor ground
    if (theme === "river_boat") {
      return { surfaceY: 0.14 + boatBobY, showStudioPlinth: false };
    }
    if (
      theme === "outdoor_coast" ||
      theme === "city" ||
      theme === "jungle" ||
      theme === "pyramid" ||
      theme === "mars"
    ) {
      return { surfaceY: 0.0, showStudioPlinth: false };
    }
    return { surfaceY: 0.08, showStudioPlinth: true };
  };

  return { root, update };
}
