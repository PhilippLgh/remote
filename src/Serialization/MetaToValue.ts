import { RemoteObjectCache } from './RemoteObjectsCache'
import { ISyncRemoteClient, instanceOfISyncRemoteClient, NoComSync } from '../ISyncRemoteClient'
import { IAsyncRemoteClient, NoComAsync } from '../IAsyncRemoteClient'
import { MetaType, instanceOfMeta } from './ValueToMeta'

const throwSyncError = (property: string | number | symbol, value: string = '', receiver: any = undefined) => {
  throw new Error(`Object is not in sync: ${property.toString()} ${value} receiver: ${receiver}`)
}

// Wrap function in Proxy for accessing remote properties
const proxyFunctionPropertiesSync = (remoteMemberFunction: any, metaId: string, name: string, com: ISyncRemoteClient, _remoteObjectCache: RemoteObjectCache) => {
  let loaded = false;

  // Lazily load function properties
  const loadRemoteProperties = () => {
    if (loaded) return;
    loaded = true;
    const meta = com.getRemoteMemberSync(metaId, name);
    setObjectMembers(remoteMemberFunction, remoteMemberFunction, meta.id, meta.members, com, _remoteObjectCache);
  };

  return new Proxy(remoteMemberFunction, {
    set: (target, property, value, receiver) => {
      if (property !== 'ref') loadRemoteProperties();
      target[property] = value;
      return true;
    },
    get: (target, property, receiver) => {
      if (!Object.prototype.hasOwnProperty.call(target, property)) loadRemoteProperties();
      const value = target[property];
      if (property === 'toString' && typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
    ownKeys: (target) => {
      loadRemoteProperties();
      return Object.getOwnPropertyNames(target);
    },
    getOwnPropertyDescriptor: (target, property) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      if (descriptor) return descriptor;
      loadRemoteProperties();
      return Object.getOwnPropertyDescriptor(target, property);
    }
  });
}

// Wrap function in Proxy for accessing remote properties
const proxyFunctionPropertiesAsync = (remoteMemberFunction: any, metaId: string, name: string, com: IAsyncRemoteClient, _remoteObjectCache: RemoteObjectCache) => {
  let loaded = false;

  // Lazily load function properties not possible with async communication
  const loadRemoteProperties = async () => {
    if (loaded) return;
    loaded = true;
    const meta = await com.getRemoteMember(metaId, name);
    await await setObjectMembers(remoteMemberFunction, remoteMemberFunction, meta.id, meta.members, com, _remoteObjectCache);
  };

  // we load once and hope for the best that things do not change
  // const properties = await loadRemoteProperties()
  // we can keep this function sync if we do not await
  // TODO find solution
  const properties = loadRemoteProperties()

  return new Proxy(remoteMemberFunction, {
    set: (target, property, value, receiver) => {
      if (property !== 'ref') {
        // loadRemoteProperties();
        throwSyncError(property, value)
      }
      target[property] = value;
      return true;
    },
    get: (target, property, receiver) => {
      if (!Object.prototype.hasOwnProperty.call(target, property)) {
        // loadRemoteProperties();
        throwSyncError(property, undefined, target)
      }
      const value = target[property];
      if (property === 'toString' && typeof value === 'function') {
        return value.bind(target);
      }
      return value;
    },
    ownKeys: (target) => {
      // loadRemoteProperties();
      return Object.getOwnPropertyNames(target);
    },
    getOwnPropertyDescriptor: (target, property) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, property);
      if (descriptor) return descriptor;
      // loadRemoteProperties();
      return Object.getOwnPropertyDescriptor(target, property);
    }
  });
}

