import { v8Util } from './v8Util'

export class CallbacksRegistry {
  private nextId: number = 0
  private callbacks = new Map<string, Function>()

  add (callback: Function) : string {
    // The callback is already added.
    let id = v8Util.getHiddenValue<string>(callback, 'callbackId');
    if (id != null) return ''+id;

    id = `${this.nextId++}`

    // Capture the location of the function and put it in the ID string,
    // so that release errors can be tracked down easily.
    const regexp = /at (.*)/gi;
    const stackString = (new Error()).stack;
    if (!stackString) {
      throw new Error('No stack available')
    }

    let filenameAndLine;
    let match;

    while ((match = regexp.exec(stackString)) !== null) {
      const location = match[1];
      if (location.includes('(native)')) continue;
      if (location.includes('(<anonymous>)')) continue;
      if (location.includes('electron/js2c')) continue;

      const ref = /([^/^)]*)\)?$/gi.exec(location);
      if (ref) filenameAndLine = ref![1];
      break;
    }

    this.callbacks.set(id, callback);
    v8Util.setHiddenValue(callback, 'callbackId', id);
    v8Util.setHiddenValue(callback, 'location', filenameAndLine);
    return ''+id;
  }

  get (id: string) {
    return this.callbacks.get(id) || function () { throw new Error('Callback not found') };
  }

  apply (id: string, ...args: any[]) {
    return this.get(id).apply(global, ...args);
  }

  remove (id: string) {
    const callback = this.callbacks.get(id);
    if (callback) {
      v8Util.deleteHiddenValue(callback, 'callbackId');
      this.callbacks.delete(id);
    }
  }
}