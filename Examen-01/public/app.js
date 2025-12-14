// Obtener el canvas
const canvas = document.getElementById("renderCanvas");

// Crear el motor Babylon
const engine = new BABYLON.Engine(canvas, true);

// Variables globales del HUD
let briefcaseCollected = 0;
let totalBriefcases = 1; // Total de maletines a recolectar
let score = 0;
let gameState = "playing"; // "playing", "victory"

// Función para actualizar el HUD
function updateHUD() {
  document.getElementById("pollenCount").textContent = briefcaseCollected;
  document.getElementById("totalPollen").textContent = totalBriefcases;
  document.getElementById("score").textContent = score;
  
  // Actualizar barra de progreso
  const progress = totalBriefcases > 0 ? (briefcaseCollected / totalBriefcases) * 100 : 0;
  const progressBar = document.getElementById("progressBar");
  progressBar.style.width = progress + "%";
  progressBar.textContent = Math.round(progress) + "%";
}

// Función para mostrar mensaje temporal - VERSIÓN CORREGIDA
function showMessage(text, duration = 2000) {
  const msgEl = document.getElementById("gameMessage");
  
  if (!msgEl) {
    console.error("❌ ERROR: No se encontró el elemento gameMessage");
    return;
  }
  
  console.log("📢 Mostrando mensaje:", text);
  
  // Limpiar cualquier timeout anterior
  if (msgEl.hideTimeout) {
    clearTimeout(msgEl.hideTimeout);
  }
  
  // Mostrar mensaje usando clase CSS
  msgEl.textContent = text;
  msgEl.classList.add("show");
  
  console.log("✅ Mensaje visible. Estado:", {
    hasShowClass: msgEl.classList.contains("show"),
    opacity: window.getComputedStyle(msgEl).opacity,
    visibility: window.getComputedStyle(msgEl).visibility
  });
  
  // Ocultar después del tiempo especificado
  msgEl.hideTimeout = setTimeout(() => {
    msgEl.classList.remove("show");
    console.log("⏰ Mensaje ocultado");
  }, duration);
}

// Función para mostrar pantalla de victoria
function showVictoryScreen() {
  const victoryScreen = document.getElementById("victoryScreen");
  const finalScoreEl = document.getElementById("finalScore");
  
  if (victoryScreen && finalScoreEl) {
    finalScoreEl.textContent = score;
    victoryScreen.classList.add("show");
    gameState = "victory";
  }
}