// Populate object's members from descriptors.
// The |ref| will be kept referenced by |members|.
// This matches |getObjectMembers| in rpc-server.
const setObjectMembers = (ref: any, object: any, metaId: any, members: any, com: IAsyncRemoteClient | ISyncRemoteClient, _remoteObjectCache: RemoteObjectCache) => {
  if (!Array.isArray(members)) return;

  for (const member of members) {
    if (Object.prototype.hasOwnProperty.call(object, member.name)) continue;

    const descriptor: any = { enumerable: member.enumerable };
    if (member.type === 'method') {
      let remoteMemberFunction : Function
      if (instanceOfISyncRemoteClient(com)) {
        remoteMemberFunction = function (...args: any[]) {
          let ret
          // @ts-ignore
          if (this && this.constructor === remoteMemberFunction) {
            ret = com.callRemoteMemberConstructorSync(metaId, member.name, args)
          } else {
            ret = com.callRemoteMemberSync(metaId, member.name, args)
          }
          return _metaToValue(ret, com, _remoteObjectCache);
        };
      } else {
        remoteMemberFunction = async function (...args: any[]) {
          let ret
          // @ts-ignore
          if (this && this.constructor === remoteMemberFunction) {
            ret = await com.callRemoteMemberConstructor(metaId, member.name, args)
          } else {
            ret = await com.callRemoteMember(metaId, member.name, args)
          }
          return _metaToValue(ret, com, _remoteObjectCache);
        };
      }


      let descriptorFunction : any
      if (instanceOfISyncRemoteClient(com)) {
        descriptorFunction = proxyFunctionPropertiesSync(remoteMemberFunction, metaId, member.name, com, _remoteObjectCache);
      } else {
        descriptorFunction = proxyFunctionPropertiesAsync(remoteMemberFunction, metaId, member.name, com, _remoteObjectCache);
      }

      descriptor.get = () => {
        descriptorFunction.ref = ref; // The member should reference its object.
        return descriptorFunction;
      };
      // Enable monkey-patch the method
      descriptor.set = (value: any) => {
        descriptorFunction = value;
        return value;
      };
      descriptor.configurable = true;
    }
    else if (member.type === 'get') {
      if (instanceOfISyncRemoteClient(com)) {
        descriptor.get = () => {
          const meta = com.getRemoteMemberSync(metaId, member.name)
          return _metaToValue(meta, com, _remoteObjectCache);
        };

        if (member.writable) {
          descriptor.set = (value: any) => {
            const meta = com.setRemoteMemberSync(metaId, member.name, value)
            if (meta != null) _metaToValue(meta, com, _remoteObjectCache);
            return value;
          };
        }
      } else {
        descriptor.get = async () => {
          const meta = await com.getRemoteMember(metaId, member.name)
          return _metaToValue(meta, com, _remoteObjectCache);
        };

        if (member.writable) {
          descriptor.set = async (value: any) => {
            const meta = await com.setRemoteMember(metaId, member.name, value)
            if (meta != null) _metaToValue(meta, com, _remoteObjectCache);
            return value;
          };
        }
      }
    }
    Object.defineProperty(object, member.name, descriptor);
  }
}

// Populate object's prototype from descriptor.
// This matches |getObjectPrototype| in rpc-server.
const setObjectPrototype = (ref: any, object: any, metaId: any, descriptor: any, com: IAsyncRemoteClient | ISyncRemoteClient, _remoteObjectCache: RemoteObjectCache) => {
  if (descriptor === null) return;
  const proto = {};
  setObjectMembers(ref, proto, metaId, descriptor.members, com, _remoteObjectCache);
  setObjectPrototype(ref, proto, metaId, descriptor.proto, com, _remoteObjectCache);
  Object.setPrototypeOf(object, proto);
}

// TODO remove redundant logic
export const _metaToValueServer = (meta: MetaType, com: IAsyncRemoteClient | ISyncRemoteClient): any => {
  if (!instanceOfMeta(meta)) {
    return meta
  }
  switch (meta.type) {
    case 'value':
      return meta.value;
    case 'remote-object':
      throw new Error('not implemented')
    // return self._objectsRegistry.get(meta.id);
    case 'array':
      return meta.members.map(val => _metaToValueServer(meta, com)) // unwrapArgs(contextId, meta.members, callback, rendererFunctions);
    case 'buffer':
      return Buffer.from(meta.value.buffer, meta.value.byteOffset, meta.value.byteLength);
    case 'promise':
      return Promise.resolve({
        then: _metaToValueServer(meta.then, com)
      });
    case 'object': {
      /*
      const ret: any = meta.name !== 'Object' ? Object.create({
        constructor: fakeConstructor(Object, meta.name)
      }) : {};
      for (const { name, value } of meta.members) {
        ret[name] = metaToValue(value);
      }
      return ret;
      */
      throw new Error('not impelmented')
    }
    case 'function-with-return-value': {
      const returnValue = _metaToValueServer(meta.value, com);
      return function () {
        return returnValue;
      };
    }
    case 'callback': {
      // Merge contextId and meta.id, since meta.id can be the same in
      // different webContents.
      /* FIXME
      const objectId = [ `${contextId}_${meta.id}` ]

      // Cache the callbacks in renderer.
      if (rendererFunctions.has(objectId)) {
        return rendererFunctions.get(objectId);
      }
      */
      let callIntoRenderer
      if (instanceOfISyncRemoteClient(com)) {
        callIntoRenderer = function (this: any, ...args: any[]) {
          // console.log('call callback with unwrapped args', args)
          const succeed = com.callCallbackSync(meta.id, args);
          if (!succeed) {
            // FIXME self.removeRemoteListenersAndLogWarning(this, callIntoRenderer);
          }
        };
      } else {
        callIntoRenderer = async function (this: any, ...args: any[]) {
          // console.log('call callback with unwrapped args', args)
          const succeed = await com.callCallback(meta.id, args);
          if (!succeed) {
            // FIXME self.removeRemoteListenersAndLogWarning(this, callIntoRenderer);
          }
        };
      }

      /*FIXME
      v8Util.setHiddenValue(callIntoRenderer, 'location', meta.location);
      Object.defineProperty(callIntoRenderer, 'length', { value: meta.length });

      // v8Util.setRemoteCallbackFreer(callIntoRenderer, frameId, contextId, meta.id, sender);
      rendererFunctions.set(objectId, callIntoRenderer);
      */
      return callIntoRenderer;
    }
    default:
      throw new TypeError(`Unknown type: ${(meta as any).type}`);
  }
}

