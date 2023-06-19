import { h, Component, render, options } from 'preact';
import { useEffect, useState, useRef, useContext, useCallback } from 'preact/hooks';

import { currentComponent } from './state'

// table of message state objects
var messageTable = [];

// stack of active rendering components
var componentStack = []

// string id map
var idMap = new Map()


const addComponent = (state) => {
  messageTable.push(state)
  let p = state.parent
  if (p) {
    state.parent.children.push(state)
  }
}

const removeComponent = (state) => {
  messageTable.splice(messageTable.indexOf(state), 1)
  let p = state.parent
  if (p) {
    p.children.splice(p.children.indexOf(state), 1)
  }
}

const readFromStack = () =>
  componentStack.length > 0 ? componentStack[componentStack.length - 1] : undefined

const matchesSelector = (selector, component) => {
  for (const key in selector) {
    if (selector[key] !== (key === 'instance' ? component.constructor : component.props[key])) {
      return false
    }
  }
  return true
}

class StateObject {
  constructor(compoment, parent) {
    this.preactComponent = compoment
    this.children = []
    this.parent = parent
  }

  exportCallbacks(obj) {
    this.callbacks = obj
  }

  selectById(id) {
    return (idMap.get(id))
  }

  selectFromChildren(selector) {
    let children = this.children
    for (const c of children) {
      if (matchesSelector(selector, c.preactComponent)) {
        return c
      }
    }
    for (const c of children) {
      let result = c.selectFromChildren(selector)
      if (result) {
        return result
      }
    }
    return null;
  }

  selectFromParents(selector) {
    let target = this.parent
    while(target && !matchesSelector(selector, target.preactComponent)) {
      target = target.parent
    }
    return target
  }
}

const API = ['selectById', 'exportCallbacks', 'parent', 'children', 'selectFromChildren', 'selectFromParents', 'preactComponent']

const handler = {
  get: (target, prop) =>
    API.includes(prop) ? target[prop] : target.callbacks[prop]
}

const createStateProxy = () => {
  const innerObject = new StateObject(currentComponent, readFromStack())
  return (new Proxy(innerObject, handler))
}

export const useMessageSystem = (id) => {
  const state = useRef()
  if (!state.current) {
    state.current = createStateProxy()
    addComponent(state.current)
    if (id) {
      idMap.set(id, state.current)
    }
  }
  componentStack.push(state.current)
  useEffect(() => {
    componentStack.pop()
  })
  useEffect(() => {
    return () => {
      removeComponent(state.current)
      if (id) {
        idMap.delete(id)
      }
    }
  }, [])
  return state.current
}
