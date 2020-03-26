# remote

# remote module in Node.js
This project aims to make the `remote` module that is part of the Electron framework available to regular Node.js applications.
The `remote` module allows a process to get a handle/reference on an object that lives on a different process.
All operations, performed on this proxy instance are synchronized over (IPC) messages with the original instance.

### Remote instances
```javascript
                  +--------+  w1-> { type: 'foo', name: 'Worker 1', counter: 1 }
                  | Master |  w2-> { type: 'foo', name: 'Worker 2', counter: 1 }
                  +--------+  w3-> { type: 'foo', name: 'Worker 3', counter: 1 }
                  ^   ^    ^
                 /    |     \
                /     |      \
               /      |       \
              /       |        \
  +----------+   +----------+   +----------+
  | Worker 1 |   | Worker 2 |   | Worker 3 |
  +----------+   +----------+   +----------+

// in each worker:
+-----------------------------------+
| const { Foo } = require('remote') |
| const foo = new Foo()             |
| foo.name = worker.name            |
| foo.counter++                     |
+-----------------------------------+
```

### Global instances
```javascript
// in master:
+-----------------------------+
| const foo = new Foo()       |
| foo.name = 'Shared Foo'     |
| remote.expose(foo, 'foo')   |
+-----------------------------+

                  +--------+  _main-> { type: 'foo', name: 'Shared Foo', counter: 3 }
                  | Master |  
                  +--------+  
                  ^   ^    ^
                 /    |     \
                /     |      \
               /      |       \
              /       |        \
  +----------+   +----------+   +----------+
  | Worker 1 |   | Worker 2 |   | Worker 3 |
  +----------+   +----------+   +----------+

// in each worker:
+-------------------------------------+
| const remote = require('remote')    |
| const foo = remote.getRemote('foo') |
| foo.counter++                       |
+-------------------------------------+
```

### "Thread" Safety
Please note that `remote` currently has no synchronization mechanisms.
This means that shared state can be accessed and modified in arbitrary order.
This code (see example above) is therefore not guaranteed to pass the test:

```javascript
const remote = require('remote')    
const foo = remote.getRemote('foo') 
assert.equal(foo.counter, 0) // true
foo.counter++ 
assert.equal(foo.counter, 1) // can be false
```

# remote module in Electron
Electron is a multi-process framework with one main process and multiple renderer processes.

Electron's built-in `remote` module allows to share objects between multiple processes similar to Java's RMI:
>The remote module provides a simple way to do inter-process communication (IPC) between the renderer process (web page) and the main process.

It allows to interact with objects that are only available on the main process from renderer processes in a very natural way. All the details about IPC are abstracted and handled by the module.

In this example, the process accessing BrowserWindow is actually creating an object instance on a different process and only has access to a proxy instance:
```javascript
const { BrowserWindow } = require('electron').remote
let win = new BrowserWindow({ width: 800, height: 600 })
win.loadURL('https://github.com')
```

# Serialization
The serialization module handles serialization and de-serialization of objects.
Unlike serialization using `JSON.stringify`/`JSON.parse` objects "survive" this process. 
However, there is only one main instance of an object. All deserialized instances will be proxies pointing to the original instance.

The serialization works by creating a meta representation of the original instance.

## Example:
```typescript
class FooFather {
  public age: number = 100
}

class Foo extends FooFather {
  public name: string = 'foo'
  get message() {
    return 'hello'
  }
  constructor() {
    super()
  }
  getNumber(num: number): number {
    return num
  }
  async getBar(): Promise<Bar> {
    return new Bar()
  }
}

const foo = new Foo()
const meta = valueToMeta(foo)
```

### Serialized object (meta representation):
```JSON
{
  "type": "object",
  "name": "Foo",
  "id": 18,
  "members": [
    {
      "name": "name",
      "enumerable": true,
      "writable": true,
      "type": "get"
    }
  ],
  "proto": {
    "members": [
      {
        "name": "constructor",
        "enumerable": false,
        "writable": false,
        "type": "method"
      },
      {
        "name": "getNumber",
        "enumerable": true,
        "writable": false,
        "type": "method"
      },
      {
        "name": "getBar",
        "enumerable": true,
        "writable": false,
        "type": "method"
      }
    ],
    "proto": null
  }
}
```

Serialization is a recursive process.
It has some mechanisms to detect circular references and processing.

## Objects
Since objects are not serialized as a whole but only their interface is used to create a proxy they live on only one process.
When a new object is serialized (during recursive serialization) the serializer asks for an id. This id is used in all communications to reference the object. Objects therefore need to be stored in an `ObjectsRegistry`.

## Functions
Functions can be used as regular functions or in arguments as callbacks.
We want their meta type to reflect this but without additional context this is not possible:
`typeof <function>` will not be callback without this extra context.
If the serializer discovers a callback it will similar to objects ask for an id to reference the callback.
Callbacks are managed in the `CallbacksRegistry`.

# IPC

## Remote Server
The server class allows to expose objects to other processes.
It also keeps track of new instances that are created in this process and their lifecycle.

```typescript
export interface IRemoteServer {
  getMember(contextId: string, objectId: string, name: string) : any;
  setMember(contextId: string, objectId: string, name: string, args: any[]) : any;
  callMember(contextId: string, objectId: string, method: string, args: any[]) : any;
  memberConstructor(contextId: string, objectId: string, method: string, args: any[]) : any;
  functionCall(contextId: string, objectId: string, args: any[]) : any;
  constructorCall(contextId: string, objectId: string, args: any[]) : any;
}
```

## Remote Client

The client has to implement an interface that 1:1 corresponds to the server.
During de-serialization, the serializer ask for information that is only available on the server process,
which needs to be fetched to construct the proxy instances.

```typescript
export interface IAsyncRemoteClient {
  getRemoteMember: (metaId: string, memberName: string) => Promise<any>
  setRemoteMember: (metaId: string, memberName: string, value: any) => Promise<void>
  callRemoteMember: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteMemberConstructor: (metaId: string, memberName: string, args: any[]) => Promise<any>
  callRemoteFunction: (metaId: string, args: any[]) => Promise<any>
  callRemoteConstructor: (metaId: string, args: any[]) => Promise<any>
}
```

## Transport
The transport layer needs to be bi-directional. For most operations, the client will only tell the server what actions to perform on the managed remote objects.
Therefore, the client will send request-response like message like "set object member x to y", "get object member x", ...
The exception are however callbacks (and therefore also promises). The server therefore should send a message to the client once a callback has finished to avoid polling.