// Función para crear la escena
const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  // === SUELO ===
  const GROUND_WIDTH = 200;
  const GROUND_HEIGHT = 400;
  
  const ground = BABYLON.MeshBuilder.CreateGround(
    "ground",
    { width: GROUND_WIDTH, height: GROUND_HEIGHT },
    scene
  );

  const groundMaterial = new BABYLON.StandardMaterial("groundMat", scene);
  groundMaterial.diffuseTexture = new BABYLON.Texture("./assets/textures/concrete/textures/worn_patterned_pavers_diff_2k.jpg", scene);
  groundMaterial.diffuseTexture.uScale = 10;
  groundMaterial.diffuseTexture.vScale = 20;
  ground.material = groundMaterial;
  ground.receiveShadows = true;
  ground.checkCollisions = false; // Desactivar colisión con suelo (la abeja vuela)

  // --- SKYBOX / ENTORNO 360 ---
  const dome = new BABYLON.PhotoDome(
      "testdome",
      "./assets/textures/urban.jpg", // <--- CAMBIA .exr POR .jpg
      {
          resolution: 32,
          size: 1000
      },
      scene
  );
  
  // Esto es opcional con JPG, pero ayuda a ajustar el brillo
  dome.imageMode = BABYLON.PhotoDome.MODE_MONOSCOPIC;

  // === CÁMARA SEGUIDORA ===
  const camera = new BABYLON.FollowCamera("FollowCamera", new BABYLON.Vector3(0, 10, -20), scene);
  camera.radius = 20;
  camera.heightOffset = 6;
  camera.rotationOffset = 180;
  camera.cameraAcceleration = 0.05;
  camera.maxCameraSpeed = 20;

  scene.registerBeforeRender(() => {
    if (playerAgent) {
      camera.lockedTarget = playerAgent;
    }
  });

  // === LUZ ===
  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.8;

  // Variables de juego
  const briefcaseSpheres = [];
  const deliveryZones = [];
  let playerAgent = null;
  let hasBriefcase = false;
  let currentBriefcase = null;

  const PICKUP_DISTANCE = 5;
  const DELIVERY_DISTANCE = 30; // Aumentado para casas grandes

  // --- CARGAR TREES --- (Eliminado para ambiente urbano)
  // BABYLON.SceneLoader.ImportMesh(
  //   "",
  //   "./assets/models/",
  //   "trees.glb",
  //   scene,
  //   (meshes) => {
  //     if (meshes.length > 0) {
  //       const rootMesh = meshes[0];
  //       rootMesh.position = new BABYLON.Vector3(0, 0, 0);
  //       rootMesh.scaling = new BABYLON.Vector3(4, 4, 4);
  //       meshes.forEach(m => {
  //         m.checkCollisions = true;
  //       });
  //       console.log("🌲 Árboles cargados");
  //     }
  //   }
  // );

  // --- CARGAR AGENTES NPC ---
  BABYLON.SceneLoader.ImportMesh(
    "",
    "./assets/models/",
    "spy_agent.glb",
    scene,
    (meshes) => {
      if (meshes.length === 0) return;
      const agent1 = meshes[0];

      try {
        if (agent1.rotationQuaternion) agent1.rotationQuaternion = null;
      } catch (e) { }

      agent1.scaling.set(2, 2, 2);
      agent1.position.set(75, 20, -120);

      const centerPosition = new BABYLON.Vector3(0, 0, 0);
      const directionToAgent1 = centerPosition.subtract(agent1.position);
      agent1.rotation.y = Math.atan2(directionToAgent1.x, directionToAgent1.z);

      // const clonesPos = [
      //   new BABYLON.Vector3(75, 15, -120),
      //   new BABYLON.Vector3(65, 15, -120),
      //   new BABYLON.Vector3(65, 20, -120),
      //   new BABYLON.Vector3(-65, 15, -100),
      //   new BABYLON.Vector3(-75, 15, -100),
      //   new BABYLON.Vector3(-80, 10, -100),
      //   new BABYLON.Vector3(-60, 10, -100),
      //   new BABYLON.Vector3(-50, 20, -100),
      //   new BABYLON.Vector3(-45, 15, -100),
      //   new BABYLON.Vector3(-37, 10, -100),
      // ];

      // clonesPos.forEach((pos, idx) => {
      //   const c = agent1.clone("agent_npc_" + idx, null);
      //   if (c) {
      //     c.position = pos.clone();
      //     const directionToCenter = centerPosition.subtract(c.position);
      //     c.rotation.y = Math.atan2(directionToCenter.x, directionToCenter.z);
      //   }
      // });
      
      console.log("🕵️ Agente NPC cargado");
    }
  );

  // --- CARGAR AGENTE JUGADOR ---
  BABYLON.SceneLoader.ImportMesh(
    "",
    "./assets/models/",
    "spy_agent.glb",
    scene,
    (meshes) => {
      if (meshes.length === 0) return;

      playerAgent = meshes[0];
      if (playerAgent.rotationQuaternion) playerAgent.rotationQuaternion = null;

      playerAgent.name = "playerAgent";
      playerAgent.scaling = new BABYLON.Vector3(1.8, 1.8, 1.8);
      playerAgent.position = new BABYLON.Vector3(-10, 0, -60);

      // ACTIVAR COLISIONES PARA EL JUGADOR
      playerAgent.checkCollisions = true;
      playerAgent.ellipsoid = new BABYLON.Vector3(1, 1, 1); // Reducido para mejor manejo
      playerAgent.ellipsoidOffset = new BABYLON.Vector3(0, 0, 0);

      // Guardar referencia al skeleton para controlar animación
      if (scene.skeletons.length > 0) {
        playerAgent.skeleton = scene.skeletons[0];
        playerAgent.animatable = null; // Se iniciará cuando se mueva
      }

      playerAgent.isPickable = false;
      
      console.log("✅ Agente jugador cargado");
      showMessage("⚡ ¡MISIÓN INICIADA! Usa ESPACIO para recoger maletín y E para entregarlo 🎯", 4000);
    }
  );

  // --- FUNCIÓN CREAR CASA DE SEGURIDAD COLGANTE ---
  function createHangingSafeHouse(scene, position, lookAtPosition) {
    const hiveContainer = new BABYLON.TransformNode("hiveContainer", scene);
    hiveContainer.position = position;

    const rope = BABYLON.MeshBuilder.CreateCylinder("rope", { height: 3, diameter: 0.2 }, scene);
    rope.position.y = 0.5;
    rope.parent = hiveContainer;
    rope.checkCollisions = true;
    const ropeMat = new BABYLON.StandardMaterial("ropeMat", scene);
    ropeMat.diffuseColor = new BABYLON.Color3(0.3, 0.2, 0.1);
    rope.material = ropeMat;

    const hiveMat = new BABYLON.StandardMaterial("hiveMat", scene);
    hiveMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5); // Gris temporal para casas de seguridad
    hiveMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.1);
    hiveMat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.05);

    const hiveBody = BABYLON.MeshBuilder.CreateCylinder("hiveBody", {
      height: 10, diameterTop: 4, diameterBottom: 6, tessellation: 32
    }, scene);
    hiveBody.position.y = -3;
    hiveBody.parent = hiveContainer;
    hiveBody.material = hiveMat;
    hiveBody.checkCollisions = true;

    const hiveTop = BABYLON.MeshBuilder.CreateSphere("hiveTop", { diameter: 5, segments: 16, slice: 0.5 }, scene);
    hiveTop.position.y = 2;
    hiveTop.scaling.y = 0.6;
    hiveTop.parent = hiveContainer;
    hiveTop.material = hiveMat;
    hiveTop.checkCollisions = true;

    const hiveBottom = BABYLON.MeshBuilder.CreateSphere("hiveBottom", { diameter: 6, segments: 16, slice: 0.5 }, scene);
    hiveBottom.position.y = -8;
    hiveBottom.rotation.x = Math.PI;
    hiveBottom.scaling.y = 0.8;
    hiveBottom.parent = hiveContainer;
    hiveBottom.material = hiveMat;
    hiveBottom.checkCollisions = true;

    const direction = lookAtPosition.subtract(position);
    const angleToTrees = Math.atan2(direction.x, direction.z);
    hiveContainer.rotation.y = angleToTrees;

    const entranceOuter = BABYLON.MeshBuilder.CreateTorus("entranceOuter", { diameter: 2.5, thickness: 0.3, tessellation: 32 }, scene);
    entranceOuter.position = new BABYLON.Vector3(0, -2, 3.2);
    entranceOuter.rotation.y = Math.PI / 2;
    entranceOuter.parent = hiveContainer;
    const entranceOuterMat = new BABYLON.StandardMaterial("entranceOuterMat", scene);
    entranceOuterMat.diffuseColor = new BABYLON.Color3(0.7, 0.55, 0.2);
    entranceOuter.material = entranceOuterMat;

    const entranceTunnel = BABYLON.MeshBuilder.CreateCylinder("entranceTunnel", { height: 2, diameter: 2.5 }, scene);
    entranceTunnel.position = new BABYLON.Vector3(0, -2, 2.5);
    entranceTunnel.rotation.x = Math.PI / 2;
    entranceTunnel.parent = hiveContainer;
    const tunnelMat = new BABYLON.StandardMaterial("tunnelMat", scene);
    tunnelMat.diffuseColor = new BABYLON.Color3(0.1, 0.05, 0);
    tunnelMat.emissiveColor = new BABYLON.Color3(0.05, 0.02, 0);
    entranceTunnel.material = tunnelMat;
    entranceTunnel.checkCollisions = false;
    entranceTunnel.isPickable = false;

    deliveryZones.push(entranceTunnel);

    const entranceHole = BABYLON.MeshBuilder.CreateCylinder("entranceHole", { height: 0.5, diameter: 1.8 }, scene);
    entranceHole.position = new BABYLON.Vector3(0, -2, 3.5);
    entranceHole.rotation.x = Math.PI / 2;
    entranceHole.parent = hiveContainer;
    const holeMat = new BABYLON.StandardMaterial("holeMat", scene);
    holeMat.diffuseColor = new BABYLON.Color3(0, 0, 0);
    holeMat.emissiveColor = new BABYLON.Color3(0, 0, 0);
    entranceHole.material = holeMat;

    for (let i = 0; i < 5; i++) {
      const layer = BABYLON.MeshBuilder.CreateTorus("layer" + i, { diameter: 6 + i * 0.3, thickness: 0.15, tessellation: 32 }, scene);
      layer.position.y = -1 - i * 1.5;
      layer.parent = hiveContainer;
      const layerMat = new BABYLON.StandardMaterial("layerMat" + i, scene);
      layerMat.diffuseColor = new BABYLON.Color3(0.7, 0.55, 0.2);
      layer.material = layerMat;
    }

    let angle = 0;
    scene.registerBeforeRender(() => {
      angle += 0.01;
      hiveContainer.rotation.z = Math.sin(angle) * 0.05;
    });

    return hiveContainer;
  }

  // const hangingSafeHouse = createHangingSafeHouse(
  //   scene,
  //   new BABYLON.Vector3(70, 20, -120),
  //   new BABYLON.Vector3(0, 0, 0)
  // );

  // --- FUNCIÓN CREAR CASA DE SEGURIDAD DE SUELO ---
  function createGroundSafeHouse(scene, position, lookAtPosition) {
    const hiveContainer = new BABYLON.TransformNode("groundHiveContainer", scene);
    hiveContainer.position = position;

    const direction = lookAtPosition.subtract(position);
    const angleToTrees = Math.atan2(direction.x, direction.z);
    hiveContainer.rotation.y = angleToTrees;

    const woodMat = new BABYLON.StandardMaterial("woodMat", scene);
    woodMat.diffuseColor = new BABYLON.Color3(0.4, 0.3, 0.2); // Marrón temporal para casas de suelo
    woodMat.specularColor = new BABYLON.Color3(0.2, 0.15, 0.1);

    const roofMat = new BABYLON.StandardMaterial("roofMat", scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    roofMat.specularColor = new BABYLON.Color3(0.3, 0.3, 0.3);

    const base = BABYLON.MeshBuilder.CreateBox("base", { width: 12, height: 0.8, depth: 8 }, scene);
    base.position.y = 0.4;
    base.parent = hiveContainer;
    base.material = woodMat;
    base.checkCollisions = true;

    const boxHeight = 3;
    const boxCount = 4;

    for (let i = 0; i < boxCount; i++) {
      const box = BABYLON.MeshBuilder.CreateBox("hiveBox" + i + "_" + position.x + "_" + position.z, { width: 10, height: boxHeight, depth: 7 }, scene);
      box.position.y = 0.8 + boxHeight * i + boxHeight / 2;
      box.parent = hiveContainer;
      box.material = woodMat;
      box.checkCollisions = true;

      const stripe = BABYLON.MeshBuilder.CreateBox("stripe" + i + "_" + position.x + "_" + position.z, { width: 10.2, height: 0.15, depth: 7.2 }, scene);
      stripe.position.y = 0.8 + boxHeight * (i + 1);
      stripe.parent = hiveContainer;
      const stripeMat = new BABYLON.StandardMaterial("stripeMat" + i, scene);
      stripeMat.diffuseColor = new BABYLON.Color3(0.4, 0.3, 0.15);
      stripe.material = stripeMat;
    }

    const roof = BABYLON.MeshBuilder.CreateBox("roof", { width: 12, height: 0.5, depth: 8 }, scene);
    roof.position.y = 0.8 + boxHeight * boxCount + 0.6;
    roof.parent = hiveContainer;
    roof.material = roofMat;
    roof.checkCollisions = true;

    const roofTop = BABYLON.MeshBuilder.CreateBox("roofTop", { width: 13, height: 0.3, depth: 9 }, scene);
    roofTop.position.y = 0.8 + boxHeight * boxCount + 1.2;
    roofTop.parent = hiveContainer;
    roofTop.material = roofMat;
    roofTop.checkCollisions = true;

    const entrance = BABYLON.MeshBuilder.CreateBox("entrance", { width: 6, height: 0.6, depth: 0.5 }, scene);
    entrance.position = new BABYLON.Vector3(0, 1.2, 3.75);
    entrance.parent = hiveContainer;
    const entranceMat = new BABYLON.StandardMaterial("entranceMat", scene);
    entranceMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    entranceMat.emissiveColor = new BABYLON.Color3(0.02, 0.02, 0.02);
    entrance.material = entranceMat;
    entrance.checkCollisions = false;

    const landingBoard = BABYLON.MeshBuilder.CreateBox("landingBoard", { width: 8, height: 0.3, depth: 3.5 }, scene);
    landingBoard.position = new BABYLON.Vector3(0, 1, 5.5);
    landingBoard.rotation.x = -Math.PI / 12;
    landingBoard.parent = hiveContainer;
    landingBoard.material = woodMat;
    landingBoard.checkCollisions = true;

    const pollenShelf1 = BABYLON.MeshBuilder.CreateBox("pollenShelf1_" + position.x + "_" + position.z, { width: 1.5, height: 0.25, depth: 1.8 }, scene);
    pollenShelf1.position = new BABYLON.Vector3(-3.8, 1.4, 4.2);
    pollenShelf1.parent = hiveContainer;
    const pollenShelfMat = new BABYLON.StandardMaterial("pollenShelfMat", scene);
    pollenShelfMat.diffuseColor = new BABYLON.Color3(0.8, 0.7, 0.3);
    pollenShelfMat.emissiveColor = new BABYLON.Color3(0.2, 0.15, 0.05);
    pollenShelf1.material = pollenShelfMat;
    pollenShelf1.checkCollisions = false;
    pollenShelf1.isPickable = false;

    const pollenShelf2 = BABYLON.MeshBuilder.CreateBox("pollenShelf2_" + position.x + "_" + position.z, { width: 1.5, height: 0.25, depth: 1.8 }, scene);
    pollenShelf2.position = new BABYLON.Vector3(3.8, 1.4, 4.2);
    pollenShelf2.parent = hiveContainer;
    pollenShelf2.material = pollenShelfMat;
    pollenShelf2.checkCollisions = false;
    pollenShelf2.isPickable = false;

    deliveryZones.push(pollenShelf1);
    deliveryZones.push(pollenShelf2);

    for (let i = 1; i <= 4; i++) {
      const handle = BABYLON.MeshBuilder.CreateTorus("handle" + i + "_" + position.x + "_" + position.z, { diameter: 0.7, thickness: 0.12, tessellation: 16 }, scene);
      handle.position = new BABYLON.Vector3(-5.3, 0.8 + boxHeight * i - 1, 0);
      handle.rotation.z = Math.PI / 2;
      handle.parent = hiveContainer;
      const handleMat = new BABYLON.StandardMaterial("handleMat" + i, scene);
      handleMat.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
      handleMat.specularColor = new BABYLON.Color3(0.8, 0.8, 0.8);
      handle.material = handleMat;
    }

    return hiveContainer;
  }

  // const groundSafeHouse = createGroundSafeHouse(
  //   scene,
  //   new BABYLON.Vector3(-45, 0, -100),
  //   new BABYLON.Vector3(0, 0, 0)
  // );

  // const groundSafeHouse2 = createGroundSafeHouse(
  //   scene,
  //   new BABYLON.Vector3(-70, 0, -100),
  //   new BABYLON.Vector3(0, 0, 0)
  // );

  // // Zonas de entrega simples (discos verdes en el suelo)
  // const deliveryZone1 = BABYLON.MeshBuilder.CreateDisc("deliveryZone1", { radius: 5 }, scene);
  // deliveryZone1.rotation.x = Math.PI / 2;
  // deliveryZone1.position = new BABYLON.Vector3(70, 0.1, -120);
  // const zoneMat1 = new BABYLON.StandardMaterial("zoneMat1", scene);
  // zoneMat1.diffuseColor = new BABYLON.Color3(0, 1, 0);
  // zoneMat1.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
  // deliveryZone1.material = zoneMat1;
  // deliveryZones.push(deliveryZone1);

  // const deliveryZone2 = BABYLON.MeshBuilder.CreateDisc("deliveryZone2", { radius: 5 }, scene);
  // deliveryZone2.rotation.x = Math.PI / 2;
  // deliveryZone2.position = new BABYLON.Vector3(-45, 0.1, -100);
  // const zoneMat2 = new BABYLON.StandardMaterial("zoneMat2", scene);
  // zoneMat2.diffuseColor = new BABYLON.Color3(0, 1, 0);
  // zoneMat2.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
  // deliveryZone2.material = zoneMat2;
  // deliveryZones.push(deliveryZone2);

  // const deliveryZone3 = BABYLON.MeshBuilder.CreateDisc("deliveryZone3", { radius: 5 }, scene);
  // deliveryZone3.rotation.x = Math.PI / 2;
  // deliveryZone3.position = new BABYLON.Vector3(-70, 0.1, -100);
  // const zoneMat3 = new BABYLON.StandardMaterial("zoneMat3", scene);
  // zoneMat3.diffuseColor = new BABYLON.Color3(0, 1, 0);
  // zoneMat3.emissiveColor = new BABYLON.Color3(0, 0.5, 0);
  // deliveryZone3.material = zoneMat3;
  // deliveryZones.push(deliveryZone3);

  // Cargar casa modular como zona de entrega
  BABYLON.SceneLoader.ImportMesh(
    "",
    "./assets/models/",
    "modular_house.glb",
    scene,
    (meshes, particleSystems, skeletons, animationGroups) => {
      if (!meshes || meshes.length === 0) {
        console.error("❌ No se pudieron cargar meshes de modular_house.glb");
        return;
      }

      console.log("🏠 modular_house.glb cargado. Meshes:", meshes.map(m => ({ name: m.name, parent: m.parent ? m.parent.name : null, visible: m.isVisible })));

      // Calcular bounding box del conjunto para ajustar tamaño y posición al suelo
      const meshList = meshes.filter(m => m instanceof BABYLON.Mesh);
      let minY = Infinity;
      let maxY = -Infinity;
      meshList.forEach(m => {
        try {
          const bb = m.getBoundingInfo();
          if (bb) {
            minY = Math.min(minY, bb.boundingBox.minimumWorld.y);
            maxY = Math.max(maxY, bb.boundingBox.maximumWorld.y);
          }
        } catch (e) {
          // Ignorar meshes sin bounding info
        }
      });

      const rawHeight = (isFinite(minY) && isFinite(maxY)) ? (maxY - minY) : null;
      console.log("📐 modular_house raw bounds:", { minY, maxY, rawHeight });

      // Crear nodo raíz para controlar posición/escala de toda la casa
      const houseRoot = new BABYLON.TransformNode("houseRoot", scene);
      // Posición X/Z deseada (mantener base en suelo, Y lo calcularemos)
      const desiredXZ = new BABYLON.Vector3(30, 0, -60);

      // Escalar la casa para que sea m\u00e1s visible y de tama\u00f1o razonable
      const TARGET_HEIGHT = 10; // metros en mundo para la casa (ajustado para mejor visibilidad)
      let scaleFactor = 1;
      if (rawHeight && rawHeight > 0) {
        scaleFactor = Math.min(1, TARGET_HEIGHT / rawHeight);
      }
      // Aplicar un escalado m\u00e1s grande para mejor visibilidad
      const BASE_SCALE = 2.5;
      const finalScale = BASE_SCALE * scaleFactor;
      houseRoot.scaling = new BABYLON.Vector3(finalScale, finalScale, finalScale);

      // Reparentar meshes al nodo raíz y forzar visibilidad/colisiones
      meshes.forEach(m => {
        m.parent = houseRoot;
        m.checkCollisions = true;
        m.isVisible = true;
        m.receiveShadows = true;
        
        // Mejorar visibilidad con material emisivo si no tiene material
        if (m.material) {
          // Añadir emisión para mayor visibilidad
          if (m.material.emissiveColor) {
            m.material.emissiveColor = new BABYLON.Color3(0.1, 0.1, 0.15);
          }
        } else {
          // Crear material básico si no tiene
          const houseMat = new BABYLON.StandardMaterial("houseMat_" + m.name, scene);
          houseMat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.9);
          houseMat.emissiveColor = new BABYLON.Color3(0.15, 0.15, 0.2);
          m.material = houseMat;
        }
      });

      // Ajustar Y del nodo raíz para que la base (minY) quede a Y=0 (suelo)
      if (rawHeight && rawHeight > 0 && isFinite(minY)) {
        // minY es en coordenadas mundiales antes de reparentar; al escalar por houseRoot,
        // debemos desplazar houseRoot en Y por -minY * finalScale para llevar la base a 0.
        const yOffset = -minY * finalScale;
        houseRoot.position = new BABYLON.Vector3(desiredXZ.x, yOffset, desiredXZ.z);
        console.log("↕️ Ajuste de altura de casa:", { TARGET_HEIGHT, rawHeight, scaleFactor, finalScale, yOffset });
      } else {
        houseRoot.position = new BABYLON.Vector3(desiredXZ.x, 0, desiredXZ.z);
      }

      // Luz direccional auxiliar para asegurar que se vea (puedes quitarla después)
      const houseLight = new BABYLON.DirectionalLight("houseLight", new BABYLON.Vector3(-0.5, -1, 0.3), scene);
      houseLight.position = new BABYLON.Vector3(50, 50, 0);
      houseLight.intensity = 0.8;

      deliveryZones.push(houseRoot);
      console.log("🏠 Casa modular colocada en", houseRoot.position);
    },
    null,
    (scene, message, exception) => {
      console.error("❌ Error cargando modular_house.glb:", message, exception);
    }
  );

  // Función para cargar casa modular en posición específica (DUPLICAR CASAS)
  function loadModularHouse(position, houseName) {
    BABYLON.SceneLoader.ImportMesh(
      "",
      "./assets/models/",
      "modular_house.glb",
      scene,
      (meshes) => {
        if (!meshes || meshes.length === 0) {
          console.error("❌ No se pudieron cargar meshes de " + houseName);
          return;
        }

        console.log("🏠 " + houseName + " cargado. Cantidad meshes:", meshes.length);

        // 1. Crear nodo raíz para controlar posición/escala
        const houseRoot = new BABYLON.TransformNode(houseName, scene);

        // 2. CORRECCIÓN CRÍTICA: Emparentar SOLO el nodo raíz del GLB
        meshes[0].parent = houseRoot;

        // 3. Configurar escala y posición (escala mayor para visibilidad)
        houseRoot.scaling = new BABYLON.Vector3(5.0, 5.0, 5.0);
        houseRoot.position = new BABYLON.Vector3(position.x, 0, position.z);

        // 4. Recorrer para materiales y colisiones (SIN cambiar parents)
        meshes.forEach(m => {
          m.isVisible = true;
          m.checkCollisions = true;
          m.receiveShadows = true;
          
          // Arreglar materiales
          if (!m.material) {
            const mat = new BABYLON.StandardMaterial("houseMat_" + houseName + "_" + m.name, scene);
            mat.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.8);
            mat.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            m.material = mat;
          } else {
            if (m.material.emissiveColor) {
              m.material.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
            }
            m.material.backFaceCulling = false;
          }
        });

        // Crear marcador visual verde grande
        const houseMarker = BABYLON.MeshBuilder.CreateDisc("marker_" + houseName, { radius: 25, tessellation: 64 }, scene);
        houseMarker.rotation.x = Math.PI / 2;
        houseMarker.position = new BABYLON.Vector3(position.x, 0.1, position.z);
        const markerMat = new BABYLON.StandardMaterial("markerMat_" + houseName, scene);
        markerMat.diffuseColor = new BABYLON.Color3(0, 1, 0);
        markerMat.emissiveColor = new BABYLON.Color3(0, 1, 0);
        markerMat.alpha = 0.7;
        houseMarker.material = markerMat;
        
        // Luz puntual brillante
        const houseSpotLight = new BABYLON.PointLight("houseLight_" + houseName, new BABYLON.Vector3(position.x, 30, position.z), scene);
        houseSpotLight.diffuse = new BABYLON.Color3(0, 1, 0);
        houseSpotLight.intensity = 5.0;
        houseSpotLight.range = 80;

        deliveryZones.push(houseRoot);
        console.log("🏠 " + houseName + " colocada correctamente en", houseRoot.position);
      }
    );
  }

  // Cargar segunda casa modular (donde estará el maletín)
  loadModularHouse(new BABYLON.Vector3(-40, 0, -80), "houseRoot2");
  
  // Cargar tercera casa para entregar (más visible y accesible)
  loadModularHouse(new BABYLON.Vector3(40, 0, -60), "houseRoot3");

  function createGlowCircle(scene, position, radius = 20) {
    const circle = BABYLON.MeshBuilder.CreateDisc("glowCircle", { radius: radius, tessellation: 200 }, scene);
    circle.rotation.x = Math.PI / 2;
    circle.position = position.add(new BABYLON.Vector3(0, 0.05, 0));
    const mat = new BABYLON.StandardMaterial("glowCircleMat", scene);
    mat.diffuseColor = new BABYLON.Color3(0, 1, 0);
    mat.emissiveColor = new BABYLON.Color3(0, 1, 0);
    mat.alpha = 0.6;
    circle.material = mat;
    return circle;
  }

  // --- CARGAR FLORES Y POLEN ---
  const flowerPositions = [
    new BABYLON.Vector3(-90, 0, 90),
    new BABYLON.Vector3(-90, 0, 30),
    new BABYLON.Vector3(-90, 0, -30),
    new BABYLON.Vector3(-90, 0, -90),
    new BABYLON.Vector3(-55, 0, 90),
    new BABYLON.Vector3(-55, 0, 30),
    new BABYLON.Vector3(-55, 0, -30),
    new BABYLON.Vector3(-55, 0, -90),
    new BABYLON.Vector3(-10, 0, 90),
    new BABYLON.Vector3(-10, 0, 30),
    new BABYLON.Vector3(-10, 0, -30),
    new BABYLON.Vector3(-10, 0, -90),
    new BABYLON.Vector3(35, 0, 90),
    new BABYLON.Vector3(35, 0, 30),
    new BABYLON.Vector3(35, 0, -30),
    new BABYLON.Vector3(35, 0, -90),
    new BABYLON.Vector3(70, 0, 90),
    new BABYLON.Vector3(70, 0, 30),
    new BABYLON.Vector3(70, 0, -30),
    new BABYLON.Vector3(70, 0, -90)
  ];

  // Posiciones fijas para el maletín (1 maletín) - en la entrada de la segunda casa (borde del círculo verde)
  const briefcasePositions = [
    new BABYLON.Vector3(-40, 3, -55)  // En la circunferencia del círculo verde (radio 25)
  ];

  // Cargar maletín desde modelo
  briefcasePositions.forEach((position, groupIndex) => {
    BABYLON.SceneLoader.ImportMesh(
      "",
      "./assets/models/",
      "suitcase.glb",
      scene,
      (meshes) => {
        if (meshes.length > 0) {
          const briefcase = meshes[0];
          briefcase.position = position;
          briefcase.scaling = new BABYLON.Vector3(5, 5, 5); // Mucho más grande para visibilidad
          briefcase.isPickable = true;
          briefcase.checkCollisions = false;

          // Crear haz de luz vertical GIGANTE para marcar el maletín
          const lightBeam = BABYLON.MeshBuilder.CreateCylinder("lightBeam_" + groupIndex, {
            height: 50,
            diameter: 8,
            tessellation: 32
          }, scene);
          lightBeam.position = new BABYLON.Vector3(position.x, 25, position.z);
          
          const beamMat = new BABYLON.StandardMaterial("beamMat_" + groupIndex, scene);
          beamMat.diffuseColor = new BABYLON.Color3(1, 1, 0);
          beamMat.emissiveColor = new BABYLON.Color3(1, 1, 0);
          beamMat.alpha = 0.7;
          beamMat.backFaceCulling = false;
          lightBeam.material = beamMat;
          lightBeam.isPickable = false;
          
          // Animar el haz de luz (pulsación)
          let beamAlpha = 0.5;
          let beamDirection = 1;
          scene.registerBeforeRender(() => {
            if (lightBeam && !lightBeam.isDisposed()) {
              beamAlpha += 0.015 * beamDirection;
              if (beamAlpha >= 0.9) beamDirection = -1;
              if (beamAlpha <= 0.4) beamDirection = 1;
              beamMat.alpha = beamAlpha;
            }
          });
          
          // Crear luz puntual MUY brillante sobre el maletín
          const spotLight = new BABYLON.PointLight(
            "spotLight_" + groupIndex,
            new BABYLON.Vector3(position.x, 30, position.z),
            scene
          );
          spotLight.diffuse = new BABYLON.Color3(1, 1, 0);
          spotLight.intensity = 8.0;
          spotLight.range = 100;

          // Animación de rotación y flotación
          let angle = 0;
          scene.registerBeforeRender(() => {
            if (briefcase && !briefcase.isDisposed()) {
              briefcase.rotation.y += 0.01;
              // Flotación suave
              angle += 0.02;
              briefcase.position.y = position.y + Math.sin(angle) * 0.2;
            }
          });

          briefcaseSpheres.push(briefcase);
          
          // Guardar referencias para eliminar el haz de luz cuando se recoja
          briefcase.lightBeam = lightBeam;
          briefcase.spotLight = spotLight;
        }
      }
    );
  });

  // Cargar edificios decorativos (opcional)
  // flowerPositions.forEach((position, flowerIndex) => {
  //   BABYLON.SceneLoader.ImportMesh(
  //     "",
  //     "./assets/models/",
  //     "buildings.glb",
  //     scene,
  //     (meshes) => {
  //       if (meshes.length > 0) {
  //         const rootMesh = meshes[0];
  //         rootMesh.position = position.clone();
  //         rootMesh.scaling = new BABYLON.Vector3(5, 5, 5);
  //         
  //         meshes.forEach(m => {
  //           m.checkCollisions = true;
  //         });
  //       }
  //     }
  //   );
  // });

  // Actualizar HUD inicial
  updateHUD();

  // --- CONTROL DEL JUGADOR ---
  const inputMap = {};
  scene.actionManager = scene.actionManager || new BABYLON.ActionManager(scene);

  scene.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyDownTrigger, (evt) => {
      inputMap[evt.sourceEvent.key.toLowerCase()] = true;
    })
  );

  scene.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnKeyUpTrigger, (evt) => {
      inputMap[evt.sourceEvent.key.toLowerCase()] = false;
    })
  );

  const PLAYER_SPEED = 0.4;

  scene.onBeforeRenderObservable.add(() => {
    if (!playerAgent || gameState !== "playing") return;

    const rotY = playerAgent.rotation ? playerAgent.rotation.y : 0;
    const forwardDir = new BABYLON.Vector3(Math.sin(rotY), 0, Math.cos(rotY));

    let movement = BABYLON.Vector3.Zero();
    let isMoving = false;

    // Movimiento horizontal (sin Y para mantener al personaje en el suelo)
    if (inputMap["w"] || inputMap["arrowup"]) {
      movement.addInPlace(forwardDir);
      isMoving = true;
    }
    if (inputMap["s"] || inputMap["arrowdown"]) {
      movement.subtractInPlace(forwardDir);
      isMoving = true;
    }
    
    // Rotación
    if (inputMap["a"] || inputMap["arrowleft"]) {
      playerAgent.rotation.y -= 0.06 * scene.getAnimationRatio();
    }
    if (inputMap["d"] || inputMap["arrowright"]) {
      playerAgent.rotation.y += 0.06 * scene.getAnimationRatio();
    }

    // Normalizar y aplicar movimiento (solo en X y Z)
    if (isMoving && movement.length() > 0) {
      movement.normalize();
      playerAgent.moveWithCollisions(movement.scale(PLAYER_SPEED * scene.getAnimationRatio()));
    }

    // Control de animación basado en movimiento
    if (playerAgent.skeleton) {
      if (isMoving) {
        // Iniciar animación si está moviendo y no está ya animando
        if (!playerAgent.animatable || playerAgent.animatable.paused) {
          playerAgent.animatable = scene.beginAnimation(playerAgent.skeleton, 0, 100, true);
        }
      } else {
        // Pausar animación si no está moviendo
        if (playerAgent.animatable && !playerAgent.animatable.paused) {
          playerAgent.animatable.pause();
        }
      }
    }

    // Inclinación visual
    const targetTilt = inputMap["w"] ? -0.12 : (inputMap["s"] ? 0.15 : 0);
    playerAgent.rotation.x += (targetTilt - playerAgent.rotation.x) * 0.1;

    // Límites del mapa
    const maxX = GROUND_WIDTH / 2 - 5;
    const maxZ = GROUND_HEIGHT / 2 - 5;
    playerAgent.position.x = Math.max(-maxX, Math.min(maxX, playerAgent.position.x));
    playerAgent.position.z = Math.max(-maxZ, Math.min(maxZ, playerAgent.position.z));
    // Mantener personaje al nivel del suelo
    playerAgent.position.y = 0;
  });

  // --- RECOGER Y ENTREGAR MALETÍN ---
  window.addEventListener("keydown", (evt) => {
    const key = evt.key.toLowerCase();
    
    // ESPACIO: Solo para recoger maletín
    if (key === " ") {
      evt.preventDefault();
      if (gameState !== "playing") return;
      
      if (hasBriefcase) {
        showMessage("⚠️ Ya tienes un maletín! Usa la tecla E para entregarlo en el círculo verde", 2500);
        return;
      }
      
      const nearBriefcase = checkNearBriefcase();
      if (nearBriefcase) {
        attemptPickup();
      } else {
        showMessage("No hay maletín cerca. Busca el haz de luz amarillo 💡", 2000);
      }
    }
    
    // E: Solo para entregar maletín
    if (key === "e") {
      evt.preventDefault();
      if (gameState !== "playing") return;
      
      if (!hasBriefcase) {
        showMessage("⚠️ No tienes maletín! Usa ESPACIO para recogerlo 📦", 2500);
        return;
      }
      
      const nearDeliveryZone = checkNearDeliveryZone();
      if (nearDeliveryZone) {
        attemptDelivery();
      } else {
        showMessage("No estás cerca de una casa. Busca el círculo verde 🟯", 2000);
      }
    }
  });

  // Función auxiliar para verificar si hay maletín cerca
  function checkNearBriefcase() {
    if (!playerAgent) return false;
    
    for (let i = 0; i < briefcaseSpheres.length; i++) {
      const b = briefcaseSpheres[i];
      if (!b || b.isDisposed()) continue;
      
      const dist = BABYLON.Vector3.Distance(playerAgent.position, b.getAbsolutePosition());
      if (dist <= PICKUP_DISTANCE) {
        return true;
      }
    }
    return false;
  }

  // Función auxiliar para verificar si hay zona de entrega cerca
  function checkNearDeliveryZone() {
    if (!playerAgent) return false;
    
    for (let zone of deliveryZones) {
      if (!zone) continue;
      
      const zonePos = zone.getAbsolutePosition ? zone.getAbsolutePosition() : zone.position;
      const dist = BABYLON.Vector3.Distance(playerAgent.position, zonePos);
      
      if (dist <= DELIVERY_DISTANCE) {
        return true;
      }
    }
    return false;
  }

  function attemptPickup() {
    if (!playerAgent) return;
    
    // VERIFICACIÓN: Si ya tiene maletín, mostrar mensaje y salir
    if (hasBriefcase) {
      console.log("⚠️ Intentando recoger maletín pero ya tiene uno");
      showMessage("¡Ya tienes un maletín! Llévalo a la casa modular 🏠", 3000);
      return;
    }

    // Buscar maletín cercano
    for (let i = 0; i < briefcaseSpheres.length; i++) {
      const b = briefcaseSpheres[i];
      if (!b || b.isDisposed()) continue;

      const dist = BABYLON.Vector3.Distance(playerAgent.position, b.getAbsolutePosition());
      
      if (dist <= PICKUP_DISTANCE) {
        console.log("✅ Maletín encontrado a distancia:", dist);
        
        hasBriefcase = true;
        currentBriefcase = b;

        b.isPickable = false;
        b.setParent(playerAgent);
        b.position = new BABYLON.Vector3(0, 0.6, 1);
        b.scaling = new BABYLON.Vector3(0.7, 0.7, 0.7);

        // Eliminar haz de luz y spotlight cuando se recoge
        if (b.lightBeam) {
          b.lightBeam.dispose();
          b.lightBeam = null;
        }
        if (b.spotLight) {
          b.spotLight.dispose();
          b.spotLight = null;
        }

        showMessage("✅ MALETÍN RECOGIDO! Lleva a la casa y presiona E para entregar 🎯", 2500);
        return;
      }
    }
    
    // Si llega aquí, no hay maletín cerca (no debería pasar con la nueva lógica)
    console.log("⚠️ No hay maletín cerca. Distancia mínima:", PICKUP_DISTANCE);
  }

  function attemptDelivery() {
    if (!playerAgent) return;
    
    // VERIFICACIÓN: Si no tiene maletín, mostrar mensaje y salir
    if (!hasBriefcase || !currentBriefcase) {
      console.log("⚠️ Intentando entregar maletín pero no tiene ninguno");
      showMessage("¡No tienes maletín para entregar! Busca el maletín 💼", 3000);
      return;
    }

    // Buscar zona de entrega cercana
    for (let zone of deliveryZones) {
      if (!zone) continue;
      
      const zonePos = zone.getAbsolutePosition ? zone.getAbsolutePosition() : zone.position;
      const dist = BABYLON.Vector3.Distance(playerAgent.position, zonePos);
      
      if (dist <= DELIVERY_DISTANCE) {
        console.log("✅ Zona de entrega encontrada a distancia:", dist);
        
        // Entregar maletín
        currentBriefcase.setParent(null);
        currentBriefcase.position = zonePos.add(new BABYLON.Vector3(0, 0.4, 0));

        const idx = briefcaseSpheres.indexOf(currentBriefcase);
        if (idx !== -1) briefcaseSpheres.splice(idx, 1);

        // Actualizar estadísticas
        briefcaseCollected++;
        score += 100;
        updateHUD();

        // Efecto de partículas
        createDeliveryParticles(scene, zonePos);

        showMessage("✨ ¡ENTREGA EXITOSA! +100 puntos 🏆", 2000);

        // Resetear estado
        hasBriefcase = false;
        currentBriefcase = null;

        // Verificar victoria
        if (briefcaseCollected === totalBriefcases) {
          setTimeout(() => {
            showMessage("🚀 ¡MISIÓN COMPLETADA! OBJETIVO CUMPLIDO ✅", 3000);
            setTimeout(() => {
              showVictoryScreen();
            }, 3500);
          }, 1000);
        }

        return;
      }
    }
    
    // Si llega aquí, no hay zona de entrega cerca (no debería pasar con la nueva lógica)
    console.log("⚠️ No hay casa cerca. Distancia mínima:", DELIVERY_DISTANCE);
    showMessage("¡Acércate más a la casa modular! 🏠", 2000);
  }

  // --- SISTEMA DE PARTÍCULAS PARA ENTREGA ---
  function createDeliveryParticles(scene, position) {
    const particleSystem = new BABYLON.ParticleSystem("particles", 50, scene);
    particleSystem.particleTexture = new BABYLON.Texture("https://www.babylonjs-playground.com/textures/flare.png", scene);

    particleSystem.emitter = position;
    particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
    particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0, 0.5);

    particleSystem.color1 = new BABYLON.Color4(1, 0.9, 0, 1);
    particleSystem.color2 = new BABYLON.Color4(1, 0.8, 0.2, 1);
    particleSystem.colorDead = new BABYLON.Color4(0.8, 0.6, 0, 0);

    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.3;

    particleSystem.minLifeTime = 0.3;
    particleSystem.maxLifeTime = 0.8;

    particleSystem.emitRate = 100;

    particleSystem.blendMode = BABYLON.ParticleSystem.BLENDMODE_ONEONE;

    particleSystem.gravity = new BABYLON.Vector3(0, -2, 0);

    particleSystem.direction1 = new BABYLON.Vector3(-1, 2, -1);
    particleSystem.direction2 = new BABYLON.Vector3(1, 4, 1);

    particleSystem.minEmitPower = 1;
    particleSystem.maxEmitPower = 3;

    particleSystem.updateSpeed = 0.01;

    particleSystem.start();

    setTimeout(() => {
      particleSystem.stop();
      setTimeout(() => particleSystem.dispose(), 1000);
    }, 500);
  }

  return scene;
};

// Crear la escena
const scene = createScene();

// Renderizar la escena en loop
engine.runRenderLoop(() => {
  scene.render();
});

// Redimensionar el canvas cuando cambie el tamaño de la ventana
window.addEventListener("resize", () => {
  engine.resize();
});