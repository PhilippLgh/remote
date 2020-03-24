export interface SyncCom {
  getRemoteMember: (metaId: string, memberName: string) => any
  setRemoteMember: (metaId: string, memberName: string, value: any) => void
  callRemoteConstructor: (metaId: string, args: any) => any
  callRemoteFunction: (metaId: string, args: any) => any
  callRemoteMemberConstructor: (metaId: string, memberName: string, args: any) => any
  callRemoteMember: (metaId: string, memberName: string, args: any) => any
}

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

// Wrap function in Proxy for accessing remote properties
const proxyFunctionProperties = (remoteMemberFunction: any, metaId: string, name: string, com: SyncCom) => {
  let loaded = false;

  // Lazily load function properties
  const loadRemoteProperties = () => {
    if (loaded) return;
    loaded = true;
    const meta = com.getRemoteMember(metaId, name);
    setObjectMembers(remoteMemberFunction, remoteMemberFunction, meta.id, meta.members, com);
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

// Populate object's members from descriptors.
// The |ref| will be kept referenced by |members|.
// This matches |getObjectMembers| in rpc-server.
const setObjectMembers = (ref: any, object: any, metaId: any, members: any, com: SyncCom) => {
  if (!Array.isArray(members)) return;

  for (const member of members) {
    if (Object.prototype.hasOwnProperty.call(object, member.name)) continue;

    const descriptor: any = { enumerable: member.enumerable };
    if (member.type === 'method') {
      const remoteMemberFunction = function (...args: any[]) {
        let command;
        let ret
        // @ts-ignore
        if (this && this.constructor === remoteMemberFunction) {
          ret = com.callRemoteMemberConstructor(metaId, member.name, args) 
        } else {
          ret = com.callRemoteMember(metaId, member.name, args) 
        }
        return metaToValue(ret, com);
      };

      let descriptorFunction = proxyFunctionProperties(remoteMemberFunction, metaId, member.name, com);

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
      descriptor.get = () => {
        const meta = com.getRemoteMember(metaId, member.name)
        return metaToValue(meta, com);
      };

      if (member.writable) {
        descriptor.set = (value: any) => {
          const meta = com.setRemoteMember(metaId, member.name, value)
          if (meta != null) metaToValue(meta, com);
          return value;
        };
      }
    }
    Object.defineProperty(object, member.name, descriptor);
  }
}

// Populate object's prototype from descriptor.
// This matches |getObjectPrototype| in rpc-server.
const setObjectPrototype = (ref: any, object: any, metaId: any, descriptor: any, com: SyncCom) => {
  if (descriptor === null) return;
  const proto = {};
  setObjectMembers(ref, proto, metaId, descriptor.members, com);
  setObjectPrototype(ref, proto, metaId, descriptor.proto, com);
  Object.setPrototypeOf(object, proto);
}

// Convert meta data from browser into real value.
export const metaToValue = (
  meta: any, /* MetaType */
  com: SyncCom
): any => {
  const types: any = {
    value: () => meta.value,
    array: () => meta.members.map((member: any) => metaToValue(member, com)),
    buffer: () => Buffer.from(meta.value.buffer, meta.value.byteOffset, meta.value.byteLength),
    promise: () => Promise.resolve({ then: metaToValue(meta.then, com) }),
    error: () => metaToError(meta, com),
    exception: () => { throw metaToError(meta.value, com); }
  };

  if (Object.prototype.hasOwnProperty.call(types, meta.type)) {
    return types[meta.type]();
  } else {
    let ret;
  
    if (_remoteObjectCache.has(meta.id)) {
      // FIXME v8Util.addRemoteObjectRef(contextId, meta.id);
      return _remoteObjectCache.get(meta.id);
    }

    // A shadow class to represent the remote function object.
    if (meta.type === 'function') {
      const remoteFunction = function (...args: any[]) {
        let command;
        let response
        // @ts-ignore
        if (this && this.constructor === remoteFunction) {
          response = com.callRemoteConstructor(meta.id, args) 
        } else {
          response = com.callRemoteFunction(meta.id, args)
        }
        return metaToValue(response, com);
      };
      ret = remoteFunction;
    } else {
      ret = {};
    }

    setObjectMembers(ret, ret, meta.id, meta.members, com);
    setObjectPrototype(ret, ret, meta.id, meta.proto, com);
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

const metaToError = (meta: any /*MetaType*/, com: SyncCom) => {
  const obj = meta.value;
  for (const { name, value } of meta.members) {
    obj[name] = metaToValue(value, com);
  }
  return obj;
}