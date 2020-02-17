import Emitter from "./src/emitter.js";
import Store from "./src/store.js";
import SharedQueue from "./src/queue.js";

// generic

const shortenHash = (hash) => hash.substr(0, 6) + ".." + hash.substr(-6);

// setup

const REQUEST_QUEUE_TIMEOUT = 500; // 5000;
const ACCEPTED_MEDIA_FORMATS = ["mp3"];
const COLOURS = ["red", "purple", "green", "orange", "magenta", "blue", "teal", "lime"];

const EMITTER = new Emitter();
const STORE = new Store({
  onSet: (key, value) => EMITTER.trigger(`set:${key}`, value)
});

let ARCHIVE;
let SHARED_QUEUE;
let PLAYING = false;
let COLOUR = COLOURS[Math.floor(Math.random() * COLOURS.length)];
let TEMPORARY_START_TIME;

// wiring

const ELEMENTS = {};
ELEMENTS.body = () => document.body;
ELEMENTS.archiveButton = () => document.querySelector("#create-archive");
ELEMENTS.archiveName = () => document.querySelector("#archive-name");
ELEMENTS.archiveMedia = () => document.querySelector("#archive-media");
ELEMENTS.queue = () => document.querySelector("#queue");
ELEMENTS.player = () => document.querySelector("#player");
ELEMENTS.radioIcon = () => document.querySelector("#radio-icon");
ELEMENTS.shout = () => document.querySelector("#shout");
ELEMENTS.shoutInput = () => document.querySelector("#shout-input");
ELEMENTS.user = () => document.querySelector("#user");
ELEMENTS.dropzone = () => document.querySelector("#dropzone");

// do things

const ACTIONS = {};

ACTIONS.loadPeerId = async () => {
  const peerId = await experimental.datPeers.getOwnPeerId()
  STORE.set("peerId", peerId);
}

ACTIONS.setArchive = async () => {
  const archive = await DatArchive.selectArchive({
    title: "Select an archive to store music in"
  });

  const info = await archive.getInfo();

  STORE.set("archiveKey", info.key);
}

ACTIONS.loadArchive = async () => {
  const key = STORE.get("archiveKey");
  if (key) {
    ARCHIVE = await DatArchive.load(`dat://${key}`);
    EMITTER.trigger("archive:load");
  }
}

ACTIONS.renderArchive = async () => {
  ELEMENTS.archiveButton().innerHTML = ARCHIVE
    ? "change archive"
    : "set or create archive";

  ELEMENTS.archiveName().innerHTML = ARCHIVE
    ? `Your archive is: <a href="beaker://library/${STORE.get("archiveKey")}">${shortenHash(STORE.get("archiveKey"))}</a>`
    : "<em>no archive yet</em>";

  if (!ARCHIVE) return;

  const files = await ARCHIVE.readdir("/", { stat: true });
  const media = files.filter(file => {
    const parts = file.name.split(".");
    const ext = parts[parts.length - 1];

    return ACCEPTED_MEDIA_FORMATS.indexOf(ext) > -1;
  })

  const listEl = ELEMENTS.archiveMedia();
  listEl.innerHTML = "";
  media.forEach(m => {
    const li = document.createElement("li");
    li.innerHTML = m.name;
    li.onclick = () => ACTIONS.queue(ARCHIVE.url, m.name);
    listEl.appendChild(li);
  });
}

ACTIONS.loadQueue = async () => {
  // QUEUE = [];
  SHARED_QUEUE = await SharedQueue.load({ timeout: REQUEST_QUEUE_TIMEOUT });
  TEMPORARY_START_TIME = SHARED_QUEUE.list().length > 0
    ? SHARED_QUEUE.startTime
    : 0;
}

ACTIONS.renderQueue = () => {
  // if (!QUEUE) return;
  if (!SHARED_QUEUE) return;

  const queueEl = ELEMENTS.queue();
  queueEl.innerHTML = "";

  SHARED_QUEUE.list().forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = `${m.name} ${m.url}`;
    queueEl.appendChild(li);
  });
}

ACTIONS.queue = (archiveUrl, fileName) => {
  const url = `${archiveUrl}/${encodeURIComponent(fileName)}`;
  SHARED_QUEUE.append({ name: fileName, url });
  EMITTER.trigger("queue:changed");
}

