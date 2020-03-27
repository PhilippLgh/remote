import { ObjectRegistry, IObjectRegistry } from './ObjectRegistry'
import { isPromise } from '../utils'
import { CallbacksRegistry } from '../CallbacksRegistry'
import { v8Util } from '../v8Util'

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

export type MetaTypeNumber = {
  type: 'number',
  value: number
}

export type MetaTypeBoolean = {
  type: 'boolean',
  value: boolean
}

export type MetaTypeString = {
  type: 'string',
  value: string
}

export type MetaTypeBigInt = {
  type: 'bigint',
  value: bigint
}

export type MetaTypeSymbol = {
  type: 'symbol',
  value: symbol
}

export type MetaTypeUndefined = {
  type: 'undefined',
  value: undefined
}

// TODO revisit name
export type MetaTypeValue = {
  type: 'value',
  value: any,
}

export type MetaTypeBuffer = {
  type: 'buffer',
  value: Uint8Array,
}

export type MetaTypeError = {
  type: 'error',
  value: Error,
  members: ObjectMember[]
}

export type MetaTypePromise = {
  type: 'promise',
  then: MetaType
}

export type MetaTypeArray = {
  type: 'array',
  members: MetaType[]
}

export type MetaTypeObjectFunction = {
  type: 'object' | 'function',
  name: string,
  members: ObjectMember[],
  proto: ObjProtoDescriptor,
  id: string,
}

/* Client Types */
export type MetaTypeRemoteObject = {
  type: 'remote-object',
  id: number
}

export type MetaTypeFunction = {
  type: 'callback',
  id: string,
  location: string,
  length: number
}

export type MetaTypeFunctionReturnValue = {
  type: 'function-with-return-value',
  value: MetaType
}

export type MetaTypeObject = {
  type: 'object',
  name: string,
  members: { name: string, value: MetaType }[]
}

/*  end client types */

export type MetaType = MetaTypeNumber | MetaTypeBoolean | MetaTypeString
  | MetaTypeBigInt | MetaTypeSymbol | MetaTypeUndefined | MetaTypeObjectFunction
  | MetaTypeValue | MetaTypeBuffer | MetaTypeArray | MetaTypeError | MetaTypePromise
  // client types
  | MetaTypeRemoteObject | MetaTypeObject | MetaTypeFunctionReturnValue | MetaTypeFunction
/*
export type MetaTypeFromClient = MetaTypeValue | MetaTypeRemoteObject | MetaTypeArray 
| MetaTypeBuffer | MetaTypePromise | MetaTypeObject | MetaTypeFunctionReturnValue | MetaTypeFunction
*/

export const instanceOfMeta = (obj: any) : obj is MetaType => 'type' in obj

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

export type AddObjectCallback = (obj: any, contextId: string) => string
export type AddCallbackCallback = (callback: Function) => string

export interface ValueToMetaOptions {
  contextId?: string,
  optimizeSimpleObject?: false
  isArgument?: boolean,
  visited?: Set<any>,
  addObject?: AddObjectCallback,
  addCallback?: AddCallbackCallback
}

// Convert a real value into meta data.
export const valueToMeta = (value: any, {
  contextId = '1',
  optimizeSimpleObject = false,
  isArgument = false,
  visited = new Set(),
  addObject = () => { throw new Error('No addObject() callback provided but required during serialization') },
  addCallback = () => { throw new Error('No addCallback() callback provided but required during serialization') }
} : ValueToMetaOptions = {}): MetaType => {

  const options : ValueToMetaOptions = {
    contextId,
    optimizeSimpleObject,
    isArgument,
    visited,
    addObject,
    addCallback
  }
  
  // Check for circular reference.
  if (visited.has(value)) {
    return {
      type: 'value',
      value: null
    };
  }

  // console.log('value to meta', value)
  // Determine the type of value.
  let type: MetaType['type'] = typeof value;

  if (type === 'object') {
    // Recognize certain types of objects.
    if (value instanceof Buffer) {
      return {
        type: 'buffer',
        value
      };
    }
    else if (Array.isArray(value)) {
      return {
        type: 'array',
        members: value.map((el: any) => valueToMeta(el, options))
      }
    }
    else if (value instanceof Error) {
      return {
        type: 'error',
        value,
        members: Object.keys(value).map(name => ({
          name,
          value: valueToMeta((<any>value)[name], options)
        }))
      };
    }
    else if (isSerializableObject(value)) {
      return {
        type: 'value',
        value
      }
    }
    else if (isPromise(value)) {
      // FIXME find better way to distinguish between client and server
      const isClient = options.isArgument
      // Add default handler to prevent unhandled rejections in main process
      // Instead they should appear in the renderer process
      if (isClient) {
        value.then(function () { }, function () { });
      }
      const _val = function (onFulfilled: Function, onRejected: Function) {
        value.then(onFulfilled, onRejected);
      }
      return {
        type: 'promise',
        then: valueToMeta(_val, options)
      }
    }
    else if (hasProp.call(value, 'callee') && value.length != null) {
      // Treat the arguments object as array.
      visited.add(value);
      const meta: MetaType = {
        type: 'array',
        members: value.map((el: any) => valueToMeta(el, options))
      };
      visited.delete(value);
      return meta;
    }
    else if (options.optimizeSimpleObject /* FIXME && v8Util.getHiddenValue(value, 'simple') */) {
      // Treat simple objects as value.
      return {
        type: 'value',
        value
      }
    }
  }

  if (options.isArgument) {

    if (type === 'function') {
      return {
        type: 'callback',
        id: addCallback(value),
        location: v8Util.getHiddenValue(value, 'location'),
        length: value.length
      }
    } else if (typeof value === 'function' && false /*FIXME && v8Util.getHiddenValue(value, 'returnValue')*/) {
      /*
      return {
        type: 'function-with-return-value',
        value: valueToMetaClient(value(), visited, callbacksRegistry)
      };
      */
      throw new Error('not implemented')
    }
    /* FIXME
    else if (v8Util.getHiddenValue(value, 'atomId')) {
      return {
        type: 'remote-object',
        id: v8Util.getHiddenValue(value, 'atomId')
      };
    }
    */
    // TODO this code assumes that we are wrapping arguments client-side
    if (typeof value === 'object') {
      const meta: MetaType = {
        type: 'object',
        name: value.constructor ? value.constructor.name : '',
        members: []
      };
      visited.add(value);
      for (const prop in value) {
        meta.members.push({
          // @ts-ignore
          name: prop,
          // @ts-ignore
          value: valueToMetaClient(value[prop], visited) as MetaTypeFromClient
        });
      }
      visited.delete(value);
      return meta;
    } else {
      return {
        type: 'value',
        value
      };
    }
  }

  // Fill the meta object according to value's type.
  if (type === 'object' || type === 'function') {
    return {
      type,
      name: value.constructor ? value.constructor.name : '',
      // Reference the original value if it's an object, because when it's
      // passed to renderer we would assume the renderer keeps a reference of it.
      id: addObject(value, contextId),
      members: getObjectMembers(value),
      proto: getObjectPrototype(value)
    };
  } else {
    return {
      type: 'value',
      value
    };
  }
}