// Convert meta data from browser into real value.
export const _metaToValue = (
  meta: any, /* MetaType */
  com: IAsyncRemoteClient | ISyncRemoteClient,
  _remoteObjectCache: RemoteObjectCache,
): any => {
  // console.log('meta to value', JSON.stringify(meta, null, 2))
  // if meta is already value: just return
  // used in testing
  if (!meta || !meta.type) {
    return meta
  }
  const types: any = {
    value: () => meta.value,
    array: () => meta.members.map((member: any) => _metaToValue(member, com, _remoteObjectCache)),
    buffer: () => Buffer.from(meta.value.buffer, meta.value.byteOffset, meta.value.byteLength),
    promise: () => Promise.resolve({ then: _metaToValue(meta.then, com, _remoteObjectCache) }),
    error: () => metaToError(meta, com, _remoteObjectCache),
    exception: () => { throw metaToError(meta.value, com, _remoteObjectCache); }
  };

  if (Object.prototype.hasOwnProperty.call(types, meta.type)) {
    const res = types[meta.type]();
    return res
  } else {
    let ret;

    if (_remoteObjectCache && _remoteObjectCache.has(meta.id)) {
      // FIXME v8Util.addRemoteObjectRef(contextId, meta.id);
      return _remoteObjectCache.get(meta.id);
    }

    // A shadow class to represent the remote function object.
    if (meta.type === 'function') {
      if (instanceOfISyncRemoteClient(com)) {
        const remoteFunction = async function (...args: any[]) {
          let response
          // @ts-ignore
          if (this && this.constructor === remoteFunction) {
            response = await com.callRemoteConstructorSync(meta.id, args)
          } else {
            response = await com.callRemoteFunctionSync(meta.id, args)
          }
          return _metaToValue(response, com, _remoteObjectCache);
        };
        ret = remoteFunction;
      } else {
        const remoteFunction = async function (...args: any[]) {
          let response
          // @ts-ignore
          if (this && this.constructor === remoteFunction) {
            response = await com.callRemoteConstructor(meta.id, args)
          } else {
            response = await com.callRemoteFunction(meta.id, args)
          }
          return _metaToValue(response, com, _remoteObjectCache);
        };
        ret = remoteFunction;
      }
    } else {
      ret = {};
    }

    setObjectMembers(ret, ret, meta.id, meta.members, com, _remoteObjectCache);
    setObjectPrototype(ret, ret, meta.id, meta.proto, com, _remoteObjectCache);
    Object.defineProperty(ret.constructor, 'name', { value: meta.name });

    // Track delegate obj's lifetime & tell browser to clean up when object is GCed.
    /*FIXME
    v8Util.setRemoteObjectFreer(ret, contextId, meta.id);
    v8Util.setHiddenValue(ret, 'atomId', meta.id);
    v8Util.addRemoteObjectRef(contextId, meta.id);
    */
    if (_remoteObjectCache) {
      _remoteObjectCache.set(meta.id, ret);
    }
    return ret;
  }
}

const metaToError = (meta: any /*MetaType*/, com: IAsyncRemoteClient | ISyncRemoteClient, _remoteObjectCache: RemoteObjectCache, ) => {
  const obj = meta.value;
  for (const { name, value } of meta.members) {
    obj[name] = _metaToValue(value, com, _remoteObjectCache);
  }
  return obj;
}

export const metaToValueSync = (
  meta: any, /* MetaType */
  com: ISyncRemoteClient = new NoComSync(),
  _remoteObjectCache = new RemoteObjectCache(),
): any => {
  // console.time('metaToValue')
  const result = _metaToValue(meta, com, _remoteObjectCache)
  // console.timeEnd('metaToValue')
  return result
}

export const metaToValue = (
  meta: any, /* MetaType */
  com: IAsyncRemoteClient = new NoComAsync(),
  _remoteObjectCache = new RemoteObjectCache(),
): any => {
  // console.time('metaToValue')
  const result = _metaToValue(meta, com, _remoteObjectCache)
  // console.timeEnd('metaToValue')
  return result
}