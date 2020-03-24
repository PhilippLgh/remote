import { IAsyncRemoteClient } from '../IAsyncRemoteClient'

class RemoteObjectCache {
  _objects: any = {}
  set(metaId: string, obj: any) {
    // console.log('object with id', metaId, 'is put in cache')
    this._objects[metaId] = obj
  }
  has(metaId: string): boolean {
    const res = metaId in this._objects
    // console.log('object cache request for', metaId, res)
    return res
  }
  get(metaId: string) {
    return this._objects[metaId]
  }
}

const _remoteObjectCache = new RemoteObjectCache()

const throwSyncError = (property: string | number | symbol, value: string = '', receiver: any = undefined) => {
  throw new Error(`Object is not in sync: ${property.toString()} ${value} receiver: ${receiver}`)
}

// Wrap function in Proxy for accessing remote properties
const proxyFunctionProperties = async (remoteMemberFunction: any, metaId: string, name: string, com: IAsyncRemoteClient) => {
  let loaded = false;

  // Lazily load function properties not possible with async communication
  const loadRemoteProperties = async () => {
    if (loaded) return;
    loaded = true;
    const meta = await com.getRemoteMember(metaId, name);
    await setObjectMembers(remoteMemberFunction, remoteMemberFunction, meta.id, meta.members, com);
  };

  // we load once and hope for the best that things do not change
  const properties = await loadRemoteProperties()

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
const setObjectMembers = async (ref: any, object: any, metaId: any, members: any, com: IAsyncRemoteClient) => {
  if (!Array.isArray(members)) return;

  for (const member of members) {
    if (Object.prototype.hasOwnProperty.call(object, member.name)) continue;

    const descriptor: any = { enumerable: member.enumerable };
    if (member.type === 'method') {
      const remoteMemberFunction = async function (...args: any[]) {
        let command;
        let ret
        // @ts-ignore
        if (this && this.constructor === remoteMemberFunction) {
          ret = await com.callRemoteMemberConstructor(metaId, member.name, args) 
        } else {
          ret = await com.callRemoteMember(metaId, member.name, args) 
        }
        return metaToValue(ret, com);
      };

      // FIXME let descriptorFunction = await proxyFunctionProperties(remoteMemberFunction, metaId, member.name, com);
      let descriptorFunction = remoteMemberFunction

      descriptor.get = () => {
        // FIXME descriptorFunction.ref = ref; // The member should reference its object.
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
      descriptor.get = async () => {
        const meta = await com.getRemoteMember(metaId, member.name)
        return metaToValue(meta, com);
      };

      if (member.writable) {
        descriptor.set = async (value: any) => {
          const meta = await com.setRemoteMember(metaId, member.name, value)
          if (meta != null) {
            await metaToValue(meta, com);
          }
          return value;
        };
      }
    }
    Object.defineProperty(object, member.name, descriptor);
  }
}

// Populate object's prototype from descriptor.
// This matches |getObjectPrototype| in rpc-server.
const setObjectPrototype = async (ref: any, object: any, metaId: any, descriptor: any, com: IAsyncRemoteClient) => {
  if (descriptor === null) return;
  const proto = {};
  await setObjectMembers(ref, proto, metaId, descriptor.members, com);
  await setObjectPrototype(ref, proto, metaId, descriptor.proto, com);
  Object.setPrototypeOf(object, proto);
}

// Convert meta data from browser into real value.
export const metaToValue = async (
  meta: any, /* MetaType */
  com: IAsyncRemoteClient
): Promise<any> => {
  const types: any = {
    value: () => meta.value,
    array: () => Promise.all(meta.members.map((member: any) => metaToValue(member, com))),
    buffer: () => Buffer.from(meta.value.buffer, meta.value.byteOffset, meta.value.byteLength),
    promise: async () => Promise.resolve({ then: await metaToValue(meta.then, com) }),
    error: () => metaToError(meta, com),
    exception: async () => { 
      throw await metaToError(meta.value, com);
    }
  };

  if (Object.prototype.hasOwnProperty.call(types, meta.type)) {
    return await types[meta.type]();
  } else {
    let ret;
  
    if (_remoteObjectCache.has(meta.id)) {
      // FIXME v8Util.addRemoteObjectRef(contextId, meta.id);
      return _remoteObjectCache.get(meta.id);
    }

    // A shadow class to represent the remote function object.
    if (meta.type === 'function') {
      const remoteFunction = async function (...args: any[]) {
        let command;
        let response
        // @ts-ignore
        if (this && this.constructor === remoteFunction) {
          response = await com.callRemoteConstructor(meta.id, args) 
        } else {
          response = await com.callRemoteFunction(meta.id, args)
        }
        return metaToValue(response, com);
      };
      ret = remoteFunction;
    } else {
      ret = {};
    }

    await setObjectMembers(ret, ret, meta.id, meta.members, com);
    await setObjectPrototype(ret, ret, meta.id, meta.proto, com);
    Object.defineProperty(ret.constructor, 'name', { value: meta.name });

    // Track delegate obj's lifetime & tell browser to clean up when object is GCed.
    /*FIXME
    v8Util.setRemoteObjectFreer(ret, contextId, meta.id);
    v8Util.setHiddenValue(ret, 'atomId', meta.id);
    v8Util.addRemoteObjectRef(contextId, meta.id);
    */
    _remoteObjectCache.set(meta.id, ret);
    return ret;
  }
}

const metaToError = async (meta: any /*MetaType*/, com: IAsyncRemoteClient) => {
  const obj = meta.value;
  for (const { name, value } of meta.members) {
    obj[name] = await metaToValue(value, com);
  }
  return obj;
}