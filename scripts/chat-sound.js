// Chat notification sound: when a chat message arrives, each client plays a random track
// from a chosen playlist (replaces the Bing Bong! module, which sets the sound at render time
// and no longer makes a sound on Foundry 14).
//
// - Normal messages: playlist "chatSoundPlaylist" (world). Empty = off.
// - Roll messages: playlist "chatSoundRollPlaylist" (world). Empty = off (the dice sound still plays).
// - Each player can mute it for themselves: "chatSoundEnabled" (client).
// - On first load the world settings are copied from Bing Bong!'s saved settings, if any.
const MODULE_ID = "bgm-master";
const KEYS = {
  PLAYLIST: "chatSoundPlaylist",
  ROLL_PLAYLIST: "chatSoundRollPlaylist",
  ENABLED: "chatSoundEnabled",
  MIGRATED: "chatSoundMigrated"
};

function pickSound(playlistName) {
  const name = String(playlistName ?? "").trim();
  if (!name) return null;
  const playlist = game.playlists.getName(name);
  const sounds = playlist ? [...playlist.sounds] : [];
  if (!sounds.length) return null;
  return sounds[Math.floor(Math.random() * sounds.length)];
}

function playFor(message) {
  if (!game.settings.get(MODULE_ID, KEYS.ENABLED)) return;
  if (game.modules.get("bing-bong")?.active) return; // the old module is still on: do not ring twice
  if (!message.visible) return; // a whisper meant for someone else
  const isRoll = message.isRoll;
  if (!isRoll && message.sound) return; // the message already brings its own sound
  const sound = pickSound(game.settings.get(MODULE_ID, isRoll ? KEYS.ROLL_PLAYLIST : KEYS.PLAYLIST));
  if (!sound?.path) return;
  foundry.audio.AudioHelper.play({ src: sound.path, volume: sound.volume ?? 1, loop: false, channel: "interface" }, false);
}

/** Copy Bing Bong!'s saved playlist names once (only the GM writes world settings). */
async function migrateFromBingBong() {
  if (!game.user.isGM || game.settings.get(MODULE_ID, KEYS.MIGRATED)) return;
  const stored = (key) => game.settings.storage.get("world")?.find((s) => s.key === `bing-bong.${key}`)?.value;
  const parse = (v) => {
    if (v === undefined || v === null) return "";
    try {
      return String(JSON.parse(v) ?? "");
    } catch (err) {
      return String(v);
    }
  };
  const normal = parse(stored("playlist.normal"));
  const rolls = parse(stored("playlist.rolls"));
  // Bing Bong!'s roll sounds were off unless a player chose a mode, so only carry the normal playlist.
  if (normal && !game.settings.get(MODULE_ID, KEYS.PLAYLIST)) await game.settings.set(MODULE_ID, KEYS.PLAYLIST, normal);
  if (rolls) console.log(`${MODULE_ID} | Bing Bong! roll playlist "${rolls}" was not copied (roll sounds were off by default)`);
  await game.settings.set(MODULE_ID, KEYS.MIGRATED, true);
}

export function registerChatSound() {
  Hooks.once("init", () => {
    game.settings.register(MODULE_ID, KEYS.PLAYLIST, {
      name: "BGM_MASTER.ChatSound.PlaylistName",
      hint: "BGM_MASTER.ChatSound.PlaylistHint",
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
    game.settings.register(MODULE_ID, KEYS.ROLL_PLAYLIST, {
      name: "BGM_MASTER.ChatSound.RollPlaylistName",
      hint: "BGM_MASTER.ChatSound.RollPlaylistHint",
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
    game.settings.register(MODULE_ID, KEYS.ENABLED, {
      name: "BGM_MASTER.ChatSound.EnabledName",
      hint: "BGM_MASTER.ChatSound.EnabledHint",
      scope: "client",
      config: true,
      type: Boolean,
      default: true
    });
    game.settings.register(MODULE_ID, KEYS.MIGRATED, { scope: "world", config: false, type: Boolean, default: false });
  });
  Hooks.once("ready", () => migrateFromBingBong().catch((err) => console.warn(`${MODULE_ID} | chat sound migration failed`, err)));
  Hooks.on("createChatMessage", (message) => {
    try {
      playFor(message);
    } catch (err) {
      console.warn(`${MODULE_ID} | chat sound failed`, err);
    }
  });
}
