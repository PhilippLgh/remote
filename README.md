# remote

[![CircleCI](https://circleci.com/gh/PhilippLgh/remote.svg?style=svg)](https://circleci.com/gh/PhilippLgh/remote)

The `remote` module allows a process to get a handle/reference on an object that lives on a different process. It is based on Electron's `remote` module but uses async communication to make it available to Node.js and browser applications.
All operations, performed on a proxy instance are synchronized over inter-process communication (IPC) with the original instance.
`remote` implements the necessary synchronization protocols, defines IPC messages and has different transport layer implementations based on the use case and environment.

## Why?
Syntactic sugar. `remote` helps to achieve more natural and elegant API's and interfaces that abstract from error prone messaging and synchronization like: 
```javascript
process.send('xyz', x)
process.on('message', ...) 
child.send({})
emit('action-performed')
x.on('something-happened', () => { /* sync state */ })
worker.postMessage(message, [transfer])
ipcMain.on('asynchronous-do-x',(event, arg) => {})
ipcRenderer.sendSync('synchronous-message', 'ping') 
```
Just like Java RMI, it can be considered the object-oriented equivalent to remote procedure calls (RPC) in JavaScript.

# Installation

```
not ready yet
```

# Usage

## parent.js
```javascript
const { Server } = require('@philipplgh/remote')

// we want all child processes to be able to access this functionality
class Api {
  number = 10 // some shared state
  addNumberAsync(num: number): Promise<number> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        resolve(this.number+num)
      }, 3000)
    })
  }
}

// create a new child process e.g. with Node.js fork
// each process has its own memory and their own V8 instance
const child = fork('path/to/child_process.js', [], {
  // with 'ipc' we establish a communication channel between the two processes
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'] 
})

// we use a server to make objects available to other processes
const server = new Server(transport)

// whitelists the child process and allows server to communicate with child
server.add(child)

// make a new instance of Api available with name 'api'
server.expose(new Api(), 'api')
```

## child_process.js
```javascript
const { Client } = require('@philipplgh/remote')
//
const client = new Client()

const api = await client.getRemote('api')

const number = await api.addNumberAsync(42)
assert.equal(number, 52) // true
```
## Instance types

### Remote instances (constructor calls)
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

### Global instances (accessed by name)
```javascript
// in master:
+-----------------------------+
| const foo = new Foo()       |
| foo.name = 'Shared Foo'     |
| remote.expose(foo, 'foo')   |
+-----------------------------+

                  +--------+  foo -> { type: 'foo', name: 'Shared Foo', counter: 3 }
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

# Electron
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

## Reactivity
A common use case in Electron applications is to have a data source on the main process and have a reactive UI framework like React or Vue bind to this source and listen for changes.
Due to the nature of the remote module, the UI initialization will work but all subsequent changes are "lost".

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