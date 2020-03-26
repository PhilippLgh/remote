export interface IObjectRegistry {
  add: (value: any, contextId?: string) => string
  get: (id: string) => any
}

export class ObjectRegistry implements IObjectRegistry {
  _objects: any = {}
  _currentId = 100
  add(obj: any, contextId?: string): string {
    // generate new id
    const id = ++this._currentId
    this._objects[id] = obj
    return `${id}`
  }
  get(oid: string) {
    return this._objects[oid]
  }
}