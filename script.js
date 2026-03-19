(function () {
  const page = document.body.dataset.page;
  const storageKeys = {
    entry: "blackVault.entryGranted",
    personal: "blackVault.personalUnlocked",
  };
  const sessionKeys = {
    reveal: "blackVault.playRevealHit",
  };

  const ACCESS_KEY = "ORPHEUS";
  const SUBJECT_KEY = "CAKE-404";
  const loadingMessages = [
    "Decrypting recovered route...",
    "Validating ghost handshake...",
    "Accessing secure server...",
    "Muting external observers...",
    "Rendering classified mirror..."
  ];
  const audioState = {
    ctx: null,
    master: null,
    ambienceGain: null,
    uiGain: null,
    ambienceStarted: false,
    lastTypeTick: 0,
  };
  const memoryStore = new Map();
  const storage = {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch (error) {
        return memoryStore.has(key) ? memoryStore.get(key) : null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch (error) {
        memoryStore.set(key, value);
      }
    }
  };
  const session = {
    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch (error) {
        return memoryStore.has(`session:${key}`) ? memoryStore.get(`session:${key}`) : null;
      }
    },
    set(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch (error) {
        memoryStore.set(`session:${key}`, value);
      }
    },
    remove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch (error) {
        memoryStore.delete(`session:${key}`);
      }
    }
  };
  const failSoft = (error) => {
    console.error("Black Vault runtime error:", error);
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
      overlay.classList.add("hidden");
    }
  };

  const createNoiseBuffer = (ctx, duration = 1.4) => {
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      channel[i] = (Math.random() * 2 - 1) * 0.5;
    }
    return buffer;
  };

  const ensureAudio = () => {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    if (!audioState.ctx) {
      const ctx = new AudioContext();
      const master = ctx.createGain();
      const ambienceGain = ctx.createGain();
      const uiGain = ctx.createGain();

      master.gain.value = 0.1;
      ambienceGain.gain.value = 0.045;
      uiGain.gain.value = 0.085;

      ambienceGain.connect(master);
      uiGain.connect(master);
      master.connect(ctx.destination);

      audioState.ctx = ctx;
      audioState.master = master;
      audioState.ambienceGain = ambienceGain;
      audioState.uiGain = uiGain;
      audioState.noiseBuffer = createNoiseBuffer(ctx);
    }

    if (audioState.ctx.state === "suspended") {
      audioState.ctx.resume().catch(() => {});
    }

    return audioState.ctx;
  };

  const withAudio = (callback) => {
    const ctx = ensureAudio();
    if (!ctx) return;
    callback(ctx);
  };

  const playOscillator = ({
    frequency = 440,
    endFrequency = frequency,
    duration = 0.08,
    type = "sine",
    gainValue = 0.05,
    target = "uiGain",
    attack = 0.005,
    release = 0.08,
  }) => {
    withAudio((ctx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const output = audioState[target] || audioState.uiGain;

      osc.type = type;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), ctx.currentTime + duration);

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + Math.max(duration, attack + release));

      osc.connect(gain);
      gain.connect(output);

      osc.start();
      osc.stop(ctx.currentTime + duration + release);
    });
  };

  const playNoiseBurst = ({
    duration = 0.18,
    gainValue = 0.02,
    lowpass = 1800,
    highpass = 220,
    target = "uiGain",
  }) => {
    withAudio((ctx) => {
      const source = ctx.createBufferSource();
      const gain = ctx.createGain();
      const hp = ctx.createBiquadFilter();
      const lp = ctx.createBiquadFilter();
      const output = audioState[target] || audioState.uiGain;

      source.buffer = audioState.noiseBuffer || createNoiseBuffer(ctx);
      hp.type = "highpass";
      hp.frequency.value = highpass;
      lp.type = "lowpass";
      lp.frequency.value = lowpass;

      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(gainValue, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      source.connect(hp);
      hp.connect(lp);
      lp.connect(gain);
      gain.connect(output);

      source.start();
      source.stop(ctx.currentTime + duration);
    });
  };

  const startAmbience = () => {
    const ctx = ensureAudio();
    if (!ctx || audioState.ambienceStarted) return;
    audioState.ambienceStarted = true;

    const bed = ctx.createOscillator();
    const pulse = ctx.createOscillator();
    const air = ctx.createBufferSource();
    const bedGain = ctx.createGain();
    const pulseGain = ctx.createGain();
    const airGain = ctx.createGain();
    const airLowpass = ctx.createBiquadFilter();
    const wobble = ctx.createOscillator();
    const wobbleGain = ctx.createGain();

    bed.type = "sine";
    bed.frequency.value = 58;
    pulse.type = "triangle";
    pulse.frequency.value = 116;

    bedGain.gain.value = 0.018;
    pulseGain.gain.value = 0.006;
    airGain.gain.value = 0.007;

    air.buffer = audioState.noiseBuffer || createNoiseBuffer(ctx);
    air.loop = true;
    airLowpass.type = "lowpass";
    airLowpass.frequency.value = 900;

    wobble.type = "sine";
    wobble.frequency.value = 0.17;
    wobbleGain.gain.value = 4;

    wobble.connect(wobbleGain);
    wobbleGain.connect(bed.frequency);

    bed.connect(bedGain);
    pulse.connect(pulseGain);
    air.connect(airLowpass);
    airLowpass.connect(airGain);

    bedGain.connect(audioState.ambienceGain);
    pulseGain.connect(audioState.ambienceGain);
    airGain.connect(audioState.ambienceGain);

    bed.start();
    pulse.start();
    air.start();
    wobble.start();
  };

  const playTypingTick = () => {
    const now = Date.now();
    if (now - audioState.lastTypeTick < 65) return;
    audioState.lastTypeTick = now;
    playOscillator({
      frequency: 1020,
      endFrequency: 840,
      duration: 0.025,
      type: "triangle",
      gainValue: 0.012,
      release: 0.04,
    });
  };

  const playUnlockBurst = () => {
    playNoiseBurst({ duration: 0.12, gainValue: 0.018, lowpass: 2600, highpass: 420 });
    playOscillator({
      frequency: 780,
      endFrequency: 1180,
      duration: 0.09,
      type: "sawtooth",
      gainValue: 0.016,
      release: 0.07,
    });
  };

  const playTransitionStatic = () => {
    playNoiseBurst({ duration: 0.22, gainValue: 0.012, lowpass: 1600, highpass: 340 });
  };

  const playAlertBeep = () => {
    playOscillator({
      frequency: 250,
      endFrequency: 210,
      duration: 0.12,
      type: "square",
      gainValue: 0.018,
      release: 0.08,
    });
  };

  const playRevealHit = () => {
    playOscillator({
      frequency: 110,
      endFrequency: 62,
      duration: 0.7,
      type: "sine",
      gainValue: 0.03,
      attack: 0.01,
      release: 0.35,
      target: "ambienceGain",
    });
    playOscillator({
      frequency: 220,
      endFrequency: 128,
      duration: 0.55,
      type: "triangle",
      gainValue: 0.015,
      attack: 0.01,
      release: 0.3,
    });
    playNoiseBurst({ duration: 0.35, gainValue: 0.008, lowpass: 700, highpass: 90, target: "ambienceGain" });
  };

  const playBeep = (frequency = 660, duration = 0.07, type = "square") => {
    playOscillator({
      frequency,
      endFrequency: frequency,
      duration,
      type,
      gainValue: 0.014,
      release: duration,
    });
  };

  const registerAudioUnlock = () => {
    const unlock = () => {
      ensureAudio();
      startAmbience();
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  };

  const initLoadingOverlay = () => {
    const overlay = document.getElementById("loading-overlay");
    if (!overlay) return;

    const progress = document.getElementById("loading-progress");
    const message = document.getElementById("loading-message");
    let step = 0;

    const tick = () => {
      step += 1;
      if (progress) progress.style.width = `${step * 20}%`;
      if (message) message.textContent = loadingMessages[Math.min(step - 1, loadingMessages.length - 1)];
      playBeep(500 + step * 60, 0.04, "sine");

      if (step < 5) {
        setTimeout(tick, 280);
      } else {
        setTimeout(() => overlay.classList.add("hidden"), 220);
      }
    };

    setTimeout(tick, 160);
  };

  const typeLogs = (element, logs, speed = 80) => {
    if (!element) return;
    let index = 0;

    const append = () => {
      if (index >= logs.length) return;
      const line = document.createElement("p");
      line.textContent = logs[index];
      element.appendChild(line);
      element.scrollTop = element.scrollHeight;
      if (index < 5) {
        playTypingTick();
      }
      index += 1;
      setTimeout(append, speed + Math.random() * 180);
    };

    append();
  };

  const guardPage = (requiredKey, fallback) => {
    if (!storage.get(requiredKey)) {
      window.location.href = fallback;
    }
  };

  const initEntryPage = () => {
    registerAudioUnlock();
    initLoadingOverlay();

    const params = new URLSearchParams(window.location.search);
    const hasDecodedRoute = params.has("route") || params.has("key") || window.location.hash.includes("decoded");
    const status = document.getElementById("entry-status");
    if (status) {
      status.textContent = hasDecodedRoute ? "ACCESS GRANTED" : "UNAUTHORIZED ENTRY DETECTED";
      status.classList.toggle("success", hasDecodedRoute);
    }

    const logs = [
      "[00:00:02] route packet recovered from dead drop",
      "[00:00:04] mirror node handshake accepted",
      "[00:00:06] firewall decoy engaged",
      "[00:00:08] observer telemetry archived",
      "[00:00:09] binary payload isolated",
      "[00:00:11] prompting operator for clearance token"
    ];
    typeLogs(document.getElementById("entry-log"), logs);

    const form = document.getElementById("access-form");
    const input = document.getElementById("access-code");
    const message = document.getElementById("access-message");
    if (!form || !input || !message) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim().toUpperCase();
      if (value === ACCESS_KEY) {
        storage.set(storageKeys.entry, "true");
        message.textContent = "Key accepted. Routing to database layer...";
        message.style.color = "var(--glow-strong)";
        playUnlockBurst();
        playTransitionStatic();
        setTimeout(() => {
          window.location.href = "database.html";
        }, 700);
      } else {
        message.textContent = "Invalid token. This activity has been logged.";
        message.style.color = "var(--danger)";
        playAlertBeep();
      }
    });
  };

  const initDatabasePage = () => {
    registerAudioUnlock();
    guardPage(storageKeys.entry, "index.html");
  };

  const initDeceasedPage = () => {
    registerAudioUnlock();
    guardPage(storageKeys.entry, "index.html");
    const form = document.getElementById("subject-form");
    const input = document.getElementById("subject-code");
    const message = document.getElementById("subject-message");
    if (!form || !input || !message) return;

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim().toUpperCase();
      if (value === SUBJECT_KEY) {
        storage.set(storageKeys.personal, "true");
        session.set(sessionKeys.reveal, "true");
        message.textContent = "Anomaly reopened. Decrypting personal file...";
        message.style.color = "var(--glow-strong)";
        playUnlockBurst();
        playTransitionStatic();
        setTimeout(() => {
          window.location.href = "personal-file.html";
        }, 650);
      } else {
        message.textContent = "Subject key rejected. Mortality seal remains intact.";
        message.style.color = "var(--danger)";
        playAlertBeep();
      }
    });
  };

  const initPersonalPage = () => {
    registerAudioUnlock();
    guardPage(storageKeys.personal, "dead-records.html");
    const shouldPlayReveal = session.get(sessionKeys.reveal) === "true";
    if (shouldPlayReveal) {
      session.remove(sessionKeys.reveal);
      setTimeout(() => {
        playRevealHit();
      }, 180);
    }
    const printButton = document.getElementById("print-file");
    if (printButton) {
      printButton.addEventListener("click", () => {
        playBeep(860, 0.08, "triangle");
        window.print();
      });
    }

    const joinButton = document.getElementById("join-taskforce");
    const overlay = document.getElementById("mission-overlay");
    const closeOverlay = document.getElementById("close-mission-overlay");
    const taskforceMessage = document.getElementById("taskforce-message");

    if (joinButton && overlay) {
      joinButton.addEventListener("click", () => {
        playUnlockBurst();
        if (taskforceMessage) {
          taskforceMessage.textContent = "Operator accepted. Opening taskforce brief...";
          taskforceMessage.style.color = "var(--glow-strong)";
        }
        setTimeout(() => {
          overlay.classList.remove("hidden");
        }, 240);
      });
    }

    if (closeOverlay && overlay) {
      closeOverlay.addEventListener("click", () => {
        playBeep(760, 0.06, "triangle");
        overlay.classList.add("hidden");
      });
    }
  };

  try {
    if (page === "entry") initEntryPage();
    if (page === "database") initDatabasePage();
    if (page === "deceased") initDeceasedPage();
    if (page === "personal") initPersonalPage();
  } catch (error) {
    failSoft(error);
  }
})();