ACTIONS.playHeadOfQueueIfNotPlaying = (time) => {
  if (!SHARED_QUEUE || SHARED_QUEUE.list().length === 0 || PLAYING) return;

  PLAYING = SHARED_QUEUE.currentlyPlaying();
  const player = ELEMENTS.player();
  player.src = PLAYING.url;

  if (TEMPORARY_START_TIME !== null) {
    player.currentTime = TEMPORARY_START_TIME;
    TEMPORARY_START_TIME = null;
  }

  try {
    player.play();
    // player.muted = false;
  } catch (e) { console.error(e); }
}

ACTIONS.nextSong = () => {
  if (!SHARED_QUEUE || SHARED_QUEUE.list().length === 0) return;

  SHARED_QUEUE.shift();
  PLAYING = false;
  ELEMENTS.player().src = null;
  ACTIONS.playHeadOfQueueIfNotPlaying();
  EMITTER.trigger("queue:changed");
}

ACTIONS.handlePlaying = () => {
  ELEMENTS.radioIcon().src = "/radio.gif";
}

ACTIONS.handleNotPlaying = () => {
  ELEMENTS.radioIcon().src = "/radio-silent.gif";
}

ACTIONS.renderPeerId = (peerId) => {
  const input = ELEMENTS.shoutInput();
  ELEMENTS.user().innerHTML = `You are ${shortenHash(peerId)}`;
  input.disabled = false;
  input.onkeydown = (e) => {
    if (e.keyCode !== 13) return;
    const message = input.value;
    ACTIONS.shoutout(message, COLOUR);
    input.value = "";
  }
}

ACTIONS.shoutout = (message, colour) => {
  const el = document.createElement("div");
  el.style = `opacity: 0; position: absolute; max-width: 160px; overflow-wrap: break-word; font-size: ${26 + Math.random() * 14}px; font-weight: bold; color: ${colour}; display: inline;`;
  el.innerHTML = message;

  ELEMENTS.shout().appendChild(el);

  el.style.left = `${Math.random() * (window.innerWidth - el.clientWidth)}px`;
  el.style.top = `${Math.random() * (window.innerHeight - el.clientHeight)}px`;
  el.style.transform = `rotate(${Math.random() > 0.5 ? "" : "-"}${Math.random() / 8}turn)`;
  el.style["animation-duration"] = "10s";
  el.style["animation-name"] = "shout";

  setTimeout(() => { el.remove() }, 10050);
}

ACTIONS.createDropZoneShower = () => {
  let timeout;
  return async (e) => {
    e.preventDefault();
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      ELEMENTS.dropzone().style.display = "none";
    }, 60);

    ELEMENTS.dropzone().style.display = "block";
  };
}

ACTIONS.hideDropZone = async (e) => {
  e.preventDefault();
  ELEMENTS.dropzone().style.display = "none";
};

ACTIONS.addDataTransferFile = (e) => {
  e.preventDefault()

  const files = e.dataTransfer.files

  for (let i = 0; i < files.length; i++) {
    const reader = new FileReader()
    reader.readAsArrayBuffer(files[i])
    reader.onload = async (loaded) => {
      await ARCHIVE.writeFile(files[i].name, loaded.target.result, {
        encoding: "binary"
      });

      EMITTER.trigger("archive:update");
    }
  }

  return false
};

ACTIONS.userConfirmation = () => {
  return new Promise(resolve => {
    const onclick = (e) => {
      e.preventDefault();
      resolve();
      document.body.removeEventListener("click", onclick);
    }

    document.body.addEventListener("click", onclick);
  });
}

// event handlers

