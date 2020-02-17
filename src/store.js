export default class Store {
  constructor ({ onSet } = {}) {
    this.onSet = onSet;
  }

  get (key) {
    return localStorage.getItem(key);
  }

  set (key, value) {
    const res = localStorage.setItem(key, value);
    if (this.onSet) this.onSet(key, value);
    return res;
  }
}
