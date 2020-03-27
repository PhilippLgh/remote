import { EventEmitter } from 'events'
import { valueToMeta, MetaType } from './Serialization'
import { IObjectRegistry, ObjectRegistry } from './Serialization/ObjectRegistry'
import { IRemoteServer } from './IRemoteServer'
import { v8Util } from './v8Util'
import { _metaToValueServer } from './Serialization/MetaToValue'

const throwRPCError = function (message: string) {
  const error = new Error(message) as Error & { code: string, errno: number };
  error.code = 'EBADRPC';
  error.errno = -72;
  throw error;
}

// TODO
export type AsyncFunctionCallback = (contextId: string, metaId: string, args: MetaType) => Promise<boolean>

export class RemoteServer implements IRemoteServer {

  optimizeSimpleObjects = false

  private _rendererFunctions: WeakMap<string[], Function> = new WeakMap();

  public _objects: any = {}
  private _callback: AsyncFunctionCallback = () => { throw new Error('Unhandled function callback') }
  constructor(
    private _objectsRegistry: ObjectRegistry = new ObjectRegistry()
  ) { }
  valueToMeta(
    value: any,
    contextId = '1',
  ) {
    return valueToMeta(value, {
      contextId,
      addObject: (obj: any, contextId: string) => this._objectsRegistry.add(obj, contextId)
    })
  }
  unwrapArgs(argsWrapped: MetaType[]) {
    return argsWrapped.map(arg => _metaToValueServer(arg, this))
  }
  exposeObject(obj: any, name: string) {
    this._objects[name] = obj
  }
  getRemote(contextId: string, name: string) {
    return this.valueToMeta(this._objects[name], contextId)
  }

  getMember(contextId: string, id: string, name: string) {
    const obj = this._objectsRegistry.get(id);
    if (obj == null) {
      throwRPCError(`Cannot get property '${name}' on missing remote object ${id}`);
    }
    // console.log('get member', 'obj:', obj, 'id', id, 'member', name, 'result', obj[name])
    return this.valueToMeta(obj[name], contextId);
  }
  setMember(contextId: string, id: string, name: string, args: any[]) {
    // FIXME args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const obj = this._objectsRegistry.get(id);
    if (obj == null) {
      throwRPCError(`Cannot set property '${name}' on missing remote object ${id}`);
    }
    obj[name] = args[0];
    return null;
  }
  callMember(contextId: string, id: string, method: string, argsWrapped: MetaType[]) {
    const args = this.unwrapArgs(argsWrapped);
    const object = this._objectsRegistry.get(id);
    if (object == null) {
      throwRPCError(`Cannot call method '${method}' on missing remote object ${id}`);
    }
    try {
      console.log('call member function', method, args)
      const result = object[method](...args)
      console.log('call member function:result', method, args, result)
      return this.valueToMeta(result, contextId);
    } catch (error) {
      const err = new Error(`Could not call remote method '${method}'. Check that the method signature is correct. Underlying error: ${error.message}\nUnderlying stack: ${error.stack}\n`);
      (err as any).cause = error;
      throw err;
    }
  }
  memberConstructor(contextId: string, id: string, method: string, argsWrapped: MetaType[]) {
    const args = this.unwrapArgs(argsWrapped);
    const object = this._objectsRegistry.get(id);
    if (object == null) {
      throwRPCError(`Cannot call constructor '${method}' on missing remote object ${id}`);
    }
    return this.valueToMeta(new object[method](...args), contextId);
  }
  functionCall(contextId: string, id: string, argsWrapped: MetaType[]) {
    const args = this.unwrapArgs(argsWrapped)
    const func = this._objectsRegistry.get(id);
    if (func == null) {
      throwRPCError(`Cannot call function on missing remote object ${id}`);
    }
    try {
      // console.log('call function', id, args, 'wrapped', argsWrapped, 'result', func(...args))
      const result = this.valueToMeta(func(...args), contextId);
      // console.log('call function:result', id, args, 'wrapped', JSON.stringify(argsWrapped), 'result', result)
      return result
    } catch (error) {
      const err = new Error(`Could not call remote function '${func.name || 'anonymous'}'. Check that the function signature is correct. Underlying error: ${error.message}\nUnderlying stack: ${error.stack}\n`);
      (err as any).cause = error;
      throw err;
    }
  }
  constructorCall(contextId: string, id: string, argsWrapped: MetaType[]) {
    const args = this.unwrapArgs(argsWrapped);
    const constructor = this._objectsRegistry.get(id);
    if (constructor == null) {
      throwRPCError(`Cannot call constructor on missing remote object ${id}`);
    }
    return this.valueToMeta(new constructor(...args), contextId);
  }

  setCallback(callback: AsyncFunctionCallback) {
    this._callback = callback
  }

  callCallback(metaId: string, args: any[]) : Promise<boolean> {
    // FIXME hardcoded context
    const contextId = "1"
    console.log('call callback', args)
    return this._callback(contextId, metaId, this.valueToMeta(args, contextId))
  }

  removeRemoteListenersAndLogWarning = (sender: any, callIntoRenderer: (...args: any[]) => void) => {
    // FIXME const location = v8Util.getHiddenValue(callIntoRenderer, 'location');
    let message = 'Attempting to call a function in a renderer window that has been closed or released.' +
      `\nFunction provided here: ${location}`;

    if (sender instanceof EventEmitter) {
      const remoteEvents = sender.eventNames().filter((eventName) => {
        return sender.listeners(eventName).includes(callIntoRenderer);
      });

      if (remoteEvents.length > 0) {
        message += `\nRemote event names: ${remoteEvents.join(', ')}`;
        remoteEvents.forEach((eventName) => {
          sender.removeListener(eventName as any, callIntoRenderer);
        });
      }
    }
    console.warn(message);
  }


}