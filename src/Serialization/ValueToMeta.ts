import { ObjectRegistry, IObjectRegistry } from './ObjectRegistry'

export const serializableTypes = [
  Boolean,
  Number,
  String,
  Date,
  Error,
  RegExp,
  ArrayBuffer
];

export const isSerializableObject = (value: any) => {
  return value === null || ArrayBuffer.isView(value) || serializableTypes.some(type => value instanceof type);
}

export const isPromise = (val: any) => {
  return (
    val &&
    val.then &&
    val.then instanceof Function &&
    val.constructor &&
    val.constructor.reject &&
    val.constructor.reject instanceof Function &&
    val.constructor.resolve &&
    val.constructor.resolve instanceof Function
  );
}

export const hasProp = {}.hasOwnProperty;

export type ObjectMember = {
  name: string,
  value?: any,
  enumerable?: boolean,
  writable?: boolean,
  type?: 'method' | 'get'
}

export type ObjProtoDescriptor = {
  members: ObjectMember[],
  proto: ObjProtoDescriptor
} | null

export type MetaType = {
  type: 'number',
  value: number
} | {
  type: 'boolean',
  value: boolean
} | {
  type: 'string',
  value: string
} | {
  type: 'bigint',
  value: bigint
} | {
  type: 'symbol',
  value: symbol
} | {
  type: 'undefined',
  value: undefined
} | {
  type: 'object' | 'function',
  name: string,
  members: ObjectMember[],
  proto: ObjProtoDescriptor,
  id: number,
} | {
  type: 'value',
  value: any,
} | {
  type: 'buffer',
  value: Uint8Array,
} | {
  type: 'array',
  members: MetaType[]
} | {
  type: 'error',
  value: Error,
  members: ObjectMember[]
} | {
  type: 'promise',
  then: MetaType
}

export type MetaTypeFromClient = {
  type: 'value',
  value: any
} | {
  type: 'remote-object',
  id: number
} | {
  type: 'array',
  value: MetaTypeFromClient[]
} | {
  type: 'buffer',
  value: Uint8Array
} | {
  type: 'promise',
  then: MetaTypeFromClient
} | {
  type: 'object',
  name: string,
  members: { name: string, value: MetaTypeFromClient }[]
} | {
  type: 'function-with-return-value',
  value: MetaTypeFromClient
} | {
  type: 'function',
  id: number,
  location: string,
  length: number
}

// The internal properties of Function.
export const FUNCTION_PROPERTIES = [
  'length', 'name', 'arguments', 'caller', 'prototype'
];

// Return the description of object's members:
export const getObjectMembers = function (object: any): ObjectMember[] {
  let names = Object.getOwnPropertyNames(object);
  // For Function, we should not override following properties even though they
  // are "own" properties.
  if (typeof object === 'function') {
    names = names.filter((name) => {
      return !FUNCTION_PROPERTIES.includes(name);
    });
  }
  // Map properties to descriptors.
  return names.map((name) => {
    const descriptor = Object.getOwnPropertyDescriptor(object, name)!;
    let type: ObjectMember['type'];
    let writable = false;
    if (descriptor.get === undefined && typeof object[name] === 'function') {
      type = 'method';
    } else {
      if (descriptor.set || descriptor.writable) writable = true;
      type = 'get';
    }
    return { name, enumerable: descriptor.enumerable, writable, type };
  });
}

// Return the description of object's prototype.
export const getObjectPrototype = function (object: any): ObjProtoDescriptor {
  const proto = Object.getPrototypeOf(object);
  if (proto === null || proto === Object.prototype) return null;
  return {
    members: getObjectMembers(proto),
    proto: getObjectPrototype(proto)
  };
};

// Convert a real value into meta data.
export const valueToMeta = (
  value: any, 
  contextId: string = '1', 
  optimizeSimpleObject = false,
  registry: IObjectRegistry = new ObjectRegistry()
): MetaType => {
  // Determine the type of value.
  let type: MetaType['type'] = typeof value;
  if (type === 'object') {
    // Recognize certain types of objects.
    if (value instanceof Buffer) {
      type = 'buffer';
    } else if (Array.isArray(value)) {
      type = 'array';
    } else if (value instanceof Error) {
      type = 'error';
    } else if (isSerializableObject(value)) {
      type = 'value';
    } else if (isPromise(value)) {
      type = 'promise';
    } else if (hasProp.call(value, 'callee') && value.length != null) {
      // Treat the arguments object as array.
      type = 'array';
    }
    else if (optimizeSimpleObject /* FIXME && v8Util.getHiddenValue(value, 'simple') */) {
      // Treat simple objects as value.
      type = 'value';
    }
  }
  // Fill the meta object according to value's type.
  if (type === 'array') {
    return {
      type,
      members: value.map((el: any) => valueToMeta(el, contextId, optimizeSimpleObject, registry))
    };
  } else if (type === 'object' || type === 'function') {
    return {
      type,
      name: value.constructor ? value.constructor.name : '',
      // Reference the original value if it's an object, because when it's
      // passed to renderer we would assume the renderer keeps a reference of it.
      id: registry.add(contextId, value),
      members: getObjectMembers(value),
      proto: getObjectPrototype(value)
    };
  } else if (type === 'buffer') {
    return { type, value };
  } else if (type === 'promise') {
    // Add default handler to prevent unhandled rejections in main process
    // Instead they should appear in the renderer process
    value.then(function () { }, function () { });

    return {
      type,
      then: valueToMeta(function (onFulfilled: Function, onRejected: Function) {
        value.then(onFulfilled, onRejected);
      }, contextId, optimizeSimpleObject, registry)
    };
  } else if (type === 'error') {
    return {
      type,
      value,
      members: Object.keys(value).map(name => ({
        name,
        value: valueToMeta(value[name], contextId, optimizeSimpleObject, registry)
      }))
    };
  } else {
    return {
      type: 'value',
      value
    };
  }
}

