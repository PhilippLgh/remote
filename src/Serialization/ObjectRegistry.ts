export interface IObjectRegistry {
  add: (contextId: string, value: any) => number
  get: (id: number) => any
}

export class ObjectRegistry implements IObjectRegistry {
  _objects: any = {}
  _currentId = 17
  add(contextId: string, obj: any): number {
    // generate new id
    const id = ++this._currentId
    this._objects[id] = obj
    return id
  }
  get(oid: number) {
    return this._objects[oid]
  }
}