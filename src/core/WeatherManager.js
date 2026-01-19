
import * as THREE from "three";

export class WeatherManager {
  constructor(game) {
    this.game = game;
    this.scene = null;
    this.camera = null; // Reference to camera for following (stars/rain)

    // Time cycle (0 to 1)
    // 0 = Midnight, 0.25 = Sunrise, 0.5 = Noon, 0.75 = Sunset
    this.time = 0.45; // Start at morning
    this.dayDuration = 600; // Seconds for a full day (10 minutes)
    this.isPlaying = true;

    // Celestial bodies
    this.sunLight = null;
    this.moonLight = null;
    this.sunMesh = null;
    this.moonMesh = null;
    this.starField = null;

    // Weather particles
    this.clouds = [];
    this.rainSystem = null;
    this.shootingStars = [];

    // Weather states: "CLEAR", "CLOUDY", "RAIN", "STORM"
    this.weatherState = "CLEAR";
    this.weatherTimer = 0;
    this.timeToNextWeather = 120; // Change weather every 2 mins

    // Eclipse
    this.isEclipse = false;

    // Tiime speed
    this.timeSpeed = 1.0;

    // Colors
    this.skyColors = {
      midnight: new THREE.Color(0x000010),
      sunrise: new THREE.Color(0xff9955),
      day: new THREE.Color(0x87ceeb),
      sunset: new THREE.Color(0xff5533),
      eclipse: new THREE.Color(0x110022)
    };
  }

  init(scene, camera) {
    this.scene = scene;
    this.camera = camera;

    this.createLights();
    this.createCelestialBodies();
    this.createStars();
    this.createClouds();
    this.createRain();
    this.setupInputListeners();

    console.log("☀️ WeatherManager initialized");
  }

  setupInputListeners() {
      window.addEventListener('keydown', (e) => {
          // Only respond if not typing in an input
          if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

          switch(e.code) {
              case 'NumpadAdd':
                  this.timeSpeed *= 2;
                  this.showNotification(`Vitesse temps: x${this.timeSpeed}`);
                  break;
              case 'NumpadSubtract':
                  this.timeSpeed /= 2;
                  this.showNotification(`Vitesse temps: x${this.timeSpeed}`);
                  break;
              case 'NumpadDivide':
                  this.timeSpeed = 1.0;
                  this.showNotification(`Vitesse temps: Normal`);
                  break;
              case 'Numpad0':
                  this.isEclipse = !this.isEclipse;
                  this.showNotification(this.isEclipse ? "🌑 Éclipse ACTIVÉE" : "🌕 Éclipse DÉSACTIVÉE");
                  break;
              case 'Numpad1':
                  this.setWeather("CLEAR");
                  this.showNotification("Météo: Dégagé");
                  break;
              case 'Numpad2':
                  this.setWeather("CLOUDY");
                  this.showNotification("Météo: Nuageux");
                  break;
              case 'Numpad3':
                  this.setWeather("RAIN");
                  this.showNotification("Météo: Pluie");
                  break;
              case 'Numpad4':
                  this.setWeather("STORM");
                  this.showNotification("Météo: Orage");
                  break;
              case 'Numpad7': 
                  this.time = 0.25; // Matin
                  this.showNotification("Temps: Matin");
                  break;
              case 'Numpad8':
                  this.time = 0.5; // Midi
                  this.showNotification("Temps: Midi");
                  break;
              case 'Numpad9':
                  this.time = 0.0; // Minuit
                  this.showNotification("Temps: Minuit");
                  break;
          }
      });
  }

  showNotification(msg) {
      console.log(msg);
      if (this.game && this.game.ui) {
          this.game.ui.showNotification(msg);
      }
  }

  createLights() {
    // Sun Light
    this.sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 500;
    this.sunLight.shadow.camera.left = -100;
    this.sunLight.shadow.camera.right = 100;
    this.sunLight.shadow.camera.top = 100;
    this.sunLight.shadow.camera.bottom = -100;
    this.scene.add(this.sunLight);

    // Moon Light
    this.moonLight = new THREE.DirectionalLight(0x4444ff, 0.3);
    this.moonLight.castShadow = true;
    this.scene.add(this.moonLight);

    // Ambient
    this.ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(this.ambientLight);
  }

  createCelestialBodies() {
    // Sun Mesh (Bigger + No Fog)
    const sunGeo = new THREE.SphereGeometry(15, 32, 32);
    const sunMat = new THREE.MeshBasicMaterial({ 
        color: 0xffffaa,
        fog: false // IMPORTANT: Ignore fog
    });
    this.sunMesh = new THREE.Mesh(sunGeo, sunMat);
    this.scene.add(this.sunMesh);

    // Moon Mesh (Bigger + No Fog)
    const moonGeo = new THREE.SphereGeometry(10, 32, 32);
    const moonMat = new THREE.MeshBasicMaterial({ 
        color: 0xeeeeff,
        fog: false // IMPORTANT: Ignore fog
    });
    this.moonMesh = new THREE.Mesh(moonGeo, moonMat);
    this.scene.add(this.moonMesh);
  }

