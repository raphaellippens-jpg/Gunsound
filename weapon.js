const cfg = window.WEAPON_CONFIG;
const cockButton = document.querySelector("#cock");
const shootButton = document.querySelector("#shoot");
const statusText = document.querySelector("#status");

let cocked = false;
let firing = false;
let continuousAudio = null;
let audioContext = null;

function getAudioContext() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  audioContext = audioContext || new Ctx();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

// Route audio through a modest gain boost and compressor so quiet source files
// are more audible without blindly maxing the iPad's hardware volume.
function makeAudio(url, loop = false, rate = 1) {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.loop = loop;
  audio.playbackRate = rate;
  const ctx = getAudioContext();
  if (ctx && audioContext.createMediaElementSource) {
    try {
      const source = ctx.createMediaElementSource(audio);
      const compressor = ctx.createDynamicsCompressor();
      const gain = ctx.createGain();
      compressor.threshold.value = -18;
      compressor.knee.value = 16;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.18;
      gain.gain.value = 2.0;
      source.connect(compressor);
      compressor.connect(gain);
      gain.connect(ctx.destination);
    } catch (e) {
      // If a browser cannot route media through Web Audio, use normal playback.
    }
  }
  return audio;
}

function playOne(url, rate = 1) {
  const audio = makeAudio(url, false, rate);
  return audio.play().catch(() => {
    statusText.textContent = "TAP AGAIN TO ENABLE SOUND";
  });
}

function runFlashShortcut() {
  // One shared shortcut is used only by the pistol and shotgun pages.
  if (!["pistol", "shotgun"].includes(cfg.slug)) return;

  const link = document.createElement("a");
  link.href = "shortcuts://run-shortcut?name=Weapon%20Flash";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

cockButton.addEventListener("click", async () => {
  if (firing || cocked) return;
  statusText.textContent = "COCKING…";
  cockButton.disabled = true;
  await playOne(cfg.cock);
  cocked = true;
  shootButton.disabled = false;
  statusText.textContent = "READY";
  cockButton.textContent = "COCKED";
});

async function fireSingle() {
  await playOne(cfg.shot);
  statusText.textContent = "SHOT FIRED";
  runFlashShortcut();
}

async function fireRifleBurst() {
  statusText.textContent = "10-SHOT BURST";
  // Ten distinct impacts with a tight, game-like rhythm.
  for (let i = 0; i < 10; i++) {
    if (!firing) break;
    await playOne(cfg.shot);
    if (i < 9) await new Promise(r => setTimeout(r, 125));
  }
  runFlashShortcut();
}

function startContinuous() {
  firing = true;
  shootButton.textContent = "STOP FIRING";
  shootButton.classList.add("stop");
  statusText.textContent = "FIRING — TAP STOP";
  // Use distinct source loops and a slightly faster rate for the minigun.
  const rate = cfg.slug === "minigun" ? 1.22 : 1;
  continuousAudio = makeAudio(cfg.shot, true, rate);
  continuousAudio.play().catch(() => {
    statusText.textContent = "TAP AGAIN TO ENABLE SOUND";
    stopContinuous(false);
  });
}

function stopContinuous(openShortcut = false) {
  firing = false;
  if (continuousAudio) {
    continuousAudio.pause();
    continuousAudio.currentTime = 0;
    continuousAudio = null;
  }
  shootButton.textContent = "START FIRING";
  shootButton.classList.remove("stop");
  statusText.textContent = "FIRING STOPPED";
  // A web page cannot keep toggling the iPad LED while Shortcuts is in front.
  // Trigger one flash after stopping instead of stealing focus during the burst.
  if (openShortcut) runFlashShortcut();
}

shootButton.addEventListener("click", async () => {
  if (cfg.mode === "continuous") {
    if (firing) stopContinuous(true);
    else if (cocked) startContinuous();
    return;
  }
  if (!cocked || firing) return;
  firing = true;
  shootButton.disabled = true;
  cockButton.disabled = true;

  if (cfg.mode === "ten") {
    await fireRifleBurst();
  } else {
    await fireSingle();
  }

  firing = false;
  cocked = false;
  cockButton.disabled = false;
  cockButton.textContent = "COCK / READY";
  shootButton.disabled = true;
  statusText.textContent = "COCK AGAIN";
});

if (cfg.mode === "continuous") {
  // The same button toggles start/stop; cocking is still required first.
  shootButton.textContent = "START FIRING";
}