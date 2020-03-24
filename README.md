# remote

# remote module in Node.js
This project aims to make the `remote` module that is part of the Electron framework available to regular Node.js applications.
The `remote` module allows a process to get a handle/reference on an object that lives on a different process.
All operations, performed on this proxy instance are synchronized over (IPC) messages with the original instance.

# remote module in Electron
Electron is a multi-process framework with one main process and multiple renderer processes.

Electron's built-in `remote` module allows to share objects between multiple processes similar to Java's RMI:
> The remote module provides a simple way to do inter-process communication (IPC) between the renderer process (web page) and the main process.

It allows to interact with objects that are only available on the main process from renderer processes in a very natural way. All the details about IPC are abstracted and handled by the module.

In this example, the process accessing BrowserWindow is actually creating an object instance on a different process and only has access to a Proxy instance:
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

Example:
```javascript
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