  createStars() {
    const starGeo = new THREE.BufferGeometry();
    const starCount = 3000;
    const pos = new Float32Array(starCount * 3);
    
    // Create a sphere of stars
    for(let i=0; i<starCount; i++) {
        const r = 400 + Math.random() * 100;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        
        pos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        pos[i*3+2] = r * Math.cos(phi);
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const starMat = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 1.5,
        transparent: true,
        opacity: 0,
        fog: false // IMPORTANT: Ignore fog
    });

    this.starField = new THREE.Points(starGeo, starMat);
    this.scene.add(this.starField);
  }

  createRain() {
      // Use LineSegments for "streak" effect
      const rainCount = 10000;
      const rainGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(rainCount * 2 * 3); // 2 vertices per line
      
      this.rainVelocities = [];

      for(let i=0; i<rainCount; i++) {
          const x = (Math.random() - 0.5) * 100;
          const y = Math.random() * 80;
          const z = (Math.random() - 0.5) * 100;
          
          // Top vertex
          positions[i*6] = x;
          positions[i*6+1] = y;
          positions[i*6+2] = z;
          
          // Bottom vertex (streak length)
          positions[i*6+3] = x;
          positions[i*6+4] = y - 0.8; // Length of rain drop
          positions[i*6+5] = z;

          this.rainVelocities.push(20 + Math.random() * 10);
      }
      
      rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      
      const rainMat = new THREE.LineBasicMaterial({
          color: 0xaaccff,
          transparent: true,
          opacity: 0.6,
          fog: true // Rain should be affected by fog
      });
      
      this.rainSystem = new THREE.LineSegments(rainGeo, rainMat);
      this.rainSystem.visible = false;
      this.scene.add(this.rainSystem);
  }

  createClouds() {
    // Increase count and variety
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1);
    const cloudMat = new THREE.MeshStandardMaterial({ 
        color: 0xffffff, 
        transparent: true, 
        opacity: 0.8,
        flatShading: true
    });

    const cloudCount = 300; // MUCH MORE CLOUDS
    for(let i=0; i<cloudCount; i++) {
        const scaleX = 15 + Math.random() * 30; // Bigger
        const scaleY = 4 + Math.random() * 8;
        const scaleZ = 8 + Math.random() * 15;

        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        // Initial random position relative to origin
        cloud.position.set(
            (Math.random() - 0.5) * 800, // Wider area
            70 + Math.random() * 50,     // Higher
            (Math.random() - 0.5) * 800
        );
        cloud.scale.set(scaleX, scaleY, scaleZ);
        
        cloud.userData = { 
            speed: 2 + Math.random() * 8,
            baseY: cloud.position.y 
        };
        
        this.scene.add(cloud);
        this.clouds.push(cloud);
    }
  }

  changeWeather() {
      const rand = Math.random();
      const previous = this.weatherState;
      
      if (rand < 0.6) this.setWeather("CLEAR");
      else if (rand < 0.8) this.setWeather("CLOUDY");
      else if (rand < 0.95) this.setWeather("RAIN");
      else this.setWeather("STORM");
      
      console.log(`🌦️ Weather changed: ${previous} -> ${this.weatherState}`);
  }

  setWeather(type) {
      this.weatherState = type;
      
      // Rain visibility
      if (this.rainSystem) {
          this.rainSystem.visible = (type === "RAIN" || type === "STORM");
      }
      
      // Cloud density logic
      // CLEAR: 20% visible
      // CLOUDY: 80% visible
      // RAIN/STORM: 100% visible
      
      let visibilityChance = 0.2;
      if (type === "CLOUDY") visibilityChance = 0.8;
      if (type === "RAIN" || type === "STORM") visibilityChance = 1.0;

      this.clouds.forEach((c) => {
          c.visible = Math.random() < visibilityChance;
      });
      
      // Force immediate color update
      this.updateSkyColor();
  }

  update(deltaTime, playerPosition) {
    if(!this.isPlaying || !this.scene) return;

    // Use player position or default to 0
    const px = playerPosition ? playerPosition.x : 0;
    const py = playerPosition ? playerPosition.y : 0;
    const pz = playerPosition ? playerPosition.z : 0;

    // Update time
    const prevTime = this.time;
    this.time += (deltaTime * this.timeSpeed) / this.dayDuration;
    if (this.time >= 1) {
        this.time = 0;
        this.checkEclipse();
    }

    // Eclipse logic
    if (this.isEclipse && Math.abs(this.time - 0.5) > 0.1) {
       // ... logic
    }
    
    // Angle: 0 = Midnight (-PI/2), 0.5 = Noon (PI/2)
    const theta = (this.time - 0.25) * Math.PI * 2;
    
    // Orbit radius
    const radius = 300; 

    // Sun movement (Orbit around PLAYER)
    const sunRelX = Math.cos(theta) * radius;
    const sunRelY = Math.sin(theta) * radius;
    const sunRelZ = -50; 
    
    if (this.sunLight && this.sunMesh) {
        // Position relative to player
        this.sunLight.position.set(px + sunRelX, py + sunRelY, pz + sunRelZ); 
        this.sunMesh.position.copy(this.sunLight.position);
        
        this.sunLight.target.position.set(px, py, pz);
        this.sunLight.target.updateMatrixWorld();
        
        // Intensity
        const intensity = Math.max(0, Math.sin(theta));
        this.sunLight.intensity = this.isEclipse ? 0.05 : intensity * 1.8;
    }

    // Moon movement (Opposite)
    if (this.moonLight && this.moonMesh) {
        this.moonLight.position.set(px - sunRelX, py - sunRelY, pz - sunRelZ);
        this.moonMesh.position.copy(this.moonLight.position);
        
        this.moonLight.target.position.set(px, py, pz);
        this.moonLight.target.updateMatrixWorld();

        // Moon intensity
        const moonIntensity = Math.max(0, -Math.sin(theta));
        this.moonLight.intensity = moonIntensity * 0.4;
    }

    // Update Sky Color
    this.updateSkyColor();

    // Stars opacity
    if (this.starField) {
        const sunHeight = Math.sin(theta);
        let starOpacity = 0;
        if (sunHeight < 0.1) {
            starOpacity = Math.min(1, (0.1 - sunHeight) * 2);
        }
        if (this.isEclipse && Math.abs(this.time - 0.5) < 0.15) {
            starOpacity = 1.0; 
        }

        this.starField.material.opacity = starOpacity;
        this.starField.position.set(px, py, pz);
    }

    // Cloud logic
    this.clouds.forEach(cloud => {
        // Move cloud
        cloud.position.x += cloud.userData.speed * deltaTime;

        // Wrap around player X
        const distLimit = 400;
        if (cloud.position.x > px + distLimit) cloud.position.x -= 2 * distLimit;
        if (cloud.position.x < px - distLimit) cloud.position.x += 2 * distLimit;
        
        // Wrap around player Z 
        if (cloud.position.z > pz + distLimit) cloud.position.z -= 2 * distLimit;
        if (cloud.position.z < pz - distLimit) cloud.position.z += 2 * distLimit;

        // Lighting on clouds
        const sunHeight = Math.sin(theta);
        let brightness = Math.max(0.3, sunHeight); // Minimum brightness 0.3
        if (this.isEclipse && Math.abs(this.time - 0.5) < 0.1) brightness = 0.1;
        if (this.weatherState === "RAIN" || this.weatherState === "STORM") brightness *= 0.4;
        
        cloud.material.color.setScalar(brightness);
    });

    // Rain logic
    if (this.rainSystem && this.rainSystem.visible) {
        const positions = this.rainSystem.geometry.attributes.position.array;
        
        this.rainSystem.position.set(px, py, pz);

        const boxSize = 60; // Rain box around player +/- 30

        for(let i=0; i<positions.length / 6; i++) {
            const vel = this.rainVelocities[i] * deltaTime;
            
            // Move Y down
            positions[i*6 + 1] -= vel; // Top Y
            positions[i*6 + 4] -= vel; // Bottom Y

            // Reset if below floor
            if (positions[i*6+1] < -10) {
                const newY = 40 + Math.random() * 20;
                positions[i*6 + 1] = newY;
                positions[i*6 + 4] = newY - 0.8;
                
                const newX = (Math.random() - 0.5) * boxSize * 2;
                const newZ = (Math.random() - 0.5) * boxSize * 2;
                
                positions[i*6] = newX;
                positions[i*6+3] = newX;
                positions[i*6+2] = newZ;
                positions[i*6+5] = newZ;
            }
        }
        this.rainSystem.geometry.attributes.position.needsUpdate = true;
    }

    // Weather change timer
    this.weatherTimer += deltaTime * this.timeSpeed;
    if (this.weatherTimer > this.timeToNextWeather) {
        this.changeWeather();
        this.weatherTimer = 0;
    }

    this.handleShootingStars(deltaTime);
  }

  updateSkyColor() {
      // Simple gradient logic
      let targetColor;
      
      // 0 = Midnight, 0.25 = Sunrise, 0.5 = Noon, 0.75 = Sunset
      if (this.isEclipse) {
          targetColor = this.skyColors.eclipse;
      } else if (this.time < 0.20) { // Night
          targetColor = this.skyColors.midnight;
      } else if (this.time < 0.30) { // Sunrise
          const t = (this.time - 0.20) / 0.10;
          targetColor = this.skyColors.midnight.clone().lerp(this.skyColors.sunrise, t);
      } else if (this.time < 0.70) { // Day
          const t = (this.time - 0.30) / 0.40;
          // Interpolate Sunrise -> Day -> Sunset
          if (t < 0.2) targetColor = this.skyColors.sunrise.clone().lerp(this.skyColors.day, t * 5);
          else if (t > 0.8) targetColor = this.skyColors.day.clone().lerp(this.skyColors.sunset, (t - 0.8) * 5);
          else targetColor = this.skyColors.day;
      } else if (this.time < 0.80) { // Sunset
          const t = (this.time - 0.70) / 0.10;
          targetColor = this.skyColors.sunset.clone().lerp(this.skyColors.midnight, t);
      } else { // Night
          targetColor = this.skyColors.midnight;
      }
      
      // Weather Overrides (Darken sky for storm/rain to hide blue sky)
      if (this.weatherState === 'STORM') {
           const stormColor = new THREE.Color(0x111115); // Very dark grey
           targetColor.lerp(stormColor, 0.95);
      } else if (this.weatherState === 'RAIN') {
           const rainColor = new THREE.Color(0x445566); // Grey-blue
           targetColor.lerp(rainColor, 0.8);
      } else if (this.weatherState === 'CLOUDY') {
           const cloudyColor = new THREE.Color(0x8899aa); // Greyish
           targetColor.lerp(cloudyColor, 0.6);
      }

      if (this.scene.background instanceof THREE.Color) {
          this.scene.background.lerp(targetColor, 0.05);
      } else {
        this.scene.background = targetColor;
      }
      
      // Update fog to match sky and weather conditions
      if (this.scene.fog) {
          this.scene.fog.color.copy(this.scene.background);
          
          let targetNear = 50;
          let targetFar = 400;

          if (this.weatherState === 'STORM') {
             targetNear = 10;
             targetFar = 150; // Very close fog
          } else if (this.weatherState === 'RAIN') {
             targetNear = 20;
             targetFar = 250;
          }

          // Smoothly transition fog values
          this.scene.fog.near += (targetNear - this.scene.fog.near) * 0.05;
          this.scene.fog.far += (targetFar - this.scene.fog.far) * 0.05;
      }
  }

  handleShootingStars(dt) {
      // Update existing
      for (let i = this.shootingStars.length - 1; i >= 0; i--) {
          const s = this.shootingStars[i];
          s.mesh.position.add(s.velocity.clone().multiplyScalar(dt));
          s.life -= dt;
          s.mesh.material.opacity = s.life; // Fade out
          if (s.life <= 0) {
              this.scene.remove(s.mesh);
              s.mesh.geometry.dispose();
              s.mesh.material.dispose();
              this.shootingStars.splice(i, 1);
          }
      }

      // Only at night
      const isNight = this.time < 0.2 || this.time > 0.8;
      if (!isNight) return;

      if (Math.random() < 0.005) { // Small chance
          this.createShootingStar();
      }
  }

  createShootingStar() {
      // Implementation placeholder for FX
      if (!this.starField) return;
      
      const star = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      
      // Spawn random position high up
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 50;
      star.position.set(
          Math.cos(angle) * radius,
          60 + Math.random() * 20,
          Math.sin(angle) * radius
      );
      
      // Trajectory
      const target = new THREE.Vector3(
          star.position.x + (Math.random() - 0.5) * 50,
          star.position.y - 40,
          star.position.z + (Math.random() - 0.5) * 50
      );
      
      // Animate
      // For now just add to scene and remove later? 
      // Need a list of active shooting stars to update in update() loop
      // Simplified:
      this.shootingStars.push({ mesh: star, velocity: target.sub(star.position).normalize().multiplyScalar(50), life: 1.0 });
      this.scene.add(star);
  }

  checkEclipse() {
      // 5% chance of eclipse each day
      this.isEclipse = (Math.random() < 0.05);
      if (this.isEclipse) {
          console.log("🌑 ECLIPSE SCHEDULED FOR TODAY!");
          if (this.game && this.game.ui) {
              this.game.ui.showNotification("Une éclipse solaire est prévue aujourd'hui...", "warning");
          }
      }
  }
}
