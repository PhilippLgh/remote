import { EventEmitter } from 'events'
import { valueToMeta } from './Serialization'
import { IObjectRegistry, ObjectRegistry } from './Serialization/ObjectRegistry'
import { IRemoteServer } from './IRemoteServer'

const throwRPCError = function (message: string) {
  const error = new Error(message) as Error & {code: string, errno: number};
  error.code = 'EBADRPC';
  error.errno = -72;
  throw error;
}

export class RemoteServer implements IRemoteServer{

  optimizeSimpleObjects = false

  private _rendererFunctions: WeakMap<[string, number], Function> = new WeakMap();

  private _objects : any = {}
  constructor(
    private _objectsRegistry: IObjectRegistry = new ObjectRegistry()
  ) {}
  valueToMeta(
    value: any, 
    contextId = '1',
    optimizeSimpleObjects = false /* TODO ignored */
  ){
    return valueToMeta(value, contextId, false, this._objectsRegistry)
  }
  exposeObject(obj: any, name: string) {
    this._objects[name] = obj
  }
  getObject(name: string) {
    return this.valueToMeta(this._objects[name])
  }

  getMember(contextId: string, id: number, name: string) {
    const obj = this._objectsRegistry.get(id);
    if (obj == null) {
      throwRPCError(`Cannot get property '${name}' on missing remote object ${id}`);
    }
    return this.valueToMeta(obj[name], contextId);
  }
  setMember(contextId: string, id: number, name: string, args: any[]) {
    // FIXME args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const obj = this._objectsRegistry.get(id);
    if (obj == null) {
      throwRPCError(`Cannot set property '${name}' on missing remote object ${id}`);
    }
    obj[name] = args[0];
    return null;
  }
  callMember(contextId: string, id: number, method: string, args: any[]) {
    // args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const object = this._objectsRegistry.get(id);
    if (object == null) {
      throwRPCError(`Cannot call method '${method}' on missing remote object ${id}`);
    }
    try {
      const result = object[method](...args)
      // console.log('serialize result', result)
      return this.valueToMeta(result, contextId, true);
    } catch (error) {
      const err = new Error(`Could not call remote method '${method}'. Check that the method signature is correct. Underlying error: ${error.message}\nUnderlying stack: ${error.stack}\n`);
      (err as any).cause = error;
      throw err;
    }
  }
  memberConstructor(contextId: string, id: number, method: string, args: any[]) {
    // FIXME args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const object = this._objectsRegistry.get(id);
    if (object == null) {
      throwRPCError(`Cannot call constructor '${method}' on missing remote object ${id}`);
    }
    return this.valueToMeta(new object[method](...args), contextId);
  }
  functionCall(contextId: string, id: number, args: any[]) {
    // FIXME args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const func = this._objectsRegistry.get(id);
    if (func == null) {
      throwRPCError(`Cannot call function on missing remote object ${id}`);
    }
    try {
      return this.valueToMeta(func(...args), contextId, true);
    } catch (error) {
      const err = new Error(`Could not call remote function '${func.name || 'anonymous'}'. Check that the function signature is correct. Underlying error: ${error.message}\nUnderlying stack: ${error.stack}\n`);
      (err as any).cause = error;
      throw err;
    }
  }
  constructorCall(contextId: string, id: number, args: any[]) {
    // FIXME args = unwrapArgs(event.sender, event.frameId, contextId, args);
    const constructor = this._objectsRegistry.get(id);
    if (constructor == null) {
      throwRPCError(`Cannot call constructor on missing remote object ${id}`);
    }
    return this.valueToMeta(new constructor(...args), contextId);
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