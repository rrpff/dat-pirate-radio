import Emitter from "./emitter.js";

// const broadcast = (message) => {
//   console.log(`broadcasting: ${JSON.stringify(message)}`);
//   experimental.datPeers.broadcast(message);
// }

const feed = () => {
  const emitter = new Emitter();
  const stop = () => experimental.datPeers.removeEventListener("message", receive);
  const receive = message => {
    emitter.trigger("message", message.content, message);
    emitter.trigger(`message:${message.type}`, message.content, message);
  };

  const broadcast = (message) => {
    console.log(`broadcasting: ${JSON.stringify(message)}`);
    experimental.datPeers.broadcast(message);
    receive(message);
  };

  experimental.datPeers.addEventListener("message", receive);

  return {
    trigger: emitter.trigger.bind(emitter),
    on: emitter.on.bind(emitter),
    broadcast: broadcast,
    stop: stop,
  }
}

export default class SharedQueue extends Emitter {
  static load ({ timeout } = { timeout: 5000 }) {
    return new Promise(resolve => {
      const conn = feed();
      conn.broadcast({ type: "QUEUE:REQUEST" });
      conn.on("message:QUEUE:SHARE", content => {
        resolve(new SharedQueue(content));
        stop();
      });

      setTimeout(() => {
        conn.broadcast({
          type: "QUEUE:SHARE",
          content: {
            queue: [{
              name: "A Tribe Called Quest - Dis Generation (ft. Busta Rhymes).mp3",
              url: "dat://43640c810aac3b8ba1840a8ee20819b37763c5fa6405dbdab2b2c0a75b8e3477/A%20Tribe%20Called%20Quest%20-%20Dis%20Generation%20(ft.%20Busta%20Rhymes).mp3",
            }],
            startTime: 50
          }
        });
      }, timeout);
    });
  }

  constructor ({ queue, startTime }) {
    super();

    this.queue = queue;
    this.startTime = startTime;
    this.feed = feed();
    this.feed.on("message:QUEUE:ADD", this.onRemoteQueue.bind(this));
    this.feed.on("message:QUEUE:REQUEST", this.onQueueRequest.bind(this));
  }

  list () {
    return this.queue;
  }

  currentlyPlaying () {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  append (media) {
    this.feed.broadcast({ type: "QUEUE:ADD", content: media });
  }

  shift () {
    this.queue.shift();
    this.trigger("shift");
  }

  onRemoteQueue (media) {
    this.queue.push(media);
    this.trigger("append", media);
  }

  onQueueRequest () {
    this.feed.broadcast({ type: "QUEUE:SHARE", content: { queue: this.queue, startTime: this.startTime } });
  }
}
