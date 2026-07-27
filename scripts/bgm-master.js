const MODULE_ID = "bgm-master";
const RANDOM_VALUE = "__random__";

const SETTINGS = {
  ENABLED: "overrideEnabled",
  PLAYLIST: "overridePlaylistId",
  SOUND: "overrideSoundId",
  CURRENT_RANDOM: "overrideCurrentRandomId",
  VOLUME: "overrideVolume",
  POSITION: "remotePosition"
};

/* -------------------------------------------- */
/*  Playback helpers                             */
/* -------------------------------------------- */

// Set to true while we intentionally stop the override sound ourselves, so the
// "auto-advance to another random track" listener doesn't also fire for it.
let autoAdvanceGuard = false;

function isRandomMode() {
  return game.settings.get(MODULE_ID, SETTINGS.SOUND) === RANDOM_VALUE;
}

function pickRandomSound(playlist, excludeId) {
  const all = playlist.sounds.contents;
  const pool = excludeId ? all.filter((s) => s.id !== excludeId) : all;
  const candidates = pool.length ? pool : all;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function getOverrideDocs() {
  const playlistId = game.settings.get(MODULE_ID, SETTINGS.PLAYLIST);
  const playlist = playlistId ? game.playlists.get(playlistId) : null;
  if (!playlist) return { playlist: null, sound: null };
  if (isRandomMode()) {
    const currentId = game.settings.get(MODULE_ID, SETTINGS.CURRENT_RANDOM);
    const sound = currentId ? playlist.sounds.get(currentId) : null;
    return { playlist, sound };
  }
  const soundId = game.settings.get(MODULE_ID, SETTINGS.SOUND);
  const sound = soundId ? playlist.sounds.get(soundId) : null;
  return { playlist, sound };
}

async function stopSceneAmbience(scene) {
  const playlist = scene?.playlist;
  if (playlist?.playing) await playlist.stopAll();
}

async function resumeSceneAmbience(scene) {
  const playlist = scene?.playlist;
  if (!playlist) return;
  const sound = scene.playlistSound ? playlist.sounds.get(scene.playlistSound) : null;
  if (sound) {
    if (!sound.playing) await playlist.playSound(sound);
  } else if (playlist.mode !== CONST.PLAYLIST_MODES.DISABLED) {
    if (!playlist.playing) await playlist.playAll();
  }
}

async function playOverride() {
  const playlistId = game.settings.get(MODULE_ID, SETTINGS.PLAYLIST);
  const playlist = playlistId ? game.playlists.get(playlistId) : null;
  if (!playlist || !playlist.sounds.size) return;

  if (isRandomMode()) {
    const pick = pickRandomSound(playlist);
    await game.settings.set(MODULE_ID, SETTINGS.CURRENT_RANDOM, pick.id);
    if (!pick.playing) await playlist.playSound(pick);
    return;
  }

  const soundId = game.settings.get(MODULE_ID, SETTINGS.SOUND);
  const sound = soundId ? playlist.sounds.get(soundId) : null;
  if (!sound) return;
  if (!sound.playing) await playlist.playSound(sound);
}

async function playNextRandom() {
  const playlistId = game.settings.get(MODULE_ID, SETTINGS.PLAYLIST);
  const playlist = playlistId ? game.playlists.get(playlistId) : null;
  if (!playlist || !playlist.sounds.size) return;
  const currentId = game.settings.get(MODULE_ID, SETTINGS.CURRENT_RANDOM);
  const pick = pickRandomSound(playlist, currentId);
  await game.settings.set(MODULE_ID, SETTINGS.CURRENT_RANDOM, pick.id);
  await playlist.playSound(pick);
}

async function stopOverride() {
  const { playlist, sound } = getOverrideDocs();
  if (!playlist || !sound) return;
  autoAdvanceGuard = true;
  try {
    if (sound.playing) await playlist.stopSound(sound);
  } finally {
    autoAdvanceGuard = false;
  }
}

async function setOverrideEnabled(enabled) {
  if (!game.user.isGM) return;
  const scene = game.scenes.active;
  await game.settings.set(MODULE_ID, SETTINGS.ENABLED, enabled);
  if (enabled) {
    await stopSceneAmbience(scene);
    await playOverride();
  } else {
    await stopOverride();
    await resumeSceneAmbience(scene);
  }
}

/* -------------------------------------------- */
/*  Floating remote (GM only)                    */
/* -------------------------------------------- */

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class BGMMasterRemote extends HandlebarsApplicationMixin(ApplicationV2) {
  constructor(options = {}) {
    const stored = game.settings.get(MODULE_ID, SETTINGS.POSITION) ?? {};
    super(foundry.utils.mergeObject({ position: stored }, options, { inplace: false }));
  }

  static DEFAULT_OPTIONS = {
    id: "bgm-master-remote",
    classes: ["bgm-master-remote"],
    tag: "div",
    window: {
      title: "BGM_MASTER.RemoteTitle",
      icon: "fa-solid fa-music",
      resizable: true,
      minimizable: true,
      positioned: true
    },
    position: {
      width: 320,
      height: "auto",
      left: 120,
      top: 120
    }
  };

  static PARTS = {
    body: {
      template: `modules/${MODULE_ID}/templates/remote.hbs`
    }
  };

  async _prepareContext(_options) {
    const enabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
    const playlistId = game.settings.get(MODULE_ID, SETTINGS.PLAYLIST);
    const soundId = game.settings.get(MODULE_ID, SETTINGS.SOUND);
    const volume = game.settings.get(MODULE_ID, SETTINGS.VOLUME);
    const playlist = playlistId ? game.playlists.get(playlistId) : null;
    const isRandom = soundId === RANDOM_VALUE;

    const playlists = game.playlists.contents
      .map((p) => ({ id: p.id, name: p.name, selected: p.id === playlistId }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const sounds = playlist
      ? playlist.sounds.contents
          .map((s) => ({ id: s.id, name: s.name, selected: !isRandom && s.id === soundId }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const activeScene = game.scenes.active;
    const currentRandomId = game.settings.get(MODULE_ID, SETTINGS.CURRENT_RANDOM);
    const currentRandomName = isRandom ? playlist?.sounds.get(currentRandomId)?.name ?? null : null;

    return {
      enabled,
      playlists,
      sounds,
      isRandom,
      currentRandomName,
      hasPlaylist: !!playlist,
      hasSelection: !!(playlist && ((isRandom && playlist.sounds.size) || (soundId && playlist.sounds.get(soundId)))),
      volume: Math.round(volume * 100),
      sceneName: activeScene?.name ?? game.i18n.localize("BGM_MASTER.NoActiveScene")
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const el = this.element;
    el.querySelector('[data-action="toggle"]')?.addEventListener("change", this.#onToggle.bind(this));
    el.querySelector('[name="playlist"]')?.addEventListener("change", this.#onSelectPlaylist.bind(this));
    el.querySelector('[name="sound"]')?.addEventListener("change", this.#onSelectSound.bind(this));
    el.querySelector('[name="volume"]')?.addEventListener("input", this.#onVolumeChange.bind(this));
  }

  async #onToggle(event) {
    const enabled = event.currentTarget.checked;
    await setOverrideEnabled(enabled);
    this.render();
  }

  async #onSelectPlaylist(event) {
    const wasEnabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
    if (wasEnabled) await stopOverride();
    await game.settings.set(MODULE_ID, SETTINGS.PLAYLIST, event.currentTarget.value);
    await game.settings.set(MODULE_ID, SETTINGS.SOUND, "");
    this.render();
  }

  async #onSelectSound(event) {
    const wasEnabled = game.settings.get(MODULE_ID, SETTINGS.ENABLED);
    if (wasEnabled) await stopOverride();
    await game.settings.set(MODULE_ID, SETTINGS.SOUND, event.currentTarget.value);
    if (wasEnabled) await playOverride();
    this.render();
  }

  async #onVolumeChange(event) {
    const volume = Number(event.currentTarget.value) / 100;
    await game.settings.set(MODULE_ID, SETTINGS.VOLUME, volume);
    const { sound } = getOverrideDocs();
    if (sound) await sound.update({ volume });
  }

  setPosition(position) {
    const result = super.setPosition(position);
    this.#savePosition();
    return result;
  }

  #savePosition = foundry.utils.debounce(() => {
    const { left, top, width, height } = this.position;
    game.settings.set(MODULE_ID, SETTINGS.POSITION, { left, top, width, height });
  }, 500);

  async close(options = {}) {
    if (!options.bgmForce) return this.minimize();
    return super.close(options);
  }
}

/* -------------------------------------------- */
/*  Setup                                        */
/* -------------------------------------------- */

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, SETTINGS.ENABLED, {
    scope: "world",
    config: false,
    type: Boolean,
    default: false
  });
  game.settings.register(MODULE_ID, SETTINGS.PLAYLIST, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.SOUND, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.CURRENT_RANDOM, {
    scope: "world",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, SETTINGS.VOLUME, {
    scope: "world",
    config: false,
    type: Number,
    default: 0.8
  });
  game.settings.register(MODULE_ID, SETTINGS.POSITION, {
    scope: "client",
    config: false,
    type: Object,
    default: { left: 120, top: 120, width: 320, height: "auto" }
  });
});

Hooks.once("ready", async () => {
  if (!game.user.isGM) return;

  game.bgmMaster = new BGMMasterRemote();
  await game.bgmMaster.render({ force: true });

  // Server restarts / reconnects: make sure actual playback matches the stored toggle state.
  if (game.settings.get(MODULE_ID, SETTINGS.ENABLED)) {
    const { sound } = getOverrideDocs();
    if (sound && !sound.playing) await playOverride();
  }
});

// While the override is set to random/shuffle playback, chain to another
// random track from the same playlist whenever the current one finishes on its own.
Hooks.on("updatePlaylistSound", async (sound, changes) => {
  if (!game.user.isGM) return;
  if (autoAdvanceGuard) return;
  if (!("playing" in changes) || changes.playing !== false) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLED)) return;
  if (!isRandomMode()) return;
  const currentId = game.settings.get(MODULE_ID, SETTINGS.CURRENT_RANDOM);
  if (sound.id !== currentId) return;
  await playNextRandom();
});

Hooks.on("updateSetting", (setting) => {
  if (!setting.key?.startsWith(`${MODULE_ID}.`)) return;
  if (game.bgmMaster?.rendered) game.bgmMaster.render();
});

// If the GM activates a different scene while the override is on, keep the override
// playing instead of letting the new scene's own ambience start underneath it.
Hooks.on("updateScene", async (scene, changes) => {
  if (!game.user.isGM) return;
  if (!changes.active) return;
  if (!game.settings.get(MODULE_ID, SETTINGS.ENABLED)) return;
  await stopSceneAmbience(scene);
  await playOverride();
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  // v12 passes an array of SceneControl groups (not the v13+ keyed object).
  const group = controls.find((c) => c.name === "token");
  if (!group) return;
  group.tools.push({
    name: "bgmMaster",
    title: "BGM_MASTER.OpenRemote",
    icon: "fa-solid fa-music",
    visible: true,
    button: true,
    onClick: () => {
      const app = game.bgmMaster;
      if (!app) return;
      if (app.minimized) app.maximize();
      if (app.rendered) app.bringToTop();
      else app.render({ force: true });
    }
  });
});
