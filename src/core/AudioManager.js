/**
 * AudioManager - Gère la musique et les sons du jeu
 */
export class AudioManager {
    constructor() {
        this.currentMusic = null;
        this.currentTrackName = null;
        this.enabled = true;
        this.volume = 0.5;

        // Mapping des scènes vers les fichiers audio
        this.musicMap = {
            // Villes
            'bourg-palette': 'assets/music/Bourg Palette - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'jadielle': 'assets/music/Jadielle - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'argenta': 'assets/music/Jadielle - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', // Même musique que Jadielle
            
            // Routes et Nature
            'route1': 'assets/music/Route 1 - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'foretjade': 'assets/music/Forêt de Jade - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'route2': 'assets/music/Route 1 - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', // Fallback Route 1
            'route2nord': 'assets/music/Route 1 - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', // Fallback Route 1
            
            // Intérieurs
            'labo': 'assets/music/Laboratoire Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'centre': 'assets/music/Centre Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'centre-argenta': 'assets/music/Centre Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'market': 'assets/music/Centre Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', // Même musique que Centre
            'market-argenta': 'assets/music/Centre Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', // Même musique que Centre
            'maison': 'assets/music/Bourg Palette - Pokémon Lets Go PikachuLets Go Évoli OST.mp3', 
            'maisonetage': 'assets/music/Bourg Palette - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            
            // Spécial
            'title': 'assets/music/ecran de titre.mp3',
            'battle-wild': 'assets/music/Capture dun Pokémon sauvage - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'battle-trainer': 'assets/music/Combat contre un dresseur Pokémon - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'battle-gym': 'assets/music/Combat contre un champion darène - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'victory-trainer': 'assets/music/Dresseur Pokémon vaincu - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'victory-gym': 'assets/music/Badge darène obtenu - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'capture-start': 'assets/music/Capture dun Pokémon sauvage - Pokémon Lets Go PikachuLets Go Évoli OST.mp3',
            'capture-success': 'assets/music/Capture réussie - Pokémon Lets Go PikachuLets Go Évoli OST.mp3'
        };

        // Sons préchargés (optionnel, pour l'instant on stream la musique)
        this.sounds = {};
    }

    /**
     * Joue une musique basée sur le nom de la scène ou une clé spéciale
     * @param {string} trackKey - Nom de la scène ou clé (ex: 'battle-wild')
     * @param {boolean} forceRestart - Si true, redémarre même si c'est la même piste
     */
    playSound(soundName) {
        if (!this.enabled) return;
        // TODO: Implement sound effects
    }

    /**
     * Joue une musique basée sur le nom de la scène ou une clé spéciale
     * @param {string} trackKey - Nom de la scène ou clé (ex: 'battle-wild')
     * @param {boolean} forceRestart - Si true, redémarre même si c'est la même piste
     * @param {boolean} loop - Si true, la musique tourne en boucle (défaut true)
     */
    playMusic(trackKey, forceRestart = false, loop = true) {
        console.log(`[AudioManager] playMusic called for: "${trackKey}" (loop=${loop})`);
        if (!this.enabled) {
            console.log("[AudioManager] Disabled");
            return;
        }

        // Gestion des alias ou fallbacks
        let file = this.musicMap[trackKey];
        
        if (!file) {
            console.warn(`[AudioManager] ❌ No music found for key: "${trackKey}"`);
            return;
        }

        console.log(`[AudioManager] 🎵 Loading file: "${file}"`);

        // Si c'est déjà la même musique qui joue
        if (this.currentTrackName === trackKey && !forceRestart) {
            console.log(`[AudioManager] Already playing ${trackKey}`);
            return;
        }

        this.fadeOutAndPlay(file, trackKey, loop);
    }

    fadeOutAndPlay(file, trackKey, loop) {
        // Stop current music
        if (this.currentMusic) {
            const oldMusic = this.currentMusic;
            // Simple fade out simulation
            let vol = oldMusic.volume;
            const fadeInterval = setInterval(() => {
                vol -= 0.1;
                if (vol <= 0) {
                    clearInterval(fadeInterval);
                    oldMusic.pause();
                    oldMusic.currentTime = 0;
                } else {
                    oldMusic.volume = vol;
                }
            }, 100);
        }

        // Start new music
        // FIX: Encoder l'URI pour gérer les espaces et accents
        const encodedFile = encodeURI(file);
        console.log(`[AudioManager] 🎵 Creating audio from: "${encodedFile}"`);

        const audio = new Audio(encodedFile);
        audio.loop = loop;
        audio.volume = 0;

        // FIX: Log des erreurs de chargement
        audio.onerror = (e) => {
            console.error(`[AudioManager] ❌ Error loading code ${audio.error ? audio.error.code : 'unknown'} for "${file}"`, e);
        };

        const playPromise = audio.play();
        if (playPromise !== undefined) {
             playPromise.then(_ => {
                 // Fade in
                 let vol = 0;
                 const fadeInInterval = setInterval(() => {
                     vol += 0.05;
                     if (vol >= this.volume) {
                         vol = this.volume;
                         clearInterval(fadeInInterval);
                     }
                     audio.volume = vol;
                 }, 50);
             })
             .catch(error => {
                 console.warn("Autoplay prevented or audio error:", error);
                 // Add one-time interaction listener to start music
                 const startAudio = () => {
                     audio.play();
                     // Retry fade in
                     let vol = 0;
                     const fadeInInterval = setInterval(() => {
                         vol += 0.05;
                         if (vol >= this.volume) {
                             vol = this.volume;
                             clearInterval(fadeInInterval);
                         }
                         audio.volume = vol;
                     }, 50);
                     document.removeEventListener('click', startAudio);
                     document.removeEventListener('keydown', startAudio);
                 };
                 document.addEventListener('click', startAudio);
                 document.addEventListener('keydown', startAudio);
             });
        }

        this.currentMusic = audio;
        this.currentTrackName = trackKey;
    }

    handleFadeIn(audio) {
        // Fade in
        let vol = 0;
        const targetVol = this.volume;
        const fadeInInterval = setInterval(() => {
            if (!this.currentMusic || this.currentMusic !== audio) {
                clearInterval(fadeInInterval);
                return;
            }
            
            vol += 0.05;
            if (vol >= targetVol) {
                vol = targetVol;
                clearInterval(fadeInInterval);
            }
            audio.volume = vol;
        }, 100);
    }

    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic = null;
            this.currentTrackName = null;
        }
    }

    playEffect(effectKey) {
        if (!this.enabled) return;
        const file = this.musicMap[effectKey];
        if (file) {
            const audio = new Audio(file);
            audio.volume = this.volume;
            audio.play().catch(e => console.warn("Audio effect blocked:", e));
            return audio; 
        }
    }
}
