const MODULE_ID = "bgm-master";

const SETTINGS = {
  ENABLED: "overrideEnabled",
  PLAYLIST: "overridePlaylistId",
  SOUND: "overrideSoundId",
  VOLUME: "overrideVolume",
  POSITION: "remotePosition"
};

/* -------------------------------------------- */
/*  Playback helpers                             */
/* -------------------------------------------- */

function getOverrideDocs() {
  const playlistId = game.settings.get(MODULE_ID, SETTINGS.PLAYLIST);
  const soundId = game.settings.get(MODULE_ID, SETTINGS.SOUND);
  const playlist = playlistId ? game.playlists.get(playlistId) : null;
  const sound = playlist && soundId ? playlist.sounds.get(soundId) : null;
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
  const { playlist, sound } = getOverrideDocs();
  if (!playlist || !sound) return;
  if (!sound.playing) await playlist.playSound(sound);
}

async function stopOverride() {
  const { playlist, sound } = getOverrideDocs();
  if (!playlist || !sound) return;
  if (sound.playing) await playlist.stopSound(sound);
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

    const playlists = game.playlists.contents
      .map((p) => ({ id: p.id, name: p.name, selected: p.id === playlistId }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const sounds = playlist
      ? playlist.sounds
          .map((s) => ({ id: s.id, name: s.name, selected: s.id === soundId }))
          .sort((a, b) => a.name.localeCompare(b.name))
      : [];

    const activeScene = game.scenes.active;

    return {
      enabled,
      playlists,
      sounds,
      hasPlaylist: !!playlist,
      hasSelection: !!(playlist && soundId && playlist.sounds.get(soundId)),
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
  const group = controls.tokens;
  if (!group) return;
  group.tools.bgmMaster = {
    name: "bgmMaster",
    title: "BGM_MASTER.OpenRemote",
    icon: "fa-solid fa-music",
    order: Object.keys(group.tools).length,
    button: true,
    onChange: () => {
      const app = game.bgmMaster;
      if (!app) return;
      if (app.minimized) app.maximize();
      if (app.rendered) app.bringToTop();
      else app.render({ force: true });
    }
  };
});
