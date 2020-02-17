export default class Emitter {
  constructor () {
    this.listeners = {};
  }

  trigger (event, ...data) {
    (this.listeners[event] || []).forEach(fn => fn(...data));
  };

  on (event, fn) {
    this.listeners[event] = this.listeners[event] || [];
    this.listeners[event].push(fn);
  };
}
