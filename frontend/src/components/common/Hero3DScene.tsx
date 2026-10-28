import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Hero3DSceneProps {
  className?: string;
}

export const Hero3DScene: React.FC<Hero3DSceneProps> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene, Camera, and Renderer setup
    const scene = new THREE.Scene();

    const width = container.clientWidth || 440;
    const height = container.clientHeight || 440;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.2, 7.2);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // 2. Lighting System
    const ambientLight = new THREE.AmbientLight(0x1a1a24, 1.4);
    scene.add(ambientLight);

    // Core point lights: Orange & Gold
    const corePointLight = new THREE.PointLight(0xff6b35, 5.0, 14, 1.6);
    corePointLight.position.set(0, 0, 0);
    scene.add(corePointLight);

    const coreAmberLight = new THREE.PointLight(0xf59e0b, 3.0, 10, 1.8);
    coreAmberLight.position.set(0, 0, 0);
    scene.add(coreAmberLight);

    // Subtle Rim & Key Lights
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.6);
    rimLight.position.set(6, 7, 5);
    scene.add(rimLight);

    const fillLight = new THREE.PointLight(0xff5500, 2.0, 8, 2);
    fillLight.position.set(-4, -3, 3);
    scene.add(fillLight);

    // 3. Main Scene Root Group
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // -------------------------------------------------------------
    // A. CENTRAL ENERGY CORE (Reactor of the Machine Economy)
    // -------------------------------------------------------------
    const coreGroup = new THREE.Group();
    rootGroup.add(coreGroup);

    // 1. Inner white-hot plasma sphere
    const innerCoreGeo = new THREE.SphereGeometry(0.48, 32, 32);
    const innerCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
    });
    const innerCore = new THREE.Mesh(innerCoreGeo, innerCoreMat);
    coreGroup.add(innerCore);

    // 2. Inner energy aura sphere
    const energyAuraGeo = new THREE.SphereGeometry(0.58, 32, 32);
    const energyAuraMat = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0xff5500,
      emissiveIntensity: 3.2,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
      metalness: 0.8,
    });
    const energyAura = new THREE.Mesh(energyAuraGeo, energyAuraMat);
    coreGroup.add(energyAura);

    // 3. Polyhedral Crystalline Lattice (Icosahedron)
    const latticeGeo = new THREE.IcosahedronGeometry(0.86, 1);
    const latticeMat = new THREE.MeshStandardMaterial({
      color: 0xff5500,
      emissive: 0xff6b35,
      emissiveIntensity: 1.4,
      wireframe: true,
      transparent: true,
      opacity: 0.8,
    });
    const lattice = new THREE.Mesh(latticeGeo, latticeMat);
    coreGroup.add(lattice);

    // 4. Hexagonal Energy Shield (Iconic geometric HUD hexagon from reference)
    const hexRadius = 1.15;
    const hexPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (i * Math.PI) / 3;
      hexPoints.push(
        new THREE.Vector3(Math.cos(angle) * hexRadius, Math.sin(angle) * hexRadius, 0)
      );
    }
    const hexLineGeo = new THREE.BufferGeometry().setFromPoints(hexPoints);
    const hexLineMat = new THREE.LineBasicMaterial({
      color: 0xff8833,
      transparent: true,
      opacity: 0.75,
      linewidth: 2,
    });
    const hexShield = new THREE.LineLoop(hexLineGeo, hexLineMat);
    coreGroup.add(hexShield);

    // -------------------------------------------------------------
    // B. MULTIPLE 3D ORBITAL GYRO RINGS
    // -------------------------------------------------------------
    const ringGroup = new THREE.Group();
    rootGroup.add(ringGroup);

    // Materials for orbital rings
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x242735,
      emissive: 0xff5500,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.15,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0x1f2430,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
      metalness: 0.92,
      roughness: 0.18,
    });
    const ringMat3 = new THREE.MeshStandardMaterial({
      color: 0x222638,
      emissive: 0xff7722,
      emissiveIntensity: 0.45,
      metalness: 0.88,
      roughness: 0.22,
    });

    // Ring 1: Inner tight orbital plane
    const ring1Geo = new THREE.TorusGeometry(1.5, 0.016, 16, 120);
    const ring1 = new THREE.Mesh(ring1Geo, ringMat1);
    ring1.rotation.x = Math.PI / 3;
    ring1.rotation.y = 0.2;
    ringGroup.add(ring1);

    // Ring 2: Mid gyroscopic orbital ring (inclined at 45°)
    const ring2Geo = new THREE.TorusGeometry(2.1, 0.018, 16, 140);
    const ring2 = new THREE.Mesh(ring2Geo, ringMat2);
    ring2.rotation.x = -Math.PI / 4;
    ring2.rotation.z = Math.PI / 6;
    ringGroup.add(ring2);

    // Ring 3: Outer perimeter orbital ring
    const ring3Geo = new THREE.TorusGeometry(2.68, 0.022, 16, 160);
    const ring3 = new THREE.Mesh(ring3Geo, ringMat3);
    ring3.rotation.x = Math.PI / 5;
    ring3.rotation.y = -Math.PI / 3;
    ringGroup.add(ring3);

    // 4. Glowing Circular Sweep Arc (Active Radar Telemetry)
    const arcRadius = 2.42;
    const arcCurve = new THREE.EllipseCurve(
      0, 0, arcRadius, arcRadius, 0, Math.PI * 0.75, false, 0
    );
    const arcPoints = arcCurve.getPoints(50);
    const arcGeo = new THREE.BufferGeometry().setFromPoints(
      arcPoints.map((p) => new THREE.Vector3(p.x, p.y, 0))
    );
    const arcMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });
    const sweepArc = new THREE.Line(arcGeo, arcMat);
    ringGroup.add(sweepArc);

    // 5. Outer Dashed Track (Concentric Tech Ticks)
    const tickCount = 48;
    const tickPositions: number[] = [];
    const rInner = 2.48;
    const rOuter = 2.56;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i / tickCount) * Math.PI * 2;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      // Skip some segments for high-tech dashed HUD aesthetic
      if (i % 4 === 0) continue;
      tickPositions.push(cos * rInner, sin * rInner, 0);
      tickPositions.push(cos * rOuter, sin * rOuter, 0);
    }
    const ticksGeo = new THREE.BufferGeometry();
    ticksGeo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(tickPositions, 3)
    );
    const ticksMat = new THREE.LineBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.65,
    });
    const ticksLine = new THREE.LineSegments(ticksGeo, ticksMat);
    ringGroup.add(ticksLine);

    // -------------------------------------------------------------
    // C. 3D SATELLITE NODES (API, Cloud, Escrow, AI Agent)
    // -------------------------------------------------------------
    const satellitesGroup = new THREE.Group();
    rootGroup.add(satellitesGroup);

    // Node 1: AI Agent Intelligence (Crystalline Octahedron)
    const sat1Geo = new THREE.OctahedronGeometry(0.24, 0);
    const sat1Mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x38bdf8, // Sky-blue intelligence pulse
      emissiveIntensity: 1.8,
      metalness: 0.8,
      roughness: 0.1,
    });
    const sat1 = new THREE.Mesh(sat1Geo, sat1Mat);
    satellitesGroup.add(sat1);

    // Node 2: Escrow & Ledger Block (Triple Disc Cylinder Stack)
    const sat2Group = new THREE.Group();
    const discGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.06, 18);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0xff6b35,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.2,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let d = -1; d <= 1; d++) {
      const disc = new THREE.Mesh(discGeo, discMat);
      disc.position.y = d * 0.08;
      sat2Group.add(disc);
    }
    satellitesGroup.add(sat2Group);

    // Node 3: Execution Gateway (Faceted Cube Prism)
    const sat3Geo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
    const sat3Mat = new THREE.MeshStandardMaterial({
      color: 0x111827,
      emissive: 0xff5500,
      emissiveIntensity: 1.6,
      metalness: 0.95,
      roughness: 0.15,
      wireframe: false,
    });
    const sat3 = new THREE.Mesh(sat3Geo, sat3Mat);
    satellitesGroup.add(sat3);

    // Node 4: MCP Protocol Gateway (Dodecahedron Node)
    const sat4Geo = new THREE.DodecahedronGeometry(0.22, 0);
    const sat4Mat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xff5500,
      emissiveIntensity: 2.0,
      metalness: 0.7,
      roughness: 0.2,
    });
    const sat4 = new THREE.Mesh(sat4Geo, sat4Mat);
    satellitesGroup.add(sat4);

    // -------------------------------------------------------------
    // D. DYNAMIC LUMINOUS DATA BEAMS (Core <-> Satellites)
    // -------------------------------------------------------------
    const beamPositions = new Float32Array(4 * 2 * 3); // 4 satellites * 2 vertices (core -> sat) * 3 coords
    const beamGeo = new THREE.BufferGeometry();
    beamGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(beamPositions, 3)
    );
    const beamMat = new THREE.LineBasicMaterial({
      color: 0xff8f50,
      transparent: true,
      opacity: 0.45,
    });
    const beamLines = new THREE.LineSegments(beamGeo, beamMat);
    rootGroup.add(beamLines);

    // -------------------------------------------------------------
    // E. GLOWING ORBITAL ENERGY PARTICLES (300 Floating Sparks)
    // -------------------------------------------------------------
    const particleCount = 280;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);
    const particleOrbitRadii: number[] = [];
    const particleOrbitSpeeds: number[] = [];
    const particleOrbitTilts: { x: number; y: number; z: number }[] = [];

    const brandOrange = new THREE.Color(0xff5500);
    const brandGold = new THREE.Color(0xfbbf24);
    const brandCyan = new THREE.Color(0x38bdf8);
    const brandWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.2 + Math.random() * 1.8;
      const speed = (0.3 + Math.random() * 0.7) * (Math.random() > 0.4 ? 1 : -1);
      const angle = Math.random() * Math.PI * 2;

      particleOrbitRadii.push(radius);
      particleOrbitSpeeds.push(speed);
      particleOrbitTilts.push({
        x: (Math.random() - 0.5) * 1.2,
        y: (Math.random() - 0.5) * 1.2,
        z: (Math.random() - 0.5) * 1.2,
      });

      particlePositions[i * 3] = Math.cos(angle) * radius;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 0.8;
      particlePositions[i * 3 + 2] = Math.sin(angle) * radius;

      // Color distribution: 60% orange, 25% gold, 10% white, 5% cyan
      const randColor = Math.random();
      const c =
        randColor < 0.6
          ? brandOrange
          : randColor < 0.85
          ? brandGold
          : randColor < 0.95
          ? brandWhite
          : brandCyan;

      particleColors[i * 3] = c.r;
      particleColors[i * 3 + 1] = c.g;
      particleColors[i * 3 + 2] = c.b;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute(
      'position',
      new THREE.BufferAttribute(particlePositions, 3)
    );
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    // Create a circular glowing canvas texture for particles
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.3, 'rgba(255, 120, 50, 0.8)');
      gradient.addColorStop(0.7, 'rgba(255, 80, 0, 0.25)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 32, 32);
    }
    const particleTexture = new THREE.CanvasTexture(canvas);

    const particleMat = new THREE.PointsMaterial({
      size: 0.12,
      map: particleTexture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    rootGroup.add(particles);

    // -------------------------------------------------------------
    // F. ANIMATION LOOP & SMOOTH INTERACTIVITY
    // -------------------------------------------------------------
    const clock = new THREE.Clock();
    let animationFrameId: number;
    let isVisible = true;

    // Pointer Parallax (Subtle response to cursor movement on desktop)
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      pointer.targetX = x * 0.45;
      pointer.targetY = y * 0.45;
    };
    const handlePointerLeave = () => {
      pointer.targetX = 0;
      pointer.targetY = 0;
    };

    window.addEventListener('mousemove', handlePointerMove);
    container.addEventListener('mouseleave', handlePointerLeave);

    // Reduced motion preference check
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const speedMultiplier = prefersReducedMotion ? 0.15 : 1.0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible) return;

      const elapsed = clock.getElapsedTime() * speedMultiplier;
      const delta = clock.getDelta();

      // 1. Spring-like Bouncy Core Float & Breathing
      const bounceFreq = 2.1;
      const primarySin = Math.sin(elapsed * bounceFreq);
      const secondarySin = Math.sin(elapsed * bounceFreq * 2.0);
      const coreBounceY = primarySin * 0.22 + secondarySin * 0.045;
      coreGroup.position.y = coreBounceY;

      // Scale Stretch & Squash at Bounce Apex:
      const apexFactor = Math.max(0, primarySin);
      const coreScaleX = 1.0 + apexFactor * 0.09 + 0.03 * Math.sin(elapsed * 4.2);
      const coreScaleY = 1.0 + apexFactor * 0.14 + 0.03 * Math.cos(elapsed * 4.2);
      const coreScaleZ = 1.0 + apexFactor * 0.09 + 0.03 * Math.sin(elapsed * 4.2);
      coreGroup.scale.set(coreScaleX, coreScaleY, coreScaleZ);

      // Core Light Breathing:
      corePointLight.intensity = 5.2 + 2.2 * Math.sin(elapsed * bounceFreq);
      coreAmberLight.intensity = 3.2 + 1.2 * Math.cos(elapsed * bounceFreq * 0.85);

      lattice.rotation.x = elapsed * 0.45;
      lattice.rotation.y = elapsed * 0.65;
      hexShield.rotation.z = -elapsed * 0.4;
      hexShield.rotation.y = Math.sin(elapsed * 1.5) * 0.15;

      // 2. Delayed Response (Follow-Through) & Oscillations on Orbital Rings
      ringGroup.position.y = Math.sin(elapsed * bounceFreq - 0.45) * 0.14;

      ring1.rotation.z = elapsed * 0.55;
      ring1.rotation.x = Math.PI / 3 + Math.sin(elapsed * 1.6) * 0.12;
      ring1.rotation.y = 0.2 + Math.cos(elapsed * 1.2) * 0.08;

      ring2.rotation.y = -elapsed * 0.48;
      ring2.rotation.x = -Math.PI / 4 + Math.sin(elapsed * 1.4 + 1.0) * 0.14;
      ring2.rotation.z = Math.PI / 6 + Math.cos(elapsed * 1.7) * 0.1;

      ring3.rotation.z = elapsed * 0.3;
      ring3.rotation.x = Math.PI / 5 + Math.cos(elapsed * 1.1 + 2.2) * 0.12;
      ring3.rotation.y = -Math.PI / 3 + Math.sin(elapsed * 0.9) * 0.09;

      sweepArc.rotation.z = -elapsed * 1.25;
      ticksLine.rotation.z = elapsed * 0.1;

      // 3. Orbiting Satellite Nodes with Independent Spring Bounces, Tilts, & Scale Pulses
      const satBounceBase = Math.sin(elapsed * bounceFreq - 0.8) * 0.16;

      // Node 1: AI Agent Octahedron
      const a1 = elapsed * 0.8;
      const s1Bounce = satBounceBase + Math.sin(elapsed * 3.1 + 0.4) * 0.12;
      sat1.position.set(
        Math.cos(a1) * 1.95,
        Math.sin(a1 * 1.2) * 0.45 + s1Bounce,
        Math.sin(a1) * 1.95
      );
      const sat1Scale = 1.0 + 0.09 * Math.sin(elapsed * 3.8);
      sat1.scale.set(sat1Scale, sat1Scale, sat1Scale);
      sat1.rotation.x = elapsed * 1.4;
      sat1.rotation.y = elapsed * 1.1;
      sat1.rotation.z = Math.sin(elapsed * 2.0) * 0.2;

      // Node 2: Escrow Ledger Discs
      const a2 = -elapsed * 0.55 + 1.8;
      const s2Bounce = satBounceBase + Math.sin(elapsed * 2.6 + 1.8) * 0.14;
      sat2Group.position.set(
        Math.cos(a2) * 2.4,
        Math.sin(a2) * 0.8 + s2Bounce,
        Math.sin(a2 * 0.8) * 2.2
      );
      sat2Group.rotation.y = elapsed * 0.9;
      sat2Group.rotation.z = Math.sin(elapsed * 1.8) * 0.28;
      sat2Group.rotation.x = Math.cos(elapsed * 1.4) * 0.15;

      // Node 3: Execution Gateway Cube
      const a3 = elapsed * 0.42 + 3.4;
      const s3Bounce = satBounceBase + Math.cos(elapsed * 2.8 + 3.1) * 0.15;
      sat3.position.set(
        Math.cos(a3) * 2.8,
        Math.cos(a3 * 0.9) * 0.7 + s3Bounce,
        Math.sin(a3) * 2.8
      );
      const sat3Scale = 1.0 + 0.08 * Math.cos(elapsed * 3.2);
      sat3.scale.set(sat3Scale, sat3Scale, sat3Scale);
      sat3.rotation.x = elapsed * 0.8;
      sat3.rotation.z = elapsed * 0.6;
      sat3.rotation.y = Math.sin(elapsed * 1.5) * 0.25;

      // Node 4: MCP Protocol Node
      const a4 = -elapsed * 0.65 + 5.1;
      const s4Bounce = satBounceBase + Math.sin(elapsed * 3.4 + 4.6) * 0.13;
      sat4.position.set(
        Math.cos(a4) * 2.2,
        Math.sin(a4 * 1.4) * 0.55 + s4Bounce,
        Math.sin(a4) * 2.2
      );
      const sat4Scale = 1.0 + 0.08 * Math.sin(elapsed * 4.0);
      sat4.scale.set(sat4Scale, sat4Scale, sat4Scale);
      sat4.rotation.y = elapsed * 1.3;
      sat4.rotation.x = Math.sin(elapsed * 2.2) * 0.22;

      // 4. Update Dynamic Connection Beams (Core Center <-> Orbiting Satellites)
      const posAttr = beamGeo.getAttribute('position') as THREE.BufferAttribute;
      const sats = [sat1.position, sat2Group.position, sat3.position, sat4.position];
      for (let i = 0; i < 4; i++) {
        posAttr.setXYZ(i * 2, 0, coreGroup.position.y, 0);
        posAttr.setXYZ(i * 2 + 1, sats[i].x, sats[i].y, sats[i].z);
      }
      posAttr.needsUpdate = true;
      beamMat.opacity = 0.38 + 0.25 * Math.sin(elapsed * 2.8);

      // 5. Update Orbiting Energy Particles
      const pPositions = particleGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < particleCount; i++) {
        const r = particleOrbitRadii[i];
        const spd = particleOrbitSpeeds[i];
        const tilt = particleOrbitTilts[i];
        const currentAngle = elapsed * spd + i;

        // Parametric circular rotation tilted in 3D
        let x = Math.cos(currentAngle) * r;
        let y = Math.sin(currentAngle * 1.5) * 0.35;
        let z = Math.sin(currentAngle) * r;

        // Apply tilt
        const cosX = Math.cos(tilt.x);
        const sinX = Math.sin(tilt.x);
        const y1 = y * cosX - z * sinX;
        const z1 = y * sinX + z * cosX;

        const cosY = Math.cos(tilt.y);
        const sinY = Math.sin(tilt.y);
        const x2 = x * cosY + z1 * sinY;
        const z2 = -x * sinY + z1 * cosY;

        pPositions.setXYZ(i, x2, y1, z2);
      }
      pPositions.needsUpdate = true;

      // 6. Smooth Pointer Parallax (Lerp)
      pointer.x += (pointer.targetX - pointer.x) * 0.05;
      pointer.y += (pointer.targetY - pointer.y) * 0.05;

      rootGroup.rotation.y = pointer.x;
      rootGroup.rotation.x = -pointer.y;

      renderer.render(scene, camera);
    };

    animate();

    // -------------------------------------------------------------
    // G. RESIZE & VISIBILITY HANDLERS
    // -------------------------------------------------------------
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 440;
      const h = container.clientHeight || 440;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Pause rendering when scrolled off-screen
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.08 }
    );
    intersectionObserver.observe(container);

    // -------------------------------------------------------------
    // H. CLEANUP & MEMORY DISPOSAL
    // -------------------------------------------------------------
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener('mousemove', handlePointerMove);
      container.removeEventListener('mouseleave', handlePointerLeave);

      // Deep disposal of Three.js objects
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line || object instanceof THREE.Points) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach((mat) => mat.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });

      particleTexture.dispose();
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`hero-3d-scene-container ${className}`}
      aria-label="Interactive 3D visualization of ToolToll autonomous machine economy"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        maxWidth: '460px',
        aspectRatio: '1 / 1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        userSelect: 'none',
      }}
    />
  );
};