const player = ELEMENTS.player();
player.addEventListener("audioprocess", () => EMITTER.trigger("audio:audioprocess")); // The input buffer of a ScriptProcessorNode is ready to be processed.
player.addEventListener("canplay", () => EMITTER.trigger("audio:canplay")); // The browser can play the media, but estimates that not enough data has been loaded to play the media up to its end without having to stop for further buffering of content.
player.addEventListener("canplaythrough", () => EMITTER.trigger("audio:canplaythrough")); // The browser estimates it can play the media up to its end without stopping for content buffering.
player.addEventListener("complete", () => EMITTER.trigger("audio:complete")); // The rendering of an OfflineAudioContext is terminated.
player.addEventListener("durationchange", () => EMITTER.trigger("audio:durationchange")); // The duration attribute has been updated.
player.addEventListener("emptied", () => EMITTER.trigger("audio:emptied")); // The media has become empty; for example, this event is sent if the media has already been loaded (or partially loaded), and the load() method is called to reload it.
player.addEventListener("ended", () => EMITTER.trigger("audio:ended")); // Playback has stopped because the end of the media was reached.
player.addEventListener("loadeddata", () => EMITTER.trigger("audio:loadeddata")); // The first frame of the media has finished loading.
player.addEventListener("loadedmetadata", () => EMITTER.trigger("audio:loadedmetadata")); // The metadata has been loaded.
player.addEventListener("pause", () => EMITTER.trigger("audio:pause")); // Playback has been paused.
player.addEventListener("play", () => EMITTER.trigger("audio:play")); // Playback has begun.
player.addEventListener("playing", () => EMITTER.trigger("audio:playing")); // Playback is ready to start after having been paused or delayed due to lack of data.
player.addEventListener("ratechange", () => EMITTER.trigger("audio:ratechange")); // The playback rate has changed.
player.addEventListener("seeked", () => EMITTER.trigger("audio:seeked")); // A seek operation completed.
player.addEventListener("seeking", () => EMITTER.trigger("audio:seeking")); // A seek operation began.
player.addEventListener("stalled", () => EMITTER.trigger("audio:stalled")); // The user agent is trying to fetch media data, but data is unexpectedly not forthcoming.
player.addEventListener("suspend", () => EMITTER.trigger("audio:suspend")); // Media data loading has been suspended.
player.addEventListener("timeupdate", () => EMITTER.trigger("audio:timeupdate")); // The time indicated by the currentTime attribute has been updated.
player.addEventListener("volumechange", () => EMITTER.trigger("audio:volumechange")); // The volume has changed.
player.addEventListener("waiting", () => EMITTER.trigger("audio:waiting")); // Playback has stopped because of a temporary lack of data

ELEMENTS.archiveButton().onclick = ACTIONS.setArchive;
ELEMENTS.body().addEventListener("dragover", ACTIONS.createDropZoneShower());
ELEMENTS.body().addEventListener("drop", ACTIONS.addDataTransferFile);

EMITTER.on("set:archiveKey", ACTIONS.loadArchive);
EMITTER.on("set:archiveKey", ACTIONS.renderArchive);
EMITTER.on("archive:update", ACTIONS.renderArchive);
EMITTER.on("archive:load", ACTIONS.renderArchive);
EMITTER.on("set:peerId", ACTIONS.renderPeerId);
EMITTER.on("queue:changed", ACTIONS.renderQueue);
EMITTER.on("queue:changed", ACTIONS.playHeadOfQueueIfNotPlaying);
EMITTER.on("audio:ended", ACTIONS.nextSong);
EMITTER.on("audio:ended", ACTIONS.handleNotPlaying);
EMITTER.on("audio:pause", ACTIONS.handleNotPlaying);
EMITTER.on("audio:play", ACTIONS.handlePlaying);

// immediately

window.addEventListener("load", async () => {
  await ACTIONS.loadPeerId();
  await ACTIONS.loadArchive();
  await ACTIONS.renderArchive();
  await ACTIONS.userConfirmation();
  await ACTIONS.loadQueue();
  await ACTIONS.renderQueue();
  await ACTIONS.playHeadOfQueueIfNotPlaying();

  console.log("loaded!");

  // await ACTIONS.queue("dat://43640c810aac3b8ba1840a8ee20819b37763c5fa6405dbdab2b2c0a75b8e3477/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3", "A Tribe Called Quest - Dis Generation (ft. Busta Rhymes).mp3");
  // await ACTIONS.queue("dat://43640c810aac3b8ba1840a8ee20819b37763c5fa6405dbdab2b2c0a75b8e3477/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3", "A Tribe Called Quest - Dis Generation (ft. Busta Rhymes).mp3");
  // await ACTIONS.queue("dat://43640c810aac3b8ba1840a8ee20819b37763c5fa6405dbdab2b2c0a75b8e3477/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3", "A Tribe Called Quest - Dis Generation (ft. Busta Rhymes).mp3");
  // await ACTIONS.queue("dat://43640c810aac3b8ba1840a8ee20819b37763c5fa6405dbdab2b2c0a75b8e3477/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3", "A Tribe Called Quest - Dis Generation (ft. Busta Rhymes).mp3");
});
